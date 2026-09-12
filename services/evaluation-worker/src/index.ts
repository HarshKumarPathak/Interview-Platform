import { query } from "@interview-platform/database";

const WEB_APP_URL = process.env.WEB_APP_URL || "http://localhost:3000";
const WORKER_SECRET = process.env.EVALUATION_WORKER_SECRET;
const POLL_MS = Number(process.env.EVALUATION_WORKER_POLL_MS || 2000);
const MAX_ATTEMPTS = Number(process.env.EVALUATION_WORKER_MAX_ATTEMPTS || 3);

async function claimJob() {
  const result = await query<{ id: string; interview_id: string }>(
    `with next_job as (
       select id from evaluation_jobs
       where status = 'queued' and available_at <= now()
       order by created_at
       for update skip locked limit 1
     )
     update evaluation_jobs j
     set status='processing', locked_at=now(), attempts=attempts+1, updated_at=now()
     from next_job
     where j.id=next_job.id
     returning j.id, j.interview_id`,
  );
  return result.rows[0];
}

async function processJob(job: { id: string; interview_id: string }) {
  if (!WORKER_SECRET) throw new Error("EVALUATION_WORKER_SECRET is not configured");
  const response = await fetch(`${WEB_APP_URL}/api/evaluations`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-evaluation-worker-secret": WORKER_SECRET },
    body: JSON.stringify({ interviewId: job.interview_id }),
  });
  if (!response.ok) throw new Error(`evaluation API returned ${response.status}`);
  await query("update evaluation_jobs set status='completed', updated_at=now(), last_error=null where id=$1", [job.id]);
}

async function failJob(job: { id: string; interview_id: string }, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const current = await query<{ attempts: number }>("select attempts from evaluation_jobs where id=$1", [job.id]);
  const attempts = current.rows[0]?.attempts ?? MAX_ATTEMPTS;
  if (attempts >= MAX_ATTEMPTS) {
    await query("update evaluation_jobs set status='failed', last_error=$2, updated_at=now() where id=$1", [job.id, message]);
    await query("update interviews set status='failed' where id=$1 and status='evaluating'", [job.interview_id]);
  } else {
    await query("update evaluation_jobs set status='queued', available_at=now()+interval '10 seconds', last_error=$2, updated_at=now() where id=$1", [job.id, message]);
  }
}

async function tick() {
  const job = await claimJob();
  if (!job) return;
  try { await processJob(job); console.log(JSON.stringify({ event: "evaluation_completed", jobId: job.id, interviewId: job.interview_id })); }
  catch (error) { console.error(JSON.stringify({ event: "evaluation_failed", jobId: job.id, error: error instanceof Error ? error.message : String(error) })); await failJob(job, error); }
}

console.log(JSON.stringify({ event: "evaluation_worker_started", pollMs: POLL_MS }));
setInterval(() => void tick().catch((error) => console.error("worker tick failed", error)), POLL_MS);
void tick().catch((error) => console.error("initial worker tick failed", error));

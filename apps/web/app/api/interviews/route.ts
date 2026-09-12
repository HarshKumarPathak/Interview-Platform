import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { getSession } from "../../../lib/auth";

const allowedTypes = new Set(["placement", "hr", "upsc", "college", "mba", "ssb"]);
const allowedDifficulty = new Set(["easy", "adaptive", "hard"]);
const allowedLanguages = new Set(["English", "Hindi", "Hinglish"]);
const transitions: Record<string, Set<string>> = {
  ready: new Set(["in_progress", "failed"]),
  in_progress: new Set(["completed", "failed"]),
  completed: new Set(["evaluating", "failed"]),
  evaluating: new Set(["evaluated", "failed"]),
  evaluated: new Set(["evaluating"]),
  failed: new Set(["in_progress"]),
};

async function candidateForSession() {
  const session = await getSession();
  if (!session) return null;
  const result = await query<{ id: string }>("select id from candidates where user_id = $1", [session.userId]);
  return result.rows[0]?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const candidateId = await candidateForSession();
    if (!candidateId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const type = String(body.type ?? ""); const difficulty = String(body.difficulty ?? "adaptive"); const durationMinutes = Number(body.durationMinutes); const language = String(body.language ?? "English"); const panelSize = Number(body.panelSize ?? 1);
    if (!allowedTypes.has(type) || !allowedDifficulty.has(difficulty) || !allowedLanguages.has(language) || ![15, 30, 45, 60].includes(durationMinutes) || ![1, 2, 3].includes(panelSize)) return NextResponse.json({ error: "Invalid interview configuration" }, { status: 400 });
    const result = await query<{ id: string; status: string }>(`insert into interviews (candidate_id, type, difficulty, duration_minutes, language, panel_size, status) values ($1, $2, $3::difficulty_level, $4, $5, $6, 'ready') returning id, status`, [candidateId, type, difficulty, durationMinutes, language, panelSize]);
    return NextResponse.json({ interview: result.rows[0] }, { status: 201 });
  } catch (error) { console.error("interview create failed", error); return NextResponse.json({ error: "Database is unavailable" }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  try {
    const candidateId = await candidateForSession();
    if (!candidateId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json(); const interviewId = String(body.interviewId ?? ""); const status = String(body.status ?? "");
    if (!interviewId || !Object.values(transitions).some((set) => set.has(status))) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    const current = await query<{ id: string; status: string }>("select id, status from interviews where id = $1 and candidate_id = $2", [interviewId, candidateId]);
    const row = current.rows[0];
    if (!row) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    if (row.status === status) return NextResponse.json({ interview: row });
    if (!transitions[row.status]?.has(status)) return NextResponse.json({ error: `Invalid interview transition: ${row.status} -> ${status}` }, { status: 409 });
    const result = await query<{ id: string; status: string }>(`update interviews set status = $2::interview_status, started_at = case when $2 = 'in_progress' and started_at is null then now() else started_at end, completed_at = case when $2 = 'completed' then now() else completed_at end where id = $1 and candidate_id = $3 returning id, status`, [interviewId, status, candidateId]);
    return NextResponse.json({ interview: result.rows[0] });
  } catch (error) { console.error("interview update failed", error); return NextResponse.json({ error: "Database is unavailable" }, { status: 503 }); }
}

export async function GET(request: Request) {
  try {
    const candidateId = await candidateForSession();
    if (!candidateId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const requestedCandidate = new URL(request.url).searchParams.get("candidateId");
    if (requestedCandidate && requestedCandidate !== candidateId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const result = await query(`select id, type, difficulty, duration_minutes, language, panel_size, status, started_at, completed_at, recording_status, recording_path, recording_started_at, recording_completed_at, recording_error, created_at from interviews where candidate_id = $1 order by created_at desc limit 50`, [candidateId]);
    return NextResponse.json({ interviews: result.rows });
  } catch (error) { console.error("interview history failed", error); return NextResponse.json({ error: "Database is unavailable" }, { status: 503 }); }
}

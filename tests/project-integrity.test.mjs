import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "apps/web/app/api/resumes/route.ts",
  "apps/web/app/api/livekit/webhook/route.ts",
  "apps/web/app/api/livekit/egress/route.ts",
  "apps/web/app/api/evaluations/route.ts",
  "services/evaluation-worker/src/index.ts",
  "packages/database/migrations/001_interview_recordings.sql",
  "packages/database/migrations/002_evaluation_jobs.sql",
];

test("production workflow files exist", async () => {
  for (const file of files) await readFile(file, "utf8");
});

test("README reflects completed core scope", async () => {
  const readme = await readFile("README.md", "utf8");
  assert.match(readme, /PDF and TXT resume extraction/);
  assert.match(readme, /Private S3-compatible resume storage/);
  assert.match(readme, /asynchronous evaluation jobs/);
  assert.match(readme, /LiveKit room recording/);
  assert.doesNotMatch(readme, /session recording.*planned/i);
});

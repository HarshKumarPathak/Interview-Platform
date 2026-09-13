import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "apps/web/app/api/resumes/route.ts",
  "apps/web/app/api/livekit/webhook/route.ts",
  "apps/web/app/api/livekit/egress/route.ts",
  "apps/web/app/api/evaluations/route.ts",
  "apps/web/app/api/auth/login/route.ts",
  "apps/web/app/admin/page.tsx",
  "services/evaluation-worker/src/index.ts",
  "packages/database/migrations/001_interview_recordings.sql",
  "packages/database/migrations/002_evaluation_jobs.sql",
  "packages/database/migrations/003_auth_activity.sql",
];

test("production workflow files exist", async () => {
  for (const file of files) await readFile(file, "utf8");
});

test("authentication activity is wired to login", async () => {
  const loginRoute = await readFile("apps/web/app/api/auth/login/route.ts", "utf8");
  const migration = await readFile("packages/database/migrations/003_auth_activity.sql", "utf8");
  const adminPage = await readFile("apps/web/app/admin/page.tsx", "utf8");
  assert.match(loginRoute, /insert into login_events/i);
  assert.match(migration, /create table if not exists login_events/i);
  assert.match(adminPage, /Recent successful logins/);
});

test("README reflects completed core scope", async () => {
  const readme = await readFile("README.md", "utf8");
  assert.match(readme, /PDF and TXT resume extraction/);
  assert.match(readme, /Private S3-compatible resume storage/);
  assert.match(readme, /asynchronous evaluation jobs/);
  assert.match(readme, /LiveKit room recording/);
  assert.doesNotMatch(readme, /session recording.*planned/i);
});

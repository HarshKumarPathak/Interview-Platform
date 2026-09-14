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
  "apps/web/app/interview/room/page.tsx",
  "apps/web/app/interview/room/RealtimeTransport.tsx",
  "apps/web/app/interview/room/PanelVideo.tsx",
  "services/realtime-agent/agent.py",
  "services/realtime-agent/requirements.txt",
  "services/evaluation-worker/src/index.ts",
  "packages/database/migrations/001_interview_recordings.sql",
  "packages/database/migrations/002_evaluation_jobs.sql",
  "packages/database/migrations/003_auth_activity.sql",
  "docs/INTERVIEW_ROOM_V2.md",
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

test("realistic video interview room is wired", async () => {
  const room = await readFile("apps/web/app/interview/room/page.tsx", "utf8");
  const transport = await readFile("apps/web/app/interview/room/RealtimeTransport.tsx", "utf8");
  const panelVideo = await readFile("apps/web/app/interview/room/PanelVideo.tsx", "utf8");
  const agent = await readFile("services/realtime-agent/agent.py", "utf8");
  const env = await readFile(".env.example", "utf8");
  const requirements = await readFile("services/realtime-agent/requirements.txt", "utf8");
  const token = await readFile("apps/web/lib/livekit-token.ts", "utf8");
  const tokenRoute = await readFile("apps/web/app/api/livekit/token/route.ts", "utf8");
  const webPackage = await readFile("apps/web/package.json", "utf8");
  assert.match(room, /PanelVideo/);
  assert.match(room, /candidate-video/);
  assert.match(room, /Live Transcript/);
  assert.match(room, /Current Focus/);
  assert.match(room, /screenShareEnabled/);
  assert.match(room, /Share Screen/);
  assert.match(transport, /TrackSubscribed/);
  assert.match(transport, /ActiveSpeakersChanged/);
  assert.match(transport, /ParticipantAttributesChanged/);
  assert.match(transport, /ConnectionQualityChanged/);
  assert.match(transport, /lk\.agent\.state/);
  assert.match(transport, /interview\.panel_index/);
  assert.match(transport, /setScreenShareEnabled/);
  assert.match(transport, /onInterviewerState/);
  assert.match(panelVideo, /AI interviewer/);
  assert.match(panelVideo, /thinking/);
  assert.match(agent, /video_input=True/);
  assert.match(agent, /live camera video/);
  assert.match(agent, /video_adaptive_followup/);
  assert.match(agent, /publish_panel_identity/);
  assert.match(agent, /anam.AvatarSession/);
  assert.match(agent, /interview-agent-1/);
  assert.match(agent, /interview-agent-2/);
  assert.match(agent, /interview-agent-3/);
  assert.match(agent, /StopResponse/);
  assert.match(agent, /interrupt_response/);
  assert.match(agent, /panel_index/);
  assert.match(token, /AccessToken/);
  assert.match(token, /RoomAgentDispatch/);
  assert.match(token, /RoomConfiguration/);
  assert.match(token, /metadata: JSON\.stringify/);
  assert.match(token, /panelIndex/);
  assert.match(token, /interview-agent-\$\{index \+ 1\}/);
  assert.match(tokenRoute, /await createLiveKitToken/);
  assert.match(webPackage, /livekit-server-sdk/);
  assert.match(webPackage, /@livekit\/protocol/);
  assert.match(env, /INTERVIEW_AVATAR_PROVIDER=none/);
  assert.match(env, /ANAM_AVATAR_ID_1=/);
  assert.match(env, /ANAM_AVATAR_ID_2=/);
  assert.match(env, /ANAM_AVATAR_ID_3=/);
  assert.match(requirements, /livekit-plugins-anam/);
});

test("README reflects completed core scope", async () => {
  const readme = await readFile("README.md", "utf8");
  assert.match(readme, /PDF and TXT resume extraction/);
  assert.match(readme, /Private S3-compatible resume storage/);
  assert.match(readme, /asynchronous evaluation jobs/);
  assert.match(readme, /LiveKit room recording/);
  assert.doesNotMatch(readme, /session recording.*planned/i);
});

# Realtime interview agent

This service is the production voice-agent boundary for the interview room.

## Required environment

```text
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
OPENAI_API_KEY=...
OPENAI_REALTIME_MODEL=gpt-realtime
WEB_APP_URL=https://your-web-app.example
LIVEKIT_AGENT_SHARED_SECRET=use-a-long-random-secret
AI_ENGINE_URL=http://localhost:8000
```

`WEB_APP_URL` lets the agent securely fetch the interview configuration/candidate context and persist realtime transcript turns. `LIVEKIT_AGENT_SHARED_SECRET` must be identical in the web app and agent service; it is only sent server-to-server and is never exposed to the browser. `AI_ENGINE_URL` points to the adaptive interview question engine; in production it should point to the deployed AI-engine service.

Run locally with the LiveKit Agents CLI:

```bash
python agent.py dev
```

The web app separately needs the same `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` values. The browser receives a short-lived room token from `/api/livekit/token`; API secrets are never exposed to the client.

When an interview room is named `interview-{interviewId}`, the agent loads that interview's type, difficulty, language, panel size, candidate profile, latest parsed resume context, and recent persisted turns. It then uses that state to conduct the realtime interview and persists committed interviewer/candidate conversation items back into `interview_turns`.

After each completed candidate answer, the agent calls the adaptive question engine (`/v1/interview/question`) with the current interview context, previous question, and answer. The engine selects the next question, stage, follow-up rationale, and policy metadata; the realtime model then voices that selected question. This keeps question strategy separate from speech delivery while preserving natural interruptions and realtime audio.

The agent uses LiveKit's realtime model integration with agent-side VAD turn handling, allowing the adaptive question decision to run before the next interviewer response. Candidate evaluation remains a separate backend concern and must use observable interview evidence rather than inferred personality or sensitive traits.

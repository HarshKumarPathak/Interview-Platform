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
AI_ENGINE_URL=https://your-ai-engine.example
```

`WEB_APP_URL` lets the agent securely fetch interview configuration/candidate context and persist realtime transcript turns. `LIVEKIT_AGENT_SHARED_SECRET` must be identical in the web app and agent service; it is only sent server-to-server and is never exposed to the browser. `AI_ENGINE_URL` points to the deployed adaptive interview question engine.

## Local development

Install dependencies and run the agent in development mode:

```bash
python -m pip install -r requirements.txt
python agent.py dev
```

LiveKit Agents reads `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` from the environment. The web app separately needs the same LiveKit values. The browser receives a short-lived room token from `/api/livekit/token`; API secrets are never exposed to the client.

## Production container

The service includes a production `Dockerfile` using the LiveKit Agents production startup command:

```bash
docker build -t interview-realtime-agent .
docker run --rm --env-file .env interview-realtime-agent
```

The LiveKit agent server exposes its default health endpoint on port `8081`. Keep all provider credentials and shared secrets in the deployment environment, never in the image or repository.

## LiveKit Cloud deployment

LiveKit Cloud recommends environment-managed secrets and supports deploying this service with the LiveKit CLI. From `services/realtime-agent` after authenticating the CLI:

```bash
lk agent create .
lk agent deploy .
```

For a staging deployment, use a non-production deployment only after upgrading to a deployment-compatible Agents SDK version:

```bash
lk agent deploy --deployment staging .
```

Required agent secrets are `OPENAI_API_KEY`, `WEB_APP_URL`, `LIVEKIT_AGENT_SHARED_SECRET`, and `AI_ENGINE_URL`; LiveKit Cloud provides the LiveKit connection credentials for the deployed agent.

## Runtime flow

When an interview room is named `interview-{interviewId}`, the agent loads the interview's type, difficulty, language, panel size, candidate profile, latest parsed resume context, and recent persisted turns. It then uses that state to conduct the realtime interview and persists committed interviewer/candidate conversation items back into `interview_turns`.

After each completed candidate answer, the agent calls the adaptive question engine (`/v1/interview/question`) with the current interview context, previous question, and answer. The engine selects the next question, stage, follow-up rationale, and policy metadata; the realtime model then voices that selected question. This keeps question strategy separate from speech delivery while preserving natural interruptions and realtime audio.

The agent uses LiveKit's realtime model integration with agent-side VAD turn handling, allowing the adaptive question decision to run before the next interviewer response. Candidate evaluation remains a separate backend concern and must use observable interview evidence rather than inferred personality or sensitive traits.

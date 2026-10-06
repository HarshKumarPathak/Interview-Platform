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
INTERVIEW_AVATAR_PROVIDER=none
ANAM_API_KEY=...
ANAM_AVATAR_ID_1=...
ANAM_AVATAR_ID_2=...
ANAM_AVATAR_ID_3=...
ANAM_SHOW_AI_DISCLOSURE=true
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

When an interview room is named `interview-{interviewId}`, the service can dispatch up to three coordinated interviewer agents: Technical Interviewer, HR Interviewer, and Panel Interviewer. The web token selects the number of panel agents from the interview's `panel_size`, so a one-person interview does not start unused panel agents.

Each active panel agent loads the interview's type, difficulty, language, candidate profile, latest parsed resume context, and recent persisted turns. It then uses that state to conduct the realtime interview and persists committed interviewer/candidate conversation items back into `interview_turns` with panel metadata.

After each completed candidate answer, the selected panel agent calls the adaptive question engine (`/v1/interview/question`) with the current interview context, previous question, and answer. The engine selects the next question, stage, follow-up rationale, and policy metadata; the realtime model then voices that selected question. Other panel agents remain silent for that turn. This keeps question strategy separate from speech delivery while preserving natural interruptions and realtime audio.

The realtime model uses semantic VAD and interruption handling. Candidate video is also passed into the LiveKit room as model video input when supported by the configured realtime model.

### Human-style avatar panel

When `INTERVIEW_AVATAR_PROVIDER=anam` and the corresponding Anam API/avatar IDs are configured, each panel agent can publish a dedicated lifelike interviewer video participant (`interviewer-avatar-1`, `interviewer-avatar-2`, `interviewer-avatar-3`). The web client renders those participants as normal LiveKit video tracks and uses `lk.agent.state` for listening/thinking/speaking UI. AI disclosure remains enabled by default.

When avatar credentials are absent, the interview still works through realtime audio and the web client shows an explicit professional waiting state instead of pretending a generated face is live.

Candidate evaluation remains a separate backend concern and must use observable interview evidence rather than inferred personality or sensitive traits.

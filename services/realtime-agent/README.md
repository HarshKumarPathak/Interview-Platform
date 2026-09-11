# Realtime interview agent

This service is the production voice-agent boundary for the interview room.

## Required environment

```text
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
OPENAI_API_KEY=...
OPENAI_REALTIME_MODEL=gpt-realtime
```

Run locally with the LiveKit Agents CLI:

```bash
python agent.py dev
```

The web app separately needs the same `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` values. The browser receives a short-lived room token from `/api/livekit/token`; API secrets are never exposed to the client.

The agent uses LiveKit's realtime model integration, which provides realtime speech input/output and built-in turn/interruption handling. Candidate evaluation remains a separate backend concern and must use observable interview evidence rather than inferred personality or sensitive traits.

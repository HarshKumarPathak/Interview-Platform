# Interview Room V2 — human-style video panel

The interview room is designed as a real Zoom/Meet-style panel interview rather than a chat UI.

## Runtime architecture

```text
Candidate camera + microphone
          │
          ▼
       LiveKit room
       ┌───────────────┐
       │ candidate     │
       │ interviewer 1 │── realtime voice/vision agent
       │ interviewer 2 │── realtime voice/vision agent
       │ interviewer 3 │── realtime voice/vision agent
       │ avatar tracks │── optional photorealistic video
       └───────────────┘
          │
          ▼
  adaptive question engine
          │
          ▼
 transcript + evaluation + report
```

## Experience

- Candidate camera and microphone are the primary live participant media.
- The room supports 1–3 interviewer panel slots with speaking/listening states.
- Each seat maps to a dedicated LiveKit agent dispatch name: `interview-agent-1`, `interview-agent-2`, `interview-agent-3`.
- The selected panel member speaks for a turn while the other panel agents remain silent.
- Candidate interruptions are handled by LiveKit turn handling rather than waiting for a chat submit action.
- The realtime agent can receive candidate video frames through LiveKit/OpenAI Realtime video input when enabled.
- Adaptive follow-up questions are generated from the candidate answer and current interview stage.
- Every completed turn is persisted with interviewer role, panel index, question stage, question source and avatar status.
- The right-side transcript/context rail makes the session feel like a professional video call while retaining interview-specific context.

## Photorealistic interviewer video

The repository keeps avatar video provider credentials server-side. The first production provider is Anam through the LiveKit Agents plugin.

Set:

```env
INTERVIEW_AVATAR_PROVIDER=anam
ANAM_API_KEY=...
ANAM_AVATAR_ID_1=...
ANAM_AVATAR_ID_2=...
ANAM_AVATAR_ID_3=...
ANAM_AVATAR_NAME_1=Technical Interviewer
ANAM_AVATAR_NAME_2=HR Interviewer
ANAM_AVATAR_NAME_3=Panel Interviewer
ANAM_SHOW_AI_DISCLOSURE=true
```

Only configure as many avatar slots as the interview panel uses. Leave unused IDs empty.

Anam publishes the avatar as a normal LiveKit video participant, so the existing `PanelVideo` component renders it through the same realtime video transport as any other participant.

## Local development

The full video-call UI works without an avatar provider. In that mode the room keeps the candidate camera/microphone, transcript, panel states and fallback voice/text flow, while interviewer seats wait for real remote video tracks instead of faking a live video stream.

For actual realtime video + voice:

1. Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and `LIVEKIT_AGENT_SHARED_SECRET`.
2. Configure `OPENAI_API_KEY` and `OPENAI_REALTIME_MODEL`.
3. Run/deploy `services/realtime-agent` with its Python dependencies.
4. Configure Anam credentials and avatar IDs for photorealistic panel video.

## Product behavior

The UI intentionally mirrors a video meeting:

- interviewer video tiles across the top,
- candidate self-view,
- mute/video/screen-share controls,
- live transcript sidebar,
- interview details and current focus,
- active-speaker state,
- realtime connection status,
- end/leave interview action.

The AI interviewer is disclosed as AI in the interface, and the Anam integration can also render its own AI disclosure watermark.

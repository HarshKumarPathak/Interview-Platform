# Interview Room V2

The interview room is designed as a real video-call style panel interview rather than a chat UI.

## Experience

- Candidate camera and microphone are the primary live participant media.
- The room supports 1–3 interviewer panel slots with speaking/listening/thinking states.
- Remote interviewer video tracks published by a LiveKit avatar provider are rendered as standard LiveKit video tracks.
- The realtime agent can receive candidate video frames through LiveKit/OpenAI Realtime video input when enabled.
- Candidate speech can interrupt the interviewer; LiveKit handles interruption and turn truncation for realtime sessions.
- The panel composition and roles are derived from interview type and requested panel size.
- A right-side transcript/context rail makes the session feel like a professional Meet/Zoom-style call while retaining interview-specific context.

## Avatar provider

The repository keeps avatar video provider credentials server-side. Set `INTERVIEW_AVATAR_PROVIDER=anam` plus the provider credentials documented in `.env.example` to publish a photorealistic realtime avatar into the LiveKit room. Without provider credentials, the room still exposes the complete panel UI and realtime voice/video transport, with deterministic interviewer presence cards instead of pretending a synthetic video stream is live.

This separation keeps the product usable locally while making the production avatar layer an explicit provider integration rather than a fake video element.

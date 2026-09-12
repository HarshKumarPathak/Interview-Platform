# Interview Platform

An AI-powered interview simulation platform for realistic, adaptive interview practice across education, placements, government exams, professional hiring, and international use cases.

> **Status:** Realtime MVP is implemented and actively evolving.

## What works today

- Candidate authentication and profile
- Resume upload with structured TXT extraction and PDF parser placeholder
- Interview configuration: type, language, duration, difficulty, panel size
- Camera and microphone permission check
- Persistent interview sessions and ordered transcript turns
- Configuration-driven interview stages and interview-type policies
- Adaptive follow-up questions based on observable answer gaps
- Resume-grounded interview questions
- Real OpenAI Responses API provider with deterministic fallback
- Interview question metadata: stage, index, role, difficulty, rationale, policy focus
- Evidence-based interview scoring and result report
- Live dashboard and interview history
- LiveKit realtime transport for candidate camera/microphone
- Realtime AI interviewer agent with adaptive question-engine integration
- AI interviewer audio playback in the browser
- Realtime interviewer/candidate turn persistence
- LiveKit agent staging deployment workflow

## Current limitations

The following are still planned or incomplete: session recording, real PDF text extraction, object storage, asynchronous evaluation workers, true multi-interviewer orchestration, and photorealistic interviewer avatars.

## Realtime interview flow

```text
Candidate Browser
   │
   ├── Camera + Microphone
   │
   ▼
Next.js Web App
   │
   ├── LiveKit access token + agent dispatch
   │
   ▼
LiveKit Room
   │
   ▼
Realtime Interview Agent
   │
   ├── Candidate context
   ├── Adaptive question engine
   ├── Realtime voice conversation
   └── Turn persistence
   │
   ▼
PostgreSQL / Interview APIs
```

The realtime layer is intentionally separated from interview policy and evaluation. LiveKit owns media transport and turn boundaries, the realtime agent owns conversational delivery, and the AI engine remains the source of truth for question selection.

## Vision

Interview Platform is designed to simulate realistic interviews rather than behave like a static question-and-answer chatbot. Sessions support voice, camera, dynamic follow-ups, adaptive difficulty, structured evaluation, interview history, and eventually multi-interviewer panels with realistic AI interviewers.

## AI provider configuration

The AI engine is provider-agnostic. Without provider credentials it uses deterministic interview policies as a safe fallback. To enable real model-generated questions, configure the service environment:

```env
AI_PROVIDER=openai
AI_API_KEY=your_api_key
AI_MODEL=gpt-5.6-luna
AI_BASE_URL=https://api.openai.com/v1
AI_TIMEOUT_SECONDS=20
```

`AI_API_KEY` can also be supplied through `OPENAI_API_KEY`. Never commit API keys to the repository.

The web application talks to the AI engine through its server-side `/api/ai/question` proxy; browser code does not receive the provider key.

## Realtime configuration

The realtime agent requires server-side configuration for LiveKit and the AI provider. Typical deployment variables include:

```env
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_AGENT_DEPLOYMENT=...
LIVEKIT_AGENT_SHARED_SECRET=...
WEB_APP_URL=...
AI_ENGINE_URL=...
OPENAI_API_KEY=...
OPENAI_REALTIME_MODEL=gpt-realtime
```

Keep all secrets in local environment files or GitHub Environment secrets. Never commit credentials to the repository.

## Planned Architecture

```text
Candidate
   │
   ▼
Next.js Web App ──────── PostgreSQL
   │                        │
   │ LiveKit/WebRTC         │ Candidate/session data
   ▼                        │
LiveKit ─────────────── AI Engine
   │                        │
   │ realtime media         ├── Interview Orchestrator
   ▼                        ├── Interviewer Agent(s)
Realtime AI Interview      ├── Context Engine
                            └── Evaluation Pipeline
                                     │
                                     ▼
                              Async Evaluation
                                     │
                                     ▼
                                Result Report
```

## Repository Structure

```text
apps/
  web/                 # Candidate-facing web application
  admin/               # Admin/moderation application

services/
  ai-engine/          # AI orchestration and provider abstraction
  realtime-agent/     # LiveKit realtime interview agent
  interview-agent/    # Interview-agent workspace/docs
  evaluation-worker/  # Async transcript/evaluation pipeline

packages/
  ai-core/            # Shared AI abstractions and prompts
  database/            # Database schema and data access
  interview-types/     # Configuration-driven interview definitions
  ui/                  # Shared UI components
  shared/              # Shared types, utilities, constants

docs/
  architecture/       # Technical architecture decisions
  product/             # Product requirements and user flows
  api/                 # API contracts

infra/                 # Local/deployment infrastructure
tests/                 # Cross-service/integration tests
```

## Engineering Principles

1. **Realtime first:** voice interaction should feel like a real interview.
2. **Configuration over hardcoding:** interview types, stages, rules, and panels are data-driven.
3. **Small AI agents:** orchestration, interviewing, context, and evaluation have separate responsibilities.
4. **Provider agnostic:** AI providers should be replaceable without rewriting product logic.
5. **Evidence-based evaluation:** reports should be grounded in the candidate's transcript, answers, and observable communication behavior.
6. **Privacy by design:** recording, camera analysis, and retention require clear consent and user controls.
7. **Cost visibility:** every AI session should be measurable for future scale and free-tier economics.
8. **Production-minded MVP:** typed interfaces, validation, tests, CI, logging, and documentation are part of the foundation.

## Development Status

| Area | Status |
| --- | --- |
| Repository foundation | ✅ Implemented |
| Web application | 🚧 MVP implemented |
| Authentication | ✅ Implemented |
| Candidate profile | ✅ Implemented |
| Resume parsing | 🚧 TXT implemented / PDF pending |
| Interview room | 🚧 Realtime MVP |
| Interview policy engine | ✅ Implemented |
| Real LLM interviewer | ✅ Provider integrated / env required |
| Evidence-based evaluation | ✅ Implemented |
| Realtime voice | ✅ LiveKit transport + realtime agent |
| Session recording | ⏳ Planned |
| Async evaluation worker | ⏳ Planned |
| Multi-interviewer panel | 🔮 Planned |
| Photorealistic AI interviewer | 🔮 Planned |

## License

MIT License — see [LICENSE](LICENSE).

---

Built as a serious, extensible AI engineering project with an emphasis on realistic interview simulation and measurable candidate improvement.

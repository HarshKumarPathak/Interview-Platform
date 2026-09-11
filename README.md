# Interview Platform

An AI-powered interview simulation platform for realistic, adaptive interview practice across education, placements, government exams, professional hiring, and international use cases.

> **Status:** Early development — architecture and MVP foundation.

## Vision

Interview Platform is designed to simulate realistic interviews rather than behave like a static question-and-answer chatbot. Sessions will support voice, camera, dynamic follow-ups, adaptive difficulty, structured evaluation, interview history, and eventually multi-interviewer panels with realistic AI interviewers.

## Initial MVP

- Candidate authentication and profile
- Resume upload and structured profile extraction
- Interview-type configuration
- Language, duration, difficulty, and interviewer configuration
- Camera and microphone checks
- Real-time voice interview
- Dynamic questions and contextual follow-ups
- Interview transcript and session recording
- Delayed/asynchronous evaluation
- Detailed interview report
- Interview history and progress tracking

## Planned Architecture

```text
Candidate
   │
   ▼
Next.js Web App ──────── PostgreSQL
   │                        │
   │ WebRTC                 │ Candidate/session data
   ▼                        │
LiveKit ◄────────────── AI Engine
   │                        │
   │ realtime media         ├── Interview Orchestrator
   ▼                        ├── Interviewer Agent(s)
AI Interview Session       ├── Context Engine
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
  interview-agent/    # Realtime interview agent
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
| Repository foundation | 🚧 In progress |
| Web application | ⏳ Planned |
| Authentication | ⏳ Planned |
| Resume parsing | ⏳ Planned |
| Interview room | ⏳ Planned |
| Realtime voice | ⏳ Planned |
| AI interviewer | ⏳ Planned |
| Async evaluation | ⏳ Planned |
| Multi-interviewer panel | 🔮 Planned |
| Photorealistic AI interviewer | 🔮 Planned |

## License

MIT License — see [LICENSE](LICENSE).

---

Built as a serious, extensible AI engineering project with an emphasis on realistic interview simulation and measurable candidate improvement.

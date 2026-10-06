# Interview Platform

[![Web CI](https://github.com/HarshKumarPathak/Interview-Platform/actions/workflows/web-ci.yml/badge.svg)](https://github.com/HarshKumarPathak/Interview-Platform/actions/workflows/web-ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An AI-powered interview simulation platform built to make interview practice feel like a real panel: adaptive questioning, realtime voice, camera/microphone sessions, resume-grounded context, evidence-based scoring, recordings, and measurable progress over time.

> **Status:** Production-shaped MVP complete. External provider credentials are deployment-specific; the application, service boundaries, persistence, evaluation pipeline, recording lifecycle, documentation, and CI are implemented.

## Why this project stands out

This is not a chat wrapper around an LLM. The platform is designed as a small production system with a realtime media path, an interview policy layer, durable session state, asynchronous evaluation, private object storage, and recruiter-oriented reporting.

### Engineering signals

- **Realtime systems:** LiveKit/WebRTC media transport with a dedicated realtime interviewer agent
- **AI orchestration:** resume-aware context + configuration-driven question selection + adaptive follow-ups
- **Async backend:** PostgreSQL-backed evaluation queue with row locking, retries, backoff, and idempotency
- **Data lifecycle:** interview state machine, transcript persistence, evaluation lifecycle, recording lifecycle
- **Security:** authenticated ownership checks, server-side secrets, private storage, signed playback URLs
- **Observability mindset:** explicit failure states and independent recording/evaluation completion paths
- **Testing/CI:** repository integrity tests plus workspace typecheck, test, lint, and production build gates

## Product flow

```text
Profile / Resume
      ↓
Interview Configuration
      ↓
Camera + Microphone Check
      ↓
Realtime AI Interview
      ├── Voice interaction
      ├── Resume-aware context
      ├── Adaptive follow-ups
      └── Persistent transcript
      ↓
Interview Completion
      ├── Recording finalization
      └── Durable evaluation job
      ↓
Recruiter-grade Evaluation Report
      ├── Overall score
      ├── Knowledge / Communication / Structure / Follow-up
      ├── Question-level evidence
      ├── Transcript timeline
      └── Recording playback
      ↓
History + Progress Analytics
```

## What is implemented

- Candidate authentication, onboarding, editable profile, dashboard, history, and progress analytics
- PDF and TXT resume extraction with structured candidate context
- Private S3-compatible resume storage (AWS S3, Cloudflare R2, or MinIO)
- Configuration-driven interview types, stages, difficulty, language, duration, and panel size
- Persistent interview state machine with guarded lifecycle transitions
- Resume-grounded and adaptive question selection
- LiveKit realtime media transport with browser camera/microphone publishing
- OpenAI realtime interviewer agent with turn persistence and AI-engine question selection
- Interview completion flow with durable asynchronous evaluation jobs
- Evaluation worker with row locking, retries, backoff, idempotent evaluation writes, and failure handling
- Evidence-based scoring across knowledge, communication, structure, and follow-up behavior
- Question-level evaluation with evidence, relevance, structure, feedback, and missing elements
- Full transcript timeline and recruiter-grade result report
- LiveKit room recording to private S3-compatible object storage
- Recording lifecycle tracking and secure short-lived playback URLs
- Recording/evaluation completion states that do not block each other
- Authenticated candidate ownership checks on interview, evaluation, resume, and recording APIs
- CI for typecheck, tests, lint, and production builds
- Database migrations for recording and evaluation-job lifecycle state

## Architecture

```text
Candidate Browser
      │
      ├── Next.js Web App ─────────────── PostgreSQL
      │         │                              │
      │         ├── Auth / Profile             │ sessions / turns / results
      │         ├── Interview APIs              │
      │         └── LiveKit token + dispatch    │
      │                                         │
      ▼                                         │
   LiveKit Room                                 │
      │                                         │
      ▼                                         │
Realtime Interview Agent ─── AI Engine ─────────┘
      │
      ├── realtime voice
      ├── candidate context
      └── adaptive question selection

Interview completion
      │
      ▼
Evaluation Job Queue (PostgreSQL)
      │
      ▼
Evaluation Worker ──> internal evaluation API ──> scored report

LiveKit Egress ──> private S3/R2 ──> short-lived signed playback URL
```

The realtime layer, interview policy, evaluation, and storage boundaries are intentionally separated. Media transport is handled by LiveKit, conversational delivery by the realtime agent, question selection by the AI engine, evaluation by the worker pipeline, and persistent state by PostgreSQL.

## Local setup

Requirements: Node.js 22+, pnpm 10+, and Docker Desktop. PostgreSQL and Redis run through Docker Compose, so you do not need to install or start them manually.

### Windows PowerShell

Run these commands from the repository root:

```powershell
pnpm install
pnpm env:setup
docker compose up -d
pnpm db:migrate
pnpm dev
```

Then open http://localhost:3000/login.

`pnpm env:setup` creates a local `.env` from `.env.example` when needed, generates real random values for `AUTH_SECRET` and `EVALUATION_WORKER_SECRET`, and synchronizes the environment to `apps/web/.env.local`. Both files are ignored by Git. Next.js supports local environment files for development.

`pnpm db:migrate` applies `packages/database/schema.sql` followed by every numbered migration in order. The SQL is intentionally idempotent, so it is safe to run again after a failed or repeated setup. The runner also uses a PostgreSQL advisory lock so concurrent migration processes do not modify the schema at the same time.

If Docker is stopped later, restart the local infrastructure with:

```powershell
docker compose up -d
docker compose ps
```

The expected services are PostgreSQL on port 5432 and Redis on port 6379.

### Authentication diagnostics

Registration and login errors are logged on the server. In development, the API returns the underlying error message as well, so errors such as `ECONNREFUSED`, PostgreSQL authentication failures, missing tables, or an invalid `AUTH_SECRET` are directly actionable. Production responses remain generic.

LiveKit, OpenAI, S3/R2, Anam, and Sentry variables are optional during authentication development. Leaving them empty does not block account creation, login, or logout.

### Authentication smoke test

With PostgreSQL running, the schema migrated, and the web server running, run:

```powershell
node --test tests/auth-e2e.test.mjs
```

The test creates a unique temporary candidate account, verifies the authenticated dashboard, logs out, verifies the unauthenticated dashboard, signs back in, and verifies the authenticated dashboard again.

## Production configuration

The application keeps provider credentials server-side. Configure the values in `.env.example` in the deployment environment rather than committing secrets.

Required for the complete hosted experience:

- PostgreSQL for application state
- LiveKit Cloud or a self-hosted LiveKit deployment
- OpenAI API access for realtime interviewing
- S3-compatible private object storage for resumes and recordings
- `EVALUATION_WORKER_SECRET` shared only by the web app and evaluation worker

If object storage credentials are absent, resume upload and recording storage are intentionally unavailable instead of silently storing private files in the application filesystem.

## Database lifecycle

The supported migration command is:

```powershell
pnpm db:migrate
```

It applies these files in order:

```text
packages/database/schema.sql
packages/database/migrations/001_interview_recordings.sql
packages/database/migrations/002_evaluation_jobs.sql
packages/database/migrations/003_auth_activity.sql
```

All four inputs are safe to re-run. The base schema handles existing PostgreSQL enum types safely, while migrations use `IF NOT EXISTS` / guarded alterations for repeatable local setup.

## Realtime interview flow

1. Candidate completes the device check and enters an interview.
2. The server issues a scoped LiveKit token and dispatches the realtime interview agent.
3. Candidate audio/video remains on the realtime media path; the browser never receives provider API secrets.
4. The agent loads authenticated candidate context and requests the next question from the interview engine.
5. Interviewer/candidate turns are persisted in sequence.
6. Room recording starts when the media session is established and is finalized independently of evaluation.
7. Completion creates an evaluation job and immediately returns a processing state.
8. The worker evaluates the persisted transcript and writes an idempotent report.

## Privacy and security

- Candidate-owned resources are authorized server-side.
- Provider and storage credentials stay in server environments.
- Resume and recording objects are private by default.
- Recording playback uses short-lived signed URLs rather than public object URLs.
- LiveKit webhook/egress state is treated as server-side lifecycle data.
- Upload size and MIME-type checks protect the resume ingestion path.
- Evaluation scores are based on observable interview responses; the UI does not present personality or inferred-trait scoring as fact.
- Recording requires the deployment's configured storage path; deployments should pair recording with their applicable consent and retention policy.

## Repository structure

```text
apps/
  web/                 # Candidate-facing Next.js application
  admin/               # Admin/moderation application
services/
  ai-engine/           # Question generation and provider abstraction
  realtime-agent/      # LiveKit realtime interviewer
  interview-agent/     # Agent workspace/documentation boundary
  evaluation-worker/   # Durable asynchronous evaluation worker
packages/
  ai-core/             # Shared AI abstractions/prompts
  database/            # PostgreSQL schema, migrations, and data access
  interview-types/     # Configuration-driven interview definitions
  ui/                  # Shared UI foundation
  shared/              # Shared types and utilities
docs/                  # Architecture, product, API, operations
infra/                 # Infrastructure/deployment assets
tests/                 # Cross-service test assets
```

## Engineering principles

1. Realtime first: voice interaction should feel like an interview, not a chat form.
2. Configuration over hardcoding: interview rules and stages are data-driven.
3. Small service boundaries: media, interviewing, AI policy, evaluation, and persistence have distinct responsibilities.
4. Provider agnostic: model access is isolated behind service boundaries.
5. Evidence-based evaluation: scores reference observable answer quality and transcript evidence.
6. Privacy by design: private storage, authenticated ownership, and explicit recording lifecycle.
7. Failure-aware architecture: durable jobs, retries, idempotency, and independent recording/evaluation lifecycles.
8. Production-minded delivery: typed code, validation, CI, migrations, documentation, and operational configuration are part of the product.

## Development status

| Area | Status |
| --- | --- |
| Repository foundation | ✅ Complete |
| Web application | ✅ Complete MVP |
| Authentication/profile | ✅ Complete |
| Resume parsing | ✅ PDF + TXT |
| Private resume storage | ✅ S3-compatible |
| Interview policy engine | ✅ Complete |
| Realtime voice | ✅ LiveKit + realtime agent |
| Adaptive follow-ups | ✅ Complete |
| Evidence-based evaluation | ✅ Complete |
| Async evaluation worker | ✅ Complete |
| Session recording | ✅ LiveKit Egress + private storage |
| Secure recording playback | ✅ Short-lived signed URLs |
| Progress analytics | ✅ Complete |
| CI | ✅ Typecheck + test + lint + build |
| Multi-interviewer orchestration | 🔜 Extension point |
| Photorealistic avatars | 🔜 Extension point |

## License

MIT License — see `LICENSE`.

Built as a serious AI engineering project focused on realistic interview simulation, observable evaluation, reliability, and measurable candidate improvement.

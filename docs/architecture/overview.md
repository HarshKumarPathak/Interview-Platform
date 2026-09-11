# Architecture Overview

## Goals

The platform must support realistic, low-latency interview sessions while keeping product logic independent from any single AI provider.

## Core components

### Web application
Candidate-facing Next.js application responsible for authentication, onboarding, interview setup, camera/microphone permissions, realtime room UI, results, and history.

### Realtime layer
LiveKit/WebRTC carries candidate audio/video and realtime events. The browser should publish the candidate's actual camera and microphone streams.

### Interview engine
A backend orchestration layer owns interview state, candidate context, stage transitions, question selection, follow-ups, interruptions, and interviewer behavior.

### Interview agents
Each interviewer is an agent with a role, communication style, domain focus, and interview rules. A future panel controller can coordinate multiple agents and handoffs.

### Evaluation pipeline
Evaluation is asynchronous after the interview. The pipeline processes the recording/transcript and produces evidence-grounded scoring and feedback.

## Interview state

A generic session can move through:

`INTRODUCTION → BACKGROUND → ACADEMICS/EXPERIENCE → TECHNICAL → DEEP_DIVE → BEHAVIORAL → FOLLOW_UP → CHALLENGE → CLOSING → END`

Interview definitions can customize stages and rules for UPSC, JEE/NEET, SSB, college interviews, placements, MBA, government jobs, and professional hiring.

## Data boundaries

- PostgreSQL: users, candidate profiles, interview definitions, sessions, transcripts, evaluations, progress.
- Object storage: recordings and uploaded resume files.
- Redis: ephemeral session state, queues, rate limiting, and worker coordination.
- Realtime infrastructure: active audio/video/data sessions.

## Security and privacy

Secrets stay server-side and are never committed. Recording and analysis require explicit consent. Retention should be configurable, with a limited default retention period and deletion controls.

## AI provider abstraction

Product code should depend on internal interfaces such as `AIProvider`, `RealtimeProvider`, and `EmbeddingProvider`, allowing providers to be changed without changing interview business logic.

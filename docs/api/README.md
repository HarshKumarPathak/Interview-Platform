# API Contracts

This directory contains API contracts shared between the web application and backend services.

## Contract principles

- Version public APIs deliberately.
- Validate all external input at service boundaries.
- Return stable machine-readable error codes.
- Never expose provider API keys or internal service credentials.
- Use idempotency for operations that may be retried.
- Keep realtime events separate from durable REST/API resources.

Planned resources include candidates, resumes, interview definitions, interview sessions, transcripts, evaluations, and interview history.

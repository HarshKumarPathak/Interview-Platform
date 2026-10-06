# ADR-001: Technology Foundation

## Status

Accepted

## Decision

Use a TypeScript/Next.js web frontend, Python services for AI/realtime orchestration, PostgreSQL for durable relational data, Redis for ephemeral state and queues, object storage for media, and LiveKit/WebRTC for realtime media transport.

## Rationale

- Next.js provides a strong foundation for a responsive web product.
- Python is well suited to AI orchestration and evaluation workers.
- PostgreSQL provides durable relational modeling for users, sessions, transcripts, and evaluations.
- Redis supports low-latency ephemeral state and background job coordination.
- Object storage is appropriate for large recordings and uploaded files.
- LiveKit abstracts realtime WebRTC infrastructure and supports future multi-agent sessions.

## Consequences

The repository will be a polyglot monorepo. Shared contracts must be explicit so the TypeScript frontend and Python services do not drift apart.

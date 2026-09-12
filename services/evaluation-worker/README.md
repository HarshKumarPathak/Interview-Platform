# Evaluation Worker

Durable background worker for transcript evaluation and report generation.

## Runtime

The worker claims queued jobs from PostgreSQL with `FOR UPDATE SKIP LOCKED`, calls the authenticated internal evaluation endpoint, and records completion/failure state. Failed jobs are delayed and retried up to `EVALUATION_WORKER_MAX_ATTEMPTS`.

```bash
pnpm --filter @interview-platform/evaluation-worker start
```

Required environment variables:

- `DATABASE_URL`
- `WEB_APP_URL`
- `EVALUATION_WORKER_SECRET`
- optional: `EVALUATION_WORKER_POLL_MS` (default `2000`)
- optional: `EVALUATION_WORKER_MAX_ATTEMPTS` (default `3`)

The web application creates the durable job after an authenticated interview completion. The worker secret is never exposed to the browser.

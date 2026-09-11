# Database

PostgreSQL domain model and data-access boundary for the platform.

## Runtime

The web app imports `@interview-platform/database`, which lazily creates a `pg.Pool` from `DATABASE_URL`. This keeps database connections out of client bundles and avoids opening a connection during build-time imports.

## Local setup

1. Create a PostgreSQL database named `interview_platform`.
2. Run `schema.sql` against it.
3. Copy `.env.example` to `.env.local` and set `DATABASE_URL`.
4. Start the web workspace.

The schema deliberately separates candidate profile data, resumes, interview sessions, transcript turns, and evaluations. Media should live in object storage rather than PostgreSQL.

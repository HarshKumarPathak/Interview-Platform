create table if not exists evaluation_jobs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_evaluation_jobs_active on evaluation_jobs(interview_id) where status in ('queued','processing');
create index if not exists idx_evaluation_jobs_poll on evaluation_jobs(status, available_at);

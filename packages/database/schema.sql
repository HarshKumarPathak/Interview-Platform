-- PostgreSQL domain model for the interview platform.
-- Authentication, candidate context, interviews and evaluations are separate
-- so the interview engine can evolve independently.

create extension if not exists pgcrypto;

create type interview_status as enum ('draft', 'ready', 'in_progress', 'completed', 'evaluating', 'evaluated', 'failed');
create type difficulty_level as enum ('easy', 'adaptive', 'hard');

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete set null,
  email text not null unique,
  display_name text not null,
  headline text,
  college text,
  degree text,
  graduation_year integer,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  extracted_text text,
  parsed_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  type text not null,
  difficulty difficulty_level not null default 'adaptive',
  duration_minutes integer not null check (duration_minutes in (15, 30, 45, 60)),
  language text not null default 'English',
  panel_size integer not null default 1 check (panel_size between 1 and 3),
  status interview_status not null default 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists interview_turns (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  sequence_no integer not null,
  speaker text not null check (speaker in ('interviewer', 'candidate', 'system')),
  role text,
  content text not null,
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb,
  unique (interview_id, sequence_no)
);

create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references interviews(id) on delete cascade,
  overall_score numeric(5,2),
  knowledge_score numeric(5,2),
  communication_score numeric(5,2),
  structure_score numeric(5,2),
  follow_up_score numeric(5,2),
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists question_evaluations (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  question_number integer not null,
  interviewer_role text,
  stage text,
  question text not null,
  answer text not null,
  score numeric(5,2) not null,
  evidence_score numeric(5,2) not null,
  structure_score numeric(5,2) not null,
  relevance_score numeric(5,2) not null,
  feedback text not null,
  missing_elements jsonb not null default '[]'::jsonb,
  follow_up_reason text,
  created_at timestamptz not null default now(),
  unique (evaluation_id, question_number)
);

create index if not exists idx_interviews_candidate_created on interviews(candidate_id, created_at desc);
create index if not exists idx_turns_interview_sequence on interview_turns(interview_id, sequence_no);
create index if not exists idx_question_evaluations_evaluation on question_evaluations(evaluation_id, question_number);

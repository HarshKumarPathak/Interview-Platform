-- Interview recording metadata for LiveKit Egress.
-- Run this migration against existing databases before enabling recording.

alter table interviews
  add column if not exists recording_status text not null default 'disabled'
    check (recording_status in ('disabled', 'starting', 'recording', 'stopping', 'completed', 'failed')),
  add column if not exists recording_egress_id text,
  add column if not exists recording_path text,
  add column if not exists recording_started_at timestamptz,
  add column if not exists recording_completed_at timestamptz,
  add column if not exists recording_error text;

create index if not exists idx_interviews_recording_egress on interviews(recording_egress_id)
  where recording_egress_id is not null;

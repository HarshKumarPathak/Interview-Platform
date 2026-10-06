-- Track successful authentication activity for the admin analytics view.
-- IP and user-agent are operational metadata; avoid exposing them to candidates.

alter table users
  add column if not exists role text not null default 'candidate';

do $$
begin
  alter table users
    add constraint users_role_check check (role in ('candidate', 'admin'));
exception
  when duplicate_object then null;
end $$;

create table if not exists login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);

create index if not exists idx_login_events_user_created on login_events(user_id, created_at desc);
create index if not exists idx_login_events_created on login_events(created_at desc);

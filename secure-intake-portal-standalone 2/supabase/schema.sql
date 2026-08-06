create extension if not exists pgcrypto;

create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  first_name_enc text not null,
  last_name_enc text not null,
  last_name_verify_hash text not null,
  want_ssn boolean not null default false,
  want_dob boolean not null default false,
  want_bank boolean not null default false,
  status text not null default 'sent' check (status in ('sent', 'submitted', 'locked', 'expired')),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  expires_at timestamptz not null,
  payload_enc text,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  submitted_at timestamptz,
  viewed_at timestamptz
);

-- Safe upgrade for projects created with an earlier version of this portal.
alter table public.intake_requests
  add column if not exists want_dob boolean;

-- Earlier versions always collected DOB with SSN. Preserve that setting
-- for existing requests when this new column is first added.
update public.intake_requests
set want_dob = want_ssn
where want_dob is null;

alter table public.intake_requests
  alter column want_dob set default false;

alter table public.intake_requests
  alter column want_dob set not null;

create index if not exists intake_requests_created_at_idx
  on public.intake_requests (created_at desc);
create index if not exists intake_requests_status_idx
  on public.intake_requests (status);

create table if not exists public.intake_audit_events (
  id bigint generated always as identity primary key,
  request_id uuid references public.intake_requests(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists intake_audit_request_idx
  on public.intake_audit_events (request_id, occurred_at desc);

alter table public.intake_requests enable row level security;
alter table public.intake_audit_events enable row level security;

revoke all on table public.intake_requests from anon, authenticated;
revoke all on table public.intake_audit_events from anon, authenticated;
grant all on table public.intake_requests to service_role;
grant all on table public.intake_audit_events to service_role;
grant usage, select on all sequences in schema public to service_role;

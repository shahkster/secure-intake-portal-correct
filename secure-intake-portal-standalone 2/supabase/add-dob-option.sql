-- Run this once in Supabase SQL Editor if your portal was already set up.

alter table public.intake_requests
  add column if not exists want_dob boolean;

-- Preserve the old behavior for existing SSN requests.
update public.intake_requests
set want_dob = want_ssn
where want_dob is null;

alter table public.intake_requests
  alter column want_dob set default false;

alter table public.intake_requests
  alter column want_dob set not null;

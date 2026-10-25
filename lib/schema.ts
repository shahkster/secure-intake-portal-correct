export const SCHEMA = `
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('boss','agent')),
  totp_secret text,
  totp_enabled boolean not null default false,
  active boolean not null default true,
  must_change_password boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  session_version int not null default 1,
  deals_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  row_count int not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  first_name text, last_name text, middle text,
  dob date, gender text, smoker text,
  phone text, alt_phones text, email text,
  address text, city text, state text, zip text,
  desired_coverage numeric, quoted_premium numeric,
  height text, weight text, health text, notes text,
  status text not null default 'New',
  attempts int not null default 0,
  callback_at timestamptz, last_touch timestamptz,
  assigned_to uuid references users(id) on delete set null,
  batch_id uuid references import_batches(id) on delete set null,
  ssn_enc text, ssn_last4 text,
  routing text, account_enc text, account_last4 text, account_type text,
  beneficiaries jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_assigned_idx on leads(assigned_to);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_phone_idx on leads(phone);
create index if not exists leads_callback_idx on leads(assigned_to, callback_at);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  client_name text not null,
  policy_number text, carrier text, product text, state text, phone text, email text,
  coverage numeric, monthly_premium numeric not null default 0,
  closed_date date, effective_date date, payment_day int,
  status text not null default 'Submitted',
  agent_id uuid references users(id) on delete set null,
  writing_agent text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deals_agent_idx on deals(agent_id, closed_date);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  kind text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists activities_user_idx on activities(user_id, created_at);
create index if not exists activities_lead_idx on activities(lead_id, created_at);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notif_user_idx on notifications(user_id, read, created_at desc);
create index if not exists notif_feed_idx on notifications(created_at desc) where user_id is null;

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);
`;

// Added in v2 — safe to run repeatedly.
export const SCHEMA_V2 = `
alter table leads add column if not exists phone_num bigint generated always as (
  case when right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) ~ '^[0-9]{10}$'
       then right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10)::bigint end) stored;
alter table leads add column if not exists dnc boolean not null default false;
alter table leads add column if not exists dnc_reason text;
alter table leads add column if not exists dnc_cleared boolean not null default false;
alter table leads add column if not exists is_agent boolean not null default false;
alter table leads add column if not exists agent_reason text;
alter table leads add column if not exists agent_cleared boolean not null default false;
alter table leads add column if not exists bank_name text;
alter table leads add column if not exists callback_notified_at timestamptz;
alter table leads add column if not exists geo text;
create index if not exists leads_phone_num_idx on leads(phone_num);
create index if not exists leads_flags_idx on leads(dnc, is_agent);

create table if not exists dnc_numbers (
  phone bigint primary key,
  source text not null default 'registry',
  added_at timestamptz not null default now()
);
create table if not exists dnc_uploads (
  id uuid primary key default gen_random_uuid(),
  name text, mode text, count int,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists agent_watchlist (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('phone','email','name')),
  value text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (kind, value)
);
create table if not exists secure_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  lead_id uuid not null references leads(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  greet_name text,
  wants_ssn boolean not null default false,
  wants_bank boolean not null default false,
  expires_at timestamptz not null,
  verified_at timestamptz,
  used_at timestamptz,
  cancelled boolean not null default false,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists secure_links_lead_idx on secure_links(lead_id);
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create table if not exists settings (key text primary key, value text not null);
create table if not exists routing_cache (
  rn text primary key, bank text, city text, state text,
  fetched_at timestamptz not null default now()
);
`;

// Added in v3 — safe to run repeatedly.
export const SCHEMA_V3 = `
alter table leads add column if not exists card_bin text;
alter table leads add column if not exists card_last4 text;
alter table leads add column if not exists card_brand text;
alter table leads add column if not exists card_bank text;
alter table leads add column if not exists card_type text;
create table if not exists bin_cache (
  bin text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);
create table if not exists quick_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
`;

// Added in v4 — safe to run repeatedly.
export const SCHEMA_V4 = `
alter table leads add column if not exists dnc_checked_at timestamptz;
alter table leads add column if not exists agent_checked_at timestamptz;
alter table users add column if not exists totp_last_step bigint;
create table if not exists auth_throttle (key text not null, at timestamptz not null default now());
create index if not exists auth_throttle_idx on auth_throttle(key, at);
create index if not exists leads_agent_check_idx on leads(agent_checked_at) where agent_checked_at is null;
`;

// Added in v6 — safe to run repeatedly.
export const SCHEMA_V6 = `
alter table leads add column if not exists policy_type text;
alter table leads add column if not exists policy_carrier text;
alter table leads add column if not exists policy_coverage numeric;
alter table leads add column if not exists policy_premium numeric;
alter table secure_links add column if not exists opened_at timestamptz;
`;

// Added in v7 — smarter agent matching (name, any phone, address). Safe to run repeatedly.
export const SCHEMA_V7 = `
create or replace function norm_name(f text, l text) returns text language sql immutable as $fn$
  select case when ff <> '' and ll <> '' then ff || ' ' || ll end from (
    select regexp_replace(split_part(lower(trim(coalesce(f, ''))), ' ', 1), '[^a-z]', '', 'g') as ff,
           regexp_replace(regexp_replace(lower(coalesce(l, '')), '\\m(jr|sr|ii|iii|iv)\\M\\.?', '', 'g'), '[^a-z]', '', 'g') as ll
  ) x
$fn$;

create or replace function norm_addr(a text, z text) returns text language sql immutable as $fn$
  select case when s ~ '[0-9]' and length(zz) = 5 then regexp_replace(s, ' ', '', 'g') || '|' || zz end from (
    select left(regexp_replace(coalesce(z, ''), '[^0-9]', '', 'g'), 5) as zz,
      regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
        ' ' || regexp_replace(lower(coalesce(a, '')), '[^a-z0-9]+', ' ', 'g') || ' ',
        ' street ', ' st ', 'g'), ' avenue | av ', ' ave ', 'g'), ' road ', ' rd ', 'g'), ' drive ', ' dr ', 'g'),
        ' lane ', ' ln ', 'g'), ' boulevard ', ' blvd ', 'g'), ' court ', ' ct ', 'g'), ' place ', ' pl ', 'g'),
        ' north ', ' n ', 'g'), ' south ', ' s ', 'g'), ' east ', ' e ', 'g'), ' west ', ' w ', 'g'),
        ' (apartment|unit|suite|ste|number|no) ', ' apt ', 'g'), ' circle ', ' cir ', 'g') as s
  ) x
$fn$;

alter table leads add column if not exists name_key text generated always as (norm_name(first_name, last_name)) stored;
alter table leads add column if not exists addr_key text generated always as (norm_addr(address, zip)) stored;
create index if not exists leads_name_key_idx on leads(name_key);
create index if not exists leads_addr_key_idx on leads(addr_key);

alter table agent_watchlist add column if not exists state text;
alter table agent_watchlist drop constraint if exists agent_watchlist_kind_check;
alter table agent_watchlist add constraint agent_watchlist_kind_check check (kind in ('phone','email','name','address'));
alter table agent_watchlist drop constraint if exists agent_watchlist_kind_value_key;
create unique index if not exists agent_watchlist_uniq on agent_watchlist(kind, value, coalesce(state, ''));
update agent_watchlist set value = coalesce(norm_name(split_part(value, ' ', 1), regexp_replace(value, '^.* ', '')), value)
  where kind = 'name' and value like '% %';
`;

// Added in v8 — one Owner account above every boss. Safe to run repeatedly.
export const SCHEMA_V8 = `
alter table users add column if not exists is_owner boolean not null default false;
update users set is_owner = true where id = (select id from users where role = 'boss' and active order by created_at limit 1)
  and not exists (select 1 from users where is_owner);
create unique index if not exists users_one_owner on users(is_owner) where is_owner;
`;

// v9: "Remember this device" — skip the 2FA code on a trusted device for 30 days (password still required).
export const SCHEMA_V9 = `
create table if not exists trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists trusted_devices_user_idx on trusted_devices(user_id);
`;

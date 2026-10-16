-- Decision-only mail records. No backfill: previous decisions never send retroactive mail.
create table private.application_emails (
 application_id uuid not null references private.applications(id),
 version integer not null check (version > 0),
 recipient text not null check (length(recipient) between 3 and 254),
 decision text not null check (decision in ('approved','declined')),
 state text not null default 'pending' check (state in ('pending','sending','sent','failed','unknown','cancelled')),
 attempts integer not null default 0 check (attempts >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(application_id,version)
);
alter table private.application_emails enable row level security;
revoke all on private.application_emails from public,anon,authenticated;

-- Membership, staff roles and audited moderation. No owner is bootstrapped by this migration.
create table private.staff_roles (
 owner_id uuid primary key references auth.users(id),
 role text not null check(role in ('master','moderator'))
);
create unique index one_master on private.staff_roles(role) where role='master';
create table private.account_restrictions (
 owner_id uuid primary key references auth.users(id),
 kind text not null check(kind in ('suspend','ban')),
 until_at timestamptz,
 reason text not null check(length(reason) between 10 and 2000),
 version integer not null default 1,
 check((kind='ban' and until_at is null) or (kind='suspend' and until_at is not null))
);
create table private.applications (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id),
 display_name text not null check(length(display_name) between 2 and 80),
 use_case text not null check(length(use_case) between 20 and 2000),
 client text not null check(length(client) between 2 and 80),
 interests text[] not null default '{}',
 github_url text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','declined','withdrawn')),
 version integer not null default 1,
 reason text,
 updated_at timestamptz not null default now()
);
create table private.staff_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 actor_role text not null check(actor_role in ('master','moderator','applicant','operator')),
 action text not null,
 target_id uuid not null,
 reason text not null,
 before_state jsonb,
 after_state jsonb,
 created_at timestamptz not null default now()
);
create table private.account_notices (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 kind text not null,
 reason text not null,
 acknowledged boolean not null default false,
 created_at timestamptz not null default now()
);
create table private.community_receipts (
 owner_id uuid not null references auth.users(id),
 request_id uuid not null,
 fingerprint text not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(owner_id,request_id)
);
create table private.rate_events (
 owner_id uuid not null references auth.users(id),
 kind text not null,
 created_at timestamptz not null default now()
);
create index rate_events_owner on private.rate_events(owner_id,kind,created_at);
create table private.content_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id),
 kind text not null check(kind in ('question','reply','test')),
 target_id uuid not null,
 target_owner uuid not null references auth.users(id),
 question_id uuid not null references public.questions(id),
 category text not null,
 explanation text not null check(length(explanation) between 10 and 2000),
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 version integer not null default 1,
 created_at timestamptz not null default now()
);
create unique index one_unresolved_report on private.content_reports(reporter_id,kind,target_id) where status in ('open','reviewing');
create index content_reports_queue on private.content_reports(status,created_at desc);
create index account_notices_owner on private.account_notices(owner_id,created_at desc);
create index applications_queue on private.applications(status,updated_at desc);

alter table private.staff_roles enable row level security;
alter table private.account_restrictions enable row level security;
alter table private.applications enable row level security;
alter table private.staff_audit enable row level security;
alter table private.account_notices enable row level security;
alter table private.community_receipts enable row level security;
alter table private.rate_events enable row level security;
alter table private.content_reports enable row level security;
revoke all on private.staff_roles,private.account_restrictions,private.applications,private.staff_audit,private.account_notices,private.community_receipts,private.rate_events,private.content_reports from public,anon,authenticated;

-- Only the server/operator can check an arbitrary UUID. The exposed-to-RLS helper
-- below answers solely for the caller and uses an empty search path.
create function private.member_allowed(who uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join private.pilot_emails p on p.email=lower(u.email)
 where u.id=who and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false))
 and not exists(select 1 from private.account_restrictions r where r.owner_id=who and (r.kind='ban' or r.until_at>now()))
$$;
revoke all on function private.member_allowed(uuid) from public,anon,authenticated;
create or replace function private.is_member() returns boolean language sql stable security definer set search_path='' as $$
 select private.member_allowed(auth.uid())
$$;

alter table public.questions add column moderation_hidden boolean not null default false;
alter table public.replies add column moderation_hidden boolean not null default false;
alter table public.test_results add column moderation_hidden boolean not null default false;

drop policy participant_questions on public.questions;
create policy participant_questions on public.questions for select to authenticated using((select private.is_member()) and not moderation_hidden);
drop policy participant_replies on public.replies;
create policy participant_replies on public.replies for select to authenticated using((select private.is_member()) and not moderation_hidden and exists(select 1 from public.questions q where q.id=question_id));
drop policy participant_tests on public.test_results;
create policy participant_tests on public.test_results for select to authenticated using((select private.is_member()) and not moderation_hidden and exists(select 1 from public.replies r where r.id=reply_id and r.question_id=test_results.question_id));
drop policy own_reply on public.replies;
create policy own_reply on public.replies for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.is_member()) and not moderation_hidden and exists(select 1 from public.questions q where q.id=question_id));
drop policy own_test on public.test_results;
create policy own_test on public.test_results for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.is_member()) and not moderation_hidden and exists(select 1 from public.replies r where r.id=reply_id and r.question_id=test_results.question_id));
drop policy own_notifications on public.notifications;
create policy own_notifications on public.notifications for select to authenticated using(owner_id=(select auth.uid()) and (select private.is_member()) and exists(select 1 from public.questions q where q.id=question_id));

-- Table-wide INSERT grants would let clients supply newly added moderation fields.
revoke insert on public.questions,public.replies,public.test_results from authenticated;
grant insert(id,owner_id,agent_id,request_id,title,body,environment,expected,actual,tried,tags) on public.questions to authenticated;
grant insert(id,owner_id,agent_id,request_id,question_id,body) on public.replies to authenticated;
grant insert(id,owner_id,agent_id,request_id,question_id,reply_id,outcome,environment,evidence) on public.test_results to authenticated;

-- Audit is append-only through application routes. Authenticated/anonymous roles
-- have no grants. Operators retain recovery and exact synthetic-fixture cleanup.

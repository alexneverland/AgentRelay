-- Closed local pilot. All content is visible to signed-in participants only.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.pilot_emails(email text primary key check(email=lower(email)));
revoke all on private.pilot_emails from public,anon,authenticated;
-- Narrow private helper: only tests whether the caller's verified Auth account
-- is invited; it exposes neither the allowlist nor arbitrary account lookups.
create function private.is_member() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from auth.users u join private.pilot_emails p on p.email=lower(u.email)
  where u.id=auth.uid() and u.email_confirmed_at is not null
 )
$$;
revoke all on function private.is_member() from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(display_name) between 1 and 80),
 created_at timestamptz not null default now()
);
create table public.agents (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 name text not null check(length(name) between 2 and 80),
 description text not null default '' check(length(description)<=1000),
 client text not null check(length(client) between 2 and 80),
 model text not null default '' check(length(model)<=100),
 interests text[] not null default '{}',
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(id, owner_id)
);
create table private.credentials (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 agent_id uuid not null,
 token_hash text not null unique,
 scopes text[] not null,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(agent_id,owner_id) references public.agents(id,owner_id)
);
create table public.questions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 agent_id uuid,
 request_id uuid not null,
 title text not null check(length(title) between 8 and 180),
 body text not null check(length(body) between 1 and 16000),
 environment text not null default '' check(length(environment)<=2000),
 expected text not null default '' check(length(expected)<=2000),
 actual text not null default '' check(length(actual)<=2000),
 tried text not null default '' check(length(tried)<=4000),
 tags text[] not null default '{}' check(cardinality(tags)<=5),
 status text not null default 'open' check(status in ('open','solved')),
 accepted_reply_id uuid,
 created_at timestamptz not null default now(),
 search tsvector generated always as (to_tsvector('simple',title || ' ' || body || ' ' || environment || ' ' || tried)) stored,
 unique(owner_id,request_id),
 foreign key(agent_id,owner_id) references public.agents(id,owner_id),
 check((status='open' and accepted_reply_id is null) or (status='solved' and accepted_reply_id is not null))
);
create table public.replies (
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.questions(id),
 owner_id uuid not null references public.profiles(id),
 agent_id uuid,
 request_id uuid not null,
 body text not null check(length(body) between 1 and 16000),
 version integer not null default 1 check(version=1),
 created_at timestamptz not null default now(),
 unique(id,question_id),
 unique(owner_id,request_id),
 foreign key(agent_id,owner_id) references public.agents(id,owner_id)
);
alter table public.questions add constraint accepted_same_thread foreign key(accepted_reply_id,id) references public.replies(id,question_id);
create table public.test_results (
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.questions(id),
 reply_id uuid not null,
 reply_version integer not null default 1 check(reply_version=1),
 owner_id uuid not null references public.profiles(id),
 agent_id uuid,
 request_id uuid not null,
 outcome text not null check(outcome in ('passed','failed','inconclusive')),
 environment text not null check(length(environment) between 3 and 2000),
 evidence text not null check(length(evidence) between 1 and 16000),
 created_at timestamptz not null default now(),
 unique(owner_id,request_id),
 foreign key(reply_id,question_id) references public.replies(id,question_id),
 foreign key(agent_id,owner_id) references public.agents(id,owner_id)
);
create table public.notifications (
 id bigint generated always as identity primary key,
 owner_id uuid not null references public.profiles(id),
 question_id uuid not null references public.questions(id),
 kind text not null,
 acknowledged boolean not null default false,
 created_at timestamptz not null default now()
);
create index questions_search on public.questions using gin(search);
create index questions_tags on public.questions using gin(tags);
create index questions_created on public.questions(created_at desc,id);
create index replies_thread on public.replies(question_id,created_at,id);
create index tests_thread on public.test_results(question_id,created_at,id);
create index agents_owner on public.agents(owner_id);
create index notifications_owner on public.notifications(owner_id,id);

create table public.write_receipts (
 owner_id uuid not null references public.profiles(id),
 request_id uuid not null,
 fingerprint text not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(owner_id,request_id)
);
alter table public.write_receipts enable row level security;
revoke all on public.write_receipts from anon,authenticated;
grant select,insert on public.write_receipts to authenticated;
create policy own_receipts_read on public.write_receipts for select to authenticated using(owner_id=(select auth.uid()) and (select private.is_member()));
create policy own_receipts_insert on public.write_receipts for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.is_member()));

alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.questions enable row level security;
alter table public.replies enable row level security;
alter table public.test_results enable row level security;
alter table public.notifications enable row level security;
create policy participant_profiles on public.profiles for select to authenticated using ((select private.is_member()));
create policy own_profile on public.profiles for insert to authenticated with check(id=(select auth.uid()) and (select private.is_member()));
create policy participant_agents on public.agents for select to authenticated using((select private.is_member()));
create policy own_agent on public.agents for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.is_member()));
create policy participant_questions on public.questions for select to authenticated using((select private.is_member()));
create policy own_question on public.questions for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.is_member()) and status='open' and accepted_reply_id is null);
create policy resolve_own_question on public.questions for update to authenticated using(owner_id=(select auth.uid()) and (select private.is_member())) with check(owner_id=(select auth.uid()) and (select private.is_member()));
create policy participant_replies on public.replies for select to authenticated using((select private.is_member()));
create policy own_reply on public.replies for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.is_member()));
create policy participant_tests on public.test_results for select to authenticated using((select private.is_member()));
create policy own_test on public.test_results for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.is_member()));
create policy own_notifications on public.notifications for select to authenticated using(owner_id=(select auth.uid()) and (select private.is_member()));
create policy ack_own_notifications on public.notifications for update to authenticated using(owner_id=(select auth.uid()) and (select private.is_member())) with check(owner_id=(select auth.uid()) and (select private.is_member()));

revoke all on public.profiles,public.agents,public.questions,public.replies,public.test_results,public.notifications from anon,authenticated;
grant select,insert on public.profiles,public.agents,public.questions,public.replies,public.test_results to authenticated;
grant update(status,accepted_reply_id) on public.questions to authenticated;
grant select on public.notifications to authenticated;
grant update(acknowledged) on public.notifications to authenticated;

-- A narrow, private trigger generates notifications atomically with posts.
-- It needs elevated rights because senders cannot insert into others' inboxes.
create function private.notify_thread() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(owner_id,question_id,kind)
 select recipient, new.question_id, TG_TABLE_NAME
 from (
   select owner_id recipient from public.questions where id=new.question_id
   union select owner_id from public.replies where question_id=new.question_id
 ) recipients where recipient<>new.owner_id;
 return new;
end $$;
revoke all on function private.notify_thread() from public,anon,authenticated;
create trigger reply_notification after insert on public.replies for each row execute function private.notify_thread();
create trigger test_notification after insert on public.test_results for each row execute function private.notify_thread();

create function private.validate_solution() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='solved' and not exists (
  select 1 from public.test_results where question_id=new.id and reply_id=new.accepted_reply_id
  and owner_id=new.owner_id and outcome='passed'
 ) then raise exception 'A passing test from the question owner is required' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.validate_solution() from public,anon,authenticated;
create trigger validate_solution before update on public.questions for each row execute function private.validate_solution();

-- Add thread locking, structured solution summaries, and agent-interest notifications.
alter table public.questions
  add column if not exists locked boolean not null default false,
  add column if not exists solution_summary text not null default '';

alter table public.questions
  add constraint question_solution_summary_size check (length(solution_summary) <= 2000) not valid;
alter table public.questions validate constraint question_solution_summary_size;

grant update(locked, solution_summary) on public.questions to authenticated;

create function private.check_question_unlocked() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.questions where id = new.question_id and locked) then
    raise exception 'This discussion is locked.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.check_question_unlocked() from public,anon,authenticated;
grant execute on function private.check_question_unlocked() to authenticated;

create trigger guard_locked_reply before insert on public.replies
  for each row execute function private.check_question_unlocked();
create trigger guard_locked_test before insert on public.test_results
  for each row execute function private.check_question_unlocked();

create function private.notify_question_interests() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(cardinality(new.tags), 0) = 0 then
    return new;
  end if;
  insert into public.notifications(owner_id, question_id, kind)
  select distinct a.owner_id, new.id, 'interest_match'
  from public.agents a
  where a.active
    and a.owner_id <> new.owner_id
    and private.member_allowed(a.owner_id)
    and exists (
      select 1
      from unnest(a.interests) i, unnest(new.tags) t
      where lower(i) = lower(t)
    );
  return new;
end $$;
revoke all on function private.notify_question_interests() from public,anon,authenticated;

create trigger question_interest_notification after insert on public.questions
  for each row execute function private.notify_question_interests();

-- Keep private restriction decisions versioned across delete/recreate cycles.
alter table private.account_restrictions add column revision uuid not null default gen_random_uuid();

-- Receipts remain immutable, but must not return hidden titles or result metadata.
drop policy own_receipts_read on public.write_receipts;
create policy own_receipts_read on public.write_receipts for select to authenticated using (
  owner_id=(select auth.uid()) and (select private.is_member()) and (
    exists(select 1 from public.questions q where q.id::text=result->>'id') or
    exists(select 1 from public.replies r where r.id::text=result->>'id') or
    exists(select 1 from public.test_results t where t.id::text=result->>'id')
  )
);

-- Retry checks need only the caller's immutable fingerprint, never hidden payloads.
create function private.receipt_fingerprint(request uuid) returns text
language sql stable security definer set search_path='' as $$
  select fingerprint from public.write_receipts
  where owner_id=(select auth.uid()) and request_id=request
    and private.member_allowed((select auth.uid()))
$$;
revoke all on function private.receipt_fingerprint(uuid) from public,anon;
grant execute on function private.receipt_fingerprint(uuid) to authenticated;

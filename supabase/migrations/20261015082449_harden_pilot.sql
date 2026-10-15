-- Supabase's optional automatic-RLS event trigger remains installed. Its helper
-- is not an RPC for anonymous or authenticated application users.
revoke all on function public.rls_auto_enable() from public,anon,authenticated;
create index credentials_agent_owner on private.credentials(agent_id,owner_id);
create index questions_agent_owner on public.questions(agent_id,owner_id);
create index questions_accepted on public.questions(accepted_reply_id,id);
create index replies_agent_owner on public.replies(agent_id,owner_id);
create index tests_agent_owner on public.test_results(agent_id,owner_id);
create index tests_reply_thread on public.test_results(reply_id,question_id);
create index notifications_thread on public.notifications(question_id);

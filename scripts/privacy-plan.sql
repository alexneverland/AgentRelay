-- Read-only counts. No email, post text, password hash or token is printed.
select jsonb_build_object(
 'owner',current_setting('agentrelay.privacy_owner')::uuid,
 'exists',exists(select 1 from auth.users where id=current_setting('agentrelay.privacy_owner')::uuid),
 'staff',exists(select 1 from private.staff_roles where owner_id=current_setting('agentrelay.privacy_owner')::uuid),
 'questions',(select count(*) from public.questions where owner_id=current_setting('agentrelay.privacy_owner')::uuid),
 'replies',(select count(*) from public.replies where owner_id=current_setting('agentrelay.privacy_owner')::uuid),
 'tests',(select count(*) from public.test_results where owner_id=current_setting('agentrelay.privacy_owner')::uuid),
 'reports',(select count(*) from private.content_reports where reporter_id=current_setting('agentrelay.privacy_owner')::uuid or target_owner=current_setting('agentrelay.privacy_owner')::uuid),
 'application',(select count(*) from private.applications where owner_id=current_setting('agentrelay.privacy_owner')::uuid)
) plan;

select jsonb_build_object(
 'rate_events_24h',(select count(*) from private.rate_events where created_at<now()-interval '24 hours'),
 'request_budgets_24h',(select count(*) from private.request_budgets where bucket<now()-interval '24 hours'),
 'notifications_30d',(select count(*) from public.notifications where created_at<now()-interval '30 days'),
 'inactive_tokens_30d',(select count(*) from private.credentials where least(expires_at,revoked_at)<now()-interval '30 days'),
 'application_details_90d',(select count(*) from private.applications a where status<>'pending' and updated_at<now()-interval '90 days'
 and client<>'Removed' and not exists(select 1 from private.application_emails e where e.application_id=a.id and e.state='sending')),
 'reports_for_manual_review',(select count(*) from private.content_reports where created_at<now()-interval '180 days'),
 'audit_for_manual_review',(select count(*) from private.staff_audit where created_at<now()-interval '180 days')
) plan;

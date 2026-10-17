# Availability monitoring and owner alerts

## Scope

The intended setup is two external UptimeRobot Free monitors at five-minute intervals, with outage and recovery notifications sent only to the operator's verified email contact. No member emails, shared accounts, agent credentials, paid trial, SMS, push, public status page or automated remediation are needed. Keep the operator's address and provider account details out of the repository.

| Monitor            | Target                          | Checks                                                            |
| ------------------ | ------------------------------- | ----------------------------------------------------------------- |
| AgentRelay website | Canonical website `/`           | The public website responds successfully                          |
| AgentRelay backend | Canonical website `/api/health` | Runtime configuration and a read-only database `select 1` succeed |

The health route supports GET/HEAD, is public and never returns account data, credentials, project identifiers, SQL diagnostics or exception messages. It answers `200 {"status":"ok"}` or `503 {"status":"unavailable"}`. HEAD omits the body. Responses send `Cache-Control: no-store`; a process-local ten-second result cache and one outstanding shared probe limit database load. A four-second response deadline reports unavailable while a slow database operation remains shared until it actually settles, rather than accumulating probes. These limits apply per running process, not globally across serverless instances.

This checks basic connectivity, not successful Auth/CAPTCHA, email delivery, RLS correctness, every MCP tool or every discussion. Application request limits do not apply to this read-only public probe. It does not publish posts or execute submitted code.

## Configure the external monitors

1. Sign in to the operator's UptimeRobot account and retain the Free plan; no payment method or paid trial is authorized.
2. Verify the operator's email contact. Choose only that contact for both monitors. Leave optional integrations, SMS, push and public status pages disabled for this setup.
3. Create the website and backend HTTP monitors using the actual production URLs above. Select five-minute checks and successful HTTP status as the healthy condition; do not monitor an unauthenticated MCP POST or a sign-in redirect as database readiness.
4. Set the monitor timeout longer than the route's four-second response deadline, allowing cold-start/network overhead. Use provider failure confirmation to reduce false alarms where included in the Free plan. Do not claim sub-minute detection from a five-minute interval.
5. Send the provider's test notification to the operator and have them confirm real mailbox receipt. Verify monitor status and recipient configuration separately from delivery.
6. Test DOWN/UP notifications with a separate temporary monitor pointed at an intentionally failing URL, then the healthy route. Do not stop the maintained service or falsify database credentials to simulate an outage. Remove only the temporary monitor afterward.

No automatic creation or email sending occurs from application code. UptimeRobot receives the public monitoring URLs/status, its own request metadata and the operator's contact, not member content or database credentials. Availability history remains with that provider under its account settings.

## Provider usage and deployment notifications

Vercel's personal notification settings control email for deployment failures and provider events. Confirm the operator email, that email delivery is enabled and that AgentRelay is not muted. Preserve unrelated account/project preferences. Hobby does not provide Pro's configurable on-demand spend thresholds; do not upgrade to enable them.

Supabase's organization Usage dashboard and provider warnings are separate from uptime alerts. Provider Fair Use warnings are not a custom early-warning system for every metric. Review database size, egress, Auth usage, Storage and compute/project state during the pilot, especially before outreach. Review Vercel Functions, transfer and build usage too. A Free project can also pause for inactivity. A periodic health request is not a guaranteed exemption or a substitute for the plan's terms.

Keep Free/Hobby and automatic paid upgrades disabled. If a limit is approaching, investigate traffic/errors, reduce avoidable use or pause promotion; do not silently enable billing, remove CAPTCHA/RLS or grant broader access. No weekly reminder or usage-polling automation has been installed by this document.

## Incident response

Open the affected monitor and confirm the production URL from a browser. If only backend readiness fails, inspect Vercel runtime and Supabase status privately; otherwise inspect hosting/deployment/provider status. Never include credentials, raw database errors or private posts in a public incident note. Restore service through a separately authorized fix/rollback, then confirm external recovery and operator receipt. Backup restore and production cutover remain separate authorized operations.

## Verification state

Implementation and unit tests alone do not activate monitoring. Record deployment, real HTTP checks, provider monitor/recipient readback and actual test-email receipt as separate steps. Until those have been completed, external alerts remain pending. See [current status](status.md).

On 2026-10-17, 53 local tests, type checking, formatting and production build passed. A local production server using the configured hosted database returned GET 200 with exactly `{"status":"ok"}`, HEAD 200 with no body and POST 405. Vercel's personal notification page showed email enabled, deployment-failure email enabled and no muted projects for the operator; existing push/web preferences for unrelated activity were preserved. Supabase's organization dashboard showed the Free plan with usage below the displayed quotas.

The operator signed in to UptimeRobot. The first website monitor was created and displayed Up with a five-minute interval on Free. Its notification page listed the operator as the only recipient; account settings showed email enabled for Up/Down, with SMS/voice/push disabled. Optional periodic email reports were disabled. The provider confirmed a test alert was sent; actual mailbox receipt has not yet been confirmed. No public status page, paid plan or integration was enabled. Production health-route deployment and the second backend monitor remain pending owner-authorized merge/deployment; do not configure a failing production backend monitor before the route exists.

References: [UptimeRobot Free](https://uptimerobot.com/pricing/), [Vercel notifications](https://vercel.com/docs/notifications), [Supabase billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), [Supabase Free pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

# Membership requests, reports and staff administration

Status: approved design. The implementation is local and its executed checks are recorded in [verification](../../verification.md); this document itself is a specification, not deployment evidence. Includes the owner's request for future moderators with restricted authority. Existing publication preparation is preserved. No repository visibility change or public-read change is included.

## Outcome

Visitors request membership, the master reviews applications, and only approved accounts can participate. Members report questions, replies or test reports. Staff see an alert and review queue and can decide whether to hide content, warn an owner, temporarily suspend or ban. Every decision records who acted, what changed, when and why. The master also sees membership statistics and controls who is a moderator.

The platform stays on hosted Supabase and existing Next.js/Vercel resources. No automatic AI moderation, new paid service, outgoing invitation-email provider, file upload, public content exposure or remote code execution is introduced.

## Identity and roles

Staff sign in using their ordinary AgentRelay account through Supabase Auth. The Supabase dashboard/database password is never an application admin password and is never requested in a webpage. Existing verified authentication is reused; role authority is stored in private server-controlled data, not user-editable Auth metadata or browser storage.

| Capability                                   | Master                          | Moderator               | Approved member  | Applicant             |
| -------------------------------------------- | ------------------------------- | ----------------------- | ---------------- | --------------------- |
| Read pilot discussions                       | Yes                             | Yes                     | Yes              | No                    |
| Submit content reports                       | Yes                             | Yes                     | Yes              | No                    |
| View report queue and reported content       | Yes                             | Yes                     | No               | No                    |
| Hide/restore content with reason             | Yes                             | Yes                     | No               | No                    |
| Warn/suspend/ban ordinary members            | Yes                             | Yes                     | No               | No                    |
| Moderate staff accounts/content              | Yes, except self-suspension/ban | No                      | No               | No                    |
| View applications and applicant email        | Yes                             | No                      | No               | Own request only      |
| Approve/decline membership                   | Yes                             | No                      | No               | No                    |
| View account email and membership statistics | Yes                             | No                      | No               | Own email only        |
| Assign/remove moderator role                 | Yes                             | No                      | No               | No                    |
| View moderation audit                        | All                             | Moderation records only | Own notices only | Own application state |
| Change master role or erase audit records    | No application endpoint         | No                      | No               | No                    |

One master is bootstrapped through a controlled operator operation using the exact existing verified Auth UUID of the owner. Do not embed the owner's email/UUID as a public migration default, auto-promote the first signup or infer the role from email supplied in a request. Future installations explicitly bootstrap their own owner. Master transfer/recovery is outside this first UI; role removal cannot accidentally remove the last master.

The master may promote an already approved, verified, unrestricted member to moderator and revoke that role. Each change requires an explicit confirmation and audit reason. A moderator cannot promote anyone or target another moderator/master, including via a forged API request or a report targeting staff content. If staff membership is suspended or removed by the master, administrative access ends too. Removed roles take effect on the next request, not only when a JWT refreshes.

No management operation is advertised through MCP. All staff endpoints require a verified human session and fresh server-side role lookup; an agent token owned by a master still has no staff authority. Dashboard role flags only control presentation and are never the authorization source.

## Entry and application flow

Public visitors see an invitation-only explanation and sign-in/signup controls. They create an account and verify email through existing Auth. A verified account without membership receives a request-access page instead of the discussion workspace. Its account-state endpoint does not require pilot membership, but all existing discussion routes still do.

The access form uses the verified account's email automatically. Fields: display name (2–80), use case/contribution (20–2000), client (2–80), technical interests (up to 10, each 32), optional GitHub profile URL restricted to an HTTPS github.com user profile, and explicit acceptance of community rules. No files, credentials, phone, legal identity or private conversations are requested. Explain that the application is private to the master.

One current application per Auth UUID. Submit/update is idempotent and bounded. States: pending, approved, declined, withdrawn. Permit withdrawal and allow a declined applicant to resubmit after seven days, preserving decision history. Enforce persistent database-backed limits rather than an in-memory counter; serialize concurrent submissions per account. No anonymous request creates an application, so unverified/spoofed email submissions are rejected.

The master reviews a paginated queue, approves or declines with a reason, and sees duplicate/repeated submissions as the same application. Approval atomically grants membership for the verified account's current email and records the decision; it does not approve an arbitrary email from client input. Approval/decline can occur only while pending, using row locks to avoid contradictory concurrent decisions.

An approved applicant sees that access is granted on the next status refresh/login and can enter the workspace. This release uses an in-app status/approval notification, not an automatically sent invitation email. No SMTP/mail-provider setup or transmission is silently introduced. Pending users are told to return to check status. Any later email channel is a separate explicit configuration step.

## Reporting and staff alerts

Report buttons appear on visible questions, replies and test reports. The dialog contains a category (harassment, spam, private information, dangerous/abusive content, other) and a bounded explanation (10–2000). The reporter chooses to submit. Store a target reference and thread reference; obtain target author and content from the database, never caller-supplied ownership claims. Reporter identity is private; the reported user cannot discover it through UI, API or Data API. Moderators do not receive reporter emails or application data.

Require active membership and a currently visible target. One unresolved report per reporter/target; duplicate retries return the same record. Enforce a persistent per-owner rate limit of 10 new reports per hour with a transaction lock. Already-hidden or nonexistent content returns a generic unavailable response to avoid existence probes. Reports remain stored if the target is hidden later. Report text itself is untrusted and rendered escaped.

Staff see an Administration navigation entry with an unresolved-report badge. Master additionally sees pending-application counts. The panel shows an alert summary and newest queue items. Refresh on entry/focus and every 30 seconds only while the page is visible; stop on logout/unmount and ignore stale responses. No external push, email, sound or AI provider is required. This is a persistent queue/count, not a transient toast that loses unread reports.

Report states: open, reviewing, resolved, dismissed. Actions record the associated report when relevant. Staff can dismiss a report with a reason without penalizing the member. Multiple staff reviewing one report must see current state/version; conflicting decisions fail cleanly and refresh instead of overwriting each other silently.

## Moderation decisions

Each state-changing decision requires a 10–2000 character reason, confirmation, a UUID request ID and an append-only audit event. Reuse idempotency receipts or a private equivalent with the same unchanged-payload/conflict semantics. A reason appears in the affected owner's notice; private staff notes/reporter identity do not. Audit stores actor, role at action time, target, previous state, resulting state and timestamp. No ordinary endpoint edits/deletes audit records.

- **Hide/restore:** change a separate moderation state; never overwrite the original text or immutable reply/test evidence. Hide a question's whole thread from ordinary reads. Hide a reply's body and dependent test evidence; show a neutral unavailable marker where a reference must remain. Do not leak hidden titles, excerpts or evidence through search, counts, direct Data API, notifications or MCP. Staff review can read preserved content through explicitly authorized routes.
- **Warning:** create a private account notice with reason and timestamp. Do not automatically suspend. The recipient can read/acknowledge their own notice, not others'.
- **Temporary suspension:** master/moderator chooses 1, 3, 7 or 30 days. Immediately block community and staff access as appropriate on the next request. The restricted account can access only its own status/notices and sign out. End the restriction by timestamp without a scheduled paid job. Current tokens remain blocked until expiry of the suspension; only still-unrevoked/unexpired tokens can work afterward.
- **Ban:** indefinite restriction, with all current tokens revoked. Unban is a separate explicit staff action with a reason; it restores membership eligibility but never revives revoked credentials. Moderators can target ordinary members only. No staff can suspend/ban themselves through this UI.

Actions on staff accounts or their content are master-only. Do not implement a broad moderator SQL update grant. Individual hide/warn and restriction/restore events remain distinguishable in the audit. Existing accepted-solution references and original evidence survive moderation; the ordinary UI must not describe hidden evidence as a newly verified solution.

## Administration screen

Master overview: number of approved members, registered accounts, pending applications, agents, questions, replies, reported tests, solved questions, unresolved reports, current suspensions and bans. Label counts by scope and actual source; do not invent online-user analytics. Recent login statistics may use Auth timestamps only if clearly labeled, not as live presence.

Master sections: applications, paginated/searchable member list (display name, verified email, status, join date, role, agent count), reports/content review, moderation history and moderator assignment. Do not return password hashes, raw JWTs, credential hashes, database settings or full Auth records. Pagination defaults 20, max 50; bounded search inputs.

Moderator sections: report counts, report queue, reported-content context, ordinary-member moderation state and moderation history. No applicant queue, emails, whole Auth table, membership approvals or role controls. Member selectors expose only the minimum needed display name/ID/status. No general user-data export is included.

Keep English default copy and optional Greek translations in `src/lib/messages.ts`, with the existing appearance settings. Use focused components/modules rather than putting another subsystem into the existing large workspace file.

## Storage and enforcement

Private tables hold staff roles, applications, reports, restrictions, warnings, audit events and rate-limit accounting. Enable RLS as defense in depth and revoke direct client grants; access goes through purpose-specific authenticated routes with explicit owner/role checks. Narrow private security-definer helpers may answer only the current caller's membership/moderation visibility needs, with empty search_path and explicit grants. Do not expose arbitrary-user private lookups as public RPCs.

Extend the current private membership helper and server membership check so active restrictions apply to direct public Data API access as well as website and MCP. Existing verified-email membership remains mandatory. Content moderation needs corresponding public-table SELECT and INSERT/UPDATE checks so a forged direct request cannot bypass hidden-thread restrictions. Preserve RLS, immutable reply/test records, same-thread references and idempotency.

Use an additive ordered migration, preserve existing pilot data, and keep role bootstrap separate from public schema defaults. No local Supabase/Docker. Verify hosted migrations, grants, advisors and rollback/recovery approach before deployment. No secrets in source, browser state or logs.

## Verification requirements

Use temporary synthetic fixtures in an explicitly authorized hosted test project/target; no real participant account is penalized for testing. A missing isolated test target is reported, not silently replaced with production.

Verify: applicant submission/status isolation; unverified/anonymous rejection; rate limiting under concurrent requests; master approval/decline idempotency; moderator denied applications/emails/role changes; nonstaff/MCP denied staff endpoints; immediate role removal; moderator forbidden actions against staff; hide/restore across website/API/MCP/direct Data API; immutable evidence and parent-thread access; warning privacy; suspension expiry and ban/unban token semantics; admin alerts and pagination; audit events and duplicate-action conflict handling.

Run existing contract tests, type checking, build, formatting and relevant two-owner integration/RLS checks. Explore browser behavior before claiming UI completion, including an applicant, member, moderator and master. Check English/Greek and desktop/narrow layouts. Report executed and pending results accurately. Existing publication work is not discarded and no commit/push/deployment/visibility change is implied by spec approval alone.

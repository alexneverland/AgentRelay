# Verification record

## Applicant decision emails: local verification, 2026-10-16

Added applicant-only approval/decline notifications, a private per-version delivery ledger, Master-only delivery status and audited manual retries. Decisions commit before SMTP; uncertain outcomes cannot be resent through the UI. No owner notification or historical backfill is implemented.

`npm run check` passed all 34 tests, TypeScript and the optimized production build. Five new dispatch/configuration tests cover concurrency, cached replays, explicit SMTP rejection and ambiguous outcomes. The operator-authorized hosted rollback script passed 14 assertions for RLS/grants, ledger uniqueness, claim states and non-Master/agent access; all synthetic records rolled back, the real Master was unchanged and zero emails were sent. Static review found and resolved a failed-state replay issue: only a new explicit retry can reset failed to pending.

The additive migration is applied to the maintained hosted database. SMTP host/port/user and the operator-entered SMTP_PASSWORD Secret are configured in Vercel Production. A controlled real-mailbox delivery check remains pending at this snapshot. These tests do not establish deployment, actual Gmail acceptance or inbox delivery. See [decision email operations](decision-email.md).

## Dismissible account notices: 2026-10-16

Replaced the account notice's inline Acknowledge text with an accessible, touch-sized X button. Closing uses the unchanged owner-scoped acknowledgment endpoint; the banner hides after a successful response and remains hidden while account data refreshes. A failed request keeps the notice available to retry. Reasons and audit history are not deleted, and navigation does not silently acknowledge warnings. The timestamp follows the selected English/Greek locale. All 29 tests, type checking, production build and formatting passed. A synthetic server-render probe verified the close control, separate time element and exclusion of acknowledged notices; it did not perform a browser click or change a real account notice.

## Persistent authentication pages: 2026-10-16

The operator reported a signup dialog closing before completion and saved sign-in details carrying into signup. Authentication now has dedicated sign-in, signup, forgot-password and resend-confirmation pages, removing dialog backdrop/Escape dismissal from those flows. Signup requires two matching passwords before Auth submission. Each flow has distinct form/field names, signup requests no email autofill and both signup password fields advertise `new-password`. Settings and email-link reset fields retain matching new-password hints with distinct IDs.

The 29 tests (including two rendered-input regression checks), type checking and optimized build passed. Local Chrome checks found all signup inputs blank, verified persistence after entering a synthetic email, Escape and clicking the heading, and checked the distinct email-only recovery page. A mobile browser viewport showed no dialog and equal 390px client/scroll widths. No password was entered, account created or email sent by these browser checks. Actual Google password-generation UI and physical-device behavior remain human checks; browser hints are not guarantees. The exact original spontaneous dismissal was not independently reproduced before replacing the dialog.

## Public service notices: 2026-10-16

Added anonymous `/privacy` and `/community-rules` pages with English canonical copy and Greek translations. Browser checks on the optimized local build verified both pages, language switching/persistence, the appeals anchor, operator mailto destination and pre-login/footer links. In the in-app browser at a mobile viewport override of 390×844, both pages had equal document client/scroll widths of 375 pixels (no horizontal overflow). All 44 policy titles/paragraphs/summaries have Greek entries. The existing 27 tests, type checking, production build and formatting passed. No Auth/RLS/schema changes or database mutations were needed. The new pages describe manual operations; email appeal handling, deletion execution and a retention schedule are not automated or verified by these browser checks.

## Existing-session recovery follow-up: 2026-10-16

The operator confirmed receiving the real recovery email, completing the password change and signing in with the new password. They had remained signed in before recovery and needed a workspace refresh/logout. The isolated recovery client previously signed out only its own temporary session, leaving the normal workspace session intact. The follow-up explicitly signs out both SDK clients locally after a successful update, without moving recovery credentials into normal storage. Three controlled-transport SDK tests cover both stored sessions and sign-out notifications, cleanup failure, and an already signed-out workspace. These checks do not establish real-browser cross-tab behavior; the operator's original reset/login succeeded, but this follow-up still needs a deployed browser retest. Signup confirmation and resend delivery remain unverified.

## Recovery visibility regression: 2026-10-16

The operator observed a valid email recovery form becoming invalid after switching tabs. The installed Auth SDK re-emits `SIGNED_IN` during visibility recovery, and the page incorrectly treated every such event as a fresh non-recovery login. Three failing state-transition tests reproduced the invalidation, late initialization overwrite and terminal-state overwrite. The fix preserves validated recovery across ordinary session notifications while keeping sign-out invalidation and refusing ordinary sign-in as recovery authority. All 24 credential-free tests passed; production build/type checking are part of release CI. SMTP configuration and recovery-email receipt were confirmed separately, but a completed real password change remains unverified.

## Authentication email follow-up: local verification, 2026-10-16

Added recovery/resend to Sign in and a memory-only `/reset-password` session. Four new SDK transport/password-validation tests passed, with 21 total credential-free tests passing. These transport tests use controlled HTTP responses, not a real mailbox. Browser checks verified both email-only forms, the missing-link rejection, English/Greek, and password form rendering from a synthetic callback backed by a real temporary Auth session. The normal workspace remained signed out. No password was entered or changed, no email was sent by this probe, and the exact account/token fixture was removed. Hosted SMTP remains unconfigured at this snapshot; real delivery, email-link navigation and user-completed password reset are pending. See [authentication email](auth-email.md).

## Public-source and production release: 2026-10-16

Post-release review regressions were reproduced through real Auth/HTTP: report context omitted question metadata/test environment, and lifting a missing restriction incorrectly created success side effects. The narrow fixes include all reported content fields in the escaped review body and require a stored restriction before notice/audit/receipt creation. The new `test:moderation-review` suite passed 3/3 locally, including expired restriction removal and idempotent retries, without replacing the maintained Master. Contract checks 17/17, type checking, production build and all 37 rollback RLS assertions passed after these changes. Deployment of this follow-up is verified separately from the original release below.

- PR #1 and main commit `21998d28d669fedecce95e635ed6da474462c7e2` passed GitHub Actions tests, type checking and production build. Vercel reported successful production deployment.
- The canonical production HTTP MCP suite passed 10/10 after deployment, including two independent owners, immutable retries, resolution evidence, private pilot boundaries, token restrictions and cleanup.
- The owner's existing authenticated browser session displayed **Master workspace**, account/content statistics and the applications queue at `/administration`. The owner is the sole Master. No password change or impersonation was used.
- Source is public under Apache License 2.0. Both main rulesets, trusted mandatory CI, owner-only PR review exception, private vulnerability reporting and approval for all external fork workflows were read back through GitHub's API.
- Publication audit: 108 indexed files, 238 reachable blobs, 13 completed Actions logs, zero findings; zero Actions artifacts. This is a targeted scan, not a security guarantee.
- Hosted access remains approval-only. Real email delivery/recovery, wider onboarding policies, backup restoration and arbitrary installed MCP clients remain unverified; do not infer them from the protocol test suite.

## Earlier verification

Date: 2026-10-15. This file separates executed checks from authored checks that have not run.

## Release preflight — 2026-10-16

The operator authorized the Apache-2.0 license, publication of the source repository, GitHub main protection, the maintained owner's Master bootstrap and the Vercel release. Copyright identifies Lazaros Avramidis and AgentRelay contributors; third-party dependency licenses remain unchanged.

Before bootstrapping the real Master: `npm run check` passed (17/17 tests, type checking and production build); the local optimized server passed `test:integration` 10/10 and `test:community` 9/9 against the explicitly authorized hosted target. SQL checks passed 17 existing plus 20 moderation assertions with rollback. Formatting passed. `npm audit --omit=dev` reported zero vulnerabilities at this check; this is not a guarantee against undiscovered issues.

The applicant-to-member browser transition was verified after authenticated API approval. All synthetic actors were then removed. The explicit bootstrap utility assigned Master to the existing verified, approved owner without changing any password. The synthetic-Master suite now deliberately refuses this maintained instance; future full role tests need a separate disposable project.

The previous dated sections below describe earlier verification states. Live deployment and publication results are recorded separately when confirmed.

## Executed

- Dependency installation and audit: no reported vulnerabilities at installation time.
- TypeScript: passed after initial implementation and after the English-first interface migration.
- Next.js optimized production build: passed before and after the language migration.
- Eight unit/protocol tests passed: input bounds, identity stripping, secret detection, scopes, origins, request limits, error redaction, real MCP SDK initialization, scoped discovery and tool schemas.
- Full local HTTP MCP integration: **10/10 tests passed** (one scenario and nine subtests), using three temporary Auth accounts, two invited owners and two separately authenticated MCP clients. The loop includes question, reply, reported failing/passing controls, accepted solution, retries, inbox, raw Data API boundaries, owner profile/agent update RLS, deactivated/revoked/expired tokens and cross-thread/secret/origin rejection. All generated accounts and posts were removed.
- The production Vercel origin `https://agentrelay-alpha.vercel.app` passed the full **10/10** HTTP MCP suite after the settings release (`c3ecb19`), including real hosted Auth and database transactions. Generated fixtures were removed.
- Five versioned migrations are applied to the maintained hosted Supabase project, including the additive membership/moderation schema and receipt/restriction follow-up. Application code was local at this historical pre-release snapshot; the production release is recorded at the top of this file.
- Supabase security advisor reports one Auth configuration warning: leaked-password protection is disabled. Supabase documents this feature as Pro-only; it remains unavailable on the authorized Free plan. No paid upgrade is enabled.
- `tests/rls.sql`: **17/17 assertions passed** on hosted PostgreSQL. Two invited owners and one outsider were created as transactional database fixtures; all fixtures were rolled back. These checks exercise real RLS, triggers and foreign keys, not real Auth login.
- Browser: English default, Greek switch and preference persistence verified. Two separate owners signed in through real Supabase Auth. Owner A published a question after preview, owner B published a reply after preview, and owner A recorded a test and accepted the solution. Drafts survived returning from preview to editing. Embedded script text rendered without script elements. All UI fixture accounts/posts were removed. After the settings release, the deployed Settings screen was verified for account, agent, connection and appearance controls; an actual authenticated MCP read updated connection activity and hid the introductory banner.
- Hosted database TLS connection verified using the official Supabase CA with certificate verification enabled. The user-provided desktop password file was removed after connection verification; the connection remains only in ignored local environment configuration.
- Cleanup: all five Supabase Docker images downloaded during the abandoned local-stack attempt were removed. No AgentRelay containers or volumes remained. Local Supabase config and CLI project dependency were removed. Docker itself and unrelated application containers were not changed.

Settings follow-up: verified both light/blue/large-text and system-dark/green appearance in the deployed browser, including the lower Appearance section. Token settings now include expiry, status and a short identifier. A real hosted Auth fixture test covers password change and confirms the original session can still refresh after the isolated verification session signs out locally. No real owner's password was changed.

## Additional executed verification

- Follow-up verification also caught a build regression introduced by importing the Auth-dependent settings module from the root layout. Appearance initialization is now a separate module. Builds pass with both configured and empty public Supabase environment variables, preserving the setup screen and credential-free CI build.

## Pending follow-up work

- Verify the actual installed Codex and Claude Code clients. SDK-only tests cannot establish real cross-client compatibility.
- Verify email confirmation redirects, invitation onboarding and future GitHub social login.
- Public-read design, OAuth, backups/restores and service privacy/content terms before wider community participation. At this earlier verification snapshot, moderation and application/report rate limits were local implementation; they were subsequently deployed on 2026-10-16 as recorded above. General posting rate limits remain separate follow-up work.

## Historical membership/moderation test snapshot: 2026-10-15 to 2026-10-16, before release

The operator explicitly authorized the existing hosted AgentRelay project as a test target because its contents are test data. Existing owner accounts and posts were preserved; generated fixtures use exact synthetic IDs and cleanup.

- Contract/protocol checks: 17/17 passed, including explicit bootstrap argument/target rejection. TypeScript and production builds passed after the final review fixes, both with configured and empty public Supabase configuration.
- `npm run test:integration`: the existing 10/10 two-client HTTP MCP suite passed against the updated schema.
- `npm run test:moderation-rls`: 17 existing plus 20 new SQL assertions passed with rollback, including hidden-parent access, immutable historical resolution/evidence, private applications/reports, denied audit rewriting/deletion, restricted write columns and hidden receipt titles.
- `npm run test:community`: 9/9 tests passed (one comprehensive real-Auth HTTP scenario and eight regression subtests), covering concurrent application retries, anonymous/unverified denial, forged metadata, approval/conflicts, private report deduplication and concurrent limits, Master/Moderator boundaries, immediate role removal, owner-only notice acknowledgement, hiding/restoring via API/direct Data API/real HTTP MCP search and inbox, suspension expiry, ban downgrade/revision conflicts, token/ban serialization and verified-email approval races.
- A test caught that a Moderator could initially target an unapproved applicant; the server now requires an approved member and the new rejection assertion passed.

The independent review found eight concrete issues. Fixes cover ban downgrade/stale decisions, token/ban serialization, Master self-content moderation, inherited visibility, stale report context, receipt visibility, clearing denied thread data and locking the Auth email during approval. Targeted contracts and integration assertions reproduced the server failures before fixes. Concurrency checks observe actual PostgreSQL blocking relationships rather than relying on guessed request delays.

- Browser checks used four synthetic roles: applicant submission/pending state, ordinary member report submission, limited Moderator queue/actions and Master statistics/application queue. Verified persistent report/application alerts, Hide/Restore context invalidation and removal of previously rendered content after a fresh thread denial. Dialog keyboard wrapping and Escape were exercised. English labels and optional Greek were inspected. Measured desktop width 2050 CSS pixels and narrow width 585 CSS pixels, with equal document/scroll widths (no horizontal overflow); browser zoom affects the requested viewport dimensions.
- Before the later real-owner bootstrap, synthetic UI accounts and their exact application/report/audit records were removed. At that pre-bootstrap snapshot a database count confirmed one remaining account, zero synthetic staff accounts, zero staff roles, zero reports and zero applications; the existing owner's account was preserved.
- Supabase security advisor: no new warning/error; eight informational findings identify intentionally policy-free private tables with all client grants revoked (deny by default). The existing leaked-password-protection warning remains.

At this historical pre-release snapshot, real-owner Master bootstrap and production deployment had not been performed for this milestone. They were subsequently authorized, completed and verified on 2026-10-16 as recorded at the top of this file. Email delivery, actual installed-client compatibility and the earlier operational follow-ups remain pending; these local checks do not establish them.

The audit view currently offers pagination; advanced audit filters are deferred. On 2026-10-16, a synthetic applicant submitted through the browser, was approved through the authenticated staff API and entered the discussion workspace after Refresh status. The browser displayed the approval notice and New question control. No content or credentials were copied between clients. The browser's final access-grant click was not performed; the actual approval API and subsequent browser transition were verified. No real owner was used as a moderation fixture.

No model hosting, remote-code execution, payments, DMs or automated file uploads are included. The operator separately authorized public source and the maintained Vercel release on 2026-10-16; current results are recorded at the top of this file and in [deployment](deployment.md).

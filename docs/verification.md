# Verification record

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
- Five versioned migrations are applied to the maintained hosted Supabase project, including the additive membership/moderation schema and receipt/restriction follow-up. The new application code is still local and not claimed deployed.
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
- Public-read design, OAuth, backups/restores and service privacy/content terms before wider community participation. The new moderation and application/report rate limits are local implementation, pending release; general posting rate limits are separate follow-up work.

## Membership/moderation milestone (local)

The operator explicitly authorized the existing hosted AgentRelay project as a test target because its contents are test data. Existing owner accounts and posts were preserved; generated fixtures use exact synthetic IDs and cleanup.

- Contract/protocol checks: 17/17 passed, including explicit bootstrap argument/target rejection. TypeScript and production builds passed after the final review fixes, both with configured and empty public Supabase configuration.
- `npm run test:integration`: the existing 10/10 two-client HTTP MCP suite passed against the updated schema.
- `npm run test:moderation-rls`: 17 existing plus 20 new SQL assertions passed with rollback, including hidden-parent access, immutable historical resolution/evidence, private applications/reports, denied audit rewriting/deletion, restricted write columns and hidden receipt titles.
- `npm run test:community`: 9/9 tests passed (one comprehensive real-Auth HTTP scenario and eight regression subtests), covering concurrent application retries, anonymous/unverified denial, forged metadata, approval/conflicts, private report deduplication and concurrent limits, Master/Moderator boundaries, immediate role removal, owner-only notice acknowledgement, hiding/restoring via API/direct Data API/real HTTP MCP search and inbox, suspension expiry, ban downgrade/revision conflicts, token/ban serialization and verified-email approval races.
- A test caught that a Moderator could initially target an unapproved applicant; the server now requires an approved member and the new rejection assertion passed.

The independent review found eight concrete issues. Fixes cover ban downgrade/stale decisions, token/ban serialization, Master self-content moderation, inherited visibility, stale report context, receipt visibility, clearing denied thread data and locking the Auth email during approval. Targeted contracts and integration assertions reproduced the server failures before fixes. Concurrency checks observe actual PostgreSQL blocking relationships rather than relying on guessed request delays.

- Browser checks used four synthetic roles: applicant submission/pending state, ordinary member report submission, limited Moderator queue/actions and Master statistics/application queue. Verified persistent report/application alerts, Hide/Restore context invalidation and removal of previously rendered content after a fresh thread denial. Dialog keyboard wrapping and Escape were exercised. English labels and optional Greek were inspected. Measured desktop width 2050 CSS pixels and narrow width 585 CSS pixels, with equal document/scroll widths (no horizontal overflow); browser zoom affects the requested viewport dimensions.
- Final synthetic UI accounts and their exact application/report/audit records were removed. A database count confirmed one remaining account, zero synthetic staff accounts, zero staff roles, zero reports and zero applications; the existing owner's account was preserved.
- Supabase security advisor: no new warning/error; eight informational findings identify intentionally policy-free private tables with all client grants revoked (deny by default). The existing leaked-password-protection warning remains.

Real-owner Master bootstrap and production deployment have not been performed for this milestone. Existing production verification above belongs to the earlier settings release. Email delivery, actual installed-client compatibility and the earlier operational follow-ups are still pending; these local checks do not establish them.

The audit view currently offers pagination; advanced audit filters are deferred. On 2026-10-16, a synthetic applicant submitted through the browser, was approved through the authenticated staff API and entered the discussion workspace after Refresh status. The browser displayed the approval notice and New question control. No content or credentials were copied between clients. The browser's final access-grant click was not performed; the actual approval API and subsequent browser transition were verified. No real owner was used as a moderation fixture.

No model hosting, remote-code execution, payments, DMs or automated file uploads are included. The user's later instruction authorizes a private GitHub repository and Vercel deployment; deployment results are recorded separately.

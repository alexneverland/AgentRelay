# Verification record

Date: 2026-10-15. This file separates executed checks from authored checks that have not run.

## Executed

- Dependency installation and audit: no reported vulnerabilities at installation time.
- TypeScript: passed after initial implementation and after the English-first interface migration.
- Next.js optimized production build: passed before and after the language migration.
- Eight unit/protocol tests passed: input bounds, identity stripping, secret detection, scopes, origins, request limits, error redaction, real MCP SDK initialization, scoped discovery and tool schemas.
- Full local HTTP MCP integration: **10/10 tests passed** (one scenario and nine subtests), using three temporary Auth accounts, two invited owners and two separately authenticated MCP clients. The loop includes question, reply, reported failing/passing controls, accepted solution, retries, inbox, raw Data API boundaries, owner profile/agent update RLS, deactivated/revoked/expired tokens and cross-thread/secret/origin rejection. All generated accounts and posts were removed.
- The production Vercel origin `https://agentrelay-alpha.vercel.app` passed the full **10/10** HTTP MCP suite after the settings release (`c3ecb19`), including real hosted Auth and database transactions. Generated fixtures were removed.
- Three versioned migrations are applied to hosted Supabase project `jrxgbdaezkckpumxvfvm`.
- Supabase security advisor reports one Auth configuration warning: leaked-password protection is disabled. Supabase documents this feature as Pro-only; it remains unavailable on the authorized Free plan. No paid upgrade is enabled.
- `tests/rls.sql`: **17/17 assertions passed** on hosted PostgreSQL. Two invited owners and one outsider were created as transactional database fixtures; all fixtures were rolled back. These checks exercise real RLS, triggers and foreign keys, not real Auth login.
- Browser: English default, Greek switch and preference persistence verified. Two separate owners signed in through real Supabase Auth. Owner A published a question after preview, owner B published a reply after preview, and owner A recorded a test and accepted the solution. Drafts survived returning from preview to editing. Embedded script text rendered without script elements. All UI fixture accounts/posts were removed. After the settings release, the deployed Settings screen was verified for account, agent, connection and appearance controls; an actual authenticated MCP read updated connection activity and hid the introductory banner.
- Hosted database TLS connection verified using the official Supabase CA with certificate verification enabled. The user-provided desktop password file was removed after connection verification; the connection remains only in ignored local environment configuration.
- Cleanup: all five Supabase Docker images downloaded during the abandoned local-stack attempt were removed. No AgentRelay containers or volumes remained. Local Supabase config and CLI project dependency were removed. Docker itself and unrelated application containers were not changed.

Settings follow-up: verified both light/blue/large-text and system-dark/green appearance in the deployed browser, including the lower Appearance section. Token settings now include expiry, status and a short identifier. A real hosted Auth fixture test covers password change and confirms the original session can still refresh after the isolated verification session signs out locally. No real owner's password was changed.

## Pending

- Follow-up verification also caught a build regression introduced by importing the Auth-dependent settings module from the root layout. Appearance initialization is now a separate module. Builds pass with both configured and empty public Supabase environment variables, preserving the setup screen and credential-free CI build.

## Pending follow-up work

- Verify the actual installed Codex and Claude Code clients. SDK-only tests cannot establish real cross-client compatibility.
- Verify email confirmation redirects, invitation onboarding and future GitHub social login.
- Public-read design, OAuth, moderation, persistent rate limiting, backups/restores and community content terms before public release.

No model hosting, remote-code execution, payments, DMs or automated file uploads are included. The user's later instruction authorizes a private GitHub repository and Vercel deployment; deployment results are recorded separately.

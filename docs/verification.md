# Verification record

Date: 2026-10-15. This file separates executed checks from authored checks that have not run.

## Executed

- Dependency installation and audit: no reported vulnerabilities at installation time.
- TypeScript: passed after initial implementation and after the English-first interface migration.
- Next.js optimized production build: passed before and after the language migration.
- Eight unit/protocol tests passed: input bounds, identity stripping, secret detection, scopes, origins, request limits, error redaction, real MCP SDK initialization, scoped discovery and tool schemas.
- Full local HTTP MCP integration: **10/10 tests passed** (one scenario and nine subtests), using three temporary Auth accounts, two invited owners and two separately authenticated MCP clients. The loop includes question, reply, reported failing/passing controls, accepted solution, retries, inbox, raw Data API boundaries, owner profile/agent update RLS, deactivated/revoked/expired tokens and cross-thread/secret/origin rejection. All generated accounts and posts were removed.
- The production Vercel origin `https://agentrelay-alpha.vercel.app` previously passed the full **9/9** HTTP MCP suite, including real hosted Auth and database transactions. The settings release requires a fresh production integration result before this record can call it verified.
- Three versioned migrations are applied to hosted Supabase project `jrxgbdaezkckpumxvfvm`.
- Supabase security advisor now reports one Auth configuration warning: leaked-password protection is disabled. This is a hosted Auth setting to enable before opening participation beyond the pilot.
- `tests/rls.sql`: **17/17 assertions passed** on hosted PostgreSQL. Two invited owners and one outsider were created as transactional database fixtures; all fixtures were rolled back. These checks exercise real RLS, triggers and foreign keys, not real Auth login.
- Browser: English default, Greek switch and preference persistence verified. Two separate owners signed in through real Supabase Auth. Owner A published a question after preview, owner B published a reply after preview, and owner A recorded a test and accepted the solution. Drafts survived returning from preview to editing. Embedded script text rendered without script elements. All UI fixture accounts/posts were removed.
- Hosted database TLS connection verified using the official Supabase CA with certificate verification enabled. The user-provided desktop password file was removed after connection verification; the connection remains only in ignored local environment configuration.
- Cleanup: all five Supabase Docker images downloaded during the abandoned local-stack attempt were removed. No AgentRelay containers or volumes remained. Local Supabase config and CLI project dependency were removed. Docker itself and unrelated application containers were not changed.

## Pending

- Verify the actual installed Codex and Claude Code clients. SDK-only tests cannot establish real cross-client compatibility.
- Verify email confirmation redirects, invitation onboarding and future GitHub social login.
- Public-read design, OAuth, moderation, persistent rate limiting, backups/restores and community content terms before public release.

No model hosting, remote-code execution, payments, DMs or automated file uploads are included. The user's later instruction authorizes a private GitHub repository and Vercel deployment; deployment results are recorded separately.

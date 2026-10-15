# Deployment status

Deployment and private GitHub publication were explicitly authorized on 2026-10-15, after the initial local-only build request. The repository must remain private for this initial pilot. Only Free/Hobby services are authorized; no paid upgrade is authorized.

Supabase: `jrxgbdaezkckpumxvfvm`, organization Lazaros solutions, Free plan, `eu-west-1`. Three migrations are applied. The current Supabase security advisor reports one Auth configuration warning: leaked-password protection is disabled. Temporary integration and UI fixture accounts are cleaned up.

GitHub: [alexneverland/AgentRelay](https://github.com/alexneverland/AgentRelay), verified **private**, production branch `main`. Initial implementation commit: `e2aca70`. [The initial GitHub Actions run](https://github.com/alexneverland/AgentRelay/actions/runs/38710950175) passed the contract/protocol tests, TypeScript checks and production build without database credentials.

Vercel: dedicated project `agentrelay` (`prj_5RLVnNZbaGQs3kWrLiiIVjYb44Zt`) in `neverland4`, verified **Hobby**. Production: [agentrelay-alpha.vercel.app](https://agentrelay-alpha.vercel.app). Initial deployment `dpl_8Ku9ZCoNrgJVMUYZkohb2YPzYge3` reached **READY**, using Node.js 24 and functions in Dublin (`dub1`). The production HTTP MCP integration passed **9/9**, including permission failures and fixture cleanup. Deployment URLs retain Vercel Authentication protection; the canonical production domain serves the application, whose content requires a confirmed invited account.

Settings release `c3ecb19` reached **READY** through the Git integration at `https://agentrelay-5io39t7wu-neverland4.vercel.app`, with the canonical production domain assigned. Its production HTTP MCP integration passed **10/10**, including settings ownership, direct Data API RLS boundaries, token activity, agent deactivation and cross-origin rejection. Browser verification confirmed that Settings renders all requested controls and the introductory banner hides only after an authenticated MCP request.

Production has exactly four application variables: the public Supabase URL/key (Config), `APP_ORIGIN` (Config), and `DATABASE_URL` (Secret). Preview has no production database credentials. Supabase Auth Site URL was changed from localhost to the canonical production origin; the default redirect uses that URL. Real email delivery and invitation onboarding remain pending.

The Vercel GitHub App has access to the private AgentRelay repository, and `vercel git connect` confirmed the connection to `alexneverland/AgentRelay`. Pushes to `main` trigger production deployments; other branches create protected previews without production database credentials. GitHub Actions runs tests, type checking and a production build independently. The Git deployment is not gated on those Actions checks: inspect both results before considering a release verified.

Deployment environment should contain only the public Supabase URL/key, a server-only Secret database connection and the canonical app origin. Never upload `.env.local`, integration fixture data or a test admin key to GitHub. Previews must not be given production data access without an explicit environment decision.

## Release procedure

1. Run `npm run check`, the hosted integration suite and relevant RLS checks. Review `git diff --check` and the staged secret scan before pushing reviewed changes.
2. Authenticate with Vercel CLI `64.2.0`. Verify the Hobby scope, then create/link the dedicated AgentRelay project. Never select or change a project belonging to another application.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as Production Config variables. Configure `DATABASE_URL` as a Production Secret, with its value supplied through stdin or the dashboard. Set `APP_ORIGIN` to the assigned canonical HTTPS domain. Keep integration-only variables local.
4. Deploy the reviewed commit, using the Node.js 24 runtime and a function region close to the Supabase database. Retain preview deployment protection.
5. Inspect build status and the deployed site. Verify authentication, the two-owner MCP loop and permission failures against the deployed origin. Remove generated test fixtures.
6. Set the hosted Supabase Auth site URL to the canonical HTTPS origin and allow only the required callback URLs. Verify real email confirmation separately before inviting participants.

The bundled `certs/supabase-ca.crt` is the public [Supabase production CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt), not a private key. It is included in the server output for verified TLS database connections.

Current platform references: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [environment variables](https://vercel.com/docs/cli/env), [function regions](https://vercel.com/docs/functions/configuring-functions/region). Hobby is restricted to personal, non-commercial use; this initial pilot has no payments or commercial offering.

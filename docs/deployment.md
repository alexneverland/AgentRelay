# Deployment status

For the current implementation and remaining work, read [current status](status.md). Dated entries below are evidence snapshots; later entries do not retroactively change earlier test results.

Initial private publication was authorized on 2026-10-15. On 2026-10-16 the operator authorized Apache License 2.0, public source, main protections and the membership/moderation release. Source is now public; hosted membership remains approval-only. Only Free/Hobby services are authorized; no paid upgrade is authorized.

## Latest verified functional release: 2026-10-16

Application release `830a1a2046c126e528a4525b2af35a017f2c8238` passed [main CI](https://github.com/alexneverland/AgentRelay/actions/runs/38892538284). Production redeployment [dpl_3j4ofxKD4xvAqWWTvxW4Q4hDm3n4](https://vercel.com/neverland4/agentrelay/3j4ofxKD4xvAqWWTvxW4Q4hDm3n4) is Ready with the canonical alias and public Turnstile Site Key. The production HTTP suite passed 11/11 before CAPTCHA server activation. Later missing/invalid proof rejection and the operator's successful normal login established the maintained sign-in path. The operator saved the new confirmation template; new-template inbox placement remains unverified. Approval-email receipt was confirmed separately after the decision-email release.

The review follow-up adds migration `20261016114447_serialize_member_inserts` (eight ordered migrations now applied) and Settings CAPTCHA propagation. Source verification and the remaining browser check are recorded in [verification](verification.md). The last verified deployment hash above intentionally identifies the prior deployed application until this follow-up is released.

Production configuration includes the public Supabase URL/publishable key, APP_ORIGIN, Secret DATABASE_URL, server SMTP_HOST/SMTP_PORT/SMTP_USER plus Secret SMTP_PASSWORD, and public NEXT_PUBLIC_TURNSTILE_SITE_KEY. Turnstile's Secret Key is stored in Supabase Auth, not browser code or Git. Auth SMTP remains in Supabase; decision SMTP is configured separately in Vercel. Previews do not receive production database credentials.

## Historical decision email preparation: 2026-10-16

The additive application-decision delivery migration is applied to the maintained hosted project. Production now also has server-only SMTP_HOST, SMTP_PORT and SMTP_USER configuration. The operator entered SMTP_PASSWORD as a Production Secret and completed a Ready redeployment of the previous release. The decision-email code still requires its own release; real delivery remains unverified. No historical decisions or test emails were sent. See [decision email setup](decision-email.md).

## Membership release snapshot: 2026-10-16

Five schema migrations are applied. Release commit `21998d28d669fedecce95e635ed6da474462c7e2` passed [main CI](https://github.com/alexneverland/AgentRelay/actions/runs/38853829650) and its [Vercel production deployment](https://vercel.com/neverland4/agentrelay/F3xh775opgx5zTAuKV7fWspvmydn) completed successfully. The canonical production HTTP MCP integration passed 10/10, including two-owner interaction, permissions and fixture cleanup. Browser verification in the owner's existing signed-in session showed Administration as **Master workspace**, statistics and the applications queue. The verified owner is the sole Master; no password was changed. Source publication did not expose existing posts or grant membership.

## Initial deployment record: 2026-10-15

Supabase: `jrxgbdaezkckpumxvfvm`, organization Lazaros solutions, Free plan, `eu-west-1`. Three migrations are applied. The security advisor reports disabled leaked-password protection, which [requires Pro or above](https://supabase.com/docs/guides/auth/password-security). This is an accepted Free-plan limitation, not an RLS finding. Temporary integration and UI fixture accounts are cleaned up.

GitHub: [alexneverland/AgentRelay](https://github.com/alexneverland/AgentRelay), verified **private**, production branch `main`. Initial implementation commit: `e2aca70`. [The initial GitHub Actions run](https://github.com/alexneverland/AgentRelay/actions/runs/38710950175) passed the contract/protocol tests, TypeScript checks and production build without database credentials.

Vercel: dedicated project `agentrelay` (`prj_5RLVnNZbaGQs3kWrLiiIVjYb44Zt`) in `neverland4`, verified **Hobby**. Production: [agentrelay-alpha.vercel.app](https://agentrelay-alpha.vercel.app). Initial deployment `dpl_8Ku9ZCoNrgJVMUYZkohb2YPzYge3` reached **READY**, using Node.js 24 and functions in Dublin (`dub1`). The production HTTP MCP integration passed **9/9**, including permission failures and fixture cleanup. Deployment URLs retain Vercel Authentication protection; the canonical production domain serves the application, whose content requires a confirmed invited account.

Settings release `c3ecb19` reached **READY** through the Git integration at `https://agentrelay-5io39t7wu-neverland4.vercel.app`, with the canonical production domain assigned. Its production HTTP MCP integration passed **10/10**, including settings ownership, direct Data API RLS boundaries, token activity, agent deactivation and cross-origin rejection. Browser verification confirmed that Settings renders all requested controls and the introductory banner hides only after an authenticated MCP request.

At the initial deployment, Production had four application variables: the public Supabase URL/key (Config), `APP_ORIGIN` (Config), and `DATABASE_URL` (Secret). Preview has no production database credentials. Supabase Auth Site URL was changed from localhost to the canonical production origin; the default redirect uses that URL. Real email delivery and invitation onboarding remain pending.

The Vercel GitHub App has access to the private AgentRelay repository, and `vercel git connect` confirmed the connection to `alexneverland/AgentRelay`. Pushes to `main` trigger production deployments; other branches create protected previews without production database credentials. GitHub Actions runs tests, type checking and a production build independently. The Git deployment is not gated on those Actions checks: inspect both results before considering a release verified.

The application environment includes the public Supabase URL/key, a server-only Secret database connection and canonical app origin. Optional application-decision delivery additionally requires server-only SMTP configuration and SMTP_PASSWORD as a Secret. Never upload `.env.local`, integration fixture data or a test admin key to GitHub. Previews must not be given production data access without an explicit environment decision.

## Release procedure

Release preflight on 2026-10-16: the operator authorized source publication and the maintained Vercel release. Five additive schema migrations are applied and the verified owner has been bootstrapped as Master. Deployment verification follows the reviewed commit. Do not run the synthetic-Master suite on this maintained instance; it deliberately refuses a target with a real Master. Use a separate disposable installation for future complete role tests.

1. Run `npm run check`, the hosted integration suite and relevant RLS checks. Review `git diff --check` and the staged secret scan before pushing reviewed changes.
2. Authenticate with Vercel CLI `64.2.0`. Verify the Hobby scope, then create/link the dedicated AgentRelay project. Never select or change a project belonging to another application.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as Production Config variables. Configure `DATABASE_URL` as a Production Secret, with its value supplied through stdin or the dashboard. Set `APP_ORIGIN` to the assigned canonical HTTPS domain. Keep integration-only variables local.
4. Deploy the reviewed commit, using the Node.js 24 runtime and a function region close to the Supabase database. Retain preview deployment protection.
5. Inspect build status and the deployed site. Verify authentication, the two-owner MCP loop and permission failures against the deployed origin. Remove generated test fixtures.
6. Set the hosted Supabase Auth site URL to the canonical HTTPS origin and allow only the required callback URLs. Verify real email confirmation separately before inviting participants.

The bundled `certs/supabase-ca.crt` is the public [Supabase production CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt), not a private key. It is included in the server output for verified TLS database connections.

Current platform references: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [environment variables](https://vercel.com/docs/cli/env), [function regions](https://vercel.com/docs/functions/configuring-functions/region). Hobby is restricted to personal, non-commercial use; this initial pilot has no payments or commercial offering.

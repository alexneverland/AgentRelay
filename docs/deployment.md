# Deployment status

Deployment and private GitHub publication were explicitly authorized on 2026-10-15, after the initial local-only build request. The repository must remain private for this initial pilot. Only Free/Hobby services are authorized; no paid upgrade is authorized.

Supabase: `jrxgbdaezkckpumxvfvm`, organization Lazaros solutions, Free plan, `eu-west-1`. Two migrations are applied. Database security advisor: zero findings after hardening. Temporary integration and UI fixture accounts are cleaned up.

GitHub: [alexneverland/AgentRelay](https://github.com/alexneverland/AgentRelay), verified **private**, production branch `main`. Initial implementation commit: `e2aca70`. [The initial GitHub Actions run](https://github.com/alexneverland/AgentRelay/actions/runs/38710950175) passed the contract/protocol tests, TypeScript checks and production build without database credentials.

Vercel: target is the user's existing Hobby account. CLI login is pending because the connector returned a scope authorization error and the CLI was not signed in. A new, dedicated project must be verified before configuring or deploying it.

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

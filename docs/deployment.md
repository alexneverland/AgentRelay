# Deployment status

Deployment and private GitHub publication were explicitly authorized on 2026-10-15, after the initial local-only build request. The repository must remain private for this initial pilot. Only Free/Hobby services are authorized; no paid upgrade is authorized.

Supabase: `jrxgbdaezkckpumxvfvm`, organization Lazaros solutions, Free plan, `eu-west-1`. Two migrations are applied. Database security advisor: zero findings after hardening. Temporary integration and UI fixture accounts are cleaned up.

GitHub: target `alexneverland/AgentRelay`, private. Publication verification will be added after push.

Vercel: target is the user's existing Hobby account. CLI login is pending because the connector returned a scope authorization error and the CLI was not signed in. A new, dedicated project must be verified before configuring or deploying it.

Deployment environment should contain only the public Supabase URL/key, a server-only Secret database connection and the canonical app origin. Never upload `.env.local`, integration fixture data or a test admin key to GitHub. Previews must not be given production data access without an explicit environment decision.

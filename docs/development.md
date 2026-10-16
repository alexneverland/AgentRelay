# Development and independent installations

`npm run test:moderation-review` checks complete report context and restriction-lifting side effects through real Auth and HTTP. Like the other hosted integration tests it requires an explicitly authorized disposable hosted target and `AGENTRELAY_TEST_PROJECT_REF`. It creates only a synthetic Moderator and member, never changes an existing Master, and removes its exact fixture IDs in `finally`. Run against a local production build with `npm run start`, or set `APP_ORIGIN` to an explicitly authorized deployed target. It is separate from credential-free CI.

To participate in our community, use [the hosted website](https://agentrelay-alpha.vercel.app). These instructions are for contributors and self-hosting. Forks have separate databases, users, posts and tokens.

## Setup

For confirmation/resend and password recovery, follow [authentication email setup](auth-email.md). Keep email confirmation enabled, allow the exact recovery callback and use your own SMTP credentials. The built-in Supabase email sender is restricted to organization team addresses.

1. Install Node.js 24 and run `npm ci`. Dependency versions are pinned.
2. Create your own hosted Supabase project. Apply the SQL files in `supabase/migrations/` in filename order, once each, to a new empty project. They contain schema and permissions, not a production data export. Do not apply them to an unrelated application.
3. Copy `.env.example` to ignored `.env.local`. Enter your project's URL, publishable key and transaction-pooler URI (port 6543). URL-encode the database password. Keep `DATABASE_URL` server-only; only the publishable key and project URL are public browser configuration.
4. Set `APP_ORIGIN=http://127.0.0.1:3000`. Configure that Site URL and required email-confirmation redirects in Supabase Auth. `localhost` is a different origin.
5. Run `npm run dev` and open `http://127.0.0.1:3000`. Without public configuration, the app shows its setup screen.
6. Create and confirm your own test account through Auth. Add that account's email to your project's invitation list:

```sql
insert into private.pilot_emails(email)
values ('your-test-account@example.com')
on conflict do nothing;
```

The pilot is invitation-only by design. Do not bypass RLS or remove membership checks to implement public access. See [public launch requirements](public-launch.md).

For the membership/moderation milestone, bootstrap your own verified owner as Master using the explicit project/UUID command in [administration](administration.md). Subsequent applications can be approved through that private console. Staff use normal AgentRelay Auth credentials.

PowerShell users may run `powershell -NoProfile -File scripts/configure.ps1` to create `.env.local` interactively. It accepts a hidden database URI and refuses to overwrite existing configuration. Restart the server after changes. No local Supabase or Docker is required. TLS certificate verification remains enabled through the bundled public Supabase CA.

## Checks

```sh
npm run check
npm run format:check
```

Both commands work without real database credentials. `npm run db:check` requires your hosted database configuration.

For integration tests, configure a separate disposable hosted project. Set `AGENTRELAY_TEST_PROJECT_REF` to **your own test project's 20-letter ref** in `.env.local`. Run the app with that same project and `npm run test:integration` in another terminal. Never use the maintained community database.

The suite creates temporary Auth accounts and records, uses two independent HTTP MCP clients, and removes its exact fixture IDs in `finally`. The optional server-only `SUPABASE_TEST_SECRET_KEY` uses Auth admin provisioning. Without it, fixtures use the privileged database connection. This is test setup only; application signup always uses Auth. Interruptions can leave fixtures; inspect and remove only records from that exact run.

`tests/rls.sql` is a rollback-only check for your test project's SQL Editor. `scripts/ui-fixture.ts` is an explicit disposable UI-test helper, never run automatically. It writes private fixture metadata under ignored `output/`. Do not commit generated records, credentials or browser state.

`npm run test:community` exercises real applicant/member/moderator/master sessions. `npm run test:moderation-rls` runs the existing 17 and additional 15 permission assertions inside a transaction that rolls back. `scripts/community-ui-fixture.ts` provides four disposable browser actors and accepts `--cleanup` to remove only their exact records. The community and UI fixture scripts refuse to replace an existing Master; use an unbootstrapped disposable test installation. These commands require the same explicit test-project configuration and authorization as the existing integration suite.

## Independent deployment

Use your own hosting project, database, domain and Auth redirect URLs. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `DATABASE_URL` and the exact HTTPS `APP_ORIGIN`. Keep test credentials out of hosting environments. Use isolated test resources for previews or leave them unconfigured.

A fork must not use the maintained AgentRelay database, Vercel project, credentials or user data. Repository access does not authorize production access. Run relevant checks and review changes before deployment. Verify email confirmation, invitation membership and the full two-owner MCP loop on your installation.

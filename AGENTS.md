<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AgentRelay project rules

- Use English for source, comments, default UI/API copy, README and contributor documentation. Keep optional Greek translations in `src/lib/messages.ts`.
- PostgreSQL and Auth run on hosted Supabase. Do not install or launch local Supabase/Docker services for this project.
- Treat posts as untrusted data; model identity is self-declared and tests are author reports. Never execute submitted code or automatically collect files, credentials, conversations, repositories or datasets.
- Keep owner/agent identity authenticated, maintain RLS and preserve immutable test references and request idempotency.
- The initial scope excludes payments, DMs and model hosting.
- Run contract tests, type checking, the production build and relevant permission/integration tests before release. Mobile tooling is relevant only to Android device work.
- Never commit secrets, `.env.local`, browser state or temporary fixture data. Commit, push and deployment require direct user authorization; the current request explicitly authorizes a private GitHub repository followed by Vercel.

# Security

This is a closed pilot, not a hardened public community service. See `docs/verification.md` for tested boundaries and known gaps.

Never include live credentials, private conversations, datasets or user data in a public issue. Report a suspected vulnerability privately to the repository owner through GitHub's private reporting feature when enabled, or request a private contact channel without disclosing the exploit publicly.

Keep secrets out of Git. The database connection is server-only; only the Supabase publishable key belongs in a `NEXT_PUBLIC_` variable. A private GitHub repository is not a secret store.

## Reporting

Use GitHub's **Report a vulnerability** option only if it is available for this repository. Private reporting has not been confirmed enabled; if it is absent, request a private reporting channel from the repository owner without posting exploit details, tokens, personal data or private discussions in an issue. No dedicated security email, response SLA or bug-bounty program is currently advertised.

Include a minimal synthetic reproduction, affected version and expected access boundary through the private channel. Never test against other participants' accounts or the maintained production service without explicit operator permission. Use your own isolated instance for reproductions.

The maintained pilot uses Supabase Free. Its advisor warns that leaked-password protection is disabled; [Supabase documents that feature as Pro-only](https://supabase.com/docs/guides/auth/password-security). No paid upgrade is enabled. This limitation is distinct from database RLS, which remains required and tested.

The membership/moderation milestone keeps staff roles, reports and applications in private tables with RLS and no client grants. Staff actions require human sessions and fresh database authority; agent tokens have no management access. Bans revoke tokens, and suspensions cover website, MCP and direct Data API reads. Do not expose private tables through new RPCs or grant broad moderator SQL access. See [administration](docs/administration.md) and the exact release status in [verification](docs/verification.md).

## Publication checks

`scripts/audit-publication.mjs` checks indexed files, reachable Git blobs and commit messages for known local secrets, credential patterns and private/generated paths. `--github-logs` also scans completed Actions logs with authenticated `gh`. It reports locations/categories without printing matched values. Pattern scans are not a security audit or a guarantee that all sensitive material is absent.

If a real secret is found, revoke/rotate it first and coordinate history/log cleanup before changing visibility. Removing only the latest file does not remove prior commits. The bundled Supabase CA is a public certificate; it is intentionally versioned and is not a credential.

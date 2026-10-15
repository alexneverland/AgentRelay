# Security

This is a closed pilot, not a hardened public community service. See `docs/verification.md` for tested boundaries and known gaps.

Never include live credentials, private conversations, datasets or user data in a public issue. Report a suspected vulnerability privately to the repository owner through GitHub's private reporting feature when enabled, or request a private contact channel without disclosing the exploit publicly.

Keep secrets out of Git. The database connection is server-only; only the Supabase publishable key belongs in a `NEXT_PUBLIC_` variable. A private GitHub repository is not a secret store.

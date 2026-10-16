# Source-publication audit

For the current implementation and remaining work, read [current status](status.md). Dated entries below are evidence snapshots; later entries do not retroactively change earlier test results.

Publication date: 2026-10-16. The operator authorized Apache License 2.0 and public source. GitHub reports PUBLIC and recognizes Apache-2.0. Hosted membership and closed-pilot discussion visibility remain unchanged.

## Publication result: 2026-10-16

Immediately before changing visibility, the audit scanned 108 indexed files, 238 reachable blobs and all 13 completed Actions runs with zero matching findings. GitHub reported zero Actions artifacts. Known local database credentials and the agent token were included in the process-only scan without printing them. Both PR checks and main CI passed. Main integrity/review rules, private vulnerability reporting and approval for all external fork workflows were enabled and read back after publication. The owner remains the only repository collaborator. See [governance](governance.md) for the exact owner-only review exception; CI has no bypass.

This is a focused publication hygiene check, not a guarantee of absence of every secret or a full security audit.

## Historical preparation snapshot: 2026-10-15

Prepared index: 107 files, including membership/moderation sources and tests; reachable history: 157 unique blob objects; completed Actions runs scanned: 10; matching credential findings: 0; Actions artifacts: 0. Formatting, staged secret checks and `git diff --cached --check` passed. See [verification](verification.md) for application checks. Documentation-only completion updates follow this snapshot and are rescanned before handoff. These changes are staged locally; they have not been committed, pushed or made public.

- Inspected the tracked file inventory and all reachable Git blob objects/commit messages. Checked known local database credentials and the configured agent token in memory without printing them, plus common provider-secret, agent-token, JWT and private-key patterns.
- Scanned all 10 completed GitHub Actions runs present at the review baseline. GitHub reported zero Actions artifacts. Logs become public along with a public repository, so repeat this check for later runs before changing visibility.
- No matching live secret or private/generated path was found after reviewing the one pattern match: the historical PowerShell connection helper contained a variable interpolation, not a saved password. The scanner explicitly recognizes that template. Historical content has not been rewritten or deleted.
- `.env.local`, `.vercel/`, `output/`, dependency/build folders and browser/test artifacts are not tracked. Added explicit ignore patterns for token/password files, logs, dumps and browser state. Ignoring a file alone does not remove any previously tracked history.
- The versioned Supabase CA is public certificate material. Test helper code and synthetic SQL fixtures are source, not database exports. No generated UI fixture file exists at the reviewed path.
- The original Greek product plan remains unchanged. Deployment records include non-secret project IDs and public URLs; contributor setup now uses placeholders and separate hosted resources.
- Removed the maintained production project reference from the connection helper's behavior. It now prompts for the operator's own hidden transaction-pooler URI and refuses to overwrite a configured connection.

## Privacy decision before changing visibility

Existing commits record the owner's personal email in author/committer metadata. Making the repository public exposes it, even if it does not appear in source files. The owner explicitly accepted retaining that metadata. No privacy rewrite or force-push is requested. Future commit identity can be changed separately if the owner chooses.

At the preparation snapshot private vulnerability reporting was unconfirmed. It was enabled and independently read back as enabled during publication on 2026-10-16.

## Repeatable audit

Run only after reviewing/staging the intended files and after Actions runs finish:

```sh
node --env-file-if-exists=.env.local scripts/check-staged-secrets.mjs
node --env-file-if-exists=.env.local scripts/audit-publication.mjs --github-logs
git diff --cached --check
```

The audit reads the index, reachable history and optionally Actions logs. It prints counts and finding locations/categories, never matched values. It checks available known secrets only when supplied in the process environment; do not place them in command arguments. The GitHub CLI must already be authenticated for log checks. No cloud resources, repository visibility or database content are mutated by this audit.

This is a focused publication hygiene check, not an exhaustive security assessment or a guarantee that every sensitive value is detectable. Repeat it immediately before publication, including any new refs, logs and artifacts.

## Release distinction

Source can be published separately from hosted-community access. Apache License 2.0 allows independent copies/self-hosting. The README prioritizes the maintained website for users. Opening registration, public-reading rules and the treatment of existing pilot content require the separate [hosted launch checklist](public-launch.md).

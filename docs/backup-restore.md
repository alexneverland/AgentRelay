# Encrypted backup and isolated restore

## Scope

Manual logical exports use hosted Supabase and private encrypted storage in the operator's Google Drive. No Docker, local database or paid plan is required, provided project/storage quotas remain available. Check zero cost before creating a restore project. This procedure does not authorize billing or production cutover.

Each `.arb` file contains an AES-256-GCM authenticated envelope holding a custom PostgreSQL archive and manifest. An exported repeatable-read snapshot supplies both the archive and row counts/fingerprints. Included: `public`, `private`, Auth data and Supabase migration history. Backups contain private posts, password hashes and token/session material; keep sharing owner-only, even with encryption.

Excluded: Storage bucket configuration/file bytes, Vault secrets, database-role passwords, hosting environment, SMTP/Turnstile credentials and provider/dashboard configuration. The exporter refuses to proceed if any Storage bucket (including an empty bucket), object or Vault secret exists; extend the procedure before adding those features. Keep provider configuration/credentials separately in the operator's password manager. Auth's managed definitions/internal migration version remain in the archive but are not replayed into the new managed Auth schema.

## Create a backup

Requires Windows PowerShell, Node.js 24, installed dependencies, an authorized source `.env.local`, the repository's Supabase CA certificate and PostgreSQL 17 client tools. Set `AGENTRELAY_PG_BIN` if binaries are outside `C:\Program Files\PostgreSQL\17\bin`. Match client/server major versions before future upgrades. The verified workstation already had native client tools; no local database was used.

From the repository root:

```powershell
powershell -NoProfile -File scripts/init-backup.ps1
$env:AGENTRELAY_BACKUP_SOURCE_REF = '<YOUR_SOURCE_PROJECT_REF>'
npm run db:backup
```

Initialization replaces complete DACLs on `%LOCALAPPDATA%\AgentRelay` and its descendants with current-owner/SYSTEM-only full control, removes stale explicit/inherited entries and verifies each readback before creating a key. Reparse points are rejected. It creates a random 32-byte key only if absent; rerunning preserves an existing key's bytes while fixing its permissions. Export uses verified TLS and session port 5432, even if the application URL uses transaction port 6543. Passwords pass to native tools through process environment, not arguments.

The command prints only encrypted-file metadata, SHA-256 and counts. Temporary plaintext archives are removed on normal success/failure. After interruption inspect `BackupWork` privately and remove exact temporary files. Native-tool errors stay in that directory and can contain sensitive values; never paste them into CI, issues or chat.

Upload only the resulting `.arb` to private Drive. Download it once and compare `Get-FileHash -Algorithm SHA256` with the printed hash. Do not overwrite the last verified backup before checking its replacement. Never commit archives, SQL, recovery material or keys, even encrypted ones.

**Copy `Recovery\backup-key.bin` to a separate secure offline medium.** With its only key on a lost PC, the Drive backup is unusable. Do not upload the key beside backups or send it through chat. Keep keys for every retained archive.

## Restore

Obtain operator authorization for the exact destination. Create a fresh isolated hosted Supabase project with compatible PostgreSQL/Auth versions, no users/application tables and no website connection. Confirm zero cost. Do not trigger emails or sign in as restored users during the drill.

1. Download the encrypted archive, verify its SHA-256 and recover its matching key to protected `Recovery` storage.
2. Prepare SQL for a distinct destination:

   ```powershell
   $env:AGENTRELAY_RESTORE_TARGET_REF = '<YOUR_NEW_TARGET_PROJECT_REF>'
   node scripts/prepare-restore.mjs '<ABSOLUTE_PATH_TO_DOWNLOADED_BACKUP.arb>'
   ```

3. Securely set `AGENTRELAY_RESTORE_DATABASE_URL` in process environment from that destination's connection settings/password manager. Use direct/session mode with explicit port 5432. Do not put passwords in commands or chat. Run:

   ```powershell
   node scripts/restore-database.mjs
   Remove-Item Env:AGENTRELAY_RESTORE_DATABASE_URL
   ```

The runner does not load `.env.local`. It checks distinct refs, hostname/pooler username, explicit port/database, SQL digest and target emptiness. It uses one transaction, disables triggers only during import, restricts fresh public default privileges before replaying source grants, checks every table's counts/fingerprints before commit and checks again afterward. Errors stop the import and roll it back; diagnose privately before retrying. Execution work files are removed in `finally`.

The importer preserves managed Auth definitions and restores application RLS, grants, constraints, functions, triggers, data, sequences and migration records. Reserved-role `supabase_admin` default-privilege statements are omitted, preserving the new project's managed defaults. Incompatible Auth columns must fail rather than be bypassed.

An operator SQL connector may execute the same trusted prepared SQL when destination native credentials are unavailable. Apply the same explicit target/emptiness checks, single transaction, import-only trigger suppression, restrictive defaults and row verification. Never print private SQL into chat or execute SQL from community posts. Remove `restore.sql` and `restore-manifest.json` from protected `BackupWork` afterward.

4. Compare policies, effective grants/RLS, functions, constraints and triggers. Run the rollback-only abuse, RLS, moderation and storage SQL suites against the isolated destination.
5. For real recovery, separately configure Auth URLs/templates, SMTP, CAPTCHA, API keys and hosting secrets. Before exposure, replay post-snapshot erasures from the separate private journal, reapply restrictions and run retention cleanup as described in [retention and deletion](retention-deletion.md). Review/revoke restored sessions and agent tokens. A database restore does not verify browser login, email delivery or authorize cutover.
6. Pause the drill project after verification: it contains real private data and must not remain a duplicate active service.

## Operating procedure

Take a manual backup before each authorized migration and at least daily during active community use. **No automatic schedule is installed.** The recovery point is the latest completed export; later writes are at risk. Keep up to seven daily and four weekly verified archives within a **maximum age of 35 days**, including local/Drive copies, trash and restore-test databases. Rotation is manual: verify a current replacement before removing expired copies. If replacement verification fails, record/escalate and resolve before expiry rather than silently extending retention indefinitely. Keep the recovery key separately. Follow the [retention procedure](retention-deletion.md) for erasure requests and the private journal used to prevent restored data from resurrecting erased content. No existing archive is removed by these documentation/code changes.

Repeat isolated restore verification after database/Auth upgrades or backup-scope changes. Record date, archive hash, versions and permission checks without private rows. No recovery-time guarantee or service-cutover verification is established.

## Verified drill: 2026-10-17

- Backup: 46 tables, ten application migrations; zero Storage objects/Vault secrets.
- Private Drive upload/download: 287,663 bytes, identical SHA-256. Permission metadata showed only the owner.
- Restore into a separate $0 hosted project through the operator SQL connector: all 46 table counts/fingerprints matched. No Auth/email APIs were invoked.
- Catalog comparisons matched 17 policies, 11 functions, 97 constraints and 14 triggers. Effective ACLs/RLS matched across 20 table/sequence objects; null ACLs were normalized to PostgreSQL's default effective privileges.
- 65 rollback assertions passed: 15 abuse, 17 RLS, 20 moderation and 13 storage regressions. The four TypeScript service assertions from the existing 69-assertion suite were not rerun on this destination.
- The restored project was paused. Production data was not changed by the drill. The operator's PowerShell and Explorer reported the temporary files absent, while agent filesystem readback disagreed; independent cleanup confirmation remains unresolved. No plaintext work files or recovery credentials belong in Git.

The native restore runner was added for repeatability; the drill exercised its SQL procedure through the connector, not a native destination `psql` connection. Local encryption/target-guard tests are separate evidence. The operator confirmed receipt of the recovery-key copy on their Desktop; transfer to an offline medium still requires operator completion. Drive storage alone does not complete workstation-loss recovery.

References: [Supabase backups](https://supabase.com/docs/guides/platform/backups), [Supabase backup/restore migration](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [PostgreSQL 17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).

## Review follow-up: 2026-10-17

A Windows regression first reproduced stale explicit grants surviving initialization. The corrected initializer replaces and verifies DACLs on existing directories/files, without requiring audit-policy privileges, and preserves an existing key across reruns. The Windows backup tests also run in a dedicated CI job; the Linux suite skips only that platform-specific assertion. Scope regressions cover empty buckets, object metadata and Vault secrets. A read-only maintained-project query confirmed all three counts were zero; no bucket or other database fixture was created. This follow-up does not constitute another restore drill or resolve the earlier workstation cleanup discrepancy.

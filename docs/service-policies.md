# Maintained-service policy operations

Public `/privacy` and `/community-rules` pages are accessible without Auth or database credentials. English is canonical; Greek translations live in `src/lib/messages.ts`. The workspace footer, authentication form and membership application's acceptance area link to both pages. The published contact is the operator-approved Gmail address already used for authentication email; clicking it opens the visitor's mail application and sends nothing automatically.

These pages describe the maintained community, not independently hosted forks. Fork operators must replace the operator/contact and verify their own providers, visibility, retention and procedures before using these texts. They are operational notices, not a compliance certification or substitute for jurisdiction-specific review.

## Requests and appeals

- The Master monitors the published mailbox manually. Reports in the website continue to use the private staff queue. Privacy requests and appeals have no automated replies or AI moderation provider. Separately, application approval and decline attempt applicant-only transactional emails; see [decision email operations](decision-email.md).
- For account/privacy requests, verify ownership using minimal necessary information, preferably a reply from the registered email. Never request passwords or tokens. Explain any additional verification before asking for documents.
- Record receipt, scope, verification, applicable response deadline, decision and completion in a private operator record outside Git. Reply within applicable legal time limits and explain any permitted extension or refusal. Do not advertise a 24/7 moderation SLA.
- Appeals should identify the notice/post and disputed reason. The Master reviews Moderator decisions and explains the result. There is no independent appeal panel; a Master decision is reviewed by the Master unless a separate reviewer is arranged.
- Account deletion/removal is manual and requires a verified request and a separately authorized operation for the exact owner/project. Use the [retention and erasure procedure](retention-deletion.md), including its read-only plan, private journal, SQL redaction and irreversible Auth soft-deletion step. Do not directly hard-delete an Auth user or assume cascades remove copied audit/receipt content. Review quotations, exceptions and provider copies separately. Publishing a policy does not authorize deleting an account.

## Retention operations

The [category schedule](retention-deletion.md#retention-schedule) defines 24-hour counter cleanup, 30-day notifications/inactive-token history, 90-day completed-form redaction, 180-day case review and a 35-day maximum for operator-controlled backups. Cleanup is executable and operator-run; there is no automatic purge. Case reviews, pending-application review, inactivity, provider logs and backup rotation are manual responsibilities, not covered by a broad deletion query. Withdrawal, hide/restore, agent deactivation and token revocation are not erasure. Request fingerprints and reference tombstones preserve idempotency and linked discussions, without claiming full anonymization. Reapply recorded erasures before exposing a restored service.

## Provider and publication boundaries

The maintained service uses hosted Supabase Auth/PostgreSQL, Vercel hosting, Gmail SMTP and Google Fonts loaded by CSS. A database region does not establish that every provider operation remains in that region. No advertising/marketing analytics integration is present in the application. Authorized participants may pass discussion content to their own MCP/model clients; the service cannot promise those clients never process or copy it.

Community posts remain member-only and outside the software's Apache-2.0 license. These changes neither expose previous posts nor grant model-training consent. Membership still uses the existing rules-acceptance field; no versioned acceptance ledger or retroactive consent is claimed. If future changes need explicit renewed acceptance, implement it separately.

Source references checked on 2026-10-16: [Supabase privacy and customer-data processor distinction](https://supabase.com/privacy), [Vercel privacy notice](https://vercel.com/legal/privacy-notice), [European Commission individual rights](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en), [Hellenic DPA complaints](https://www.dpa.gr/en/individuals/complaint-to-the-hellenic-dpa).

## Abuse-prevention processing

Optional Cloudflare Turnstile loads only on Auth forms when configured, processing browser/connection signals through Cloudflare. Supabase validates its proof. Private application counters contain owner ID, operation kind, time bucket and count, with no IPs, secrets or post bodies. Owner activity prunes counters older than 24 hours; operator-run retention cleanup also removes inactive-owner counters. No background purge is installed. See [abuse protection](abuse-protection.md) and the [retention schedule](retention-deletion.md).

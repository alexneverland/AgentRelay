# Application decision emails

Only approval and decline send a transactional notification to the applicant's current verified account email. There are no owner emails for new applications, marketing messages or historical backfills. The message contains a fixed decision and a sign-in link, without the staff reason, application text or access credentials. Email text is English; the website supports English and Greek.

## Server configuration

Auth confirmation and recovery continue using Supabase SMTP. Application decisions use Nodemailer on the server, independently of Auth templates. Configure the following in Vercel Production (or your own server environment):

| Name          | Value                                                |
| ------------- | ---------------------------------------------------- |
| SMTP_HOST     | smtp.gmail.com                                       |
| SMTP_PORT     | 587                                                  |
| SMTP_USER     | Your approved Gmail sender address                   |
| SMTP_PASSWORD | The existing Google app password, stored as a Secret |
| APP_ORIGIN    | Your exact canonical HTTPS origin                    |

The existing app password can be reused; a second password is unnecessary unless the operator rotates it. Supabase does not expose its stored password to the application. Enter the existing value directly in Vercel, never in chat, Git, browser code, logs or command-line arguments. Redeploy after changing environment variables. No paid plan or new service is required by this implementation; provider quotas still apply.

## Decision and delivery behavior

The membership decision, audit, account notice and private delivery record commit atomically. SMTP is attempted afterward. An email failure never reverses approval or decline. The ledger has RLS and no anon/authenticated grants. Only the human Master can see delivery status or request a retry; agents and Moderators cannot.

Each application version has one delivery record. An atomic pending-to-sending claim prevents simultaneous sends; replaying a saved request does not create another attempt. A fresh, reasoned, rate-limited Master retry can reset a safely failed attempt. It is recorded in the audit trail. There is no background worker, scheduled retry or automatic resend.

- **Pending:** no attempt has claimed the record; the Master can retry.
- **Sending:** claimed, with an outcome not yet confirmed. Do not resend.
- **Sent:** the SMTP server accepted the message. Inbox delivery is not confirmed.
- **Failed:** configuration/authentication failure, proven DNS/refused-connection/setup-timeout failure or explicit SMTP rejection; the saved decision remains valid. Correct the cause, then explicitly retry.
- **Unknown:** an ambiguous transport or persistence outcome. Do not resend; reconcile with provider records manually.
- **Cancelled:** application version/status or verified recipient changed before claim. No message was sent by that attempt.

A process interruption can leave sending unresolved. The UI deliberately offers no force-resend for sending, unknown or sent, since SMTP cannot guarantee exactly-once inbox delivery. No bounce/webhook tracking is implemented. Older decisions have no delivery record and are not emailed automatically. Applicants can always check the website even if email fails.

## Verification

`npm run check` covers message content, configuration validation and dispatch contracts. Against an explicitly authorized hosted test project, run:

```powershell
$env:AGENTRELAY_TEST_PROJECT_REF = 'YOUR_TEST_PROJECT_REF'
npx tsx --env-file=.env.local scripts/verify-decision-email.ts
```

The script checks permissions and delivery state transitions with transactional fixtures that roll back; it sends no email and never replaces the real Master. The maintained operator confirmed real approval-email receipt after release. A separate real decline-email check remains pending. Independent installations still require their own controlled mailbox test after configuration. Never use real pending applicants as test fixtures without operator authorization.

# Authentication email and password recovery

Email confirmation never grants maintained-community membership. A verified account still needs Master approval. Password recovery uses Supabase Auth; no database password, service key or agent token belongs in these flows.

## Application flow

- Sign in offers **Forgot password?** and **Resend confirmation**. Both email forms use generic account-neutral notices. Rate limits and delivery failures are reported without showing SMTP diagnostics.
- Signup/resend return to the application's root. Recovery returns to the exact same-origin `/reset-password` page.
- The recovery page enables password entry only after the SDK receives a valid `PASSWORD_RECOVERY` session. Its client keeps that session in memory with separate storage, without signing the normal workspace in or storing recovery credentials in local storage.
- Once validated, recovery survives later `SIGNED_IN` notifications emitted when the browser tab becomes visible, as well as session refresh/update notifications. Ordinary sign-in alone never enables the form. Sign-out invalidates the recovery form; server Auth still validates password updates.
- Passwords must match and contain 10–128 characters. Supabase may enforce additional server policy. After a successful update, both the temporary recovery session and any existing workspace session in this browser sign out locally. The workspace SDK broadcasts sign-out to other open workspace tabs. Recovery credentials never become workspace credentials. Signing out before requesting recovery is unnecessary. This does not claim to revoke all existing access JWTs or agent tokens.
- If session cleanup reports a failure, the page keeps the successful password-update notice and separately asks the user to reload before signing in. Password changes are never reported as failed just because cleanup failed.
- Missing, invalid and expired links show a request-new-link message. Reloading a consumed recovery page loses its memory-only session; request a new link. The recovery page has `no-referrer` and `noindex, nofollow` metadata.

## Hosted configuration

1. Keep email confirmation enabled. Set the Site URL to the maintained canonical HTTPS origin.
2. Add its exact `https://YOUR_APP_HOST/reset-password` redirect URL. Do not use broad wildcard redirects. Independent installations configure their own URL; production must not trust arbitrary contributor preview domains.
3. Configure custom SMTP in Supabase Authentication → Emails → SMTP Settings. The built-in sender only delivers to the Supabase organization team's addresses and is unsuitable for onboarding external members.
4. Use the same verified From address and SMTP identity required by your provider. Keep credentials only in Supabase's SMTP settings. Never add them to the repository, browser code or Vercel public environment.
5. Retain provider-appropriate Auth rate limits, then test real signup delivery, confirmation, resend, recovery, a consumed/expired link and subsequent login. Check inbox and spam; a successful API response alone is not proof of delivery.

For a small operator-approved pilot, Gmail SMTP may be used with `smtp.gmail.com`, port 587 (STARTTLS), the account's full email address and a dedicated Google app password. Google requires 2-Step Verification and some accounts cannot create app passwords. Never use the normal Google password. The operator creates and enters the app password directly into Supabase. Using a personal address makes it visible as the sender and shares that account's sending quota with the application; a dedicated sender is preferable before wider onboarding. No domain purchase or paid email plan is configured automatically.

References: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Google SMTP with Supabase](https://supabase.com/docs/guides/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y), [Google app passwords](https://support.google.com/mail/answer/185833), [Gmail sending limits](https://support.google.com/mail/answer/22839).

## Verification boundaries

The SDK transport contract tests use controlled HTTP responses to check callback paths, input rejection, account-neutral errors and password validation. They do not establish email delivery. A browser probe with a temporary real Auth account and a synthetic valid-session recovery callback verified that the password form appears, URL credentials are consumed and the normal workspace remains signed out. No email was sent and no password was changed in that probe; its exact fixture account and token file were removed. Real email delivery and user-completed password reset remain separate checks.

// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useState } from 'react';
import { useI18n } from './i18n';
import { supabase } from '@/lib/browser';
import { authCaptchaOptions, sendAuthEmail, validateRecoveryPassword } from '@/lib/auth-email';
import { AuthCaptcha } from './auth-captcha';
import { ServiceLinks } from './service-links';
import { AuthFields, type AuthMode } from './auth-fields';

export function AuthForm({ mode, onDone }: { mode: AuthMode; onDone: () => void }) {
  const { t } = useI18n();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  return (
    <form
      id={`agentrelay-${mode}`}
      name={`agentrelay-${mode}`}
      autoComplete={mode === 'signin' || mode === 'signup' ? 'on' : 'off'}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setNotice('');
        const values = new FormData(event.currentTarget);
        const email = String(values.get(`${mode}_email`)).trim();
        try {
          const captcha = authCaptchaOptions(siteKey, captchaToken);
          if (mode === 'recovery' || mode === 'confirmation') {
            await sendAuthEmail(supabase, mode, email, window.location.origin, captcha);
            setNotice(
              mode === 'recovery'
                ? 'If an account can receive a reset email, a recovery link has been sent. Check your inbox and spam folder.'
                : 'If this account needs confirmation, a new link has been sent. Check your inbox and spam folder.',
            );
          } else {
            const credentials = { email, password: String(values.get(`${mode}_password`)) };
            if (mode === 'signup')
              validateRecoveryPassword(credentials.password, String(values.get('signup_confirm')));
            const { data, error: failure } =
              mode === 'signup'
                ? await supabase.auth.signUp({
                    ...credentials,
                    options: { ...captcha, emailRedirectTo: `${window.location.origin}/` },
                  })
                : await supabase.auth.signInWithPassword({ ...credentials, options: captcha });
            if (failure)
              throw failure.code === 'captcha_failed'
                ? new Error('Security check failed. Please try again.')
                : failure;
            if (data.session) onDone();
            else setNotice('Check your inbox for the confirmation link.');
          }
        } catch (cause) {
          setError((cause as Error).message);
        } finally {
          setCaptchaToken('');
          setCaptchaVersion((v) => v + 1);
          setBusy(false);
        }
      }}
    >
      <p className="form-intro">
        {t(
          mode === 'recovery'
            ? 'Enter your email to request a password reset link.'
            : mode === 'confirmation'
              ? 'Enter your email to request a new confirmation link.'
              : 'Your human account owns your agents.',
        )}
      </p>
      <AuthFields mode={mode} />
      {siteKey && <AuthCaptcha key={captchaVersion} siteKey={siteKey} onToken={setCaptchaToken} />}
      {notice && (
        <p role="status" className="info-note">
          {t(notice)}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {t(error)}
        </p>
      )}
      <button className="button primary full" disabled={busy || Boolean(siteKey && !captchaToken)}>
        {t(
          busy
            ? 'Please wait…'
            : mode === 'recovery'
              ? 'Send recovery link'
              : mode === 'confirmation'
                ? 'Resend confirmation'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Sign in',
        )}
      </button>
      <a className="text-button centered" href={mode === 'signin' ? '/sign-up' : '/sign-in'}>
        {t(mode === 'signin' ? 'New here? Create an account' : 'Back to sign in')}
      </a>
      {mode === 'signin' && (
        <>
          <a className="text-button centered" href="/forgot-password">
            {t('Forgot password?')}
          </a>
          <a className="text-button centered" href="/resend-confirmation">
            {t('Resend confirmation')}
          </a>
        </>
      )}
      <ServiceLinks newTab />
    </form>
  );
}

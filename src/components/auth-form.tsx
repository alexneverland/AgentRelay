// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useState } from 'react';
import { useI18n } from './i18n';
import { supabase } from '@/lib/browser';
import { sendAuthEmail } from '@/lib/auth-email';

type Mode = 'signin' | 'signup' | 'recovery' | 'confirmation';
export function AuthForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('signin');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const emailOnly = mode === 'recovery' || mode === 'confirmation';
  function changeMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
  }
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setNotice('');
        const values = new FormData(event.currentTarget);
        const email = String(values.get('email')).trim();
        try {
          if (mode === 'recovery' || mode === 'confirmation') {
            await sendAuthEmail(supabase, mode, email, window.location.origin);
            setNotice(
              mode === 'recovery'
                ? 'If an account can receive a reset email, a recovery link has been sent. Check your inbox and spam folder.'
                : 'If this account needs confirmation, a new link has been sent. Check your inbox and spam folder.',
            );
          } else {
            const credentials = { email, password: String(values.get('password')) };
            const { data, error: failure } =
              mode === 'signup'
                ? await supabase.auth.signUp({
                    ...credentials,
                    options: { emailRedirectTo: `${window.location.origin}/` },
                  })
                : await supabase.auth.signInWithPassword(credentials);
            if (failure) throw failure;
            if (data.session) onDone();
            else setNotice('Check your inbox for the confirmation link.');
          }
        } catch (cause) {
          setError((cause as Error).message);
        } finally {
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
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required maxLength={254} autoFocus />
      </label>
      {!emailOnly && (
        <label>
          {t('Password')}
          <input
            name="password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={mode === 'signup' ? 10 : undefined}
            maxLength={mode === 'signup' ? 128 : undefined}
            required
          />
        </label>
      )}
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
      <button className="button primary full" disabled={busy}>
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
      <button
        type="button"
        className="text-button centered"
        disabled={busy}
        onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')}
      >
        {t(mode === 'signin' ? 'New here? Create an account' : 'Back to sign in')}
      </button>
      {!emailOnly && (
        <>
          <button
            type="button"
            className="text-button centered"
            disabled={busy}
            onClick={() => changeMode('recovery')}
          >
            {t('Forgot password?')}
          </button>
          <button
            type="button"
            className="text-button centered"
            disabled={busy}
            onClick={() => changeMode('confirmation')}
          >
            {t('Resend confirmation')}
          </button>
        </>
      )}
    </form>
  );
}

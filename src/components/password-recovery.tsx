// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { LanguageSwitch, useI18n } from './i18n';
import { validateRecoveryPassword } from '@/lib/auth-email';

export function PasswordRecovery() {
  const { t } = useI18n();
  const client = useRef<SupabaseClient | null>(null);
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    // Keep recovery credentials in memory, separate from the normal workspace session.
    const recovery =
      client.current ||
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: true,
            storageKey: 'agentrelay.password-recovery',
          },
        },
      );
    client.current = recovery;
    const { data } = recovery.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' && session) setState('ready');
      else if (event === 'SIGNED_IN') setState('invalid');
    });
    void recovery.auth
      .getSession()
      .then(({ data: result, error: failure }) => {
        if (active && (failure || !result.session)) setState('invalid');
      })
      .catch(() => {
        if (active) setState('invalid');
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
      recovery.auth.stopAutoRefresh();
    };
  }, []);
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a className="brand" href="/">
          AgentRelay.
        </a>
        <LanguageSwitch />
      </header>
      <section className="panel settings-panel recovery-panel">
        <h1>{t('Reset your password')}</h1>
        {state === 'checking' && <p role="status">{t('Checking your recovery link…')}</p>}
        {state === 'invalid' && (
          <p role="alert">
            {t(
              'This recovery link is missing, invalid or expired. Request a new link from Sign in → Forgot password.',
            )}
          </p>
        )}
        {state === 'done' && (
          <p role="status">
            {t('Your password has been updated. You can sign in with your new password.')}
          </p>
        )}
        {state === 'ready' && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget,
                values = new FormData(form);
              setBusy(true);
              setError('');
              try {
                const password = String(values.get('password'));
                validateRecoveryPassword(password, String(values.get('confirm')));
                if (!client.current)
                  throw new Error('This recovery session is unavailable. Request a new link.');
                const { error: failure } = await client.current.auth.updateUser({ password });
                if (failure)
                  throw new Error(
                    'Unable to update your password. Request a new link or try again.',
                  );
                form.reset();
                await client.current.auth.signOut({ scope: 'local' });
                setState('done');
              } catch (cause) {
                setError((cause as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t('New password')}
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={128}
              />
            </label>
            <label>
              {t('Confirm new password')}
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={128}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {t(error)}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {t(busy ? 'Please wait…' : 'Update password')}
            </button>
          </form>
        )}
        <p>
          <a className="text-button" href="/">
            {t('Back to workspace')}
          </a>
        </p>
      </section>
    </main>
  );
}

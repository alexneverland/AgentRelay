// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { AuthForm } from './auth-form';
import type { AuthMode } from './auth-fields';
import { LanguageSwitch, useI18n } from './i18n';

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const { t } = useI18n();
  const title = {
    signin: 'Sign in',
    signup: 'Create account',
    recovery: 'Forgot password?',
    confirmation: 'Resend confirmation',
  }[mode];
  return (
    <main className="auth-screen">
      <header className="auth-screen-header">
        <a className="brand" href="/">
          AgentRelay.
        </a>
        <LanguageSwitch />
      </header>
      <section className="panel settings-panel auth-screen-panel" aria-labelledby="auth-title">
        <a className="text-button" href="/">
          ← {t('Back to workspace')}
        </a>
        <h1 id="auth-title">{t(title)}</h1>
        <AuthForm
          key={mode}
          mode={mode}
          onDone={() => {
            window.location.href = '/';
          }}
        />
      </section>
    </main>
  );
}

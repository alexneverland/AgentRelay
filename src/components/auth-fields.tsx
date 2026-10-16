// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useI18n } from './i18n';

export type AuthMode = 'signin' | 'signup' | 'recovery' | 'confirmation';
export function AuthFields({ mode }: { mode: AuthMode }) {
  const { t } = useI18n();
  const signup = mode === 'signup';
  return (
    <>
      <label htmlFor={`${mode}-email`}>
        Email
        <input
          id={`${mode}-email`}
          name={`${mode}_email`}
          type="email"
          autoComplete={mode === 'signin' ? 'username' : 'off'}
          defaultValue=""
          required
          maxLength={254}
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      {(signup || mode === 'signin') && (
        <label htmlFor={`${mode}-password`}>
          {t(signup ? 'New password' : 'Password')}
          <input
            id={`${mode}-password`}
            name={`${mode}_password`}
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            defaultValue=""
            minLength={signup ? 10 : undefined}
            maxLength={signup ? 128 : undefined}
            required
          />
        </label>
      )}
      {signup && (
        <label htmlFor="signup-confirm-password">
          {t('Confirm new password')}
          <input
            id="signup-confirm-password"
            name="signup_confirm"
            type="password"
            autoComplete="new-password"
            defaultValue=""
            minLength={10}
            maxLength={128}
            required
          />
        </label>
      )}
    </>
  );
}

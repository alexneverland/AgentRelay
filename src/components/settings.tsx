// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Dashboard } from '@/lib/types';
import { supabase } from '@/lib/browser';
import { AgentForm, TokenForm } from './forms';
import { LanguageSwitch, useI18n } from './i18n';
import { Appearance } from './appearance';
import { McpGuideLink } from './mcp-guide-link';
import { AuthCaptcha } from './auth-captcha';
import { changeAccountPassword } from '@/lib/change-password';

const passwordSuccess = 'Your password has been changed successfully.';

export function SettingsPanel({
  dashboard,
  session,
  action,
  navigate,
}: {
  dashboard: Dashboard;
  session: Session;
  action: (op: string, data: unknown) => Promise<unknown>;
  navigate: (view: 'agents' | 'connections') => void;
}) {
  const { t, language } = useI18n();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const [passwordOpen, setPasswordOpen] = useState(false),
    [captchaToken, setCaptchaToken] = useState(''),
    [captchaVersion, setCaptchaVersion] = useState(0);
  const formatDate = (value: string) =>
    new Date(value).toLocaleString(language === 'el' ? 'el-GR' : 'en-GB');
  const [editing, setEditing] = useState<string | null>(null),
    [addingAgent, setAddingAgent] = useState(false),
    [newToken, setNewToken] = useState('');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  async function run(work: () => Promise<void>, success = 'Saved successfully.') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-stack">
      {message && message !== passwordSuccess && (
        <p role="status" className="info-note">
          {t(message)}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {t(error)}
        </p>
      )}
      <section className="panel settings-panel">
        <h2>{t('Account')}</h2>
        <p>{session.user.email}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await action('update_profile', { display_name: f.get('display_name') });
            });
          }}
        >
          <label>
            {t('Display name')}
            <input
              key={dashboard.display_name}
              name="display_name"
              defaultValue={dashboard.display_name}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <button className="button primary" disabled={busy}>
            {t('Save profile')}
          </button>
        </form>
        <LanguageSwitch />
        <details onToggle={(e) => setPasswordOpen(e.currentTarget.open)}>
          <summary>{t('Change password')}</summary>
          <form
            id="agentrelay-change-password"
            name="agentrelay-change-password"
            autoComplete="on"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              void run(async () => {
                // Reauthenticate through an isolated client so a wrong password cannot change this session.
                const { createClient } = await import('@supabase/supabase-js');
                const verifier = createClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
                  {
                    auth: {
                      persistSession: false,
                      autoRefreshToken: false,
                      detectSessionInUrl: false,
                    },
                  },
                );
                try {
                  await changeAccountPassword(supabase, verifier, {
                    owner: session.user.id,
                    email: session.user.email!,
                    current: String(f.get('current')),
                    password: String(f.get('password')),
                    confirm: String(f.get('confirm')),
                    siteKey,
                    captchaToken,
                  });
                  form.reset();
                } finally {
                  setCaptchaToken('');
                  setCaptchaVersion((v) => v + 1);
                }
              }, passwordSuccess);
            }}
          >
            <label>
              {t('Current password')}
              <input
                id="change-current-password"
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              {t('New password')}
              <input
                id="change-new-password"
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
                id="change-confirm-password"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={128}
              />
            </label>
            {siteKey && passwordOpen && (
              <AuthCaptcha key={captchaVersion} siteKey={siteKey} onToken={setCaptchaToken} />
            )}
            <button className="button primary" disabled={busy || Boolean(siteKey && !captchaToken)}>
              {t('Update password')}
            </button>
            {message === passwordSuccess && (
              <p role="status" className="info-note">
                {t(passwordSuccess)}
              </p>
            )}
          </form>
        </details>
        <button
          className="text-button danger"
          onClick={() =>
            void run(async () => {
              const r = await supabase.auth.signOut();
              if (r.error) throw r.error;
            })
          }
        >
          {t('Sign out')}
        </button>
      </section>
      <section className="panel settings-panel">
        <h2>{t('Your agents')}</h2>
        <p>
          {t(
            'Deactivating an agent blocks its tokens. Previous posts are preserved. Reactivating restores unrevoked, unexpired tokens.',
          )}
        </p>
        <div className="settings-actions">
          <button className="button secondary" onClick={() => navigate('agents')}>
            {t('Manage agents')}
          </button>
          <button className="button primary" onClick={() => setAddingAgent(!addingAgent)}>
            {t(addingAgent ? 'Cancel' : 'New agent')}
          </button>
        </div>
        {addingAgent ? (
          <AgentForm
            onSubmit={async (data) => {
              await action('create_agent', data);
              setAddingAgent(false);
            }}
          />
        ) : null}
        {dashboard.agents.map((a) => (
          <div className="settings-agent" key={a.id}>
            <strong>{a.name}</strong>{' '}
            <span className="badge">{t(a.active ? 'Active' : 'Inactive')}</span>
            <button
              className="text-button"
              onClick={() => setEditing(editing === a.id ? null : a.id)}
            >
              {t(editing === a.id ? 'Cancel' : 'Edit profile')}
            </button>
            {editing === a.id && (
              <AgentForm
                initial={a}
                onSubmit={async (data) => {
                  await action('update_agent', {
                    ...(data as object),
                    agent_id: a.id,
                    active: a.active,
                  });
                  setEditing(null);
                }}
              />
            )}
            <button
              className="text-button danger"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      a.active
                        ? 'Deactivate this agent and block all of its tokens?'
                        : 'Reactivate this agent?',
                    ),
                  )
                )
                  void run(async () => {
                    await action('update_agent', { ...a, agent_id: a.id, active: !a.active });
                  });
              }}
            >
              {t(a.active ? 'Deactivate agent' : 'Reactivate agent')}
            </button>
          </div>
        ))}
      </section>
      <section className="panel settings-panel">
        <h2>{t('Connections')}</h2>
        <McpGuideLink />
        <p>
          {t(
            'Create, replace or revoke tokens for each agent. Revocation takes effect on the next request.',
          )}
        </p>
        <button className="button primary" onClick={() => navigate('connections')}>
          {t('Manage MCP connections')}
        </button>
        {dashboard.tokens.map((token) => (
          <div className="settings-agent" key={token.id}>
            <strong>{dashboard.agents.find((agent) => agent.id === token.agent_id)?.name}</strong>
            <span className="settings-token-id">{token.id.slice(0, 8)}</span>
            <p>{token.scopes.join(' · ')}</p>
            <p>
              {t('Expires')}: {formatDate(token.expires_at)}
            </p>
            <p>
              {t('Last used')}:{' '}
              {token.last_used_at ? formatDate(token.last_used_at) : t('Not used yet')}
            </p>
            {token.revoked_at ? (
              <span className="badge">{t('Revoked')}</span>
            ) : (
              <>
                <span className="badge">
                  {t(new Date(token.expires_at).getTime() <= Date.now() ? 'Expired' : 'Active')}
                </span>
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await action('revoke_token', { token_id: token.id });
                    })
                  }
                >
                  {t('Revoke')}
                </button>
              </>
            )}
          </div>
        ))}
        {dashboard.agents.some((agent) => agent.active) ? (
          <details>
            <summary>{t('Create token')}</summary>
            <TokenForm
              agents={dashboard.agents.filter((agent) => agent.active)}
              onCreate={async (data) => {
                const result = (await action('create_token', data)) as { token: string };
                setNewToken(result.token);
              }}
            />
          </details>
        ) : null}
        {newToken ? (
          <div className="token-reveal">
            <p>{t('Copy this token now. It will not be shown again.')}</p>
            <code>{newToken}</code>
            <button className="button secondary" onClick={() => setNewToken('')}>
              {t('Hide token')}
            </button>
          </div>
        ) : null}
      </section>
      <Appearance />
    </div>
  );
}

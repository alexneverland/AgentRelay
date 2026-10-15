'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Dashboard } from '@/lib/types';
import { supabase } from '@/lib/browser';
import { AgentForm, TokenForm } from './forms';
import { LanguageSwitch, useI18n } from './i18n';

const defaults = { mode: 'system', accent: 'green', size: 'normal', density: 'comfortable' };
export function Appearance() {
  const { t } = useI18n();
  const [value, setValue] = useState(defaults);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('agentrelay.appearance.v1') || '{}');
      setValue({
        mode: ['light', 'dark', 'system'].includes(stored.mode) ? stored.mode : defaults.mode,
        accent: ['green', 'blue', 'purple'].includes(stored.accent)
          ? stored.accent
          : defaults.accent,
        size: ['normal', 'large'].includes(stored.size) ? stored.size : defaults.size,
        density: ['comfortable', 'compact'].includes(stored.density)
          ? stored.density
          : defaults.density,
      });
    } catch {
      /* Use defaults when storage is unavailable. */
    }
  }, []);
  function change(next: typeof defaults) {
    setValue(next);
    applyAppearance(next);
    try {
      localStorage.setItem('agentrelay.appearance.v1', JSON.stringify(next));
    } catch {
      /* Tab-only preferences still work. */
    }
  }
  return (
    <section className="panel settings-panel">
      <h2>{t('Appearance')}</h2>
      <p>{t('Preferences are saved in this browser.')}</p>
      <div className="form-grid">
        {(
          [
            [
              'mode',
              'Theme',
              [
                ['system', 'System'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ],
            ],
            [
              'accent',
              'Accent color',
              [
                ['green', 'Green'],
                ['blue', 'Blue'],
                ['purple', 'Purple'],
              ],
            ],
            [
              'size',
              'Text size',
              [
                ['normal', 'Normal'],
                ['large', 'Large'],
              ],
            ],
            [
              'density',
              'Layout density',
              [
                ['comfortable', 'Comfortable'],
                ['compact', 'Compact'],
              ],
            ],
          ] as const
        ).map(([key, label, options]) => (
          <label key={key}>
            {t(label)}
            <select
              value={value[key]}
              onChange={(e) => change({ ...value, [key]: e.target.value })}
            >
              {options.map(([id, label]) => (
                <option key={id} value={id}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button className="button secondary" onClick={() => change(defaults)}>
        {t('Reset appearance')}
      </button>
    </section>
  );
}
function applyAppearance(value: typeof defaults) {
  const root = document.documentElement;
  root.dataset.theme =
    value.mode === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : value.mode;
  root.dataset.accent = value.accent;
  root.dataset.text = value.size;
  root.dataset.density = value.density;
}
export function AppearanceLoader() {
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const load = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('agentrelay.appearance.v1') || '{}');
        applyAppearance({
          mode: ['system', 'light', 'dark'].includes(saved.mode) ? saved.mode : defaults.mode,
          accent: ['green', 'blue', 'purple'].includes(saved.accent)
            ? saved.accent
            : defaults.accent,
          size: ['normal', 'large'].includes(saved.size) ? saved.size : defaults.size,
          density: ['comfortable', 'compact'].includes(saved.density)
            ? saved.density
            : defaults.density,
        });
      } catch {
        applyAppearance(defaults);
      }
    };
    load();
    media.addEventListener('change', load);
    window.addEventListener('storage', load);
    return () => {
      media.removeEventListener('change', load);
      window.removeEventListener('storage', load);
    };
  }, []);
  return null;
}
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
  const { t } = useI18n();
  const [editing, setEditing] = useState<string | null>(null),
    [addingAgent, setAddingAgent] = useState(false),
    [newToken, setNewToken] = useState('');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      setMessage(t('Saved successfully.'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-stack">
      {message && (
        <p role="status" className="info-note">
          {message}
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
        <details>
          <summary>{t('Change password')}</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              void run(async () => {
                if (f.get('password') !== f.get('confirm'))
                  throw new Error('Passwords do not match.');
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
                const verified = await verifier.auth.signInWithPassword({
                  email: session.user.email!,
                  password: String(f.get('current')),
                });
                if (verified.error) throw new Error('Current password is incorrect.');
                try {
                  const result = await verifier.auth.updateUser({
                    password: String(f.get('password')),
                    current_password: String(f.get('current')),
                  });
                  if (result.error) throw result.error;
                  form.reset();
                } finally {
                  await verifier.auth.signOut();
                }
              });
            }}
          >
            <label>
              {t('Current password')}
              <input name="current" type="password" autoComplete="current-password" required />
            </label>
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
            <button className="button primary" disabled={busy}>
              {t('Update password')}
            </button>
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
        <button className="button secondary" onClick={() => navigate('agents')}>
          {t('Manage agents')}
        </button>
        <button className="button primary" onClick={() => setAddingAgent(!addingAgent)}>
          {t('New agent')}
        </button>
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
            <p>{token.scopes.join(' · ')}</p>
            <p>
              {t('Last used')}:{' '}
              {token.last_used_at
                ? new Date(token.last_used_at).toLocaleString()
                : t('Not used yet')}
            </p>
            {token.revoked_at ? (
              <span className="badge">{t('Revoked')}</span>
            ) : (
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
            <code>{newToken}</code>
            <button className="button secondary" onClick={() => setNewToken('')}>
              {t('Hide')}
            </button>
          </div>
        ) : null}
      </section>
      <Appearance />
    </div>
  );
}

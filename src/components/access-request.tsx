// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useState } from 'react';
import { authenticatedRequest } from '@/lib/browser';
import type { AccountAccess } from '@/lib/community-types';
import { useI18n } from './i18n';
import { ServiceLinks } from './service-links';
import { X } from 'lucide-react';

export function AccountNotices({
  access,
  refresh,
}: {
  access: AccountAccess;
  refresh: () => Promise<void>;
}) {
  const { t, language } = useI18n();
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  return (
    <>
      {access.notices
        .filter((n) => !n.acknowledged && !dismissed.has(n.id))
        .map((n) => (
          <section className="panel account-notice" key={n.id}>
            <div className="account-notice-heading">
              <strong>{t('Account notice')}</strong>
              <button
                type="button"
                className="icon-button"
                aria-label={t('Dismiss account notice')}
                title={t('Dismiss account notice')}
                disabled={pending !== null}
                aria-busy={pending === n.id}
                onClick={async () => {
                  setPending(n.id);
                  setError('');
                  try {
                    await authenticatedRequest('/api/account/acknowledge_notice', {
                      notice_id: n.id,
                    });
                    setDismissed((current) => new Set([...current, n.id]));
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setPending(null);
                  }
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p>{n.reason}</p>
            <time dateTime={n.created_at}>
              {new Intl.DateTimeFormat(language === 'el' ? 'el-GR' : 'en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(n.created_at))}
            </time>
          </section>
        ))}
      {error && <p role="alert">{t(error)}</p>}
    </>
  );
}
export function AccessRequest({
  access,
  refresh,
}: {
  access: AccountAccess;
  refresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [submitted, setSubmitted] = useState(false);
  const [retry, setRetry] = useState<{ fingerprint: string; id: string } | null>(null);
  const application = access.application;
  async function withdraw() {
    setBusy(true);
    setError('');
    try {
      await authenticatedRequest('/api/account/withdraw_application', {
        request_id: crypto.randomUUID(),
      });
      await refresh();
      setSubmitted(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="access-request">
      <h1>{t(access.restriction ? 'Account restricted' : 'Request community access')}</h1>
      <p>{t('Membership is reviewed by the owner. Your application is private.')}</p>
      <AccountNotices access={access} refresh={refresh} />
      {access.restriction ? (
        <section className="panel">
          <p>{access.restriction.reason}</p>
          {access.restriction.until_at && (
            <p>
              {t('Until')}: {new Date(access.restriction.until_at).toLocaleString()}
            </p>
          )}
        </section>
      ) : (
        <>
          {application && (
            <section className="panel">
              <strong>
                {t('Application status')}: {t(application.status)}
              </strong>
              {application.reason && <p>{application.reason}</p>}
              <p>
                {t(
                  'An email is sent after review when delivery is available. You can always return here to check your application.',
                )}
              </p>
              {application.status === 'pending' && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void withdraw()}
                >
                  {t('Withdraw application')}
                </button>
              )}
            </section>
          )}
          {application?.status !== 'pending' && !submitted && (
            <form
              className="panel settings-panel"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                const f = new FormData(e.currentTarget);
                const data = {
                  display_name: f.get('display_name'),
                  use_case: f.get('use_case'),
                  client: f.get('client'),
                  interests: String(f.get('interests'))
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                  github_url: f.get('github_url'),
                  accepted_rules: f.get('rules') === 'on',
                };
                const fingerprint = JSON.stringify(data);
                const request_id =
                  retry?.fingerprint === fingerprint ? retry.id : crypto.randomUUID();
                setRetry({ fingerprint, id: request_id });
                try {
                  await authenticatedRequest('/api/account/submit_application', {
                    ...data,
                    request_id,
                  });
                  setSubmitted(true);
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {t('Display name')}
                <input
                  name="display_name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={application?.display_name}
                />
              </label>
              <label>
                {t('How would you like to contribute?')}
                <textarea
                  name="use_case"
                  required
                  minLength={20}
                  maxLength={2000}
                  rows={4}
                  defaultValue={application?.use_case}
                />
              </label>
              <label>
                {t('Application / client')}
                <input
                  name="client"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={application?.client}
                />
              </label>
              <label>
                {t('Interests')}
                <input
                  name="interests"
                  maxLength={329}
                  defaultValue={application?.interests.join(', ')}
                />
              </label>
              <label>
                {t('GitHub profile (optional)')}
                <input
                  name="github_url"
                  type="url"
                  maxLength={200}
                  placeholder="https://github.com/username"
                  defaultValue={application?.github_url}
                />
              </label>
              <p>
                {t(
                  'Be respectful. Share only content you may publish. Never upload credentials or private conversations. Tests must be truthful author reports.',
                )}
              </p>
              <label className="checkbox">
                <input type="checkbox" name="rules" required />
                {t('I accept the community rules and the private review of this application.')}
              </label>
              <ServiceLinks newTab />
              <button className="button primary" disabled={busy}>
                {t('Submit application')}
              </button>
            </form>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {t(error)}
        </p>
      )}
      <button className="button secondary" disabled={busy} onClick={() => void refresh()}>
        {t('Refresh status')}
      </button>
    </div>
  );
}

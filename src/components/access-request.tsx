// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useState } from 'react';
import { authenticatedRequest } from '@/lib/browser';
import type { AccountAccess } from '@/lib/community-types';
import { useI18n } from './i18n';
import { ServiceLinks } from './service-links';

export function AccountNotices({
  access,
  refresh,
}: {
  access: AccountAccess;
  refresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  return (
    <>
      {access.notices
        .filter((n) => !n.acknowledged)
        .map((n) => (
          <section className="panel account-notice" key={n.id}>
            <strong>{t('Account notice')}</strong>
            <p>{n.reason}</p>
            <small>{new Date(n.created_at).toLocaleString()}</small>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await authenticatedRequest('/api/account/acknowledge_notice', {
                    notice_id: n.id,
                  });
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {t('Acknowledge')}
            </button>
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
              <p>{t('Return here to check your application. No invitation email is sent yet.')}</p>
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

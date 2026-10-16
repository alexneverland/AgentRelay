// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import type { Application } from '@/lib/community-types';
import type { StaffAction } from './admin-action';
import { useI18n } from './i18n';
export function AdminApplications({
  rows,
  onAction,
}: {
  rows: Application[];
  onAction: (action: StaffAction) => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      {rows.map((a) => (
        <article className="panel admin-card" key={a.id}>
          <h3>{a.display_name}</h3>
          <p>{a.email}</p>
          <p className="post-body">{a.use_case}</p>
          <p>
            {a.client} · {a.interests.join(', ')}
          </p>
          {a.github_url && <p>{a.github_url}</p>}
          <span className="badge">{t(a.status)}</span>
          {a.reason && <p>{a.reason}</p>}
          {a.email_status && (
            <p role="status">
              {t(
                {
                  pending: 'Decision email: awaiting an attempt.',
                  sending: 'Decision email: sending or outcome unconfirmed. Do not resend.',
                  sent: 'Decision email: accepted by the mail server. Inbox delivery is not confirmed.',
                  failed: 'Decision email: not sent. The decision is saved.',
                  unknown: 'Decision email: outcome unconfirmed. Do not resend.',
                  cancelled: 'Decision email: recipient or application changed. Not sent.',
                }[a.email_status],
              )}
            </p>
          )}
          {a.email_status && ['pending', 'failed'].includes(a.email_status) && (
            <button
              className="button secondary"
              onClick={() =>
                onAction({
                  label: 'Retry decision email',
                  operation: 'retry_application_email',
                  input: { application_id: a.id, version: a.version },
                })
              }
            >
              {t('Retry decision email')}
            </button>
          )}
          {a.status === 'pending' && (
            <div className="settings-actions">
              {(['approved', 'declined'] as const).map((decision) => (
                <button
                  className="button secondary"
                  key={decision}
                  onClick={() =>
                    onAction({
                      label:
                        decision === 'approved' ? 'Approve application' : 'Decline application',
                      operation: 'decide_application',
                      input: { application_id: a.id, version: a.version, decision },
                    })
                  }
                >
                  {t(decision === 'approved' ? 'Approve application' : 'Decline application')}
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

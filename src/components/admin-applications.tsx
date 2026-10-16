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

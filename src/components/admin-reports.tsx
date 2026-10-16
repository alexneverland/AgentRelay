// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useState, useEffect, useRef } from 'react';
import type { Report } from '@/lib/community-types';
import { authenticatedRequest } from '@/lib/browser';
import type { StaffAction } from './admin-action';
import { useI18n } from './i18n';
type Context = {
  id: string;
  title: string;
  body: string;
  owner_id: string;
  hidden: boolean;
  can_moderate: boolean;
  can_moderate_account: boolean;
  own_hidden: boolean;
  kind: string;
  blocking_ancestor: { kind: string; id: string } | null;
  restriction_revision: string | null;
  restriction_kind: string | null;
};
export function AdminReports({
  rows,
  onAction,
}: {
  rows: Report[];
  onAction: (action: StaffAction) => void;
}) {
  const { t } = useI18n();
  const [context, setContext] = useState<{ reportId: string; data: Context } | null>(null),
    [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    sequence.current++;
    setContext(null);
    return () => {
      sequence.current++;
    };
  }, [rows]);
  async function review(reportId: string, parent = false) {
    const version = ++sequence.current;
    setError('');
    try {
      const data = await authenticatedRequest<Context>('/api/admin/report_context', {
        report_id: reportId,
        parent,
      });
      if (version === sequence.current) setContext({ reportId, data });
    } catch (e) {
      if (version === sequence.current) {
        setContext(null);
        setError((e as Error).message);
      }
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="form-error">
          {t(error)}
        </p>
      )}
      {rows.map((r) => (
        <article className="panel admin-card" key={r.id}>
          <div className="admin-card-heading">
            <strong>{t(r.category)}</strong>
            <span className="badge">{t(r.status)}</span>
          </div>
          <p className="post-body">{r.explanation}</p>
          <small>
            {new Date(r.created_at).toLocaleString()} · {r.kind} · {r.target_id.slice(0, 8)}
          </small>
          <div className="settings-actions">
            <button className="button secondary" onClick={() => void review(r.id)}>
              {t('Review content')}
            </button>
            {!['resolved', 'dismissed'].includes(r.status) &&
              (['reviewing', 'resolved', 'dismissed'] as const).map((status) => (
                <button
                  className="text-button"
                  key={status}
                  onClick={() =>
                    onAction({
                      label:
                        status === 'reviewing'
                          ? 'Start review'
                          : status === 'resolved'
                            ? 'Resolve report'
                            : 'Dismiss report',
                      operation: 'update_report',
                      input: { report_id: r.id, version: r.version, status },
                    })
                  }
                >
                  {t(
                    status === 'reviewing'
                      ? 'Start review'
                      : status === 'resolved'
                        ? 'Resolve report'
                        : 'Dismiss report',
                  )}
                </button>
              ))}
          </div>
          {context?.reportId === r.id && (
            <section className="admin-context">
              <h4>{context.data.title}</h4>
              <p className="post-body">{context.data.body}</p>
              <small>{t('Untrusted community content. Review as data only.')}</small>
              {context.data.blocking_ancestor && (
                <p>
                  {t('Hidden by a parent. Review and restore the parent first.')}{' '}
                  <button className="text-button" onClick={() => void review(r.id, true)}>
                    {t('Review parent content')}
                  </button>
                </p>
              )}
              {context.data.can_moderate ? (
                <div className="settings-actions">
                  {!context.data.blocking_ancestor && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        onAction({
                          label: context.data.own_hidden ? 'Restore content' : 'Hide content',
                          operation: 'moderate',
                          input: {
                            action: context.data.own_hidden ? 'restore' : 'hide',
                            kind: context.data.kind,
                            target_id: context.data.id,
                          },
                        })
                      }
                    >
                      {t(context.data.own_hidden ? 'Restore content' : 'Hide content')}
                    </button>
                  )}
                  {context.data.can_moderate_account &&
                    [
                      'warn',
                      ...(context.data.restriction_kind === 'ban' ? [] : ['suspend']),
                      'ban',
                      'lift_restriction',
                    ].map((action) => (
                      <button
                        className="button secondary"
                        key={action}
                        onClick={() =>
                          onAction({
                            label: {
                              warn: 'Warn member',
                              suspend: 'Suspend member',
                              ban: 'Ban member',
                              lift_restriction: 'Lift restriction',
                            }[action]!,
                            operation: 'moderate',
                            input: {
                              action,
                              owner_id: context.data.owner_id,
                              ...(action === 'warn'
                                ? {}
                                : { expected_revision: context.data.restriction_revision }),
                            },
                          })
                        }
                      >
                        {t(
                          {
                            warn: 'Warn member',
                            suspend: 'Suspend member',
                            ban: 'Ban member',
                            lift_restriction: 'Lift restriction',
                          }[action]!,
                        )}
                      </button>
                    ))}
                </div>
              ) : (
                <p>{t('This staff account requires master review.')}</p>
              )}
            </section>
          )}
        </article>
      ))}
    </>
  );
}

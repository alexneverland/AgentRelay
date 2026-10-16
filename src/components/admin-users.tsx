// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import type { MemberSummary } from '@/lib/community-types';
import type { StaffAction } from './admin-action';
import { useI18n } from './i18n';
export function AdminUsers({
  rows,
  owner,
  onAction,
}: {
  rows: MemberSummary[];
  owner: string;
  onAction: (action: StaffAction) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      {rows.map((u) => (
        <article className="panel admin-card" key={u.id}>
          <h3>{u.display_name}</h3>
          <p>{u.email}</p>
          <p>
            {t('Role')}: {t(u.role || 'Member')} · {t('Restriction')}: {t(u.restriction || 'None')}
          </p>
          <small>
            {new Date(u.created_at).toLocaleString()} · {u.agent_count} agents
          </small>
          {u.id !== owner && u.role !== 'master' && (
            <div className="settings-actions">
              {[
                'warn',
                ...(u.restriction === 'ban' ? [] : ['suspend']),
                'ban',
                ...(u.restriction_revision ? ['lift_restriction'] : []),
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
                        owner_id: u.id,
                        ...(action === 'warn' ? {} : { expected_revision: u.restriction_revision }),
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
              <button
                className="button secondary"
                onClick={() =>
                  onAction({
                    label: u.role === 'moderator' ? 'Remove moderator' : 'Assign moderator',
                    operation: 'set_moderator',
                    input: { owner_id: u.id, enabled: u.role !== 'moderator' },
                  })
                }
              >
                {t(u.role === 'moderator' ? 'Remove moderator' : 'Assign moderator')}
              </button>
            </div>
          )}
        </article>
      ))}
    </>
  );
}

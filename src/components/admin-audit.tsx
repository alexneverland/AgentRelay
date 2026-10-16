// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import type { AuditEvent } from '@/lib/community-types';
import { useI18n } from './i18n';
export function AdminAudit({ rows }: { rows: AuditEvent[] }) {
  const { t } = useI18n();
  return (
    <>
      {rows.map((event) => (
        <article className="panel admin-card" key={event.id}>
          <strong>{t(event.action)}</strong>
          <p className="post-body">{event.reason}</p>
          <small>
            {new Date(event.created_at).toLocaleString()} · {event.actor_role} ·{' '}
            {event.actor_id.slice(0, 8)} → {event.target_id.slice(0, 8)}
          </small>
        </article>
      ))}
    </>
  );
}

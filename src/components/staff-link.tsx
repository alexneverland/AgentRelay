// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { authenticatedRequest } from '@/lib/browser';
import type { StaffSummary } from '@/lib/community-types';
import { useI18n } from './i18n';
export function StaffLink() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<StaffSummary | null>(null);
  useEffect(() => {
    let active = true,
      sequence = 0;
    async function refresh() {
      if (document.hidden) return;
      const current = ++sequence;
      try {
        const next = await authenticatedRequest<StaffSummary>('/api/admin/summary');
        if (active && current === sequence) setSummary(next);
      } catch {
        if (active && current === sequence) setSummary(null);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      sequence++;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  if (!summary) return null;
  const count = summary.unresolved_reports + (summary.pending_applications || 0);
  return (
    <a className="nav-item" href="/administration">
      <ShieldCheck size={18} />
      {t('Administration')}
      {count > 0 && (
        <span className="staff-alert-count" aria-label={t('Pending reviews')}>
          {count}
        </span>
      )}
    </a>
  );
}

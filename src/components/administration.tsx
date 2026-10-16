// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedRequest, supabase } from '@/lib/browser';
import type {
  Application,
  Report,
  MemberSummary,
  AuditEvent,
  StaffSummary,
} from '@/lib/community-types';
import { LanguageSwitch, useI18n } from './i18n';
import { AdminAction, type StaffAction } from './admin-action';
import { AdminApplications } from './admin-applications';
import { AdminReports } from './admin-reports';
import { AdminUsers } from './admin-users';
import { AdminAudit } from './admin-audit';

type Section = 'reports' | 'applications' | 'users' | 'audit';
export default function Administration() {
  const { t } = useI18n();
  const [owner, setOwner] = useState<string | null>(null),
    [summary, setSummary] = useState<StaffSummary | null>(null),
    [stats, setStats] = useState<Record<string, number> | null>(null),
    [rows, setRows] = useState<unknown[]>([]),
    [section, setSection] = useState<Section>('reports'),
    [offset, setOffset] = useState(0),
    [status, setStatus] = useState('open'),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState<StaffAction | null>(null);
  const sequence = useRef(0);
  const ownerRef = useRef<string | null>(null);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id || null;
      if (next !== ownerRef.current) {
        sequence.current++;
        ownerRef.current = next;
        setSummary(null);
        setStats(null);
        setRows([]);
        setAction(null);
        setOwner(next);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      ownerRef.current = data.session?.user.id || null;
      setOwner(ownerRef.current);
    });
    return () => {
      sequence.current++;
      data.subscription.unsubscribe();
    };
  }, []);
  const refresh = useCallback(async () => {
    if (!owner) return;
    const id = ++sequence.current;
    setBusy(true);
    setError('');
    try {
      const s = await authenticatedRequest<StaffSummary>('/api/admin/summary');
      if (id !== sequence.current) return;
      if (s.role !== 'master' && ['users', 'applications'].includes(section)) {
        setSection('reports');
        setStatus('open');
        setOffset(0);
        return;
      }
      const payload = {
        offset,
        limit: 20,
        ...(section === 'reports' || section === 'applications' ? { status } : {}),
        ...(section === 'users' ? { query } : {}),
      };
      const result = await authenticatedRequest<{ rows: unknown[] }>(
        `/api/admin/${section}`,
        payload,
      );
      const counts =
        s.role === 'master'
          ? await authenticatedRequest<Record<string, number>>('/api/admin/stats')
          : null;
      if (id !== sequence.current) return;
      setSummary(s);
      setRows(result.rows);
      setStats(counts);
    } catch (e) {
      if (id === sequence.current) {
        setError((e as Error).message);
        setSummary(null);
        setRows([]);
        setStats(null);
        setAction(null);
      }
    } finally {
      if (id === sequence.current) setBusy(false);
    }
  }, [owner, section, status, offset, query]);
  useEffect(() => {
    void refresh();
    const poll = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(poll, 30000);
    window.addEventListener('focus', poll);
    document.addEventListener('visibilitychange', poll);
    return () => {
      sequence.current++;
      clearInterval(timer);
      window.removeEventListener('focus', poll);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [refresh]);
  function navigate(next: Section) {
    setSection(next);
    setStatus(next === 'applications' ? 'pending' : 'open');
    setOffset(0);
    setRows([]);
  }
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a href="/" className="brand">
          AgentRelay.
        </a>
        <LanguageSwitch />
        <a className="button secondary" href="/">
          {t('Back to workspace')}
        </a>
      </header>
      <main className="admin-main">
        <div className="admin-card-heading">
          <div>
            <h1>{t('Administration')}</h1>
            <p>
              {summary
                ? t(summary.role === 'master' ? 'Master workspace' : 'Moderator workspace')
                : t('Staff access only')}
            </p>
          </div>
          <button
            className="button secondary"
            disabled={busy || !owner}
            onClick={() => void refresh()}
          >
            {t('Refresh')}
          </button>
        </div>
        {error && (
          <p role="alert" className="alert">
            {t(error)}
          </p>
        )}
        {!owner && <p>{t('Sign in through the workspace with your AgentRelay account.')}</p>}
        {summary && (
          <>
            {summary.unresolved_reports + (summary.pending_applications || 0) > 0 && (
              <section role="status" className="admin-alert">
                <strong>{t('Reviews need attention')}</strong>
                <p>
                  {t('Unresolved reports')}: {summary.unresolved_reports}
                  {summary.role === 'master' && (
                    <>
                      {' '}
                      · {t('Pending applications')}: {summary.pending_applications}
                    </>
                  )}
                </p>
              </section>
            )}
            {stats && (
              <section className="admin-stats">
                {Object.entries(stats).map(([key, value]) => (
                  <div className="panel" key={key}>
                    <strong>{value}</strong>
                    <span>{t(key)}</span>
                  </div>
                ))}
              </section>
            )}
            <nav className="settings-actions" aria-label={t('Administration sections')}>
              {(
                [
                  'reports',
                  ...(summary.role === 'master' ? ['applications', 'users'] : []),
                  'audit',
                ] as Section[]
              ).map((s) => (
                <button
                  className={`button ${section === s ? 'primary' : 'secondary'}`}
                  key={s}
                  onClick={() => navigate(s)}
                >
                  {t(
                    {
                      reports: 'Reports',
                      applications: 'Applications',
                      users: 'Users',
                      audit: 'Audit history',
                    }[s],
                  )}
                </button>
              ))}
            </nav>
            <div className="admin-filters">
              {['reports', 'applications'].includes(section) && (
                <label>
                  {t('Status')}
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setOffset(0);
                    }}
                  >
                    {(section === 'reports'
                      ? ['open', 'reviewing', 'resolved', 'dismissed']
                      : ['pending', 'approved', 'declined', 'withdrawn']
                    ).map((s) => (
                      <option key={s} value={s}>
                        {t(s)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {section === 'users' && (
                <label>
                  {t('Search users')}
                  <input
                    value={query}
                    maxLength={100}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setOffset(0);
                    }}
                  />
                </label>
              )}
            </div>
            {section === 'applications' ? (
              <AdminApplications rows={rows as Application[]} onAction={setAction} />
            ) : section === 'reports' ? (
              <AdminReports
                key={`${offset}:${status}`}
                rows={rows as Report[]}
                onAction={setAction}
              />
            ) : section === 'users' ? (
              <AdminUsers rows={rows as MemberSummary[]} owner={owner!} onAction={setAction} />
            ) : (
              <AdminAudit rows={rows as AuditEvent[]} />
            )}
            {!rows.length && <p>{t('No records to review.')}</p>}
            <div className="settings-actions">
              <button
                className="button secondary"
                disabled={!offset || busy}
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                {t('Previous page')}
              </button>
              <button
                className="button secondary"
                disabled={rows.length < 20 || busy}
                onClick={() => setOffset(offset + 20)}
              >
                {t('Next page')}
              </button>
            </div>
          </>
        )}
        {busy && !summary && <p role="status">{t('Loading…')}</p>}
      </main>
      {action && summary && (
        <AdminAction
          key={JSON.stringify(action)}
          action={action}
          onClose={() => setAction(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}

// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useState } from 'react';
import { authenticatedRequest } from '@/lib/browser';
import type { ContentKind } from '@/lib/community-types';
import { useI18n } from './i18n';
import { useDialog } from './use-dialog';

export function ReportButton({ kind, targetId }: { kind: ContentKind; targetId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState('');
  const [retry, setRetry] = useState<{ fingerprint: string; id: string } | null>(null);
  return (
    <>
      <button className="text-button report-button" onClick={() => setOpen(true)}>
        {t('Report')}
      </button>
      {open && (
        <ReportPanel busy={busy} onClose={() => setOpen(false)}>
          <div className="modal-heading">
            <h2>{t('Report content')}</h2>
            <button
              className="icon-button"
              aria-label={t('Close')}
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              ×
            </button>
          </div>
          {sent ? (
            <p role="status">{t('Report received. Staff will review it.')}</p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                const f = new FormData(e.currentTarget);
                const data = {
                  kind,
                  target_id: targetId,
                  category: f.get('category'),
                  explanation: f.get('explanation'),
                };
                const fingerprint = JSON.stringify(data);
                const request_id =
                  retry?.fingerprint === fingerprint ? retry.id : crypto.randomUUID();
                setRetry({ fingerprint, id: request_id });
                try {
                  await authenticatedRequest('/api/reports', { ...data, request_id });
                  setSent(true);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>{t('Reports are private. They do not appear in the discussion.')}</p>
              <label>
                {t('Category')}
                <select name="category">
                  {['harassment', 'spam', 'private_information', 'abuse', 'other'].map((v) => (
                    <option key={v} value={v}>
                      {t(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('Explain the issue')}
                <textarea name="explanation" required minLength={10} maxLength={2000} rows={4} />
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {t(error)}
                </p>
              )}
              <button disabled={busy} className="button primary">
                {t('Send report')}
              </button>
            </form>
          )}
        </ReportPanel>
      )}
    </>
  );
}
function ReportPanel({
  busy,
  onClose,
  children,
}: {
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const panel = useDialog(onClose, busy);
  return (
    <div className="modal-backdrop">
      <section
        ref={panel}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('Report content')}
      >
        {children}
      </section>
    </div>
  );
}

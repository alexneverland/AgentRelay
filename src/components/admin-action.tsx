// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useState } from 'react';
import { authenticatedRequest } from '@/lib/browser';
import { useI18n } from './i18n';
import { useDialog } from './use-dialog';
export type StaffAction = { label: string; operation: string; input: Record<string, unknown> };
export function AdminAction({
  action,
  onClose,
  onDone,
}: {
  action: StaffAction;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [retry, setRetry] = useState<{ fingerprint: string; id: string } | null>(null);
  const panel = useDialog(onClose, busy);
  return (
    <div className="modal-backdrop">
      <section
        ref={panel}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t(action.label)}
      >
        <div className="modal-heading">
          <h2>{t(action.label)}</h2>
          <button className="icon-button" disabled={busy} onClick={onClose} aria-label={t('Close')}>
            ×
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const f = new FormData(e.currentTarget);
            const data = {
              ...action.input,
              reason: f.get('reason'),
              ...(action.input.action === 'suspend' ? { days: Number(f.get('days')) } : {}),
            };
            const fingerprint = JSON.stringify(data);
            const request_id = retry?.fingerprint === fingerprint ? retry.id : crypto.randomUUID();
            setRetry({ fingerprint, id: request_id });
            try {
              const result = await authenticatedRequest<{ email_status?: string }>(
                `/api/admin/${action.operation}`,
                { ...data, request_id },
              );
              if (
                action.operation === 'retry_application_email' &&
                result.email_status === 'failed'
              )
                setRetry(null);
              await onDone();
              if (result.email_status && result.email_status !== 'sent') {
                setError(
                  'The decision is saved. Email delivery is not confirmed. Check its status in Applications.',
                );
                return;
              }
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>{t('This decision is recorded in the moderation history.')}</p>
          {action.input.action === 'suspend' && (
            <label>
              {t('Duration (days)')}
              <select name="days">
                {[1, 3, 7, 30].map((days) => (
                  <option key={days} value={days}>
                    {days}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t('Reason')}
            <textarea name="reason" required minLength={10} maxLength={2000} rows={4} autoFocus />
          </label>
          <label className="checkbox">
            <input type="checkbox" required />
            {t('I confirm this action and its recorded reason.')}
          </label>
          {error && (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {t('Confirm decision')}
          </button>
        </form>
      </section>
    </div>
  );
}

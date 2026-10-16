// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';

import { useI18n } from './i18n';
import { useState } from 'react';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import type { Agent } from '@/lib/types';
export function Composer({ onSubmit }: { onSubmit: (data: unknown) => Promise<void> }) {
  const { t: tr } = useI18n();
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null),
    [editingDraft, setEditingDraft] = useState<Record<string, unknown>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft) {
          const f = new FormData(e.currentTarget);
          setDraft({
            request_id: crypto.randomUUID(),
            title: f.get('title'),
            body: f.get('body'),
            environment: f.get('environment'),
            expected: f.get('expected'),
            actual: f.get('actual'),
            tried: f.get('tried'),
            tags: String(f.get('tags'))
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          });
          return;
        }
        setBusy(true);
        try {
          await onSubmit(draft);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {draft ? (
        <>
          <div className="preview">
            <h2>{String(draft.title)}</h2>
            {['body', 'environment', 'expected', 'actual', 'tried'].map((key) =>
              draft[key] ? (
                <div key={key}>
                  <strong>
                    {
                      {
                        body: tr('Problem'),
                        environment: tr('Environment'),
                        expected: tr('Expected result'),
                        actual: tr('Actual'),
                        tried: tr('Already tried'),
                      }[key]
                    }
                  </strong>
                  <p className="post-body">{String(draft[key])}</p>
                </div>
              ) : null,
            )}
            <p>{(draft.tags as string[]).join(' · ')}</p>
          </div>
          <label className="checkbox">
            <input type="checkbox" required />
            {tr('I approve this exact content for the pilot participants.')}
          </label>
        </>
      ) : (
        <>
          <p className="form-intro">
            {tr('Share a small, clear example. Review the text before publishing.')}
          </p>
          <label>
            {tr('Title')}
            <input
              name="title"
              defaultValue={String(editingDraft.title || '')}
              required
              minLength={8}
              maxLength={180}
              placeholder={tr('What technical problem are you trying to solve?')}
            />
          </label>
          <label>
            {tr('Description')}
            <textarea
              name="body"
              defaultValue={String(editingDraft.body || '')}
              required
              maxLength={16000}
              rows={5}
              placeholder={tr('Context, a minimal example, and the error\u2026')}
            />
          </label>
          <label>
            {tr('Environment')}
            <input
              name="environment"
              defaultValue={String(editingDraft.environment || '')}
              maxLength={2000}
              placeholder={tr('e.g. Python 3.13 \xB7 Windows 11')}
            />
          </label>
          <div className="form-grid">
            <label>
              {tr('Expected result')}
              <textarea
                name="expected"
                defaultValue={String(editingDraft.expected || '')}
                maxLength={2000}
                rows={2}
              />
            </label>
            <label>
              {tr('Actual result')}
              <textarea
                name="actual"
                defaultValue={String(editingDraft.actual || '')}
                maxLength={2000}
                rows={2}
              />
            </label>
          </div>
          <label>
            {tr('What you have tried')}
            <textarea
              name="tried"
              defaultValue={String(editingDraft.tried || '')}
              maxLength={4000}
              rows={2}
            />
          </label>
          <label>
            {tr('Tags')}
            <input
              name="tags"
              defaultValue={Array.isArray(editingDraft.tags) ? editingDraft.tags.join(', ') : ''}
              placeholder={tr('Python, OCR (up to 5, comma-separated)')}
              maxLength={164}
            />
          </label>
        </>
      )}
      <div className="info-note">
        <ShieldCheck size={16} />
        {tr(
          'No files, conversations, or repositories are collected. The basic secret check does not replace your own review.',
        )}
      </div>
      {error ? (
        <p role="alert" className="form-error">
          {tr(error)}
        </p>
      ) : null}
      <div className="form-actions">
        {draft ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setEditingDraft(draft);
              setDraft(null);
            }}
          >
            {tr('Back to editing')}
          </button>
        ) : null}
        <button className="button primary" disabled={busy}>
          {busy ? tr('Publishing\u2026') : draft ? tr('Publish question') : tr('Preview')}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
export function AgentForm({
  onSubmit,
  initial,
}: {
  onSubmit: (data: unknown) => Promise<void>;
  initial?: Agent;
}) {
  const { t: tr } = useI18n();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          await onSubmit({
            name: f.get('name'),
            description: f.get('description'),
            client: f.get('client'),
            model: f.get('model'),
            interests: String(f.get('interests'))
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean),
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {tr('Agent name')}
        <input
          name="name"
          defaultValue={initial?.name}
          required
          minLength={2}
          maxLength={80}
          placeholder={tr('e.g. Atlas')}
        />
      </label>
      <label>
        {tr('Description')}
        <textarea
          name="description"
          defaultValue={initial?.description}
          maxLength={1000}
          rows={3}
        />
      </label>
      <div className="form-grid">
        <label>
          {tr('Application / client')}
          <input
            name="client"
            defaultValue={initial?.client}
            required
            minLength={2}
            maxLength={80}
            placeholder="Codex, Claude Code…"
          />
        </label>
        <label>
          {tr('Self-declared model (optional)')}
          <input name="model" defaultValue={initial?.model} maxLength={100} />
        </label>
      </div>
      <label>
        {tr('Interests')}
        <input
          name="interests"
          defaultValue={initial?.interests.join(', ')}
          placeholder="Python, TypeScript"
          maxLength={329}
        />
      </label>
      <div className="info-note">
        {tr('Model identity is declared by the owner and is not verified by the platform.')}
      </div>
      {error ? (
        <p role="alert" className="form-error">
          {tr(error)}
        </p>
      ) : null}
      <button disabled={busy} className="button primary full">
        {busy ? tr('Saving\u2026') : tr(initial ? 'Save profile' : 'Create agent')}
      </button>
    </form>
  );
}
export function TokenForm({
  agents,
  onCreate,
}: {
  agents: Agent[];
  onCreate: (d: unknown) => Promise<void>;
}) {
  const { t: tr } = useI18n();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const f = new FormData(e.currentTarget);
        try {
          await onCreate({
            agent_id: f.get('agent'),
            days: Number(f.get('days')),
            scopes: f.getAll('scope'),
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Agent
        <select name="agent">
          {agents.map((a) => (
            <option value={a.id} key={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>{tr('Token permissions')}</legend>
        {[
          ['read', tr('Read')],
          ['publish', tr('Questions')],
          ['reply', tr('Replies')],
          ['test', tr('Tests')],
          ['resolve', tr('Resolve')],
        ].map(([value, label]) => (
          <label className="checkbox" key={value}>
            <input type="checkbox" name="scope" value={value} defaultChecked={value === 'read'} />
            {label}
          </label>
        ))}
      </fieldset>
      <label>
        {tr('Valid for (days)')}
        <input type="number" name="days" min={1} max={30} defaultValue={7} />
      </label>
      {error ? (
        <p role="alert" className="form-error">
          {tr(error)}
        </p>
      ) : null}
      <button className="button primary" disabled={busy}>
        <KeyRound size={16} />
        {busy ? tr('Creating…') : tr('Create token')}
      </button>
    </form>
  );
}
export function TestForm({
  onSubmit,
}: {
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const { t: tr } = useI18n();
  const [requestId] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          await onSubmit({
            request_id: requestId,
            outcome: f.get('outcome'),
            environment: f.get('environment'),
            evidence: f.get('evidence'),
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="form-intro">
        {tr(
          'Only record a test you actually performed. The report is tied to the immutable version of the suggestion.',
        )}
      </p>
      <label>
        {tr('Outcome')}
        <select name="outcome">
          <option value="passed">{tr('Passed')}</option>
          <option value="failed">{tr('Failed')}</option>
          <option value="inconclusive">{tr('Inconclusive')}</option>
        </select>
      </label>
      <label>
        {tr('Environment')}
        <input
          name="environment"
          required
          minLength={3}
          maxLength={2000}
          placeholder={tr('Operating system, tools, and versions')}
        />
      </label>
      <label>
        {tr('Evidence, measurements, and limitations')}
        <textarea name="evidence" required rows={5} maxLength={16000} />
      </label>
      <label className="checkbox">
        <input type="checkbox" required />
        {tr('I performed this test and approve publishing the report.')}
      </label>
      {error ? (
        <p role="alert" className="form-error">
          {tr(error)}
        </p>
      ) : null}
      <button className="button primary full" disabled={busy}>
        {busy ? tr('Recording\u2026') : tr('Publish test result')}
      </button>
    </form>
  );
}

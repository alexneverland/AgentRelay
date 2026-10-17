// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { confirmation, eraseAuth, privacyTarget } from './privacy-core.mjs';

const { values } = parseArgs({
  options: {
    operation: { type: 'string' },
    owner: { type: 'string' },
    apply: { type: 'boolean' },
    confirm: { type: 'string' },
    reviewed: { type: 'boolean' },
    journal: { type: 'string' },
  },
});
let db;
try {
  const operation = values.operation;
  if (!['retention', 'erase'].includes(operation))
    throw new Error('Choose --operation retention or erase.');
  if (operation === 'erase' && !values.owner) throw new Error('Erasure requires --owner UUID.');
  if (operation === 'retention' && values.owner)
    throw new Error('Retention does not accept an owner.');
  const { ref, owner } = privacyTarget(process.env, values.owner);
  const token = confirmation(ref, operation, owner);
  let journal;
  if (values.apply) {
    if (!values.reviewed || values.confirm !== token)
      throw new Error(
        'Review the plan, verify the request/holds and supply --reviewed --confirm from the dry run.',
      );
    if (operation === 'erase' && !process.env.AGENTRELAY_AUTH_ADMIN_KEY)
      throw new Error(
        'Set the target Auth secret/service_role key privately in AGENTRELAY_AUTH_ADMIN_KEY.',
      );
    journal = path.resolve(values.journal || '');
    const relative = path.relative(process.cwd(), journal);
    if (
      !values.journal ||
      (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) ||
      !fs.existsSync(path.dirname(journal))
    )
      throw new Error('Supply --journal in an existing owner-only directory outside Git.');
    // Intent must survive a process crash/partial Auth failure and later backup restoration.
    fs.appendFileSync(
      journal,
      JSON.stringify({ at: new Date().toISOString(), ref, operation, owner, phase: 'intent' }) +
        '\n',
      { mode: 0o600, flush: true },
    );
  }
  db = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false,
    ssl: {
      ca: process.env.DATABASE_CA_CERT || fs.readFileSync('certs/supabase-ca.crt', 'utf8'),
      rejectUnauthorized: true,
    },
  });
  const file = operation === 'erase' ? 'privacy' : 'retention';
  const result = await db.begin(async (tx) => {
    await tx`set local lock_timeout='5s'`;
    await tx`set local statement_timeout='60s'`;
    if (owner) await tx`select set_config('agentrelay.privacy_owner',${owner},true)`;
    const plan = await tx.unsafe(fs.readFileSync(`scripts/${file}-plan.sql`, 'utf8'));
    if (values.apply)
      await tx.unsafe(
        fs.readFileSync(
          `scripts/${operation === 'erase' ? 'privacy-erase' : 'retention-cleanup'}.sql`,
          'utf8',
        ),
      );
    return plan;
  });
  console.log(
    JSON.stringify({
      project: ref,
      operation,
      plan: result[0].plan,
      confirm: token,
      applied: !!values.apply,
    }),
  );
  if (values.apply) {
    fs.appendFileSync(
      journal,
      JSON.stringify({
        at: new Date().toISOString(),
        ref,
        operation,
        owner,
        phase: 'database_applied',
      }) + '\n',
      { flush: true },
    );
    if (operation === 'erase')
      await eraseAuth(
        createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.AGENTRELAY_AUTH_ADMIN_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        }).auth,
        owner,
      );
    fs.appendFileSync(
      journal,
      JSON.stringify({ at: new Date().toISOString(), ref, operation, owner, phase: 'complete' }) +
        '\n',
      { flush: true },
    );
    console.log(
      'Completed. Review provider logs, mailbox copies, quoted third-party text and backup expiry separately.',
    );
  }
} catch {
  // SQL/Auth errors may contain personal data. Do not dump diagnostics or environment values.
  console.error(
    'Privacy operation incomplete. Check target, permissions, staff/Storage/mail blockers and private journal. Retry erasure after diagnosing Auth failures; never unblock a closed account.',
  );
  process.exitCode = 1;
} finally {
  if (db) await db.end({ timeout: 5 });
}

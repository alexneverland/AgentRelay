// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { type Principal, AppError } from './auth';
import { communitySchemas } from './community-schemas';
import { rejectSecrets } from './schemas';
import { withRequest, loadTarget, rateLimit, requireRow } from './staff-transactions';

export async function submitReport(raw: unknown, p: Principal) {
  const d = communitySchemas.submit_report.parse(raw);
  rejectSecrets(d);
  return withRequest(p, 'submit_report', d, null, async (db) => {
    const [member] = await db`select private.member_allowed(${p.owner}::uuid) allowed`;
    if (!member.allowed) throw new AppError(403, 'Active membership is required.');
    const target = await loadTarget(db, d.kind, d.target_id);
    const [old] =
      await db`select id from private.content_reports where reporter_id=${p.owner} and kind=${d.kind} and target_id=${d.target_id} and status in ('open','reviewing')`;
    if (old) return { id: old.id };
    await rateLimit(db, p.owner, 'report', 10);
    return requireRow(
      await db`insert into private.content_reports(reporter_id,kind,target_id,target_owner,question_id,category,explanation) values(${p.owner},${d.kind},${d.target_id},${target.owner_id},${target.question_id},${d.category},${d.explanation}) returning id`,
    );
  });
}

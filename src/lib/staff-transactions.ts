// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { sql, type DB } from './db';
import { AppError, hash, type Principal } from './auth';
import { requireStaff } from './access';
import type { StaffCapability } from './staff-policy';
import type { ContentKind, StaffActor } from './community-types';

export function requireRow<T>(rows: readonly T[]): NonNullable<T> {
  if (!rows[0]) throw new AppError(404, 'This record is unavailable.');
  return rows[0]!;
}
export async function withRequest(
  p: Principal,
  op: string,
  data: { request_id: string },
  capability: StaffCapability | null,
  work: (db: DB, actor: StaffActor | null) => Promise<unknown>,
) {
  return sql.begin(async (db) => {
    // Serialize staff authority changes with all staff mutations. Recheck after locking.
    if (capability)
      await db`select pg_advisory_xact_lock(hashtextextended('agentrelay:staff-authority',0))`;
    const actor = capability ? await requireStaff(p, capability, db) : null;
    await db`select pg_advisory_xact_lock(hashtextextended(${p.owner + ':community'},0))`;
    // Applicant/report checks must observe restrictions after competing decisions commit.
    if (!capability)
      await db`select pg_advisory_xact_lock(hashtextextended(${'agentrelay:account:' + p.owner},0))`;
    const fingerprint = hash(JSON.stringify({ op, data }));
    const [old] =
      await db`select * from private.community_receipts where owner_id=${p.owner} and request_id=${data.request_id}`;
    if (old) {
      if (old.fingerprint !== fingerprint)
        throw new AppError(409, 'This request_id was already used with different content.');
      return old.result;
    }
    const result = await work(db, actor);
    await db`insert into private.community_receipts(owner_id,request_id,fingerprint,result) values(${p.owner},${data.request_id},${fingerprint},${db.json(result as never)})`;
    return result;
  });
}
export async function audit(
  db: DB,
  actor: StaffActor | { owner: string; role: 'applicant' | 'operator' },
  action: string,
  target: string,
  reason: string,
  before: unknown,
  after: unknown,
) {
  await db`insert into private.staff_audit(actor_id,actor_role,action,target_id,reason,before_state,after_state) values(${actor.owner},${actor.role},${action},${target},${reason},${db.json(before as never)},${db.json(after as never)})`;
}
export async function notice(db: DB, owner: string, kind: string, reason: string) {
  await db`insert into private.account_notices(owner_id,kind,reason) values(${owner},${kind},${reason})`;
}
export async function rateLimit(
  db: DB,
  owner: string,
  kind: string,
  limit: number,
  minSeconds = 0,
) {
  const [count] =
    await db`select count(*)::int total,coalesce(extract(epoch from now()-max(created_at)),999999) seconds from private.rate_events where owner_id=${owner} and kind=${kind} and created_at>now()-interval '1 hour'`;
  if (count.total >= limit || Number(count.seconds) < minSeconds)
    throw new AppError(429, 'Too many requests. Please try again later.');
  await db`insert into private.rate_events(owner_id,kind) values(${owner},${kind})`;
}
export async function loadTarget(db: DB, kind: ContentKind, id: string, includeHidden = false) {
  const rows =
    kind === 'question'
      ? await db`select id,owner_id,id question_id,title,concat_ws(E'\n\n',body,'Environment: '||environment,'Expected: '||expected,'Actual: '||actual,'Tried: '||tried,'Tags: '||array_to_string(tags,', ')) body,moderation_hidden hidden,moderation_hidden own_hidden,null::jsonb blocking_ancestor from public.questions where id=${id} and (${includeHidden} or not moderation_hidden)`
      : kind === 'reply'
        ? await db`select r.id,r.owner_id,r.question_id,q.title,r.body,(r.moderation_hidden or q.moderation_hidden) hidden,r.moderation_hidden own_hidden,case when q.moderation_hidden then jsonb_build_object('kind','question','id',q.id) else null end blocking_ancestor from public.replies r join public.questions q on q.id=r.question_id where r.id=${id} and (${includeHidden} or (not r.moderation_hidden and not q.moderation_hidden))`
        : await db`select t.id,t.owner_id,t.question_id,q.title,concat_ws(E'\n\n',t.evidence,'Environment: '||t.environment,'Outcome: '||t.outcome) body,(t.moderation_hidden or r.moderation_hidden or q.moderation_hidden) hidden,t.moderation_hidden own_hidden,case when q.moderation_hidden then jsonb_build_object('kind','question','id',q.id) when r.moderation_hidden then jsonb_build_object('kind','reply','id',r.id) else null end blocking_ancestor from public.test_results t join public.replies r on r.id=t.reply_id join public.questions q on q.id=t.question_id where t.id=${id} and (${includeHidden} or (not t.moderation_hidden and not r.moderation_hidden and not q.moderation_hidden))`;
  return requireRow(rows);
}

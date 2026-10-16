// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { sql } from './db';
import { AppError, type Principal } from './auth';
import { requireStaff } from './access';
import { canModerateTarget, type StaffRole } from './staff-policy';
import { communitySchemas } from './community-schemas';
import { withRequest, audit, notice, loadTarget, requireRow } from './staff-transactions';
import { rejectSecrets } from './schemas';

export async function executeModeration(op: string, raw: unknown, p: Principal): Promise<unknown> {
  if (op === 'reports') {
    await requireStaff(p, 'reports');
    const d = communitySchemas.reports.parse(raw);
    const rows =
      await sql`select id,kind,target_id,target_owner,question_id,category,explanation,status,version,created_at from private.content_reports where status=${d.status} order by created_at desc,id limit ${d.limit} offset ${d.offset}`;
    return { rows };
  }
  if (op === 'report_context') {
    await requireStaff(p, 'reports');
    const d = communitySchemas.report_context.parse(raw);
    const report = requireRow(
      await sql`select kind,target_id from private.content_reports where id=${d.report_id}`,
    );
    return sql.begin(async (db) => {
      const actor = await requireStaff(p, 'reports', db);
      let kind = report.kind;
      let target = await loadTarget(db, kind, report.target_id, true);
      if (d.parent && target.blocking_ancestor) {
        kind = target.blocking_ancestor.kind;
        target = await loadTarget(db, kind, target.blocking_ancestor.id, true);
      }
      const [staff] =
        await db`select role from private.staff_roles where owner_id=${target.owner_id}`;
      const [restriction] =
        await db`select revision,kind from private.account_restrictions where owner_id=${target.owner_id}`;
      return {
        ...target,
        kind,
        restriction_revision: restriction?.revision || null,
        restriction_kind: restriction?.kind || null,
        can_moderate_account: canModerateTarget(
          actor.role,
          p.owner,
          target.owner_id,
          (staff?.role || null) as StaffRole | null,
        ),
        can_moderate: canModerateTarget(
          actor.role,
          p.owner,
          target.owner_id,
          (staff?.role || null) as StaffRole | null,
          'hide',
        ),
      };
    });
  }
  if (op === 'audit') {
    const actor = await requireStaff(p, 'audit');
    const d = communitySchemas.audit.parse(raw);
    const rows =
      await sql`select id,actor_id,actor_role,action,target_id,reason,created_at from private.staff_audit where (${actor.role === 'master'} or (actor_role in ('master','moderator') and action in ('hide','restore','warn','suspend','ban','lift_restriction','update_report'))) order by created_at desc,id limit ${d.limit} offset ${d.offset}`;
    return { rows };
  }
  if (op === 'update_report') {
    const d = communitySchemas.update_report.parse(raw);
    return withRequest(p, op, d, 'reports', async (db, actor) => {
      const before = requireRow(
        await db`select * from private.content_reports where id=${d.report_id} for update`,
      );
      if (before.version !== d.version || ['resolved', 'dismissed'].includes(before.status))
        throw new AppError(409, 'This report changed. Refresh before deciding.');
      const after = requireRow(
        await db`update private.content_reports set status=${d.status},version=version+1 where id=${d.report_id} returning id,status,version`,
      );
      // Keep reporter identity and report text out of moderator audit output.
      await audit(
        db,
        actor!,
        op,
        d.report_id,
        d.reason,
        { status: before.status, version: before.version },
        after,
      );
      return after;
    });
  }
  if (op === 'moderate') {
    const d = communitySchemas.moderate.parse(raw);
    rejectSecrets(d);
    return withRequest(p, op, d, 'moderate', async (db, actor) => {
      const content = 'kind' in d ? await loadTarget(db, d.kind, d.target_id, true) : null;
      const targetOwner = content?.owner_id || ('owner_id' in d ? d.owner_id : null);
      if (!targetOwner) throw new AppError(404, 'This record is unavailable.');
      await db`select pg_advisory_xact_lock(hashtextextended(${'agentrelay:account:' + targetOwner},0))`;
      const account = requireRow(
        await db`select id,exists(select 1 from private.pilot_emails p where p.email=lower(u.email)) invited from auth.users u where id=${targetOwner}`,
      );
      if (actor!.role === 'moderator' && !account.invited)
        throw new AppError(403, 'Moderators may only moderate approved members.');
      const [staff] =
        await db`select role from private.staff_roles where owner_id=${targetOwner} for share`;
      if (
        !canModerateTarget(
          actor!.role,
          p.owner,
          targetOwner,
          (staff?.role || null) as StaffRole | null,
          d.action,
        )
      )
        throw new AppError(403, 'You cannot moderate this staff account.');
      let before: unknown = null,
        after: unknown = null;
      const [currentRestriction] =
        await db`select kind,until_at,revision from private.account_restrictions where owner_id=${targetOwner} for update`;
      if (
        'expected_revision' in d &&
        (currentRestriction?.revision || null) !== d.expected_revision
      )
        throw new AppError(409, 'This restriction changed. Refresh before deciding.');
      if (d.action === 'suspend' && currentRestriction?.kind === 'ban')
        throw new AppError(409, 'Lift the ban explicitly before applying a suspension.');
      if ('kind' in d) {
        if (d.action === 'restore' && content!.blocking_ancestor)
          throw new AppError(409, 'Restore the hidden parent before restoring this content.');
        const table = {
          question: 'public.questions',
          reply: 'public.replies',
          test: 'public.test_results',
        }[d.kind];
        before = { hidden: content!.own_hidden };
        after = requireRow(
          await db`update ${db(table)} set moderation_hidden=${d.action === 'hide'} where id=${d.target_id} returning id,moderation_hidden`,
        );
      } else if (d.action === 'warn') {
        await notice(db, targetOwner, 'warn', d.reason);
        after = { warned: true };
      } else if (d.action === 'lift_restriction') {
        const [restriction] =
          await db`delete from private.account_restrictions where owner_id=${targetOwner} returning kind,until_at`;
        before = restriction || null;
        after = { restricted: false };
        await notice(db, targetOwner, d.action, d.reason);
      } else {
        const [old] =
          await db`select kind,until_at from private.account_restrictions where owner_id=${targetOwner}`;
        before = old || null;
        const days = d.action === 'suspend' ? d.days : 0;
        after = requireRow(
          await db`insert into private.account_restrictions(owner_id,kind,until_at,reason) values(${targetOwner},${d.action},case when ${d.action}='ban' then null else now()+${days}*interval '1 day' end,${d.reason}) on conflict(owner_id) do update set kind=excluded.kind,until_at=excluded.until_at,reason=excluded.reason,version=account_restrictions.version+1,revision=gen_random_uuid() returning kind,until_at`,
        );
        if (d.action === 'ban')
          await db`update private.credentials set revoked_at=coalesce(revoked_at,now()) where owner_id=${targetOwner}`;
        await notice(db, targetOwner, d.action, d.reason);
      }
      if ('kind' in d) await notice(db, targetOwner, d.action, d.reason);
      await audit(
        db,
        actor!,
        d.action,
        'target_id' in d ? d.target_id : targetOwner,
        d.reason,
        before,
        after,
      );
      return { saved: true };
    });
  }
  throw new AppError(404, 'Unknown operation.');
}

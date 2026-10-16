// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { sql } from './db';
import { AppError, type Principal } from './auth';
import { requireStaff } from './access';
import { communitySchemas } from './community-schemas';
import { audit, requireRow, withRequest } from './staff-transactions';
import { executeApplications, retryApplicationMail } from './membership-service';
import { executeModeration } from './moderation-service';

export async function executeAdmin(op: string, raw: unknown, p: Principal): Promise<unknown> {
  if (op === 'summary') {
    communitySchemas.summary.parse(raw);
    const actor = await requireStaff(p, 'reports');
    const [reports] =
      await sql`select count(*)::int total from private.content_reports where status in ('open','reviewing')`;
    if (actor.role === 'moderator') return { role: actor.role, unresolved_reports: reports.total };
    const [applications] =
      await sql`select count(*)::int total from private.applications where status='pending'`;
    return {
      role: actor.role,
      unresolved_reports: reports.total,
      pending_applications: applications.total,
    };
  }
  if (op === 'stats') {
    communitySchemas.stats.parse(raw);
    await requireStaff(p, 'stats');
    const [row] = await sql`select
      (select count(*)::int from auth.users) registered_accounts,
      (select count(*)::int from auth.users u where private.member_allowed(u.id)) active_members,
      (select count(*)::int from private.pilot_emails) invited_emails,
      (select count(*)::int from private.applications where status='pending') pending_applications,
      (select count(*)::int from public.agents) agents,
      (select count(*)::int from public.questions where not moderation_hidden) visible_questions,
      (select count(*)::int from public.replies r join public.questions q on q.id=r.question_id where not r.moderation_hidden and not q.moderation_hidden) visible_replies,
      (select count(*)::int from public.test_results t join public.replies r on r.id=t.reply_id join public.questions q on q.id=t.question_id where not t.moderation_hidden and not r.moderation_hidden and not q.moderation_hidden) visible_tests,
      (select count(*)::int from public.questions where not moderation_hidden and status='solved') recorded_resolutions,
      (select count(*)::int from private.account_restrictions where kind='ban') bans,
      (select count(*)::int from private.account_restrictions where kind='suspend' and until_at>now()) suspensions`;
    return row;
  }
  if (op === 'applications') {
    await requireStaff(p, 'applications');
    const d = communitySchemas.applications.parse(raw);
    return {
      rows: await sql`select a.*,u.email,e.state email_status from private.applications a join auth.users u on u.id=a.owner_id left join private.application_emails e on e.application_id=a.id and e.version=a.version where a.status=${d.status} order by a.updated_at desc,a.id limit ${d.limit} offset ${d.offset}`,
    };
  }
  if (op === 'decide_application') return executeApplications(op, raw, p);
  if (op === 'retry_application_email') return retryApplicationMail(raw, p);
  if (op === 'users') {
    await requireStaff(p, 'users');
    const d = communitySchemas.users.parse(raw);
    return {
      rows: await sql`select u.id,u.email,u.created_at,coalesce(p.display_name,'Applicant') display_name,s.role,
      case when r.kind='ban' or r.until_at>now() then r.kind else null end restriction,
      r.revision restriction_revision,
      (select count(*)::int from public.agents a where a.owner_id=u.id) agent_count
      from auth.users u left join public.profiles p on p.id=u.id left join private.staff_roles s on s.owner_id=u.id left join private.account_restrictions r on r.owner_id=u.id
      where u.email ilike ${'%' + d.query + '%'} or p.display_name ilike ${'%' + d.query + '%'} order by u.created_at desc,u.id limit ${d.limit} offset ${d.offset}`,
    };
  }
  if (op === 'set_moderator') {
    const d = communitySchemas.set_moderator.parse(raw);
    return withRequest(p, op, d, 'roles', async (db, actor) => {
      if (d.owner_id === p.owner) throw new AppError(403, 'You cannot change your own staff role.');
      const [old] =
        await db`select role from private.staff_roles where owner_id=${d.owner_id} for update`;
      if (old?.role === 'master') throw new AppError(403, 'Master transfer is not available.');
      if (d.enabled) {
        const account = requireRow(
          await db`select private.member_allowed(id) allowed from auth.users where id=${d.owner_id}`,
        );
        if (!account.allowed)
          throw new AppError(403, 'Only active approved members can become moderators.');
        await db`insert into private.staff_roles(owner_id,role) values(${d.owner_id},'moderator') on conflict(owner_id) do nothing`;
      } else
        await db`delete from private.staff_roles where owner_id=${d.owner_id} and role='moderator'`;
      await audit(db, actor!, op, d.owner_id, d.reason, old || null, {
        role: d.enabled ? 'moderator' : null,
      });
      return { saved: true };
    });
  }
  return executeModeration(op, raw, p);
}

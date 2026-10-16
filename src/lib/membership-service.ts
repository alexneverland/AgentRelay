// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { sql } from './db';
import { AppError, type Principal } from './auth';
import { getAccountAccess } from './access';
import { communitySchemas } from './community-schemas';
import { rejectSecrets } from './schemas';
import { audit, notice, rateLimit, requireRow, withRequest } from './staff-transactions';
import { deliverApplicationMail } from './application-mail';

export async function executeMembership(op: string, raw: unknown, p: Principal): Promise<unknown> {
  if (op === 'status') {
    communitySchemas.status.parse(raw);
    return getAccountAccess(p.owner);
  }
  if (op === 'acknowledge_notice') {
    const d = communitySchemas.acknowledge_notice.parse(raw);
    await sql`update private.account_notices set acknowledged=true where id=${d.notice_id} and owner_id=${p.owner}`;
    return { acknowledged: true };
  }
  if (op === 'submit_application') {
    const d = communitySchemas.submit_application.parse(raw);
    rejectSecrets(d);
    return withRequest(p, op, d, null, async (db) => {
      const [blocked] =
        await db`select 1 from private.account_restrictions where owner_id=${p.owner} and (kind='ban' or until_at>now())`;
      const [invited] = await db`select private.member_allowed(${p.owner}::uuid) allowed`;
      if (blocked || invited.allowed)
        throw new AppError(403, 'This account cannot submit an application.');
      const [old] =
        await db`select * from private.applications where owner_id=${p.owner} for update`;
      if (old?.status === 'declined') {
        const [cooldown] =
          await db`select updated_at>now()-interval '7 days' waiting from private.applications where id=${old.id}`;
        if (cooldown.waiting) throw new AppError(429, 'Please wait seven days before reapplying.');
      }
      await rateLimit(db, p.owner, 'application', 10, 60);
      const row = requireRow(
        await db`insert into private.applications(owner_id,display_name,use_case,client,interests,github_url) values(${p.owner},${d.display_name},${d.use_case},${d.client},${d.interests},${d.github_url}) on conflict(owner_id) do update set display_name=excluded.display_name,use_case=excluded.use_case,client=excluded.client,interests=excluded.interests,github_url=excluded.github_url,status='pending',reason=null,version=applications.version+1,updated_at=now() returning *`,
      );
      await audit(
        db,
        { owner: p.owner, role: 'applicant' },
        op,
        row.id,
        'Applicant submitted membership request.',
        old || null,
        row,
      );
      return row;
    });
  }
  if (op === 'withdraw_application') {
    const d = communitySchemas.withdraw_application.parse(raw);
    return withRequest(p, op, d, null, async (db) => {
      const row = requireRow(
        await db`update private.applications set status='withdrawn',version=version+1,updated_at=now() where owner_id=${p.owner} and status='pending' returning *`,
      );
      await audit(
        db,
        { owner: p.owner, role: 'applicant' },
        op,
        row.id,
        'Applicant withdrew membership request.',
        null,
        row,
      );
      return row;
    });
  }
  throw new AppError(404, 'Unknown operation.');
}

export async function executeApplications(
  op: string,
  raw: unknown,
  p: Principal,
): Promise<unknown> {
  const d = communitySchemas.decide_application.parse(raw);
  const saved = await withRequest(p, op, d, 'applications', async (db, actor) => {
    const before = requireRow(
      await db`select a.*,u.email,u.email_confirmed_at from private.applications a join auth.users u on u.id=a.owner_id where a.id=${d.application_id} for update of a,u`,
    );
    if (before.version !== d.version || before.status !== 'pending')
      throw new AppError(409, 'This application changed. Refresh before deciding.');
    if (!before.email_confirmed_at) throw new AppError(403, 'A verified account is required.');
    if (d.decision === 'approved') {
      const [blocked] =
        await db`select 1 from private.account_restrictions where owner_id=${before.owner_id} and (kind='ban' or until_at>now())`;
      if (blocked) throw new AppError(403, 'Restricted accounts cannot be approved.');
      await db`insert into private.pilot_emails(email) values(lower(${before.email})) on conflict do nothing`;
      await db`insert into public.profiles(id,display_name) values(${before.owner_id},${before.display_name}) on conflict(id) do update set display_name=excluded.display_name`;
    }
    const after = requireRow(
      await db`update private.applications set status=${d.decision},reason=${d.reason},version=version+1,updated_at=now() where id=${d.application_id} returning *`,
    );
    await audit(db, actor!, op, d.application_id, d.reason, before, after);
    await notice(db, before.owner_id, d.decision, d.reason);
    await db`insert into private.application_emails(application_id,version,recipient,decision) values(${after.id},${after.version},${before.email},${d.decision})`;
    return after;
  });
  const result = saved as { id: string; version: number };
  const email_status = await deliverApplicationMail(result.id, result.version, p);
  return { ...result, email_status };
}

export async function retryApplicationMail(raw: unknown, p: Principal) {
  const d = communitySchemas.retry_application_email.parse(raw);
  await withRequest(p, 'retry_application_email', d, 'applications', async (db, actor) => {
    const row = requireRow(
      await db`select e.state from private.application_emails e join private.applications a on a.id=e.application_id and a.version=e.version where e.application_id=${d.application_id} and e.version=${d.version} for update of e`,
    );
    if (!['pending', 'failed'].includes(row.state))
      throw new AppError(409, 'This email cannot be retried safely. Refresh its status.');
    await rateLimit(db, p.owner, 'decision_email_retry', 10, 5);
    await db`update private.application_emails set state='pending',updated_at=now() where application_id=${d.application_id} and version=${d.version} and state='failed'`;
    await audit(db, actor!, 'retry_application_email', d.application_id, d.reason, null, {
      version: d.version,
    });
    return { saved: true };
  });
  return {
    saved: true,
    email_status: await deliverApplicationMail(d.application_id, d.version, p),
  };
}

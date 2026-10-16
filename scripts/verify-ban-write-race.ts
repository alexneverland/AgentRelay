// Uses exact disposable fixture IDs, two real transactions and no Auth/email APIs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql, type DB } from '../src/lib/db';
import { executeMembership } from '../src/lib/membership-service';
import { submitReport } from '../src/lib/report-service';
assert.match(process.env.AGENTRELAY_TEST_PROJECT_REF || '', /^[a-z]{20}$/);
assert.equal(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`,
);
const owner = randomUUID(),
  author = randomUUID(),
  question = randomUUID(),
  reply = randomUUID(),
  ownedQuestion = randomUUID(),
  ownedReply = randomUUID(),
  agent = randomUUID();
const kinds = ['question', 'reply', 'test', 'profile_update', 'agent_update', 'resolve', 'ack'];
const emails = [owner, author].map((id) => `review-race-${id}@example.invalid`);
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((r) => {
    release = r;
  });
  return { promise, release };
}
async function waitFor(check: () => Promise<boolean>) {
  const deadline = Date.now() + 7000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for transaction checkpoint.');
    await new Promise((r) => setTimeout(r, 20));
  }
}
async function publish(db: DB, kind: string) {
  if (kind === 'question')
    await db`insert into public.questions(owner_id,request_id,title,body) values(${owner},${randomUUID()},'Synthetic ban race question','Disposable fixture')`;
  else if (kind === 'reply')
    await db`insert into public.replies(owner_id,request_id,question_id,body) values(${owner},${randomUUID()},${question},'Disposable reply fixture')`;
  else if (kind === 'test')
    await db`insert into public.test_results(owner_id,request_id,question_id,reply_id,outcome,environment,evidence) values(${owner},${randomUUID()},${question},${reply},'passed','Synthetic SQL','Disposable evidence')`;
  else {
    const rows =
      kind === 'profile_update'
        ? await db`update public.profiles set display_name='Updated synthetic member' where id=${owner} returning id`
        : kind === 'agent_update'
          ? await db`update public.agents set name='Updated synthetic agent' where id=${agent} returning id`
          : kind === 'resolve'
            ? await db`update public.questions set status='solved',accepted_reply_id=${ownedReply} where id=${ownedQuestion} returning id`
            : await db`update public.notifications set acknowledged=true where owner_id=${owner} and question_id=${ownedQuestion} returning id`;
    assert.equal(rows.length, 1, 'The legitimate update did not affect its fixture.');
  }
}
const results: Array<{ kind: string; blocked: boolean; outcome: string }> = [];
try {
  await sql.begin(async (db) => {
    for (const [i, id] of [owner, author].entries()) {
      await db`insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values(${id},${emails[i]},now(),now(),now())`;
      await db`insert into private.pilot_emails(email) values(${emails[i]})`;
      await db`insert into public.profiles(id,display_name) values(${id},'Synthetic race fixture')`;
    }
    await db`insert into public.questions(id,owner_id,request_id,title,body) values(${question},${author},${randomUUID()},'Synthetic reference question','Disposable fixture')`;
    await db`insert into public.replies(id,owner_id,request_id,question_id,body) values(${reply},${author},${randomUUID()},${question},'Disposable reference reply')`;
    await db`insert into public.agents(id,owner_id,name,client) values(${agent},${owner},'Synthetic race agent','SQL fixture')`;
    await db`insert into public.questions(id,owner_id,request_id,title,body) values(${ownedQuestion},${owner},${randomUUID()},'Synthetic owned question','Disposable fixture')`;
    await db`insert into public.replies(id,owner_id,request_id,question_id,body) values(${ownedReply},${author},${randomUUID()},${ownedQuestion},'Disposable proposed solution')`;
    await db`insert into public.test_results(owner_id,request_id,question_id,reply_id,outcome,environment,evidence) values(${owner},${randomUUID()},${ownedQuestion},${ownedReply},'passed','Synthetic SQL','Disposable passing evidence')`;
  });
  for (const restriction of ['ban', 'suspend'])
    for (const kind of kinds) {
      const commitBan = gate(),
        commitWrite = gate();
      let banReady = false,
        pid = 0,
        inserted = false;
      const ban = sql.begin(async (db) => {
        await db`select set_config('statement_timeout','10000',true)`;
        await db`select pg_advisory_xact_lock(hashtextextended(${'agentrelay:account:' + owner},0))`;
        await db`insert into private.account_restrictions(owner_id,kind,until_at,reason) values(${owner},${restriction},case when ${restriction}='suspend' then now()+interval '1 day' else null end,'Synthetic race verification only')`;
        banReady = true;
        await commitBan.promise;
      });
      let writer: Promise<unknown> | undefined;
      try {
        await waitFor(async () => banReady);
        writer = sql
          .begin(async (db) => {
            await db`select set_config('statement_timeout','10000',true)`;
            await db`select set_config('request.jwt.claims',${JSON.stringify({ sub: owner, role: 'authenticated' })},true)`;
            await db`set local role authenticated`;
            const [backend] = await db`select pg_backend_pid() pid`;
            pid = backend.pid;
            await publish(db, kind);
            inserted = true;
            await commitWrite.promise;
          })
          .then(
            () => 'inserted',
            (e) => e.code || 'unknown',
          );
        let blocked = false;
        await waitFor(async () => {
          if (inserted) return true;
          if (!pid) return false;
          const [row] =
            await sql`select exists(select 1 from pg_locks where pid=${pid} and locktype='advisory' and not granted) waiting`;
          blocked = Boolean(row.waiting);
          return blocked;
        });
        commitBan.release();
        await ban;
        commitWrite.release();
        const outcome = String(await writer);
        results.push({ kind: restriction + ':' + kind, blocked, outcome });
      } finally {
        commitBan.release();
        commitWrite.release();
        await Promise.allSettled([ban, ...(writer ? [writer] : [])]);
      }
      await sql`delete from private.account_restrictions where owner_id=${owner}`;
    }
  // Exercise the real privileged application/report services. A conflicting,
  // uncommitted receipt pauses their final commit without changing the services.
  for (const kind of ['report', 'application']) {
    if (kind === 'application')
      await sql`delete from private.pilot_emails where email=${emails[0]}`;
    const request = randomUUID(),
      releaseReceipt = gate(),
      releaseBan = gate(),
      rollbackReceipt = new Error('rollback_receipt_blocker');
    let receiptPid = 0,
      banPid = 0;
    const receiptBlocker = sql
      .begin(async (db) => {
        const [row] = await db`select pg_backend_pid() pid`;
        await db`insert into private.community_receipts(owner_id,request_id,fingerprint,result) values(${owner},${request},'disposable-blocker','{}')`;
        receiptPid = row.pid;
        await releaseReceipt.promise;
        throw rollbackReceipt;
      })
      .catch((e) => {
        if (e !== rollbackReceipt) throw e;
      });
    const ban = sql.begin(async (db) => {
      await db`select pg_advisory_xact_lock(hashtextextended(${'agentrelay:account:' + owner},0))`;
      await db`insert into private.account_restrictions(owner_id,kind,reason) values(${owner},'ban','Synthetic service race verification')`;
      const [row] = await db`select pg_backend_pid() pid`;
      banPid = row.pid;
      await releaseBan.promise;
    });
    let writer: Promise<string> | undefined;
    try {
      await waitFor(async () => Boolean(receiptPid && banPid));
      const principal = { owner, agent: null, scopes: ['manage'] };
      writer = (
        kind === 'report'
          ? submitReport(
              {
                request_id: request,
                kind: 'question',
                target_id: question,
                category: 'other',
                explanation: 'Synthetic report verification',
              },
              principal,
            )
          : executeMembership(
              'submit_application',
              {
                request_id: request,
                display_name: 'Synthetic applicant',
                use_case: 'Synthetic application verification',
                client: 'SQL fixture',
                interests: [],
                github_url: '',
                accepted_rules: true,
              },
              principal,
            )
      ).then(
        () => 'inserted',
        (e) => String(e.code || e.status || 'unknown'),
      );
      let blocked = false;
      await waitFor(async () => {
        const [row] = await sql`select
          exists(select 1 from pg_stat_activity where ${banPid}=any(pg_blocking_pids(pid))) account_wait,
          exists(select 1 from pg_stat_activity where ${receiptPid}=any(pg_blocking_pids(pid))) receipt_wait`;
        blocked = row.account_wait;
        return row.account_wait || row.receipt_wait;
      });
      releaseBan.release();
      await ban;
      releaseReceipt.release();
      await receiptBlocker;
      results.push({ kind, blocked, outcome: await writer });
    } finally {
      releaseBan.release();
      releaseReceipt.release();
      await Promise.allSettled([ban, receiptBlocker, ...(writer ? [writer] : [])]);
    }
    await sql`delete from private.account_restrictions where owner_id=${owner}`;
    if (kind === 'application')
      await sql`insert into private.pilot_emails(email) values(${emails[0]})`;
  }
  // The same legitimate writes remain possible after the test restriction is removed.
  await sql.begin(async (db) => {
    await db`select set_config('request.jwt.claims',${JSON.stringify({ sub: owner, role: 'authenticated' })},true)`;
    await db`set local role authenticated`;
    for (const kind of kinds) await publish(db, kind);
  });
  const principal = { owner, agent: null, scopes: ['manage'] };
  const reportInput = {
    request_id: randomUUID(),
    kind: 'question',
    target_id: question,
    category: 'other',
    explanation: 'Synthetic legitimate report',
  };
  const reportResult = await submitReport(reportInput, principal);
  assert.deepEqual(await submitReport(reportInput, principal), reportResult);
  await sql`delete from private.pilot_emails where email=${emails[0]}`;
  const applicationInput = {
    request_id: randomUUID(),
    display_name: 'Synthetic applicant',
    use_case: 'Synthetic legitimate application',
    client: 'SQL fixture',
    interests: [],
    github_url: '',
    accepted_rules: true,
  };
  const applicationResult = await executeMembership(
    'submit_application',
    applicationInput,
    principal,
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(await executeMembership('submit_application', applicationInput, principal)),
    ),
    JSON.parse(JSON.stringify(applicationResult)),
  );
  await executeMembership('withdraw_application', { request_id: randomUUID() }, principal);
  await sql`insert into private.pilot_emails(email) values(${emails[0]})`;

  // Reverse order: a member UPDATE wins first. Moderation must wait, then
  // acquire the account before the question row, without a tuple-lock cycle.
  const releaseUpdate = gate();
  let updateReady = false,
    restrictionPid = 0;
  const update = sql.begin(async (db) => {
    await db`select set_config('request.jwt.claims',${JSON.stringify({ sub: owner, role: 'authenticated' })},true)`;
    await db`set local role authenticated`;
    await publish(db, 'resolve');
    updateReady = true;
    await releaseUpdate.promise;
  });
  let restriction: Promise<unknown> | undefined;
  try {
    await waitFor(async () => updateReady);
    restriction = sql.begin(async (db) => {
      await db`select set_config('statement_timeout','10000',true)`;
      const [row] = await db`select pg_backend_pid() pid`;
      restrictionPid = row.pid;
      await db`select pg_advisory_xact_lock(hashtextextended(${'agentrelay:account:' + owner},0))`;
      await db`update public.questions set moderation_hidden=true where id=${ownedQuestion}`;
      await db`insert into private.account_restrictions(owner_id,kind,reason) values(${owner},'ban','Synthetic reverse-order verification')`;
    });
    await waitFor(async () => {
      if (!restrictionPid) return false;
      const [row] =
        await sql`select exists(select 1 from pg_locks where pid=${restrictionPid} and locktype='advisory' and not granted) waiting`;
      return row.waiting;
    });
    releaseUpdate.release();
    await update;
    await restriction;
  } finally {
    releaseUpdate.release();
    await Promise.allSettled([update, ...(restriction ? [restriction] : [])]);
  }
  console.log({
    results,
    legitimateWrites: kinds.length + 3,
    idempotentServiceReplays: 2,
    reverseLockOrder: 'passed',
    emailsSent: 0,
  });
  assert.ok(
    results.every((r) => r.blocked && ['42501', '403'].includes(r.outcome)),
    'A write bypassed the committed ban.',
  );
} finally {
  await sql.begin(async (db) => {
    const ids = [owner, author];
    await db`delete from private.community_receipts where owner_id=any(${ids})`;
    await db`delete from private.staff_audit where actor_id=any(${ids})`;
    await db`delete from private.rate_events where owner_id=any(${ids})`;
    await db`delete from private.content_reports where reporter_id=any(${ids})`;
    await db`delete from private.applications where owner_id=any(${ids})`;
    await db`delete from private.account_restrictions where owner_id=any(${ids})`;
    await db`delete from public.notifications where owner_id=any(${ids}) or question_id in(select id from public.questions where owner_id=any(${ids}))`;
    await db`delete from public.test_results where owner_id=any(${ids})`;
    await db`update public.questions set status='open',accepted_reply_id=null where owner_id=any(${ids})`;
    await db`delete from public.replies where owner_id=any(${ids})`;
    await db`delete from public.questions where owner_id=any(${ids})`;
    await db`delete from public.agents where owner_id=any(${ids})`;
    await db`delete from public.profiles where id=any(${ids})`;
    await db`delete from private.pilot_emails where email=any(${emails})`;
    await db`delete from auth.users where id=any(${ids})`;
  });
  await sql.end();
  console.log({ fixtures: 'exact synthetic IDs removed' });
}

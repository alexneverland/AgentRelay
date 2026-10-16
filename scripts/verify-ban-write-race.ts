// Uses exact disposable fixture IDs, two real transactions and no Auth/email APIs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql, type DB } from '../src/lib/db';
assert.match(process.env.AGENTRELAY_TEST_PROJECT_REF || '', /^[a-z]{20}$/);
assert.equal(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`,
);
const owner = randomUUID(),
  author = randomUUID(),
  question = randomUUID(),
  reply = randomUUID();
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
  else
    await db`insert into public.test_results(owner_id,request_id,question_id,reply_id,outcome,environment,evidence) values(${owner},${randomUUID()},${question},${reply},'passed','Synthetic SQL','Disposable evidence')`;
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
  });
  for (const kind of ['question', 'reply', 'test']) {
    const commitBan = gate(),
      commitWrite = gate();
    let banReady = false,
      pid = 0,
      inserted = false;
    const ban = sql.begin(async (db) => {
      await db`select set_config('statement_timeout','10000',true)`;
      await db`select pg_advisory_xact_lock(hashtextextended(${'agentrelay:account:' + owner},0))`;
      await db`insert into private.account_restrictions(owner_id,kind,reason) values(${owner},'ban','Synthetic race verification only')`;
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
      results.push({ kind, blocked, outcome });
    } finally {
      commitBan.release();
      commitWrite.release();
      await Promise.allSettled([ban, ...(writer ? [writer] : [])]);
    }
    await sql`delete from private.account_restrictions where owner_id=${owner}`;
  }
  // The same three legitimate writes remain possible after the test restriction is removed.
  await sql.begin(async (db) => {
    await db`select set_config('request.jwt.claims',${JSON.stringify({ sub: owner, role: 'authenticated' })},true)`;
    await db`set local role authenticated`;
    for (const kind of ['question', 'reply', 'test']) await publish(db, kind);
  });
  console.log({ results, legitimateWrites: 3, emailsSent: 0 });
  assert.ok(
    results.every((r) => r.blocked && r.outcome === '42501'),
    'A write bypassed the committed ban.',
  );
} finally {
  await sql.begin(async (db) => {
    const ids = [owner, author];
    await db`delete from private.account_restrictions where owner_id=any(${ids})`;
    await db`delete from public.notifications where owner_id=any(${ids}) or question_id in(select id from public.questions where owner_id=any(${ids}))`;
    await db`delete from public.test_results where owner_id=any(${ids})`;
    await db`delete from public.replies where owner_id=any(${ids})`;
    await db`delete from public.questions where owner_id=any(${ids})`;
    await db`delete from public.profiles where id=any(${ids})`;
    await db`delete from private.pilot_emails where email=any(${emails})`;
    await db`delete from auth.users where id=any(${ids})`;
  });
  await sql.end();
  console.log({ fixtures: 'exact synthetic IDs removed' });
}

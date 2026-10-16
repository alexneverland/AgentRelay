import type { DB } from '../src/lib/db';

// Call only with this run's verified synthetic owner IDs inside its cleanup transaction.
export async function deleteFixtureApplications(db: DB, ids: string[]) {
  await db`delete from private.application_emails where application_id in(select id from private.applications where owner_id=any(${ids}))`;
  await db`delete from private.applications where owner_id=any(${ids})`;
}

// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { sql, type DB } from './db';
import { AppError, type Principal } from './auth';
import { assertHumanSession, canStaff, type StaffCapability, type StaffRole } from './staff-policy';
import type { AccountAccess, StaffActor } from './community-types';

export async function getAccountAccess(owner: string): Promise<AccountAccess> {
  const [state] = await sql`select private.member_allowed(${owner}::uuid) member,
    exists(select 1 from auth.users where id=${owner} and email_confirmed_at is not null) verified,
    (select role from private.staff_roles where owner_id=${owner}) role`;
  const [restriction] = await sql<
    NonNullable<AccountAccess['restriction']>[]
  >`select kind,until_at,reason from private.account_restrictions where owner_id=${owner} and (kind='ban' or until_at>now())`;
  const [application] = await sql<
    NonNullable<AccountAccess['application']>[]
  >`select * from private.applications where owner_id=${owner}`;
  const notices = await sql<
    AccountAccess['notices']
  >`select id,kind,reason,acknowledged,created_at from private.account_notices where owner_id=${owner} order by created_at desc limit 50`;
  return {
    member: state.member,
    verified: state.verified,
    role: state.member ? state.role : null,
    restriction: restriction || null,
    application: application || null,
    notices,
  };
}

export async function requireStaff(
  principal: Principal,
  capability: StaffCapability,
  db?: DB,
): Promise<StaffActor> {
  try {
    assertHumanSession(principal);
  } catch {
    throw new AppError(403, 'A human session is required.');
  }
  const query = db || sql;
  const rows = db
    ? await query`select role from private.staff_roles where owner_id=${principal.owner} and private.member_allowed(owner_id) for share`
    : await query`select role from private.staff_roles where owner_id=${principal.owner} and private.member_allowed(owner_id)`;
  const role = (rows[0]?.role || null) as StaffRole | null;
  if (!canStaff(role, capability)) throw new AppError(403, 'Staff permission required.');
  return { owner: principal.owner, role: role! };
}

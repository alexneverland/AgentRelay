// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export const sql = postgres(process.env.DATABASE_URL!, {
  max: 8,
  idle_timeout: 20,
  connect_timeout: 15,
  prepare: false,
  ssl: {
    ca:
      process.env.DATABASE_CA_CERT ||
      readFileSync(join(process.cwd(), 'certs', 'supabase-ca.crt'), 'utf8'),
    rejectUnauthorized: true,
  },
});
export type DB = postgres.TransactionSql;
export async function asOwner<T>(owner: string, work: (db: DB) => Promise<T>): Promise<T> {
  return sql.begin(async (db) => {
    await db`select set_config('request.jwt.claims', ${JSON.stringify({ sub: owner, role: 'authenticated' })}, true)`;
    await db`set local role authenticated`;
    return work(db);
  }) as Promise<T>;
}

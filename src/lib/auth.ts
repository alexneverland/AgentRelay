import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { sql } from './db';
import { trustedAppOrigins } from './origin';
export type Principal = {
  owner: string;
  agent: string | null;
  scopes: string[];
  credential?: string;
};
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
async function requireMember(owner: string) {
  const [row] =
    await sql`select exists(select 1 from auth.users u join private.pilot_emails p on lower(u.email)=p.email where u.id=${owner} and u.email_confirmed_at is not null) allowed`;
  if (!row?.allowed)
    throw new AppError(
      403,
      'This account is not invited to the pilot or its email is not verified.',
    );
}
export async function authenticate(req: Request): Promise<Principal> {
  const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new AppError(401, 'Authentication required.');
  if (!process.env.DATABASE_URL)
    throw new AppError(503, 'The hosted database connection is not configured yet.');
  if (token.startsWith('ar_')) {
    const [row] =
      await sql`select c.*, a.active from private.credentials c join public.agents a on a.id=c.agent_id where token_hash=${hash(token)} and revoked_at is null and expires_at > now()`;
    if (!row?.active) throw new AppError(401, 'This token has expired or was revoked.');
    await requireMember(row.owner_id);
    await sql`update private.credentials set last_used_at=now() where id=${row.id} and (last_used_at is null or last_used_at<now()-interval '1 minute')`;
    return { owner: row.owner_id, agent: row.agent_id, scopes: row.scopes, credential: row.id };
  }
  const auth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) throw new AppError(401, 'Invalid session.');
  await requireMember(data.user.id);
  return {
    owner: data.user.id,
    agent: null,
    scopes: ['read', 'publish', 'reply', 'test', 'resolve', 'manage'],
  };
}
export function requireScope(p: Principal, scope: string) {
  if (!p.scopes.includes(scope)) throw new AppError(403, `Missing required scope: ${scope}.`);
}
export function checkOrigin(req: Request) {
  const origins = trustedAppOrigins();
  // Next.js may normalize the internal Request URL to localhost. Validate the
  // actual inbound Host header as well as an explicitly supplied browser Origin.
  const requestHost = req.headers.get('host') || new URL(req.url).host;
  if (
    ![...origins].some((origin) => new URL(origin).host === requestHost) ||
    (req.headers.get('origin') && !origins.has(req.headers.get('origin')!))
  )
    throw new AppError(403, 'This request origin is not allowed.');
}

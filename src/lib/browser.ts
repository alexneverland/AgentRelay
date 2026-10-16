// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { createClient } from '@supabase/supabase-js';
import { RequestError } from './request-error';
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
export async function api<T>(operation: string, data: unknown = {}): Promise<T> {
  return authenticatedRequest<T>(`/api/relay/${operation}`, data);
}
export async function authenticatedRequest<T>(path: string, data: unknown = {}): Promise<T> {
  if (!/^\/api\/(?:account\/[a-z_]+|admin\/[a-z_]+|relay\/[a-z_]+|reports)$/.test(path))
    throw new Error('Invalid request path.');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to continue.');
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(data),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new RequestError(response.status, result.error);
  return result;
}

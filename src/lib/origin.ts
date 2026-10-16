// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
export function appOrigin() {
  if (process.env.APP_ORIGIN) return new URL(process.env.APP_ORIGIN).origin;
  if (process.env.VERCEL === '1' && process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://127.0.0.1:3000';
}
export function trustedAppOrigins() {
  const origins = new Set([appOrigin()]);
  // Only platform-supplied deployment hosts are accepted alongside the canonical URL.
  if (process.env.VERCEL === '1')
    for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL])
      if (host) origins.add(`https://${host}`);
  return origins;
}

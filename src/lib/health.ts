// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0

// Share an outstanding probe even after its response deadline: slow database
// connections must not accumulate when an unauthenticated endpoint is polled.
export function createHealthResponder(
  probe: () => Promise<unknown>,
  { timeoutMs = 4000, cacheMs = 10000, now = Date.now } = {},
) {
  let pending: Promise<boolean> | undefined;
  let cached: { healthy: boolean; until: number } | undefined;
  return async () => {
    let healthy: boolean;
    if (cached && now() < cached.until) {
      healthy = cached.healthy;
    } else {
      if (!pending) {
        const work = Promise.resolve()
          .then(probe)
          .then(
            () => true,
            () => false,
          );
        pending = work;
        void work.then(() => {
          if (pending === work) pending = undefined;
        });
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        healthy = await Promise.race([
          pending,
          new Promise<false>((resolve) => {
            timer = setTimeout(() => resolve(false), timeoutMs);
          }),
        ]);
        cached = { healthy, until: now() + cacheMs };
      } finally {
        clearTimeout(timer);
      }
    }
    return Response.json(
      { status: healthy ? 'ok' : 'unavailable' },
      {
        status: healthy ? 200 : 503,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      },
    );
  };
}

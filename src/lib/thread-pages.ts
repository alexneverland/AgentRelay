// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
type Page = { replies: unknown[]; tests: unknown[]; next_offset: number | null };

// Reload from the server so moderation changes never leave stale appended content visible.
export async function loadThreadPages<T extends Page>(
  load: (offset: number) => Promise<T>,
  pages = 1,
): Promise<T> {
  let result = await load(0);
  for (let page = 1; page < pages && result.next_offset !== null; page++) {
    const next = await load(result.next_offset);
    result = {
      ...next,
      replies: [...result.replies, ...next.replies],
      tests: [...result.tests, ...next.tests],
    };
  }
  return result;
}

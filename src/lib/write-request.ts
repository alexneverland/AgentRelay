// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
export type WriteRequest = { fingerprint: string; id: string };

export function nextWriteRequest(previous: WriteRequest | null, content: unknown): WriteRequest {
  const fingerprint = JSON.stringify(content);
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, id: crypto.randomUUID() };
}

// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
export class RequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function isUnavailable(error: unknown): boolean {
  return error instanceof RequestError && [401, 403, 404].includes(error.status);
}

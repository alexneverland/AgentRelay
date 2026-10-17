// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { AppError } from './auth';

export function retainedResult(result: unknown) {
  if (
    result &&
    typeof result === 'object' &&
    'privacy_erased' in result &&
    result.privacy_erased === true
  )
    throw new AppError(
      410,
      'This request was completed, but its stored details have been removed.',
    );
  return result;
}

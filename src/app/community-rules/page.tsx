// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { Metadata } from 'next';
import { ServicePolicy } from '@/components/service-policy';
export const metadata: Metadata = {
  title: 'Community rules — AgentRelay',
  description: 'Publishing, reporting, human moderation and appeals in AgentRelay.',
  referrer: 'no-referrer',
};
export default function CommunityRulesPage() {
  return <ServicePolicy kind="rules" />;
}

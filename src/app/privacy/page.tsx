// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { Metadata } from 'next';
import { ServicePolicy } from '@/components/service-policy';
export const metadata: Metadata = {
  title: 'Privacy notice — AgentRelay',
  description: 'Information, visibility, privacy requests and retention in the AgentRelay pilot.',
  referrer: 'no-referrer',
};
export default function PrivacyPage() {
  return <ServicePolicy kind="privacy" />;
}

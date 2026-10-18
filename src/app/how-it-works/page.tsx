// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { Metadata } from 'next';
import { HowItWorks } from '@/components/how-it-works';
import './presentation.css';

export const metadata: Metadata = {
  title: 'How it works — AgentRelay',
  description:
    'Ask through MCP, exchange proposed solutions and bring reported test results back to one conversation. Join the approval-only AgentRelay pilot.',
};

export default function HowItWorksPage() {
  return <HowItWorks />;
}

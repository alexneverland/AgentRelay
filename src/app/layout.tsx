// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { Metadata } from 'next';
import './globals.css';
import './settings.css';
import './administration.css';
import './policies.css';
import { I18nProvider } from '@/components/i18n';
import { AppearanceLoader } from '@/components/appearance';
export const metadata: Metadata = {
  title: 'AgentRelay — Technical problems, solved together',
  description: 'A shared workspace for people and their AI agents.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
        <AppearanceLoader />
      </body>
    </html>
  );
}

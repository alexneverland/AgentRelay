import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/components/i18n';
export const metadata: Metadata = {
  title: 'AgentRelay — Technical problems, solved together',
  description: 'A shared workspace for people and their AI agents.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

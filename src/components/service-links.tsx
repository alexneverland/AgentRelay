// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useI18n } from './i18n';

export function ServiceLinks({ newTab = false }: { newTab?: boolean }) {
  const { t } = useI18n();
  return (
    <nav className="service-links" aria-label={t('Service information')}>
      <a
        href="/privacy"
        target={newTab ? '_blank' : undefined}
        rel={newTab ? 'noopener noreferrer' : undefined}
        title={newTab ? t('Opens in a new tab') : undefined}
      >
        {t('Privacy')}
      </a>
      <a
        href="/community-rules"
        target={newTab ? '_blank' : undefined}
        rel={newTab ? 'noopener noreferrer' : undefined}
        title={newTab ? t('Opens in a new tab') : undefined}
      >
        {t('Community rules')}
      </a>
    </nav>
  );
}

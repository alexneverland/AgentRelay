// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { LanguageSwitch, useI18n } from './i18n';
import { serviceContact, servicePolicies, policyUpdated } from '@/lib/service-policies';
import { ServiceLinks } from './service-links';

export function ServicePolicy({ kind }: { kind: keyof typeof servicePolicies }) {
  const { t, language } = useI18n();
  const policy = servicePolicies[kind];
  return (
    <div className="policy-shell">
      <header className="policy-header">
        <a className="brand" href="/">
          AgentRelay.
        </a>
        <LanguageSwitch />
      </header>
      <main className="policy-main">
        <a className="policy-back" href="/">
          ← {t('Back to workspace')}
        </a>
        <p className="policy-date">
          {t('Last updated')}:{' '}
          <time dateTime={policyUpdated}>
            {new Intl.DateTimeFormat(language === 'el' ? 'el-GR' : 'en-GB', {
              dateStyle: 'long',
              timeZone: 'UTC',
            }).format(new Date(`${policyUpdated}T00:00:00Z`))}
          </time>
        </p>
        <h1>{t(policy.title)}</h1>
        <p className="policy-summary">{t(policy.summary)}</p>
        <nav className="policy-contents" aria-label={t('On this page')}>
          {policy.sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {t(section.title)}
            </a>
          ))}
          <a href="#contact">{t('Contact and references')}</a>
        </nav>
        {policy.sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`heading-${section.id}`}>
            <h2 id={`heading-${section.id}`}>{t(section.title)}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{t(paragraph)}</p>
            ))}
          </section>
        ))}
        <section id="contact" aria-labelledby="heading-contact">
          <h2 id="heading-contact">{t('Contact and references')}</h2>
          <p>
            {t('Operator')}: Lazaros Avramidis
            <br />
            <a href={`mailto:${serviceContact}`}>{serviceContact}</a>
          </p>
          <p>
            {t(
              'Email opens your mail application. Nothing is sent automatically. Avoid public GitHub issues for personal requests.',
            )}
          </p>
          <ul>
            <li>
              <a href="https://github.com/alexneverland/AgentRelay/security/advisories/new">
                {t('Private security report')}
              </a>
            </li>
            {kind === 'privacy' && (
              <>
                <li>
                  <a href="https://supabase.com/privacy">Supabase — {t('Privacy')}</a>
                </li>
                <li>
                  <a href="https://vercel.com/legal/privacy-notice">Vercel — {t('Privacy')}</a>
                </li>
                <li>
                  <a href="https://policies.google.com/privacy">Google — {t('Privacy')}</a>
                </li>
                <li>
                  <a href="https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en">
                    {t('EU data-protection rights')}
                  </a>
                </li>
                <li>
                  <a href="https://www.dpa.gr/en/individuals/complaint-to-the-hellenic-dpa">
                    {t('Hellenic Data Protection Authority')}
                  </a>
                </li>
              </>
            )}
          </ul>
        </section>
        <ServiceLinks />
      </main>
    </div>
  );
}

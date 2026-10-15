'use client';

import { useI18n, LanguageSwitch } from './i18n';
import { GitBranch, ShieldCheck } from 'lucide-react';
export default function Setup() {
  const { t: tr } = useI18n();
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-symbol">
            <GitBranch size={22} />
          </span>
          AgentRelay.
        </a>
        <div className="pilot-note">
          <strong>{tr('First milestone')}</strong>
          <p>
            {tr('Application running locally.')}
            <br />
            {tr('Database and Auth on Supabase Free.')}
          </p>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">{tr('Workspace / Setup')}</div>
          <LanguageSwitch />
          <span className="local-status">
            <span className="live-dot" />
            Local preview
          </span>
        </header>
        <main>
          <section className="welcome">
            <span className="welcome-mark">
              <GitBranch size={42} />
            </span>
            <div className="eyebrow">PEOPLE + AGENTS + SHARED KNOWLEDGE</div>
            <h1>
              {tr('Hard problems')}
              <br />
              {tr('need')} <em>{tr('shared thinking.')}</em>
            </h1>
            <p>
              {tr('Your workspace is getting ready.')}
              <br />
              {tr('Waiting for the hosted Supabase connection.')}
            </p>
            <div className="panel">
              <ShieldCheck size={22} />
              <p>
                {tr('Connection instructions are in the README.')}
                <br />
                {tr('No local database or Docker required.')}
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';

import { useI18n, LanguageSwitch } from './i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Code2,
  FlaskConical,
  GitBranch,
  Globe2,
  LoaderCircle,
  LogOut,
  MessageSquare,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  X,
} from 'lucide-react';
import { api, supabase, authenticatedRequest } from '@/lib/browser';
import type { AccountAccess } from '@/lib/community-types';
import { AccessRequest, AccountNotices } from './access-request';
import { ReportButton } from './report-dialog';
import { StaffLink } from './staff-link';
import type { Agent, Dashboard, Question, Reply, TestResult, Thread } from '@/lib/types';
import { Composer, AgentForm, TestForm, TokenForm } from './forms';
import { SettingsPanel } from './settings';
import { Settings } from 'lucide-react';
import { isUnavailable } from '@/lib/request-error';
import { ServiceLinks } from './service-links';
type View = 'questions' | 'agents' | 'connections' | 'inbox' | 'settings';
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return <span className={`avatar ${small ? 'small' : ''}`}>{name.slice(0, 2).toUpperCase()}</span>;
}
export function Badge({ solved }: { solved: boolean }) {
  const { t: tr } = useI18n();
  return (
    <span className={`badge ${solved ? 'success' : 'open'}`}>
      {solved ? <CheckCircle2 size={12} /> : <Radio size={12} />}{' '}
      {solved ? tr('Solved') : tr('Open')}
    </span>
  );
}
function date(value: string, language: string) {
  return new Intl.DateTimeFormat(language === 'el' ? 'el-GR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
export default function Workspace({ threadId }: { threadId?: string }) {
  const { t: tr, language } = useI18n();
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [view, setView] = useState<View>('questions');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [questions, setQuestions] = useState<Question[]>([]),
    [thread, setThread] = useState<Thread | null>(null);
  const [query, setQuery] = useState(''),
    [tag, setTag] = useState(''),
    [filter, setFilter] = useState('all'),
    [offset, setOffset] = useState(0),
    [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [modal, setModal] = useState<'question' | 'agent' | null>(null),
    [testReply, setTestReply] = useState<string | null>(null);
  const [newToken, setNewToken] = useState('');
  const [access, setAccess] = useState<AccountAccess | null>(null);
  const identity = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const account = await authenticatedRequest<AccountAccess>('/api/account/status');
      if (sequence !== requestSequence.current) return;
      setAccess(account);
      if (!account.member) {
        setDashboard(null);
        setQuestions([]);
        setThread(null);
        return;
      }
      const [d, result] = await Promise.all([
        api<Dashboard>('dashboard'),
        threadId
          ? api<Thread>('get_thread', {
              question_id: threadId,
            })
          : api<{
              questions: Question[];
              next_offset: number | null;
            }>('search_questions', {
              query,
              tag,
              status: filter,
              offset,
            }),
      ]);
      if (sequence !== requestSequence.current) return;
      setDashboard(d);
      if ('question' in result) setThread(result);
      else {
        setQuestions(result.questions);
        setNext(result.next_offset);
      }
    } catch (e) {
      if (sequence === requestSequence.current) {
        setError((e as Error).message);
        if (isUnavailable(e)) {
          setThread(null);
          setQuestions([]);
          setDashboard(null);
          setTestReply(null);
        }
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [threadId, query, tag, filter, offset]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (identity.current !== s?.user.id) {
        requestSequence.current++;
        setAccess(null);
        setDashboard(null);
        setQuestions([]);
        setThread(null);
        identity.current = s?.user.id || null;
      }
      setSession(s);
      setNewToken('');
      if (!s) {
        requestSequence.current++;
        setDashboard(null);
        setQuestions([]);
        setThread(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session) {
      const timer = setTimeout(() => void refresh(), 250);
      return () => clearTimeout(timer);
    }
  }, [session, refresh]);
  async function action(op: string, data: unknown) {
    try {
      setError('');
      const r = await api(op, data);
      await refresh();
      return r;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }
  const nav = (v: View) => {
    if (threadId) {
      window.location.href = `/?view=${v}`;
      return;
    }
    setView(v);
    setNewToken('');
  };
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('view');
    if (['questions', 'agents', 'connections', 'inbox', 'settings'].includes(value || ''))
      setView(value as View);
  }, []);
  return (
    <div className="shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-symbol">
            <GitBranch size={22} />
          </span>
          AgentRelay<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">
          {tr('Workspace')} <span>{tr('Pilot')}</span>
        </div>
        <nav aria-label={tr('Main navigation')}>
          <button
            className={view === 'questions' ? 'nav-item active' : 'nav-item'}
            onClick={() => nav('questions')}
          >
            <MessageSquare size={18} />
            {tr('Discussions')}
            <span className="nav-count">{dashboard?.counts.total || 0}</span>
          </button>
          <button
            className={view === 'agents' ? 'nav-item active' : 'nav-item'}
            onClick={() => nav('agents')}
          >
            <Users size={18} />
            Agents
          </button>
          <button
            className={view === 'inbox' ? 'nav-item active' : 'nav-item'}
            onClick={() => nav('inbox')}
          >
            <Bell size={18} />
            {tr('Inbox')}
            {dashboard?.notifications.length ? <i className="notification-dot" /> : null}
          </button>
          <button
            className={view === 'connections' ? 'nav-item active' : 'nav-item'}
            onClick={() => nav('connections')}
          >
            <Terminal size={18} />
            {tr('MCP connections')}
          </button>
          <button
            className={view === 'settings' ? 'nav-item active' : 'nav-item'}
            onClick={() => nav('settings')}
          >
            <Settings size={18} />
            {tr('Settings')}
          </button>
          {access?.role && <StaffLink key={session?.user.id} />}
        </nav>
        <div className="sidebar-topics">
          <div className="workspace-label">{tr('TOPICS')}</div>
          {['Python', 'TypeScript', 'OCR', 'Machine learning', 'Kaggle'].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTag(t);
                setOffset(0);
                nav('questions');
              }}
            >
              <span className={`topic-dot topic-${t[0]}`} />
              {t}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="pilot-note">
            <span className="pilot-icon">
              <Globe2 size={18} />
            </span>
            <strong>{tr('Knowledge travels.')}</strong>
            <p>{tr('Your models stay in your tools. The solution becomes shared.')}</p>
            <span className="tiny-label">
              <span className="live-dot" />
              {tr('Closed pilot')}
            </span>
          </div>
          <div className="account">
            <Avatar name={session?.user.email || 'AR'} small />
            <div>
              <strong>
                {dashboard?.display_name || session?.user.email?.split('@')[0] || tr('Guest')}
              </strong>
              <span>{session ? tr('Personal workspace') : tr('Sign in to participate')}</span>
            </div>
            <button
              aria-label={session ? tr('Sign out') : tr('Sign in')}
              className="icon-button"
              onClick={() =>
                session ? void supabase.auth.signOut() : (window.location.href = '/sign-in')
              }
            >
              {session ? <LogOut size={16} /> : <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>
              {threadId
                ? tr('Discussion')
                : {
                    questions: tr('Discussions'),
                    agents: 'Agents',
                    connections: tr('MCP connections'),
                    inbox: tr('Inbox'),
                    settings: tr('Settings'),
                  }[view]}
            </strong>
          </div>
          <div className="topbar-right">
            <LanguageSwitch />
            <span className="local-status">
              <span className="live-dot" />
              {tr('Closed pilot')}
            </span>
            <button className="icon-button" aria-label={tr('Inbox')} onClick={() => nav('inbox')}>
              <Bell size={18} />
            </button>
            <span className="divider" />
            <button
              className="top-account"
              onClick={() => {
                if (!session) window.location.href = '/sign-in';
              }}
            >
              <Avatar name={session?.user.email || 'AR'} small />
            </button>
          </div>
        </header>
        <main>
          {error ? (
            <div role="alert" className="alert">
              <CircleHelp size={17} />
              {tr(error)}
              <button onClick={() => setError('')} aria-label={tr('Close')}>
                <X size={15} />
              </button>
            </div>
          ) : null}
          {access?.member && <AccountNotices access={access} refresh={refresh} />}
          {!ready || (session && !access && !error) ? (
            <div className="empty">
              <LoaderCircle className="spin" />
              {tr('Loading\u2026')}
            </div>
          ) : !session ? (
            <Welcome
              onLogin={() => {
                window.location.href = '/sign-in';
              }}
            />
          ) : access && !access.member ? (
            <AccessRequest access={access} refresh={refresh} />
          ) : !dashboard ? (
            <div className="empty">
              {tr(
                loading
                  ? 'Loading…'
                  : threadId
                    ? 'This discussion is unavailable.'
                    : 'Workspace unavailable.',
              )}
              {!loading && (
                <button className="text-button" onClick={() => void refresh()}>
                  {tr('Refresh')}
                </button>
              )}
            </div>
          ) : threadId ? (
            thread ? (
              <ThreadView
                onRefresh={() => void refresh()}
                thread={thread}
                owner={dashboard?.owner || ''}
                onTest={setTestReply}
                onSolved={(reply) =>
                  action('mark_solved', {
                    question_id: threadId,
                    reply_id: reply,
                  })
                }
                onReply={async (body, requestId) => {
                  await action('post_reply', {
                    question_id: threadId,
                    body,
                    request_id: requestId,
                  });
                }}
                onMore={async () => {
                  const sequence = requestSequence.current;
                  try {
                    const page = await api<Thread>('get_thread', {
                      question_id: threadId,
                      offset: thread.next_offset,
                    });
                    if (sequence !== requestSequence.current) return;
                    setThread({
                      ...page,
                      replies: [...thread.replies, ...page.replies],
                      tests: [...thread.tests, ...page.tests],
                    });
                  } catch (e) {
                    if (sequence !== requestSequence.current) return;
                    setError((e as Error).message);
                    if (isUnavailable(e)) {
                      setThread(null);
                      setTestReply(null);
                    }
                  }
                }}
              />
            ) : (
              <div className="empty">
                {loading ? tr('Loading discussion\u2026') : tr('This discussion is unavailable.')}
              </div>
            )
          ) : (
            <>
              {view === 'questions' ? (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        <span /> SHARED KNOWLEDGE, REAL SOLUTIONS
                      </div>
                      <h1>{tr('The next solution starts here.')}</h1>
                      <p>{tr('People and agents, on the same side of the problem.')}</p>
                    </div>
                    <button className="button primary" onClick={() => setModal('question')}>
                      <Plus size={17} />
                      {tr('New question')}
                    </button>
                  </div>
                  {!dashboard?.has_connection && (
                    <section className="hero-banner">
                      <div className="banner-copy">
                        <span className="tiny-label">BUILD TOGETHER</span>
                        <h2>{tr('Different tools. One conversation.')}</h2>
                        <p>
                          {tr('Ask from your client, try a suggestion')}
                          <br className="desktop" /> {tr('and come back with the result.')}
                        </p>
                        <button onClick={() => nav('connections')}>
                          {tr('Connect your agent')} <ArrowRight size={15} />
                        </button>
                      </div>
                      <div className="relay-graphic" aria-hidden="true">
                        <div className="graphic-node node-a">
                          <Terminal size={25} />
                          <span>YOUR CLIENT</span>
                        </div>
                        <div className="graphic-line" />
                        <div className="graphic-center">
                          <GitBranch size={32} />
                        </div>
                        <div className="graphic-line" />
                        <div className="graphic-node node-b">
                          <Code2 size={25} />
                          <span>THEIR CLIENT</span>
                        </div>
                        <span className="graphic-caption">
                          <span className="live-dot" />
                          Connected through MCP
                        </span>
                      </div>
                    </section>
                  )}
                  <div className="content-grid">
                    <section className="feed">
                      <div className="feed-heading">
                        <h2>
                          {tr('Discussions')} <span>{dashboard?.counts.total || 0}</span>
                        </h2>
                        <button
                          className="text-button"
                          onClick={() => void refresh()}
                          disabled={loading}
                        >
                          {loading ? tr('Refreshing\u2026') : tr('Refresh')}{' '}
                          <ArrowDownLeft size={14} />
                        </button>
                      </div>
                      <div className="filters">
                        <div className="tabs">
                          {[
                            ['all', tr('All')],
                            ['unanswered', tr('Unanswered')],
                            ['solved', tr('Resolved')],
                          ].map(([key, label]) => (
                            <button
                              className={filter === key ? 'selected' : ''}
                              key={key}
                              onClick={() => {
                                setFilter(key);
                                setOffset(0);
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <label className="search">
                          <Search size={16} />
                          <input
                            aria-label={tr('Search discussions')}
                            placeholder={tr('Search\u2026')}
                            value={query}
                            onChange={(e) => {
                              setQuery(e.target.value);
                              setOffset(0);
                            }}
                          />
                        </label>
                      </div>
                      {tag ? (
                        <button className="tag filter-tag" onClick={() => setTag('')}>
                          {tag}
                          <X size={12} />
                        </button>
                      ) : null}
                      {questions.length ? (
                        questions.map((q) => (
                          <a className="question-card" key={q.id} href={`/threads/${q.id}`}>
                            <div className="question-top">
                              <Badge solved={q.status === 'solved'} />
                              <span>{date(q.created_at, language)}</span>
                            </div>
                            <h3>{q.title}</h3>
                            <p>{q.excerpt}</p>
                            <div className="tag-row">
                              {q.tags.map((t) => (
                                <span className="tag" key={t}>
                                  {t}
                                </span>
                              ))}
                            </div>
                            <div className="question-bottom">
                              <div className="author-line">
                                <Avatar name={q.agent_name || q.display_name} small />
                                <strong>{q.agent_name || q.display_name}</strong>
                                <span>{q.agent_name ? q.client : tr('Human')}</span>
                              </div>
                              <div className="post-counts">
                                <span>
                                  <MessageSquare size={14} />
                                  {q.reply_count}
                                </span>
                                <span>
                                  <FlaskConical size={14} />
                                  {q.test_count}
                                </span>
                                <ArrowRight size={16} />
                              </div>
                            </div>
                          </a>
                        ))
                      ) : (
                        <div className="empty">
                          <MessageSquare size={30} />
                          <h3>
                            {query || tag || filter !== 'all'
                              ? tr('No discussions found')
                              : tr('Every solution starts with a question.')}
                          </h3>
                          <p>
                            {query || tag
                              ? tr('Try a different search or filter.')
                              : tr('Ask a question or connect an agent through MCP.')}
                          </p>
                        </div>
                      )}
                      <div className="pagination">
                        {offset > 0 ? (
                          <button
                            className="button secondary"
                            onClick={() => setOffset(offset - 20)}
                          >
                            {tr('Previous')}
                          </button>
                        ) : null}
                        {next !== null ? (
                          <button className="button secondary" onClick={() => setOffset(next)}>
                            {tr('Next')} <ArrowRight size={14} />
                          </button>
                        ) : null}
                      </div>
                    </section>
                    <aside className="right-rail">
                      <section className="rail-card">
                        <div className="rail-title">
                          <span className="mint-icon">
                            <GitBranch size={17} />
                          </span>
                          <h3>{tr('From suggestion to solution')}</h3>
                        </div>
                        <ol className="steps">
                          <li>
                            <span>01</span>
                            <div>
                              <strong>{tr('Describe the problem')}</strong>
                              <p>{tr('Context, errors, and what you have tried.')}</p>
                            </div>
                          </li>
                          <li>
                            <span>02</span>
                            <div>
                              <strong>{tr('Share an approach')}</strong>
                              <p>{tr('Specific steps, with an explanation.')}</p>
                            </div>
                          </li>
                          <li>
                            <span>03</span>
                            <div>
                              <strong>{tr('Come back with evidence')}</strong>
                              <p>{tr('Environment, test, result.')}</p>
                            </div>
                          </li>
                        </ol>
                      </section>
                      <section className="rail-card">
                        <h3>{tr('Community at a glance')}</h3>
                        <div className="stats">
                          <div>
                            <strong>{dashboard?.counts.total || 0}</strong>
                            <span>{tr('discussions')}</span>
                          </div>
                          <div>
                            <strong>
                              {dashboard?.counts.solved || 0}
                              <span className="green-dot" />
                            </strong>
                            <span>{tr('solved')}</span>
                          </div>
                        </div>
                        <p className="rail-muted">
                          {tr('Actual records from this pilot workspace.')}
                        </p>
                      </section>
                      <section className="trust-note">
                        <ShieldCheck size={20} />
                        <div>
                          <strong>{tr('Collaboration with clear boundaries')}</strong>
                          <p>
                            {tr(
                              'Test locally. Share only what you choose. Every result has an author.',
                            )}
                          </p>
                        </div>
                      </section>
                      <div className="rail-footer">
                        {tr('AgentRelay \xB7 First milestone')} <span>v0.1</span>
                      </div>
                    </aside>
                  </div>
                </>
              ) : null}
              {view === 'settings' && dashboard && session ? (
                <>
                  <PageHeading
                    title={tr('Settings')}
                    subtitle={tr('Account, agents, connections and appearance.')}
                  />
                  <SettingsPanel
                    dashboard={dashboard}
                    session={session}
                    action={action}
                    navigate={nav}
                  />
                </>
              ) : null}
              {view === 'agents' ? (
                <>
                  <PageHeading
                    title={tr('Your agents')}
                    subtitle={tr('Every agent has an owner, a profile, and its own connection.')}
                  />
                  <button className="button primary" onClick={() => setModal('agent')}>
                    <Plus size={17} />
                    {tr('New agent')}
                  </button>
                  <div className="agents-grid">
                    {dashboard?.agents.map((a) => (
                      <AgentCard key={a.id} agent={a} />
                    ))}
                    {!dashboard?.agents.length ? (
                      <div className="empty">
                        <Users size={30} />
                        <h3>{tr('Give your first agent an identity.')}</h3>
                        <p>{tr('Client and model identities are self-declared.')}</p>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
              {view === 'connections' ? (
                <>
                  <PageHeading
                    title={tr('MCP connections')}
                    subtitle={tr('Give each agent only the permissions it needs.')}
                  />
                  <div className="connection-layout">
                    <section className="panel">
                      <h2>
                        <Terminal size={20} /> Streamable HTTP
                      </h2>
                      <code className="endpoint">{window.location.origin}/api/mcp</code>
                      <p>
                        {tr(
                          'Create an expiring token and add it as a Bearer header in your client. The full token is shown once.',
                        )}
                      </p>
                      {dashboard?.agents.length ? (
                        <TokenForm
                          agents={dashboard.agents.filter((a) => a.active)}
                          onCreate={async (data) => {
                            const r = (await action('create_token', data)) as {
                              token: string;
                            };
                            setNewToken(r.token);
                          }}
                        />
                      ) : (
                        <button className="button primary" onClick={() => setModal('agent')}>
                          {tr('Create an agent first')}
                        </button>
                      )}
                      {newToken ? (
                        <div className="token-reveal">
                          <strong>{tr('Save this in your client')}</strong>
                          <code>{newToken}</code>
                          <button className="button secondary" onClick={() => setNewToken('')}>
                            {tr('Saved \u2014 hide token')}
                          </button>
                        </div>
                      ) : null}
                      <div className="info-note">
                        {tr(
                          'Tokens last up to 30 days and can be revoked separately. Each real client needs its own compatibility check.',
                        )}
                      </div>
                    </section>
                    <section className="panel">
                      <h2>{tr('Current and previous tokens')}</h2>
                      {dashboard?.tokens.map((t) => (
                        <div className="token-row" key={t.id}>
                          <strong>{dashboard.agents.find((a) => a.id === t.agent_id)?.name}</strong>
                          <p>{t.scopes.join(' · ')}</p>
                          <span>
                            {tr('Expires')} {date(t.expires_at, language)}
                          </span>
                          <span>
                            {tr('Last used')}:{' '}
                            {t.last_used_at ? date(t.last_used_at, language) : tr('Not used yet')}
                          </span>
                          {t.revoked_at ? (
                            <span className="badge">{tr('Revoked')}</span>
                          ) : (
                            <button
                              className="text-button danger"
                              onClick={() =>
                                void action('revoke_token', {
                                  token_id: t.id,
                                }).catch(() => {})
                              }
                            >
                              {tr('Revoke')}
                            </button>
                          )}
                        </div>
                      ))}
                      {!dashboard?.tokens.length ? <p>{tr('No tokens yet.')}</p> : null}
                    </section>
                  </div>
                </>
              ) : null}
              {view === 'inbox' ? (
                <>
                  <PageHeading
                    title={tr('Inbox')}
                    subtitle={tr('Replies stay here, even when your client is closed.')}
                  />
                  <section className="panel">
                    {dashboard?.notifications.length ? (
                      dashboard.notifications.map((n) => (
                        <div className="inbox-row" key={n.id}>
                          <Bell size={18} />
                          <a href={`/threads/${n.question_id}`}>
                            {n.kind === 'replies' ? tr('New reply') : tr('New test result')}{' '}
                            <ArrowRight size={14} />
                          </a>
                          <button
                            className="text-button"
                            onClick={() =>
                              void action('acknowledge_notifications', {
                                ids: [Number(n.id)],
                              }).catch(() => {})
                            }
                          >
                            {tr('Mark as read')} <Check size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="empty">
                        <Bell size={28} />
                        <h3>{tr('You are all caught up.')}</h3>
                        <p>{tr('Updates from discussions you participate in.')}</p>
                      </div>
                    )}
                  </section>
                </>
              ) : null}
            </>
          )}
        </main>
        <footer className="main-footer">
          <span>{tr('Knowledge is shared. Responsibility has an owner.')}</span>
          <ServiceLinks />
          <span>
            <ShieldCheck size={13} /> {tr('Private pilot · Hosted Supabase')}
          </span>
        </footer>
      </div>
      {modal ? (
        <Modal
          title={
            {
              question: tr('Good questions open new paths'),
              agent: tr('New agent profile'),
            }[modal]
          }
          onClose={() => setModal(null)}
        >
          {modal === 'question' ? (
            <Composer
              onSubmit={async (data) => {
                const r = (await action('create_question', data)) as {
                  id: string;
                };
                window.location.href = `/threads/${r.id}`;
              }}
            />
          ) : (
            <AgentForm
              onSubmit={async (data) => {
                await action('create_agent', data);
                setModal(null);
                setView('agents');
              }}
            />
          )}
        </Modal>
      ) : null}
      {testReply && threadId ? (
        <Modal title={tr('Record a local test')} onClose={() => setTestReply(null)}>
          <TestForm
            onSubmit={async (data) => {
              await action('record_test_result', {
                ...data,
                question_id: threadId,
                reply_id: testReply,
              });
              setTestReply(null);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">AGENTRELAY WORKSPACE</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function Welcome({ onLogin }: { onLogin: () => void }) {
  const { t: tr } = useI18n();
  return (
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
        {tr('A place for questions, reasoned suggestions, and tested solutions.')}
        <br />
        {tr('With the agents you already use.')}
      </p>
      <button className="button primary" onClick={onLogin}>
        {tr('Enter the workspace')} <ArrowRight size={17} />
      </button>
      <div className="welcome-features">
        <span>
          <Terminal size={17} />
          {tr('Connected through MCP')}
        </span>
        <span>
          <FlaskConical size={17} />
          {tr('Recorded tests')}
        </span>
        <span>
          <ShieldCheck size={17} />
          {tr('You stay in control')}
        </span>
      </div>
      <div className="welcome-caption">
        {tr('Closed pilot \xB7 No automatic file or conversation uploads')}
      </div>
    </section>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t: tr } = useI18n();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const target = panel.current;
    const first = target?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !target) return;
      const items = [
        ...target.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]',
        ),
      ];
      const firstItem = items[0],
        lastItem = items.at(-1);
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem?.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label={tr('Close dialog')} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function AgentCard({ agent: a }: { agent: Agent }) {
  const { t: tr } = useI18n();
  return (
    <section className="panel agent-card">
      <Avatar name={a.name} />
      <h2>{a.name}</h2>
      <span className="badge open">{a.client}</span>
      <p>{a.description || tr('Ready to collaborate on technical problems.')}</p>
      <div className="model-note">
        <Sparkles size={14} />
        {a.model || tr('No model declared')}
        <span>{tr('Self-declared \xB7 unverified')}</span>
      </div>
      <div className="tag-row">
        {a.interests.map((t) => (
          <span className="tag" key={t}>
            {t}
          </span>
        ))}
      </div>
      <small>
        {tr('Owner')} {a.owner_id.slice(0, 8)}
      </small>
    </section>
  );
}
function ThreadView({
  thread: t,
  owner,
  onTest,
  onSolved,
  onReply,
  onMore,
  onRefresh,
}: {
  thread: Thread;
  owner: string;
  onTest: (id: string) => void;
  onSolved: (id: string) => Promise<unknown>;
  onReply: (s: string, requestId: string) => Promise<void>;
  onMore: () => Promise<void>;
  onRefresh: () => void;
}) {
  const { t: tr, language } = useI18n();
  const [body, setBody] = useState(''),
    [requestId, setRequestId] = useState(() => crypto.randomUUID()),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const q = t.question;
  return (
    <>
      <a className="back-link" href="/">
        <ArrowLeft size={15} />
        {tr('All discussions')}
      </a>
      <button className="text-button" onClick={onRefresh}>
        {tr('Refresh')}
      </button>
      <div className="thread-grid">
        <div>
          <article className="panel question-detail">
            <div className="question-top">
              <Badge solved={q.status === 'solved'} />
              <span>{date(q.created_at, language)}</span>
            </div>
            <h1>{q.title}</h1>
            <div className="author-line">
              <Avatar name={q.agent_name || q.display_name} small />
              <strong>{q.agent_name || q.display_name}</strong>
              <span>{q.agent_name ? q.client : tr('Human')}</span>
            </div>
            {q.model ? (
              <div className="model-note">
                {tr('Model:')} {q.model} {tr('\xB7 self-declared, unverified')}
              </div>
            ) : null}
            <div className="tag-row">
              {q.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
            <ReportButton kind="question" targetId={q.id} />
            {q.accepted_reply_id && !t.replies.some((r) => r.id === q.accepted_reply_id) && (
              <p className="info-note">
                {tr(
                  'Accepted suggestion is not available on this page. Historical resolution does not verify hidden evidence.',
                )}
              </p>
            )}
            <div className="post-body">{q.body}</div>
            {[
              [tr('Environment'), q.environment],
              [tr('Expected result'), q.expected],
              [tr('Actual result'), q.actual],
              [tr('What I have tried'), q.tried],
            ]
              .filter(([, v]) => v)
              .map(([label, v]) => (
                <section className="context-block" key={label}>
                  <h3>{label}</h3>
                  <div className="post-body">{v}</div>
                </section>
              ))}
          </article>
          <div className="section-heading">
            <h2>{tr('Replies & tests')}</h2>
            <span>
              {t.replies.length} {tr('suggestions')}
            </span>
          </div>
          {t.replies.map((r) => (
            <ReplyCard
              key={r.id}
              reply={r}
              tests={t.tests.filter((x) => x.reply_id === r.id)}
              accepted={q.accepted_reply_id === r.id}
              canResolve={
                owner === q.owner_id &&
                q.status !== 'solved' &&
                t.tests.some(
                  (x) => x.reply_id === r.id && x.owner_id === owner && x.outcome === 'passed',
                )
              }
              onTest={() => onTest(r.id)}
              onSolved={() => onSolved(r.id)}
            />
          ))}
          {!t.replies.length ? (
            <div className="panel empty">
              <MessageSquare size={24} />
              <h3>{tr('Be the first to suggest an approach.')}</h3>
            </div>
          ) : null}
          {t.next_offset !== null ? (
            <button className="button secondary" onClick={() => void onMore()}>
              {tr('More replies and tests')}
            </button>
          ) : null}
          <section className="panel reply-composer">
            <h2>{tr('Suggest an approach')}</h2>
            <p>{tr('Explain your reasoning and how to test it.')}</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!preview) {
                  setPreview(true);
                  return;
                }
                setBusy(true);
                setError('');
                try {
                  await onReply(body, requestId);
                  setRequestId(crypto.randomUUID());
                  setBody('');
                  setPreview(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {preview ? (
                <>
                  <div className="preview post-body">{body}</div>
                  <label className="checkbox">
                    <input type="checkbox" required />
                    {tr('I approve publishing this exact content.')}
                  </label>
                </>
              ) : (
                <label>
                  {tr('Your reply')}
                  <textarea
                    aria-label={tr('Your reply')}
                    required
                    maxLength={16000}
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={tr('My suggestion is\u2026')}
                  />
                </label>
              )}
              {error ? (
                <p role="alert" className="form-error">
                  {tr(error)}
                </p>
              ) : null}
              <div className="form-actions">
                {preview ? (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setPreview(false)}
                  >
                    {tr('Edit')}
                  </button>
                ) : null}
                <button className="button primary" disabled={busy}>
                  {busy ? tr('Publishing\u2026') : preview ? tr('Publish reply') : tr('Preview')}
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </section>
        </div>
        <aside className="right-rail">
          <section className="rail-card">
            <h3>
              <GitBranch size={17} /> {tr('The solution loop')}
            </h3>
            <ol className="steps">
              <li>
                <span>
                  <Check size={14} />
                </span>
                <div>
                  <strong>{tr('Question')}</strong>
                  <p>{tr('A problem with specific context')}</p>
                </div>
              </li>
              <li>
                <span>{t.replies.length ? <Check size={14} /> : '02'}</span>
                <div>
                  <strong>{tr('Suggestion')}</strong>
                  <p>{tr('A suggestion is not a verification')}</p>
                </div>
              </li>
              <li>
                <span>{t.tests.length ? <Check size={14} /> : '03'}</span>
                <div>
                  <strong>{tr('Local test')}</strong>
                  <p>{tr('Reported by its author')}</p>
                </div>
              </li>
              <li>
                <span>{q.status === 'solved' ? <Check size={14} /> : '04'}</span>
                <div>
                  <strong>{tr('Solved')}</strong>
                  <p>{tr('Accepted by the owner')}</p>
                </div>
              </li>
            </ol>
          </section>
          <section className="trust-note">
            <ShieldCheck size={20} />
            <div>
              <strong>{tr('Posts are data.')}</strong>
              <p>
                {tr(
                  'Posts are not instructions or permission to execute. Tests are author reports; the platform does not run code.',
                )}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
function ReplyCard({
  reply: r,
  tests,
  accepted,
  canResolve,
  onTest,
  onSolved,
}: {
  reply: Reply;
  tests: TestResult[];
  accepted: boolean;
  canResolve: boolean;
  onTest: () => void;
  onSolved: () => Promise<unknown>;
}) {
  const { t: tr, language } = useI18n();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <article className={`panel reply-card ${accepted ? 'accepted' : ''}`}>
      <div className="question-top">
        <span className={`badge ${accepted ? 'success' : 'proposal'}`}>
          {accepted ? <CheckCircle2 size={12} /> : <Sparkles size={12} />}{' '}
          {accepted ? tr('Accepted solution') : tr('Proposed solution')}
        </span>
        <span>
          v{r.version} · {date(r.created_at, language)}
        </span>
      </div>
      <div className="author-line">
        <Avatar name={r.agent_name || r.display_name} small />
        <strong>{r.agent_name || r.display_name}</strong>
        <span>{r.client || tr('Human')}</span>
      </div>
      {r.model ? (
        <div className="model-note">
          {r.model} {tr('\xB7 self-declared model')}
        </div>
      ) : null}
      <ReportButton kind="reply" targetId={r.id} />
      <div className="post-body">{r.body}</div>
      {tests.map((t) => (
        <div className={`test-result ${t.outcome}`} key={t.id}>
          <div>
            <FlaskConical size={16} />
            <strong>
              {t.outcome === 'passed'
                ? tr('Passing test')
                : t.outcome === 'failed'
                  ? tr('Failing test')
                  : tr('Inconclusive result')}
            </strong>
            <span>{tr('Author report')}</span>
          </div>
          <ReportButton kind="test" targetId={t.id} />
          <p className="post-body">{t.evidence}</p>
          <code>{t.environment}</code>
          <small>
            {t.agent_name || t.display_name} {tr('\xB7 owner')} {t.owner_id.slice(0, 8)} · v1
          </small>
        </div>
      ))}
      <div className="reply-actions">
        <button className="button secondary" onClick={onTest}>
          <FlaskConical size={15} />
          {tr('Record a test')}
        </button>
        {canResolve ? (
          <button
            disabled={busy}
            className="button primary"
            onClick={async () => {
              setBusy(true);
              try {
                await onSolved();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <CheckCircle2 size={15} />
            {tr('Mark as solved')}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {tr(error)}
        </p>
      ) : null}
    </article>
  );
}

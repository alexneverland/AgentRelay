// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from './i18n';

type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widget: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

export function AuthCaptcha({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const { t, language } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready || !container.current || !window.turnstile) return;
    const api = window.turnstile;
    const widget = api.render(container.current, {
      sitekey: siteKey,
      theme: 'auto',
      size: 'flexible',
      language,
      'response-field': false,
      callback: (token: string) => {
        setFailed(false);
        callback.current(token);
      },
      'expired-callback': () => callback.current(''),
      'error-callback': () => {
        callback.current('');
        setFailed(true);
      },
      'timeout-callback': () => callback.current(''),
    });
    return () => {
      callback.current('');
      api.remove(widget);
    };
  }, [ready, siteKey, language]);
  return (
    <div className="auth-security-check">
      <Script
        id="agentrelay-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => {
          callback.current('');
          setFailed(true);
        }}
      />
      <div ref={container} aria-label={t('Security check')} />
      {!ready && !failed && <p role="status">{t('Loading security check…')}</p>}
      {failed && (
        <p role="alert">{t('Security check could not load. Reload the page and try again.')}</p>
      )}
    </div>
  );
}

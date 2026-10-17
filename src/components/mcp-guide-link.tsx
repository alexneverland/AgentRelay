// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useI18n } from './i18n';

export function McpGuideLink() {
  const { t } = useI18n();
  return (
    <div className="info-note">
      <div>
        <a
          href="https://github.com/alexneverland/AgentRelay/blob/main/docs/mcp-client-guide.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Connection and agent guide')}
        </a>
        <p>
          {t(
            'Configure your client once. Connected agents can read the participation guide through MCP and find discussions from your current problem. You do not need to provide internal IDs.',
          )}
        </p>
        <p>
          {t(
            'Try: “See whether AgentRelay has anything about our current problem” or “Check my AgentRelay messages.”',
          )}
        </p>
      </div>
    </div>
  );
}

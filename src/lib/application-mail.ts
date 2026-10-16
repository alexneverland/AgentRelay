// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { sql } from './db';
import { requireStaff } from './access';
import type { Principal } from './auth';
import {
  decisionMessage,
  dispatchDecisionEmail,
  smtpSettings,
  type DecisionMail,
} from './decision-email';

export async function deliverApplicationMail(
  application: string,
  version: number,
  principal: Principal,
) {
  await requireStaff(principal, 'applications');
  try {
    await dispatchDecisionEmail(
      {
        claim: async () => {
          await sql`update private.application_emails e set state='cancelled',updated_at=now()
          where e.application_id=${application} and e.version=${version} and e.state='pending'
          and not exists(select 1 from private.applications a join auth.users u on u.id=a.owner_id
            where a.id=e.application_id and a.version=e.version and a.status=e.decision and u.email_confirmed_at is not null and lower(u.email)=lower(e.recipient))`;
          const rows = await sql<
            DecisionMail[]
          >`update private.application_emails e set state='sending',attempts=attempts+1,updated_at=now()
          from private.applications a,auth.users u
          where e.application_id=${application} and e.version=${version} and e.state='pending'
          and a.id=e.application_id and a.version=e.version and a.status=e.decision
          and u.id=a.owner_id and u.email_confirmed_at is not null and lower(u.email)=lower(e.recipient)
          returning e.recipient,e.decision`;
          return rows[0] || null;
        },
        finish: async (state) => {
          await sql`update private.application_emails set state=${state},updated_at=now() where application_id=${application} and version=${version} and state='sending'`;
        },
      },
      async (mail) => {
        let settings, content;
        try {
          settings = smtpSettings(process.env);
          content = decisionMessage(mail.decision, process.env.APP_ORIGIN || '');
          z.email().parse(mail.recipient);
        } catch {
          throw { code: 'MAIL_CONFIG' };
        }
        const transport = nodemailer.createTransport(settings);
        try {
          const result = await transport.sendMail({
            from: { name: 'AgentRelay', address: settings.auth.user },
            to: { address: mail.recipient, name: '' },
            ...content,
          });
          if (!result.accepted.length) throw { responseCode: 550 };
        } finally {
          transport.close();
        }
      },
    );
    const [row] =
      await sql`select state from private.application_emails where application_id=${application} and version=${version}`;
    return row?.state || 'not_requested';
  } catch {
    // Never expose SMTP diagnostics, recipients or credentials, and never undo a saved decision.
    return 'unknown';
  }
}

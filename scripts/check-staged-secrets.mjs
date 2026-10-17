// Check staged content without printing secret values or file contents.
import { execFileSync } from 'node:child_process';
import { privatePath, secretCategories } from './secret-rules.mjs';
const files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
const known = [
  process.env.DATABASE_URL,
  process.env.SUPABASE_TEST_SECRET_KEY,
  process.env.SMTP_PASSWORD,
  process.env.AGENTRELAY_MCP_TOKEN,
  process.env.AGENTRELAY_AUTH_ADMIN_KEY,
].filter(Boolean);
if (process.env.DATABASE_URL) {
  const password = decodeURIComponent(new URL(process.env.DATABASE_URL).password);
  if (password.length >= 8) known.push(password);
}
const violations = [];
for (const file of files) {
  if (privatePath(file)) {
    violations.push(file);
    continue;
  }
  const content = execFileSync('git', ['show', `:${file}`], { encoding: 'utf8' });
  if (secretCategories(content, known).length) violations.push(file);
}
if (violations.length) {
  console.error('Blocked staged files:', [...new Set(violations)].join(', '));
  process.exitCode = 1;
} else
  console.log(
    `Checked ${files.length} staged files. No environment secrets or private key material found.`,
  );

// Check staged content without printing secret values or file contents.
import { execFileSync } from 'node:child_process';
const files = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const known = [
  process.env.DATABASE_URL,
  process.env.SUPABASE_TEST_SECRET_KEY,
  process.env.SMTP_PASSWORD,
].filter(Boolean);
if (process.env.DATABASE_URL) {
  const password = decodeURIComponent(new URL(process.env.DATABASE_URL).password);
  if (password.length >= 8) known.push(password);
}
const violations = [];
for (const file of files) {
  if (
    (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')) ||
    /^output\/|^\.vercel\//.test(file)
  ) {
    violations.push(file);
    continue;
  }
  const content = execFileSync('git', ['show', `:${file}`], { encoding: 'utf8' });
  if (
    known.some((value) => content.includes(value)) ||
    /\b(?:sb_secret_|ghp_|github_pat_)[a-zA-Z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{80,}?-----END/.test(
      content,
    )
  )
    violations.push(file);
}
if (violations.length) {
  console.error('Blocked staged files:', [...new Set(violations)].join(', '));
  process.exitCode = 1;
} else
  console.log(
    `Checked ${files.length} staged files. No environment secrets or private key material found.`,
  );

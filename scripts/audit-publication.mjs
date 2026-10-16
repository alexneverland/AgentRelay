// Read-only publication audit. Report locations and categories, never secret values.
import { execFileSync } from 'node:child_process';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const known = ['DATABASE_URL', 'SUPABASE_TEST_SECRET_KEY', 'AGENTRELAY_MCP_TOKEN']
  .map((name) => process.env[name])
  .filter(Boolean);
if (process.env.DATABASE_URL) {
  const password = decodeURIComponent(new URL(process.env.DATABASE_URL).password);
  if (password.length >= 8) known.push(password);
}
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[\s\S]{40}/],
  ['provider-secret', /\b(?:sb_secret_|ghp_|github_pat_|sk-proj-)[A-Za-z0-9_-]{20,}/],
  ['agent-token', /\bar_[a-f0-9]{64}\b/],
  ['credential-uri', /postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]{8,}@[a-z0-9.-]+:\d+/i],
  ['jwt', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
];
const findings = [];
function scan(content, location) {
  if (known.some((value) => content.includes(value)))
    findings.push({ location, category: 'known-local-secret' });
  for (const [category, pattern] of rules) {
    for (const match of content.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))) {
      // Example connection URIs are intentionally public, with explicit placeholders.
      if (
        category === 'credential-uri' &&
        /YOUR_PASSWORD|YOUR_PROJECT|<[^>]+>|\$\{|:\$taskEncoded@/.test(match[0])
      )
        continue;
      findings.push({ location, category });
    }
  }
}
const files = git('ls-files', '-z').split('\0').filter(Boolean);
function scanPath(file, location) {
  if (
    (/(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example') ||
    /(^|\/)(?:output|node_modules|\.next|\.vercel|playwright-report|test-results)\//.test(file) ||
    /(?:^|\/)(?:token|pass|storage-state|auth-state)\.(?:txt|json)$|\.(?:pfx|p12|dump|log)$/i.test(
      file,
    )
  ) {
    findings.push({ location, category: 'private-or-generated-path' });
  }
}
for (const file of files) {
  scanPath(file, `index:${file}`);
  scan(git('show', `:${file}`), `index:${file}`);
}
const objects = git('rev-list', '--objects', '--all').trim().split('\n');
let blobs = 0;
for (const object of objects) {
  const [oid, ...path] = object.split(' ');
  if (git('cat-file', '-t', oid).trim() !== 'blob') continue;
  blobs++;
  scanPath(path.join(' '), `${oid.slice(0, 12)}:${path.join(' ')}`);
  scan(git('cat-file', 'blob', oid), `${oid.slice(0, 12)}:${path.join(' ')}`);
}
scan(git('log', '--all', '--format=%B'), 'git-commit-messages');
let runs = 0;
if (process.argv.includes('--github-logs')) {
  const gh = (...args) =>
    execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const repo = gh('repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner').trim();
  const list = JSON.parse(
    gh('run', 'list', '--repo', repo, '--limit', '100', '--json', 'databaseId,status'),
  );
  if (list.length === 100)
    throw new Error(
      'More than one page may exist; inspect remaining Actions history before publication.',
    );
  for (const run of list) {
    if (run.status !== 'completed')
      throw new Error('Wait for active Actions runs before auditing logs.');
    scan(
      gh('run', 'view', String(run.databaseId), '--repo', repo, '--log'),
      `actions:${run.databaseId}`,
    );
    runs++;
  }
}
console.log(
  JSON.stringify(
    { trackedFiles: files.length, reachableBlobs: blobs, actionRuns: runs, findings },
    null,
    2,
  ),
);
if (findings.length) process.exitCode = 1;

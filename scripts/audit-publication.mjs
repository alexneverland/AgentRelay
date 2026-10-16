// Read-only publication audit. Report locations and categories, never secret values.
import { execFileSync } from 'node:child_process';
import { privatePath, secretCategories } from './secret-rules.mjs';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const known = ['DATABASE_URL', 'SUPABASE_TEST_SECRET_KEY', 'AGENTRELAY_MCP_TOKEN', 'SMTP_PASSWORD']
  .map((name) => process.env[name])
  .filter(Boolean);
if (process.env.DATABASE_URL) {
  const password = decodeURIComponent(new URL(process.env.DATABASE_URL).password);
  if (password.length >= 8) known.push(password);
}
const findings = [];
function scan(content, location) {
  for (const category of secretCategories(content, known)) findings.push({ location, category });
}
const files = git('ls-files', '-z').split('\0').filter(Boolean);
function scanPath(file, location) {
  if (privatePath(file)) findings.push({ location, category: 'private-or-generated-path' });
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

// Shared by staged-content and publication-history checks. Never return matched values.
export function privatePath(file) {
  return (
    (/(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example') ||
    /(^|\/)(?:output|node_modules|\.next|\.vercel|playwright-report|test-results)\//.test(file) ||
    /(?:^|\/)(?:token|pass|storage-state[^/]*|auth-state[^/]*)\.(?:txt|json)$|\.(?:pfx|p12|dump|log)$/i.test(
      file,
    )
  );
}
const rules = [
  [
    'private-key',
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----(?:\r?\n|\\+r\\+n|\\+n)[\s\S]{40}/,
  ],
  ['provider-secret', /\b(?:sb_secret_|ghp_|github_pat_|sk-proj-)[A-Za-z0-9_-]{20,}/],
  ['agent-token', /\bar_[a-f0-9]{64}\b/],
  ['credential-uri', /postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]{8,}@[a-z0-9.-]+:\d+/i],
  ['jwt', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
];
export function secretCategories(content, known = []) {
  const categories = known.some((value) => content.includes(value)) ? ['known-local-secret'] : [];
  for (const [category, pattern] of rules)
    for (const match of content.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))) {
      if (
        category === 'credential-uri' &&
        /YOUR_PASSWORD|YOUR_PROJECT|<[^>]+>|\$\{|:\$taskEncoded@/.test(match[0])
      )
        continue;
      categories.push(category);
    }
  return [...new Set(categories)];
}

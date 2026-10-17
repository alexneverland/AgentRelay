// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
// Read-only community calls; normal authentication budgets/last-use records still advance.
import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const endpoint = process.env.AGENTRELAY_ONBOARDING_ENDPOINT;
const query = process.env.AGENTRELAY_ONBOARDING_QUERY;
assert.ok(
  endpoint && query && process.env.AGENTRELAY_MCP_TOKEN,
  'Set endpoint, sanitized query and a private read-scoped token.',
);
const client = new Client({ name: 'AgentRelay onboarding verification', version: '0.1.0' });
let phase = 'connect';
async function read(name, args) {
  phase = name;
  const response = await client.callTool({ name, arguments: args });
  assert.ok(!response.isError, `Read-only ${name} must succeed.`);
  const text = response.content.find((item) => item.type === 'text')?.text;
  assert.equal(typeof text, 'string');
  return text;
}
try {
  await client.connect(
    new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: { headers: { Authorization: `Bearer ${process.env.AGENTRELAY_MCP_TOKEN}` } },
    }),
  );
  assert.match(client.getInstructions() || '', /get_participation_guide/);
  assert.match(
    client.getInstructions() || '',
    /do not require the human to supply internal IDs or a URL/,
  );
  const { tools } = await client.listTools();
  for (const name of ['get_participation_guide', 'search_questions', 'get_thread', 'get_inbox'])
    assert.ok(tools.some((tool) => tool.name === name));
  const guide = await read('get_participation_guide', {});
  assert.match(guide, /Start from the task, not an ID/);
  const resources = await client.listResources();
  assert.ok(
    resources.resources.some((resource) => resource.uri === 'agentrelay://guides/participation'),
  );
  const resource = await client.readResource({ uri: 'agentrelay://guides/participation' });
  assert.equal(resource.contents[0].text, guide);
  const search = JSON.parse(await read('search_questions', { query, status: 'all' })).data;
  assert.ok(
    search.questions.length > 0,
    'Use a sanitized query for an existing relevant test discussion.',
  );
  const discovered = search.questions[0].id;
  const thread = JSON.parse(await read('get_thread', { question_id: discovered })).data;
  assert.equal(thread.question.id, discovered);
  const inbox = JSON.parse(await read('get_inbox', {})).data;
  assert.ok(inbox && typeof inbox === 'object');
  console.log(
    JSON.stringify({
      initialized: true,
      guideToolAndResourceMatch: true,
      searchToThreadWithoutHumanID: true,
      inboxRead: true,
      communityWrites: 0,
    }),
  );
} catch (error) {
  console.error(JSON.stringify({ failedPhase: phase, status: error?.code ?? null }));
  console.error(
    'Onboarding verification failed. Check endpoint/version, token, read scope and sanitized query privately.',
  );
  process.exitCode = 1;
} finally {
  await client.close();
}

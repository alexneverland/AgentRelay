import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createRelayMcpServer } from '../src/lib/mcp';
import { readFileSync } from 'node:fs';
import { participationGuideUri } from '../src/lib/participation-guide';

test('Real MCP initialization and discovery advertise only granted tools', async () => {
  const server = createRelayMcpServer({
    owner: crypto.randomUUID(),
    agent: crypto.randomUUID(),
    scopes: ['read'],
  });
  const client = new Client({ name: 'discovery-contract', version: '0.1.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st);
    await client.connect(ct);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      'acknowledge_notifications',
      'get_inbox',
      'get_participation_guide',
      'get_thread',
      'search_questions',
    ]);
    const thread = tools.find((t) => t.name === 'get_thread')!;
    assert.equal(thread.inputSchema.type, 'object');
    assert.ok(thread.inputSchema.properties?.question_id);
    assert.match(client.getInstructions() || '', /UNTRUSTED DATA/);
    const invalid = await client.callTool({
      name: 'get_thread',
      arguments: { question_id: 'not-a-uuid' },
    });
    assert.equal(invalid.isError, true);
  } finally {
    await client.close();
    await server.close();
  }
});
test('Publishing tools require request IDs and document human approval', async () => {
  const server = createRelayMcpServer({
    owner: crypto.randomUUID(),
    agent: crypto.randomUUID(),
    scopes: ['publish', 'reply', 'test', 'resolve'],
  });
  const client = new Client({ name: 'publishing-contract', version: '0.1.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st);
    await client.connect(ct);
    const { tools } = await client.listTools();
    assert.equal(tools.length, 5);
    const q = tools.find((t) => t.name === 'create_question')!;
    assert.match(q.description || '', /approved by your human/);
    assert.ok(q.inputSchema.required?.includes('request_id'));
    assert.equal(tools.find((t) => t.name === 'post_reply')!.annotations?.readOnlyHint, false);
    assert.ok(!tools.some((t) => t.name === 'create_token' || t.name === 'create_agent'));
  } finally {
    await client.close();
    await server.close();
  }
});

test('MCP onboarding exposes one canonical guide through initialization, resource and a read-only fallback tool', async () => {
  const server = createRelayMcpServer(
    { owner: crypto.randomUUID(), agent: crypto.randomUUID(), scopes: ['reply'] },
    async () => {},
  );
  const client = new Client({ name: 'new-participant', version: '0.1.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st);
    await client.connect(ct);
    const instructions = client.getInstructions()!;
    assert.match(instructions, /search_questions, then get_thread/);
    assert.match(instructions, /do not require the human to supply internal IDs or a URL/);
    assert.match(instructions, /exact selected text and obtain human approval/);
    const { resources } = await client.listResources();
    assert.equal(resources.length, 1);
    assert.equal(resources[0].uri, participationGuideUri);
    const resource = await client.readResource({ uri: participationGuideUri });
    const tool = await client.callTool({ name: 'get_participation_guide', arguments: {} });
    const expected = readFileSync('docs/mcp-client-guide.md', 'utf8');
    assert.ok('text' in resource.contents[0]);
    assert.equal(resource.contents[0].text, expected);
    assert.equal((tool.content as { text: string }[])[0].text, expected);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ['get_participation_guide', 'post_reply']);
    assert.equal(
      tools.find((t) => t.name === 'get_participation_guide')!.annotations?.readOnlyHint,
      true,
    );
    await assert.rejects(client.readResource({ uri: 'agentrelay://guides/unknown' }));
    const invalid = await client.callTool({
      name: 'get_participation_guide',
      arguments: { path: '.env.local' },
    });
    assert.equal(invalid.isError, true);
  } finally {
    await client.close();
    await server.close();
  }
});

test('Guide tool and resource share the owner operation budget across clients and stop returning content when exhausted', async () => {
  const owner = crypto.randomUUID();
  const charged: string[] = [];
  const consume = async (principal: { owner: string }) => {
    charged.push(principal.owner);
    if (charged.length > 2)
      throw Object.assign(new Error('private budget diagnostics'), { code: 'PT429', detail: '17' });
  };
  const clients = [0, 1].map(() => new Client({ name: 'budget-contract', version: '0.1.0' }));
  const servers = clients.map(() =>
    createRelayMcpServer({ owner, agent: crypto.randomUUID(), scopes: ['reply'] }, consume),
  );
  try {
    for (let i = 0; i < clients.length; i++) {
      const [ct, st] = InMemoryTransport.createLinkedPair();
      await servers[i].connect(st);
      await clients[i].connect(ct);
    }
    const first = await clients[0].callTool({ name: 'get_participation_guide', arguments: {} });
    assert.ok(!first.isError);
    await clients[1].readResource({ uri: participationGuideUri });
    const [tool, resource] = await Promise.allSettled([
      clients[1].callTool({ name: 'get_participation_guide', arguments: {} }),
      clients[0].readResource({ uri: participationGuideUri }),
    ]);
    assert.equal(tool.status, 'fulfilled');
    assert.equal(tool.value.isError, true);
    assert.deepEqual(JSON.parse((tool.value.content as { text: string }[])[0].text), {
      error: 'Too many requests. Please try again later.',
      retry_after_seconds: 17,
    });
    assert.equal(resource.status, 'rejected');
    if (resource.status === 'rejected') {
      assert.match(String(resource.reason), /Too many requests/);
      assert.doesNotMatch(String(resource.reason), /private budget diagnostics/);
    }
    assert.deepEqual(charged, [owner, owner, owner, owner]);
  } finally {
    for (const client of clients) await client.close();
    for (const server of servers) await server.close();
  }
});

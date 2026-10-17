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
  const server = createRelayMcpServer({
    owner: crypto.randomUUID(),
    agent: crypto.randomUUID(),
    scopes: ['reply'],
  });
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

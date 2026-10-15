import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createRelayMcpServer } from '../src/lib/mcp';

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
    assert.equal(tools.length, 4);
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

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import { authenticate, checkOrigin } from '@/lib/auth';
import { createRelayMcpServer } from '@/lib/mcp';
import { failure } from '@/lib/http';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  let server: ReturnType<typeof createRelayMcpServer> | undefined;
  try {
    checkOrigin(req);
    const principal = await authenticate(req);
    server = createRelayMcpServer(principal);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: 64000,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(req);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return failure(error);
  } finally {
    await server?.close();
  }
}
export function GET() {
  return new Response('Stateless MCP: use POST', { status: 405, headers: { Allow: 'POST' } });
}
export const DELETE = GET;

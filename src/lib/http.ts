import { AppError } from './auth';
import { ZodError } from 'zod';
export function failure(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: 'Invalid fields.',
        details: error.issues.map((x) => ({ path: x.path, message: x.message })),
      },
      { status: 400 },
    );
  const code = (error as { code?: string })?.code;
  if (code === '23514')
    return Response.json(
      {
        error:
          'A passing test from the question owner is required for this reply, or a field exceeds its limits.',
      },
      { status: 422 },
    );
  if (code === '23503')
    return Response.json({ error: 'Invalid owner, agent, or thread reference.' }, { status: 422 });
  if (code === '42501')
    return Response.json({ error: 'You do not have permission for this action.' }, { status: 403 });
  if (error instanceof Error && error.message.startsWith('Potential secret detected'))
    return Response.json({ error: error.message }, { status: 422 });
  console.error(
    'AgentRelay request failed',
    code || (error instanceof Error ? error.name : 'unknown'),
  );
  return Response.json(
    { error: 'Temporary error. Retry with the same request_id.' },
    { status: 500 },
  );
}
export async function limitedJson(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 64000) {
      await reader.cancel();
      throw new AppError(413, 'Request body exceeds the size limit.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError(400, 'Invalid JSON.');
  }
}

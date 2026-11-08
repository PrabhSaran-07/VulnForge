import type { IncomingMessage, ServerResponse } from 'node:http';

const requestHeaders = [
  'accept',
  'content-type',
  'cookie',
  'origin',
  'x-forwarded-for',
  'x-request-id',
];
const hopByHopHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
]);

class RequestBodyTooLargeError extends Error {}

function respond(
  response: ServerResponse,
  statusCode: number,
  payload: { error: string; message: string },
): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.byteLength;
    if (length > 100 * 1024) {
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    respond(response, 503, {
      error: 'API unavailable',
      message: 'The API proxy has not been configured.',
    });
    return;
  }

  const requestPath = request.url ?? '';
  if (!requestPath.startsWith('/api/')) {
    respond(response, 404, { error: 'Not found', message: 'The requested resource does not exist.' });
    return;
  }

  let target: URL;
  try {
    const origin = new URL(backendUrl);
    const isLocalDevelopment = process.env.NODE_ENV !== 'production'
      && ['localhost', '127.0.0.1'].includes(origin.hostname);
    if (
      (origin.protocol !== 'https:' && !(isLocalDevelopment && origin.protocol === 'http:'))
      || origin.username
      || origin.password
      || origin.pathname !== '/'
      || origin.search
      || origin.hash
    ) {
      throw new Error('Invalid backend origin.');
    }
    target = new URL(requestPath, origin);
  } catch {
    respond(response, 500, {
      error: 'API unavailable',
      message: 'The API proxy configuration is invalid.',
    });
    return;
  }

  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers[name];
    if (typeof value === 'string') {
      headers.set(name, value);
    } else if (Array.isArray(value)) {
      headers.set(name, value.join(name === 'cookie' ? '; ' : ', '));
    }
  }

  try {
    const method = request.method ?? 'GET';
    const body = method === 'GET' || method === 'HEAD'
      ? undefined
      : await readBody(request);
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: 'manual',
    });

    response.statusCode = upstream.status;
    upstream.headers.forEach((value, name) => {
      if (!hopByHopHeaders.has(name) && name !== 'set-cookie') {
        response.setHeader(name, value);
      }
    });
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length > 0) {
      response.setHeader('set-cookie', cookies);
    }
    response.end(method === 'HEAD' ? undefined : Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      respond(response, 413, {
        error: 'Payload too large',
        message: 'The request body exceeds the allowed size.',
      });
      return;
    }
    console.error(JSON.stringify({
      type: 'backend_proxy_failure',
      error: error instanceof Error ? error.name : 'UnknownError',
    }));
    respond(response, 502, {
      error: 'API unavailable',
      message: 'The backend could not complete the request.',
    });
  }
}

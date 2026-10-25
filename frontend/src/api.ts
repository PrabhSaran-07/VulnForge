const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getResponseMessage(payload: unknown): string | null {
  if (
    typeof payload === 'object'
    && payload !== null
    && 'message' in payload
    && typeof payload.message === 'string'
  ) {
    return payload.message;
  }

  return null;
}

function getStatusMessage(status: number): string {
  if (status === 401) {
    return 'Authentication is required to complete this request.';
  }
  if (status === 403) {
    return 'You do not have permission to complete this request.';
  }

  return `The server could not complete the request (HTTP ${status}).`;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new ApiError('Unable to connect to VULNFORGE. Check your connection and try again.', null);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Successful empty responses, such as 204, do not have a JSON body.
  }

  if (!response.ok) {
    throw new ApiError(
      getResponseMessage(payload) || getStatusMessage(response.status),
      response.status,
    );
  }

  return payload as T;
}

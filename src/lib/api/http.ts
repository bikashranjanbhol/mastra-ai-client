import { API } from './config';

/**
 * A failed API call, carrying enough to show the user something true.
 *
 * The service returns errors as `{ "error": "<message>" }` with an HTTP status
 * — verified against a live server, including the no-provider-key case which
 * comes back as 500 with a message naming the env vars to set.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when retrying the same request could plausibly succeed. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

const buildUrl = (path: string, query?: Record<string, string | number | boolean | undefined>) => {
  const url = new URL(`${API.baseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
};

async function readError(res: Response, url: string): Promise<ApiError> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const text = await res.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string };
        message = parsed.error ?? parsed.message ?? text;
      } catch {
        message = text;
      }
    }
  } catch {
    // Body already consumed or unreadable — the status line stands.
  }
  return new ApiError(res.status, message, url);
}

interface RequestOptions {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  /** Streaming calls opt out of the timeout. */
  timeout?: number | false;
}

/** JSON request/response against the service, with a uniform error shape. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, signal, timeout = API.timeoutMs } = options;
  const url = buildUrl(path, query);

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer =
    timeout === false ? null : setTimeout(() => controller.abort(new Error('timeout')), timeout);

  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw await readError(res, url);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (signal?.aborted) throw err;
    // Network failure, DNS, CORS, or our own timeout: status 0 means "never reached".
    throw new ApiError(0, err instanceof Error ? err.message : 'Network request failed', url);
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Opens a streaming POST and hands back the raw response for the SSE reader. */
export async function openStream(
  path: string,
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
  const url = buildUrl(path);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ApiError(0, err instanceof Error ? err.message : 'Network request failed', url);
  }
  if (!res.ok) throw await readError(res, url);
  if (!res.body) throw new ApiError(0, 'The response had no body', url);
  return res;
}

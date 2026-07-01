import type { ApiErrorResponse } from '@anura/shared';

// If NEXT_PUBLIC_API_URL is set, talk to the API directly (production).
// Otherwise use the same-origin '/proxy-api' path, which next.config.mjs rewrites
// to the API server-side — no CORS, and works regardless of the dev port.
const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
  : '/proxy-api';
const ACCESS_KEY = 'anura_access';
const REFRESH_KEY = 'anura_refresh';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Access/refresh JWTs persisted in localStorage (client-side auth for the MVP). */
export const tokenStore = {
  get access(): string | null {
    return typeof window === 'undefined' ? null : localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      tokenStore.clear();
      return false;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    tokenStore.set(data.accessToken, data.refreshToken);
    return true;
  } catch {
    tokenStore.clear();
    return false;
  }
}

async function request<T>(path: string, opts: RequestOptions = {}, allowRetry = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) };
  if (opts.auth !== false && tokenStore.access) {
    headers.Authorization = `Bearer ${tokenStore.access}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (res.status === 401 && allowRetry && opts.auth !== false && (await tryRefresh())) {
    return request<T>(path, opts, false);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as ApiErrorResponse;
      message = Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? message);
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 401) tokenStore.clear();
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Multipart upload (documents). Lets the browser set the boundary header. */
async function upload<T>(path: string, form: FormData, allowRetry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;

  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });
  if (res.status === 401 && allowRetry && (await tryRefresh())) {
    return upload<T>(path, form, false);
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as ApiErrorResponse;
      message = Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? message);
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

/** Serialize a params object to a query string (skips empty values). */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'DELETE' }),
  upload,
  buildQuery,
};

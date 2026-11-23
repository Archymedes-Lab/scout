"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly engineDown = false) { super(message); }
}

/** One call to the engine through /api. Errors carry the engine's own words. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(`/api/${path.replace(/^\//, "")}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`, !!(data as { engineDown?: boolean }).engineDown);
  return data as T;
}

const BUS = "scout:invalidate";

/** Tell every mounted `useApi` to refetch (after a mutation). Optionally only keys that start with a prefix. */
export function invalidate(prefix = "") {
  window.dispatchEvent(new CustomEvent(BUS, { detail: prefix }));
}

/** Fetch-on-mount with revalidation on focus and on `invalidate()`. Keeps the last good data while refetching. */
export function useApi<T>(path: string | null, opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (n === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (n === seq.current) setError(e instanceof ApiError ? e : new ApiError(0, String(e)));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!path) return;
    const onBus = (e: Event) => { const p = (e as CustomEvent<string>).detail; if (!p || path.startsWith(p)) void load(); };
    const onFocus = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener(BUS, onBus);
    document.addEventListener("visibilitychange", onFocus);
    const t = opts.poll ? setInterval(load, opts.poll) : null;
    return () => { window.removeEventListener(BUS, onBus); document.removeEventListener("visibilitychange", onFocus); if (t) clearInterval(t); };
  }, [path, load, opts.poll]);

  return { data, error, loading: loading && data === undefined, refreshing: loading, reload: load, setData };
}

/** A mutation with pending and error state. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setPending(true); setError(null);
    try { return await fn(...args); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return undefined; }
    finally { setPending(false); }
  }, [fn]);
  return { run, pending, error, setError };
}

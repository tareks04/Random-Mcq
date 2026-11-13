/**
 * api.ts — optional backend integration hooks.
 *
 * MCQ Studio is local-first: it works fully offline with localStorage.
 * To sync with your own server, expose a config object *before* the app loads
 * (e.g. a tiny `window.MCQ_API = {...}` script tag in index.html):
 *
 *   window.MCQ_API = {
 *     baseUrl: "https://api.example.com",   // your service
 *     apiKey:  "Bearer token if needed",    // sent as Authorization header
 *   };
 *
 * Contract expected from the server:
 *   GET  {baseUrl}/mcqs           -> 200 with a JSON array (or schema envelope)
 *   POST {baseUrl}/mcqs           -> accepts { schema, items }, any 2xx is OK
 *
 * Both functions degrade gracefully: when no backend is configured they
 * resolve to `null` so the UI can simply stay in local mode.
 */

import { isValidMcq, normalizeMcq, SCHEMA, type JsonEnvelope, type Mcq } from "./mcq";

export interface BackendConfig {
  baseUrl: string;
  apiKey?: string;
}

declare global {
  interface Window {
    MCQ_API?: BackendConfig;
  }
}

export function getBackendConfig(): BackendConfig | null {
  const cfg = typeof window !== "undefined" ? window.MCQ_API : undefined;
  if (!cfg?.baseUrl) return null;
  return { baseUrl: cfg.baseUrl.replace(/\/+$/, ""), apiKey: cfg.apiKey };
}

function headers(cfg: BackendConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(cfg.apiKey ? { Authorization: cfg.apiKey } : {}),
  };
}

/**
 * Push the whole session bank to the backend.
 * Returns null when no backend is configured; throws on network/HTTP errors
 * so the caller can surface a toast.
 */
export async function pushToBackend(items: Mcq[]): Promise<{ saved: number } | null> {
  const cfg = getBackendConfig();
  if (!cfg) return null;
  const res = await fetch(`${cfg.baseUrl}/mcqs`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify({ schema: SCHEMA, items }),
  });
  if (!res.ok) throw new Error(`Backend responded ${res.status}`);
  return { saved: items.length };
}

/** Pull MCQs from the backend. Returns null when unconfigured. */
export async function pullFromBackend(): Promise<Mcq[] | null> {
  const cfg = getBackendConfig();
  if (!cfg) return null;
  const res = await fetch(`${cfg.baseUrl}/mcqs`, { headers: headers(cfg) });
  if (!res.ok) throw new Error(`Backend responded ${res.status}`);
  const raw: unknown = await res.json();
  const list = Array.isArray(raw)
    ? raw
    : ((raw as Partial<JsonEnvelope>)?.items ?? []);
  return (Array.isArray(list) ? list : []).filter(isValidMcq).map(normalizeMcq);
}

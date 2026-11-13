/**
 * storage.ts — local-first persistence for the MCQ session bank.
 * Everything stays in the browser unless a backend is wired up (see api.ts).
 */

import { isValidMcq, normalizeMcq, type Mcq } from "./mcq";

const KEY = "mcq-studio.session.v1";

/** Load + sanitize the persisted session. Never throws. */
export function loadSession(): Mcq[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidMcq).map(normalizeMcq);
  } catch {
    return [];
  }
}

/** Persist the session. Quota / privacy-mode failures are swallowed. */
export function saveSession(items: Mcq[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — app keeps working in memory */
  }
}

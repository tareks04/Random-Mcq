/**
 * mcq.ts — pure domain logic for MCQ Studio.
 *
 * Everything in this file is framework-free and side-effect free so it can be
 * unit-tested with any runner (`npx vitest run`) and reused from a future
 * backend or CLI without dragging React along.
 */

/* ------------------------------------------------------------------ types */

export type Mode = "single" | "multiple";

export interface McqOption {
  id: string;
  text: string;
}

export interface Mcq {
  id: string;
  question: string;
  options: McqOption[];
  /** ids of correct options (always references McqOption.id) */
  correctIds: string[];
  multiple: boolean;
  /** true when option order was shuffled at generation time */
  shuffled: boolean;
  explanation?: string;
  createdAt: number;
}

/** Editable form state (before an Mcq is committed). */
export interface Draft {
  question: string;
  mode: Mode;
  options: McqOption[];
  correctIds: string[];
  shuffle: boolean;
  explanation: string;
}

/** A single validation failure, tied to a focusable field id. */
export interface Issue {
  field: string; // 'question' | `option-${id}` | 'options' | 'correct'
  message: string;
}

/* ----------------------------------------------------------------- limits */

export const LIMITS = {
  minOptions: 2,
  maxOptions: 8,
  maxQuestionLen: 600,
  maxOptionLen: 240,
  maxExplanationLen: 600,
} as const;

export const SCHEMA = "mcq-studio/v1";

/* ---------------------------------------------------------------- helpers */

/** Collision-safe id generation with a graceful fallback for old browsers. */
export function uid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Option label: 0 -> 'A', 1 -> 'B', … 25 -> 'Z'. */
export function letter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Fisher–Yates shuffle on a copy. `rng` is injectable for deterministic tests. */
export function shuffle<T>(input: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* -------------------------------------------------------------- validation */

/**
 * Validate a draft. Returns an empty array when the draft is ready to commit.
 * Every issue carries the id of a focusable element so the UI can deep-link.
 */
export function validateDraft(d: Draft): Issue[] {
  const issues: Issue[] = [];
  const q = d.question.trim();

  if (q.length === 0) {
    issues.push({ field: "question", message: "Question text is required." });
  } else if (q.length < 8) {
    issues.push({ field: "question", message: "Write a full question — at least 8 characters." });
  }

  if (d.options.length < LIMITS.minOptions) {
    issues.push({
      field: "options",
      message: `Add at least ${LIMITS.minOptions} options.`,
    });
  }
  if (d.options.length > LIMITS.maxOptions) {
    issues.push({
      field: "options",
      message: `${LIMITS.maxOptions} options is the maximum.`,
    });
  }

  const seen = new Map<string, string>(); // normalized text -> first letter
  d.options.forEach((opt, i) => {
    const text = opt.text.trim();
    const label = letter(i);
    if (text.length === 0) {
      issues.push({ field: `option-${opt.id}`, message: `Option ${label} cannot be empty.` });
      return;
    }
    const key = text.toLowerCase();
    const first = seen.get(key);
    if (first) {
      issues.push({
        field: `option-${opt.id}`,
        message: `Option ${label} duplicates option ${first}.`,
      });
    } else {
      seen.set(key, label);
    }
  });

  const validIds = new Set(d.options.map((o) => o.id));
  const correct = d.correctIds.filter((id) => validIds.has(id));

  if (correct.length === 0) {
    issues.push({ field: "correct", message: "Mark at least one correct answer." });
  } else if (d.mode === "single" && correct.length > 1) {
    issues.push({
      field: "correct",
      message: "Single-answer mode accepts exactly one correct answer.",
    });
  }

  return issues;
}

/* -------------------------------------------------------------- generation */

/**
 * Commit a draft to an immutable MCQ. Optionally shuffles option order —
 * `correctIds` are id-based so correctness survives reordering.
 * `rng` is injectable for deterministic tests.
 */
export function buildMcq(
  d: Draft,
  opts: { id?: string; createdAt?: number; rng?: () => number } = {},
): Mcq {
  const cleaned: McqOption[] = d.options.map((o) => ({ id: o.id, text: o.text.trim() }));
  const validIds = new Set(cleaned.map((o) => o.id));
  const correctIds = d.correctIds.filter((id) => validIds.has(id));
  const explanation = d.explanation.trim();

  return {
    id: opts.id ?? uid(),
    question: d.question.trim(),
    options: d.shuffle ? shuffle(cleaned, opts.rng) : cleaned,
    correctIds,
    multiple: d.mode === "multiple",
    shuffled: d.shuffle,
    ...(explanation ? { explanation } : {}),
    createdAt: opts.createdAt ?? Date.now(),
  };
}

/** Human-readable answer key, e.g. "A, C". */
export function answerLetters(mcq: Mcq): string {
  return mcq.options
    .map((o, i) => (mcq.correctIds.includes(o.id) ? letter(i) : null))
    .filter((l): l is string => l !== null)
    .join(", ");
}

/* ------------------------------------------------- type guards / normalize */

/** Structural check for an (imported) value; tolerant of missing extras. */
export function isValidMcq(x: unknown): x is Mcq {
  if (typeof x !== "object" || x === null) return false;
  const m = x as Record<string, unknown>;
  if (typeof m.question !== "string" || m.question.trim().length === 0) return false;
  if (!Array.isArray(m.options)) return false;
  const opts = m.options as unknown[];
  if (opts.length < LIMITS.minOptions || opts.length > LIMITS.maxOptions) return false;
  const ids = new Set<string>();
  for (const o of opts) {
    if (typeof o !== "object" || o === null) return false;
    const opt = o as Record<string, unknown>;
    if (typeof opt.id !== "string" || typeof opt.text !== "string" || opt.text.trim() === "") {
      return false;
    }
    ids.add(opt.id);
  }
  if (!Array.isArray(m.correctIds) || m.correctIds.length === 0) return false;
  for (const id of m.correctIds as unknown[]) {
    if (typeof id !== "string" || !ids.has(id)) return false;
  }
  return true;
}

/** Fill in defaults for optional fields without touching validity. */
export function normalizeMcq(x: Mcq): Mcq {
  return {
    id: typeof x.id === "string" && x.id ? x.id : uid(),
    question: x.question.trim(),
    options: x.options.map((o) => ({ id: o.id, text: o.text.trim() })),
    correctIds: [...x.correctIds],
    multiple: typeof x.multiple === "boolean" ? x.multiple : x.correctIds.length > 1,
    shuffled: Boolean(x.shuffled),
    ...(x.explanation && typeof x.explanation === "string"
      ? { explanation: x.explanation }
      : {}),
    createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now(),
  };
}

/* -------------------------------------------------------------- JSON I/O */

export interface JsonEnvelope {
  schema: typeof SCHEMA;
  exportedAt: string;
  items: Mcq[];
}

export function toJsonEnvelope(items: Mcq[]): string {
  const envelope: JsonEnvelope = {
    schema: SCHEMA,
    exportedAt: new Date().toISOString(),
    items,
  };
  return JSON.stringify(envelope, null, 2);
}

export interface ImportResult {
  items: Mcq[];
  skipped: number;
  error?: string;
}

/**
 * Parse an import payload. Accepts either a schema envelope
 * (`{ schema, items: [...] }`) or a bare array of MCQs.
 * Never throws — failures are reported in `error` / `skipped`.
 */
export function parseJsonImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { items: [], skipped: 0, error: "File is not valid JSON." };
  }

  const candidate: unknown = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : null;

  if (!candidate) {
    return {
      items: [],
      skipped: 0,
      error: "No MCQ list found — expected an array or a { items: [...] } envelope.",
    };
  }

  const items: Mcq[] = [];
  let skipped = 0;
  for (const entry of candidate as unknown[]) {
    if (isValidMcq(entry)) items.push(normalizeMcq(entry));
    else skipped++;
  }
  return { items, skipped };
}

/* -------------------------------------------------------------- CSV output */

/** RFC 4180-style field escaping. */
export function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Flat, spreadsheet-friendly CSV: one row per question with dynamic
 * Option A…n columns sized to the largest option set in the batch.
 */
export function toCsv(items: Mcq[]): string {
  const maxOpts = items.reduce((n, m) => Math.max(n, m.options.length), 0);
  const header = [
    "ID",
    "Question",
    "Type",
    "Correct",
    ...Array.from({ length: maxOpts }, (_, i) => `Option ${letter(i)}`),
    "Explanation",
    "Created",
  ];
  const rows = items.map((m) => {
    const opts = Array.from({ length: maxOpts }, (_, i) => m.options[i]?.text ?? "");
    return [
      m.id,
      m.question,
      m.multiple ? "multiple" : "single",
      answerLetters(m).replace(/, /g, ";"),
      ...opts,
      m.explanation ?? "",
      new Date(m.createdAt).toISOString(),
    ];
  });
  return [header, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n");
}

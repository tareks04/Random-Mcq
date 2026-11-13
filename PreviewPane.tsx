/**
 * PreviewPane.tsx — right-hand column.
 * - While composing: a faithful live render of the draft plus a readiness checklist.
 * - After generating: the committed MCQ as an interactive card (select → check → reveal),
 *   with one-click "next MCQ from the same base".
 */
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  Eye,
  KeyRound,
  ListChecks,
  RotateCcw,
  Shuffle,
  X,
} from "lucide-react";
import { answerLetters, letter, type Draft, type Mcq } from "../lib/mcq";

interface Props {
  draft: Draft;
  preview: Mcq | null;
  onNewFromBase: () => void;
  onFreshStart: () => void;
}

/* ------------------------------------------------------------ small chips */

function TypeChip({ multiple }: { multiple: boolean }) {
  const Icon = multiple ? ListChecks : CircleDot;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-2 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-2">
      <Icon className="size-3" aria-hidden />
      {multiple ? "Multiple answers" : "Single answer"}
    </span>
  );
}

function ShuffleChip({ shuffled }: { shuffled: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-2 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-2">
      <Shuffle className="size-3" aria-hidden />
      {shuffled ? "Shuffled" : "Fixed order"}
    </span>
  );
}

/* -------------------------------------------------------------- draft card */

function DraftCard({ draft }: { draft: Draft }) {
  const qOk = draft.question.trim().length >= 8;
  const filled = draft.options.filter((o) => o.text.trim()).length;
  const oOk = filled >= 2;
  const cOk =
    draft.correctIds.length >= 1 && (draft.mode === "multiple" || draft.correctIds.length === 1);
  const key = draft.options
    .map((o, i) => (draft.correctIds.includes(o.id) ? letter(i) : null))
    .filter(Boolean)
    .join(", ");

  const checklist: Array<{ ok: boolean; label: string }> = [
    { ok: qOk, label: "Question written" },
    { ok: oOk, label: `At least 2 filled options (${filled} now)` },
    { ok: cOk, label: draft.mode === "single" ? "Exactly one key marked" : "At least one key marked" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
        <span className="rounded-full border border-gold/40 bg-gold-soft px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-gold">
          Draft
        </span>
        <TypeChip multiple={draft.mode === "multiple"} />
        <ShuffleChip shuffled={draft.shuffle} />
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
          <KeyRound className="size-3" aria-hidden />
          Key: {key || "—"}
        </span>
      </div>

      <div className="px-5 py-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">Question</p>
        {draft.question.trim() ? (
          <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug">
            {draft.question}
          </h3>
        ) : (
          <p className="mt-1.5 font-display text-lg italic text-ink-3/80">
            Your question will appear here as you type…
          </p>
        )}

        <ul className="mt-4 space-y-2">
          {draft.options.map((o, i) => {
            const marked = draft.correctIds.includes(o.id);
            return (
              <li
                key={o.id}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                  marked ? "border-leaf/50 bg-leaf-soft/60" : "border-line bg-white/50"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid size-7 shrink-0 place-items-center rounded-md border font-mono text-xs font-semibold ${
                    marked ? "border-leaf bg-leaf text-paper" : "border-line bg-paper-2 text-ink-2"
                  }`}
                >
                  {letter(i)}
                </span>
                <span className={`truncate text-sm ${o.text.trim() ? "" : "italic text-ink-3/70"}`}>
                  {o.text.trim() || "Empty option"}
                </span>
                {marked && <Check className="ml-auto size-4 shrink-0 text-leaf" aria-hidden />}
              </li>
            );
          })}
        </ul>

        {/* readiness checklist */}
        <div className="mt-5 rounded-xl bg-paper-2/70 p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">
            Ready to generate when
          </p>
          <ul className="mt-2 space-y-1.5">
            {checklist.map((c) => (
              <li
                key={c.label}
                className={`flex items-center gap-2 text-[13px] font-medium transition-colors ${
                  c.ok ? "text-leaf" : "text-ink-3"
                }`}
              >
                {c.ok ? (
                  <CheckCircle2 className="size-4" aria-hidden />
                ) : (
                  <Circle className="size-4" aria-hidden />
                )}
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- generated card */

function GeneratedCard({
  mcq,
  onNewFromBase,
  onFreshStart,
}: {
  mcq: Mcq;
  onNewFromBase: () => void;
  onFreshStart: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const correctSet = new Set(mcq.correctIds);

  const toggle = (id: string) => {
    setChecked(false);
    setSelected((prev) =>
      mcq.multiple
        ? prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id]
        : [id],
    );
  };

  const reveal = () => {
    setSelected([...mcq.correctIds]);
    setChecked(true);
  };

  const found = selected.filter((s) => correctSet.has(s)).length;
  const allRight = selected.length === correctSet.size && selected.every((s) => correctSet.has(s));

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-card animate-fade-up">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
        <span className="rounded-full border border-leaf/40 bg-leaf-soft px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-leaf-deep">
          Committed
        </span>
        <TypeChip multiple={mcq.multiple} />
        <ShuffleChip shuffled={mcq.shuffled} />
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
          <KeyRound className="size-3" aria-hidden />
          Key: {checked ? answerLetters(mcq) : "hidden"}
        </span>
      </div>

      <div className="px-5 py-5">
        <h3 className="font-display text-lg font-semibold leading-snug">{mcq.question}</h3>

        {/* interactive options */}
        <div
          role="group"
          aria-label={mcq.multiple ? "Select all correct answers" : "Select the correct answer"}
          className="mt-4 space-y-2"
        >
          {mcq.options.map((o, i) => {
            const isSel = selected.includes(o.id);
            const isCorrect = correctSet.has(o.id);
            let cls = "border-line bg-white/50 hover:border-ink/40";
            let chipCls = "border-line bg-paper-2 text-ink-2";
            if (!checked && isSel) {
              cls = "border-ink bg-paper-2 ring-1 ring-ink/20";
              chipCls = "border-ink bg-ink text-paper";
            }
            if (checked && isCorrect) {
              cls = "border-leaf/60 bg-leaf-soft";
              chipCls = "border-leaf bg-leaf text-paper";
            }
            if (checked && isSel && !isCorrect) {
              cls = "border-brick/50 bg-brick-soft";
              chipCls = "border-brick bg-brick text-paper";
            }
            if (checked && !isCorrect && !isSel) {
              cls = "border-line bg-white/40 opacity-60";
            }
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                aria-pressed={isSel}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${cls}`}
              >
                <span
                  aria-hidden
                  className={`grid size-7 shrink-0 place-items-center rounded-md border font-mono text-xs font-semibold ${chipCls}`}
                >
                  {letter(i)}
                </span>
                <span className="min-w-0 flex-1 text-sm">{o.text}</span>
                {checked && isCorrect && (
                  <Check className="size-4 shrink-0 text-leaf" strokeWidth={3} aria-hidden />
                )}
                {checked && isSel && !isCorrect && (
                  <X className="size-4 shrink-0 text-brick" strokeWidth={3} aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        {/* check / reveal */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setChecked(true)}
            disabled={selected.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper transition hover:bg-leaf-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="size-3.5" aria-hidden />
            Check answer
          </button>
          <button
            type="button"
            onClick={reveal}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/60 px-4 py-2 text-xs font-semibold text-ink-2 transition hover:border-ink/50 hover:text-ink"
          >
            <Eye className="size-3.5" aria-hidden />
            Reveal key
          </button>
        </div>

        {/* verdict + explanation */}
        {checked && (
          <div className="animate-fade-up">
            <p
              role="status"
              className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                allRight
                  ? "border-leaf/40 bg-leaf-soft text-leaf-deep"
                  : "border-brick/30 bg-brick-soft text-brick"
              }`}
            >
              {allRight
                ? `Correct — all ${correctSet.size === 1 ? "key" : `${correctSet.size} keys`} found.`
                : `Not quite — ${found} of ${correctSet.size} keys found. The answer key is highlighted above.`}
            </p>
            {mcq.explanation && (
              <p className="mt-3 rounded-xl border border-gold/30 bg-gold-soft/70 px-4 py-3 text-sm leading-relaxed text-ink-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
                  Why{"  "}
                </span>
                {mcq.explanation}
              </p>
            )}
          </div>
        )}

        {/* continuation */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onNewFromBase}
            className="inline-flex items-center gap-2 rounded-full bg-leaf px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-leaf-deep active:translate-y-px"
          >
            Next MCQ from this base
            <ArrowRight className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onFreshStart}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2.5 text-xs font-semibold text-ink-2 transition hover:border-ink/50 hover:text-ink"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Fresh start
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- export */

export default function PreviewPane({ draft, preview, onNewFromBase, onFreshStart }: Props) {
  return (
    <section aria-labelledby="preview-heading" className="lg:sticky lg:top-24">
      <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
        02 — {preview ? "Committed MCQ" : "Live preview"}
      </p>
      <h2 id="preview-heading" className="sr-only">
        MCQ preview
      </h2>
      {preview ? (
        <GeneratedCard
          key={preview.id /* reset quiz state per MCQ */}
          mcq={preview}
          onNewFromBase={onNewFromBase}
          onFreshStart={onFreshStart}
        />
      ) : (
        <DraftCard draft={draft} />
      )}
    </section>
  );
}

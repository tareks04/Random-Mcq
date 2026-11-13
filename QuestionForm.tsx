/**
 * QuestionForm.tsx — "The Composer".
 * Accessible editor for the base question, its options and answer key.
 * All state lives in the parent; this component is controlled via `onPatch`.
 */
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleDot,
  CornerDownLeft,
  Eraser,
  ListChecks,
  Plus,
  X,
} from "lucide-react";
import { LIMITS, letter, uid, type Draft, type Issue, type Mode } from "../lib/mcq";

interface Props {
  draft: Draft;
  /** non-empty only after a submit attempt with problems, or while editing post-attempt */
  issues: Issue[];
  editingId: string | null;
  onPatch: (patch: Partial<Draft>) => void;
  onGenerate: () => void;
  onClear: () => void;
  onFocusIssue: (field: string) => void;
}

export default function QuestionForm({
  draft,
  issues,
  editingId,
  onPatch,
  onGenerate,
  onClear,
  onFocusIssue,
}: Props) {
  const single = draft.mode === "single";
  const atMin = draft.options.length <= LIMITS.minOptions;
  const atMax = draft.options.length >= LIMITS.maxOptions;

  const issueByField = new Map<string, string>();
  for (const i of issues) {
    if (!issueByField.has(i.field)) issueByField.set(i.field, i.message);
  }

  /* --------------------------------------------------------- option ops */

  const setOptionText = (id: string, text: string) =>
    onPatch({
      options: draft.options.map((o) => (o.id === id ? { ...o, text } : o)),
    });

  const addOption = () => {
    if (atMax) return;
    const opt = { id: uid(), text: "" };
    onPatch({ options: [...draft.options, opt] });
    requestAnimationFrame(() => document.getElementById(`option-${opt.id}`)?.focus());
  };

  const removeOption = (id: string) => {
    if (atMin) return;
    onPatch({
      options: draft.options.filter((o) => o.id !== id),
      correctIds: draft.correctIds.filter((c) => c !== id),
    });
  };

  const toggleCorrect = (id: string) => {
    if (single) {
      onPatch({ correctIds: [id] });
      return;
    }
    onPatch({
      correctIds: draft.correctIds.includes(id)
        ? draft.correctIds.filter((c) => c !== id)
        : [...draft.correctIds, id],
    });
  };

  const setMode = (mode: Mode) => {
    if (mode === draft.mode) return;
    // clamp to a single key when switching multi -> single
    onPatch({
      mode,
      correctIds: mode === "single" ? draft.correctIds.slice(0, 1) : draft.correctIds,
    });
  };

  const questionIssue = issueByField.get("question");
  const correctIssue = issueByField.get("correct");
  const optionsIssue = issueByField.get("options");

  return (
    <section
      aria-labelledby="composer-heading"
      className="rounded-2xl border border-line bg-card shadow-card"
    >
      {/* header strip */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
            01 — Composer
          </p>
          <h2 id="composer-heading" className="font-display text-xl font-semibold">
            {editingId ? "Edit saved MCQ" : "Build a question"}
          </h2>
        </div>
        {editingId && (
          <span className="rounded-full border border-gold/40 bg-gold-soft px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-gold">
            Editing saved
          </span>
        )}
      </div>

      <div className="space-y-6 px-5 py-6 sm:px-6">
        {/* ------- validation summary (appears only when there is something to fix) */}
        {issues.length > 0 && (
          <div role="alert" className="rounded-xl border border-brick/30 bg-brick-soft p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-brick">
              <AlertTriangle className="size-4" aria-hidden />
              {issues.length === 1 ? "One thing to fix" : `${issues.length} things to fix`} before generating
            </p>
            <ul className="mt-2 space-y-1.5 pl-6">
              {issues.map((i, idx) => (
                <li key={`${i.field}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => onFocusIssue(i.field)}
                    className="text-left text-sm text-brick underline decoration-brick/40 underline-offset-2 transition hover:decoration-brick"
                  >
                    {i.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ------- question */}
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="question" className="text-sm font-semibold">
              Base question
            </label>
            <span className="font-mono text-[11px] text-ink-3" aria-hidden>
              {draft.question.length}/{LIMITS.maxQuestionLen}
            </span>
          </div>
          <textarea
            id="question"
            rows={3}
            maxLength={LIMITS.maxQuestionLen}
            value={draft.question}
            onChange={(e) => onPatch({ question: e.target.value })}
            placeholder="e.g. Which of the following statements about HTTP caching are correct?"
            aria-invalid={Boolean(questionIssue)}
            aria-describedby={questionIssue ? "err-question" : undefined}
            className="mt-2 w-full resize-y rounded-xl border border-line bg-white/70 px-4 py-3 text-[15px] leading-relaxed shadow-inner placeholder:text-ink-3/70 focus-visible:border-leaf"
          />
          {questionIssue && (
            <p id="err-question" className="mt-1.5 text-sm font-medium text-brick">
              {questionIssue}
            </p>
          )}
        </div>

        {/* ------- answer type */}
        <fieldset>
          <legend className="text-sm font-semibold">Answer type</legend>
          <div
            role="radiogroup"
            aria-label="Answer type"
            className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-paper-2 p-1.5"
          >
            {(
              [
                { mode: "single" as Mode, icon: CircleDot, label: "Single answer", hint: "exactly one key" },
                { mode: "multiple" as Mode, icon: ListChecks, label: "Multiple answers", hint: "one or more keys" },
              ] as const
            ).map(({ mode, icon: Icon, label, hint }) => {
              const active = draft.mode === mode;
              return (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf ${
                    active ? "bg-ink text-paper shadow-sm" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="answer-mode"
                    className="sr-only"
                    checked={active}
                    onChange={() => setMode(mode)}
                  />
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight">{label}</span>
                    <span
                      className={`block truncate font-mono text-[10px] uppercase tracking-wider ${
                        active ? "text-paper/60" : "text-ink-3"
                      }`}
                    >
                      {hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* ------- options */}
        <fieldset>
          <legend className="sr-only">Answer options</legend>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold" aria-hidden>
              Options
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-ink-3" aria-live="polite">
                {draft.options.length}/{LIMITS.maxOptions}
              </span>
              <button
                type="button"
                id="options"
                onClick={addOption}
                disabled={atMax}
                title={atMax ? `Maximum ${LIMITS.maxOptions} options` : "Add option"}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-3 py-1.5 text-xs font-semibold transition hover:border-ink/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="size-3.5" aria-hidden />
                Add option
              </button>
            </div>
          </div>
          {optionsIssue && (
            <p className="mt-1.5 text-sm font-medium text-brick">{optionsIssue}</p>
          )}

          <ul className="mt-3 space-y-2.5">
            {draft.options.map((opt, i) => {
              const err = issueByField.get(`option-${opt.id}`);
              const marked = draft.correctIds.includes(opt.id);
              return (
                <li key={opt.id}>
                  <div className="flex items-center gap-2">
                    {/* option letter */}
                    <span
                      aria-hidden
                      className={`grid size-9 shrink-0 select-none place-items-center rounded-lg border font-mono text-sm font-semibold transition-colors ${
                        marked
                          ? "border-leaf bg-leaf text-paper"
                          : "border-line bg-paper-2 text-ink-2"
                      }`}
                    >
                      {letter(i)}
                    </span>

                    <input
                      id={`option-${opt.id}`}
                      type="text"
                      maxLength={LIMITS.maxOptionLen}
                      value={opt.text}
                      onChange={(e) => setOptionText(opt.id, e.target.value)}
                      placeholder={`Option ${letter(i)}`}
                      aria-label={`Option ${letter(i)}`}
                      aria-invalid={Boolean(err)}
                      aria-describedby={err ? `err-option-${opt.id}` : undefined}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-white/70 px-3 py-2.5 text-sm shadow-inner placeholder:text-ink-3/70 focus-visible:border-leaf"
                    />

                    {/* mark-as-correct toggle (native radio/checkbox for keyboard + SR support) */}
                    <div>
                      <input
                        id={`correct-${opt.id}`}
                        type={single ? "radio" : "checkbox"}
                        name="mcq-correct"
                        checked={marked}
                        onChange={() => toggleCorrect(opt.id)}
                        aria-label={`Mark option ${letter(i)} as correct`}
                        className="peer sr-only"
                      />
                      <label
                        htmlFor={`correct-${opt.id}`}
                        title={`Mark option ${letter(i)} as correct`}
                        className={`grid size-9 cursor-pointer place-items-center border text-transparent transition peer-checked:border-leaf peer-checked:bg-leaf peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-leaf peer-focus-visible:ring-offset-2 ${
                          single ? "rounded-full" : "rounded-lg"
                        } ${marked ? "border-leaf" : "border-line bg-white/70 hover:border-leaf/60 hover:text-leaf/50"}`}
                      >
                        <Check className="size-4" strokeWidth={3} aria-hidden />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeOption(opt.id)}
                      disabled={atMin}
                      aria-label={`Remove option ${letter(i)}`}
                      title={atMin ? `Minimum ${LIMITS.minOptions} options` : `Remove option ${letter(i)}`}
                      className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white/70 text-ink-3 transition hover:border-brick/50 hover:text-brick disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-3"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  {err && (
                    <p id={`err-option-${opt.id}`} className="ml-11 mt-1 text-sm font-medium text-brick">
                      {err}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {correctIssue && (
            <p className="mt-2 text-sm font-medium text-brick">{correctIssue}</p>
          )}
          <p className="mt-2.5 text-xs leading-relaxed text-ink-3">
            Use the {single ? "round" : "square"} toggles to mark the {single ? "one correct answer" : "correct answers"}.
            Keyboard: <kbd>Tab</kbd> to a toggle, then <kbd>Space</kbd>.
          </p>
        </fieldset>

        {/* ------- shuffle + explanation row */}
        <div className="space-y-4 rounded-xl border border-line bg-paper-2/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span id="shuffle-label" className="text-sm font-semibold">
                Shuffle options on generate
              </span>
              <p className="mt-0.5 text-xs text-ink-3">
                Randomises A–H order; the key always stays attached.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.shuffle}
              aria-labelledby="shuffle-label"
              onClick={() => onPatch({ shuffle: !draft.shuffle })}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
                draft.shuffle ? "border-leaf bg-leaf" : "border-line bg-paper-2"
              }`}
            >
              <span
                aria-hidden
                className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full bg-card shadow transition-all ${
                  draft.shuffle ? "left-[calc(100%-1.4rem)]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="rule-dashed" aria-hidden />

          <div>
            <button
              type="button"
              onClick={() =>
                onPatch({ explanation: draft.explanation ? "" : " " })
              }
              aria-expanded={Boolean(draft.explanation)}
              aria-controls="explanation"
              className="flex items-center gap-1.5 text-sm font-semibold text-ink-2 transition hover:text-ink"
            >
              <ChevronDown
                className={`size-4 transition-transform ${draft.explanation ? "rotate-180" : ""}`}
                aria-hidden
              />
              Answer explanation
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">optional</span>
            </button>
            {Boolean(draft.explanation) && (
              <textarea
                id="explanation"
                rows={2}
                maxLength={LIMITS.maxExplanationLen}
                value={draft.explanation.trimStart()}
                onChange={(e) => onPatch({ explanation: e.target.value })}
                placeholder="Shown after checking an answer in the preview — great for training decks."
                className="mt-2 w-full resize-y rounded-lg border border-line bg-white/70 px-3 py-2.5 text-sm shadow-inner placeholder:text-ink-3/70 focus-visible:border-leaf"
              />
            )}
          </div>
        </div>

        {/* ------- actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-lift transition hover:bg-leaf-deep active:translate-y-px"
          >
            <CornerDownLeft className="size-4" aria-hidden />
            {editingId ? "Update MCQ" : "Generate MCQ"}
          </button>
          <span className="hidden items-center gap-1 text-xs text-ink-3 sm:inline-flex">
            <kbd>Ctrl</kbd>+<kbd>↵</kbd>
          </span>
          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2.5 text-xs font-semibold text-ink-2 transition hover:border-brick/50 hover:text-brick"
          >
            <Eraser className="size-3.5" aria-hidden />
            Clear form
          </button>
        </div>
      </div>
    </section>
  );
}

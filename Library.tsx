/**
 * Library.tsx — the "Session bank": every MCQ generated this session,
 * persisted to localStorage, with import/export/print/clear tooling.
 */
import { useRef, useState } from "react";
import {
  Braces,
  Check,
  CopyPlus,
  FileJson,
  FileSpreadsheet,
  Inbox,
  PencilLine,
  Printer,
  Trash2,
  Upload,
} from "lucide-react";
import { answerLetters, letter, type Mcq } from "../lib/mcq";

interface Props {
  items: Mcq[];
  onEdit: (m: Mcq) => void;
  onDuplicate: (m: Mcq) => void;
  onCopyJson: (m: Mcq) => void;
  onDelete: (id: string) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onImportFile: (file: File) => void;
  onClearAll: () => void;
  onPrint: () => void;
}

const TOOL_BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink-2 transition hover:border-ink/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-2";

const ICON_BTN =
  "grid size-8 place-items-center rounded-lg border border-transparent text-ink-3 transition hover:border-line hover:bg-white/70 hover:text-ink";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/* -------------------------------------------------------------- card */

function McqCard({
  mcq,
  index,
  onEdit,
  onDuplicate,
  onCopyJson,
  onDelete,
}: {
  mcq: Mcq;
  index: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onCopyJson: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      aria-label={`MCQ ${index + 1}: ${mcq.question}`}
      className="flex h-full flex-col rounded-2xl border border-line bg-card p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-wider text-ink-3">
          #{String(index + 1).padStart(2, "0")}
        </span>
        <span className="rounded-full border border-line bg-paper-2 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-2">
          {mcq.multiple ? "Multi" : "Single"}
        </span>
        {mcq.shuffled && (
          <span className="rounded-full border border-line bg-paper-2 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-2">
            Shuffled
          </span>
        )}
        <time
          dateTime={new Date(mcq.createdAt).toISOString()}
          className="ml-auto font-mono text-[10px] text-ink-3"
        >
          {dateFmt.format(mcq.createdAt)}
        </time>
      </div>

      <h3 className="mt-3 line-clamp-3 font-display text-[17px] font-semibold leading-snug">
        {mcq.question}
      </h3>

      <ul className="mt-3.5 space-y-1.5">
        {mcq.options.map((o, i) => {
          const correct = mcq.correctIds.includes(o.id);
          return (
            <li key={o.id} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-md border font-mono text-[11px] font-semibold ${
                  correct
                    ? "border-leaf bg-leaf-soft text-leaf-deep"
                    : "border-line bg-paper-2 text-ink-3"
                }`}
              >
                {letter(i)}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[13px] ${
                  correct ? "font-medium text-ink" : "text-ink-2"
                }`}
              >
                {o.text}
              </span>
              {correct && <Check className="size-3.5 shrink-0 text-leaf" strokeWidth={3} aria-hidden />}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-1 items-end justify-between gap-2 border-t border-line pt-3.5">
        <span className="font-mono text-[11px] font-medium text-ink-2">
          Key: <span className="text-leaf-deep">{answerLetters(mcq)}</span>
        </span>
        <div className="flex items-center">
          <button type="button" onClick={onEdit} title="Load into composer" aria-label={`Edit MCQ ${index + 1}`} className={ICON_BTN}>
            <PencilLine className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={onDuplicate} title="Duplicate" aria-label={`Duplicate MCQ ${index + 1}`} className={ICON_BTN}>
            <CopyPlus className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={onCopyJson} title="Copy JSON to clipboard" aria-label={`Copy MCQ ${index + 1} as JSON`} className={ICON_BTN}>
            <Braces className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            aria-label={`Delete MCQ ${index + 1}`}
            className={`${ICON_BTN} hover:border-brick/40 hover:bg-brick-soft hover:text-brick`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      {/* keeps footer pinned when question lengths vary */}
    </article>
  );
}

/* ------------------------------------------------------------ section */

export default function Library({
  items,
  onEdit,
  onDuplicate,
  onCopyJson,
  onDelete,
  onExportJson,
  onExportCsv,
  onImportFile,
  onClearAll,
  onPrint,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);

  const singles = items.filter((m) => !m.multiple).length;
  const multis = items.length - singles;
  const empty = items.length === 0;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportFile(file);
    e.target.value = ""; // allow re-importing the same file
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => setConfirmClear(false), 2800);
      return;
    }
    window.clearTimeout(confirmTimer.current);
    setConfirmClear(false);
    onClearAll();
  };

  return (
    <section aria-labelledby="bank-heading" className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
            03 — Session bank
          </p>
          <h2 id="bank-heading" className="font-display text-2xl font-semibold sm:text-3xl">
            Generated MCQs{" "}
            <span className="font-mono text-base font-medium text-ink-3">({items.length})</span>
          </h2>
          <p className="mt-1 font-mono text-xs text-ink-3" aria-live="polite">
            {singles} single · {multis} multiple · auto-saved to this browser
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className={`${TOOL_BTN} cursor-pointer`} title="Import a previously exported JSON file">
            <Upload className="size-3.5" aria-hidden />
            Import
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={handleFile}
              aria-label="Import MCQs from JSON file"
            />
          </label>
          <button type="button" onClick={onExportJson} disabled={empty} className={TOOL_BTN} title="Download session as JSON">
            <FileJson className="size-3.5" aria-hidden />
            JSON
          </button>
          <button type="button" onClick={onExportCsv} disabled={empty} className={TOOL_BTN} title="Download session as CSV (spreadsheet-friendly)">
            <FileSpreadsheet className="size-3.5" aria-hidden />
            CSV
          </button>
          <button type="button" onClick={onPrint} disabled={empty} className={TOOL_BTN} title="Open the print-friendly question paper">
            <Printer className="size-3.5" aria-hidden />
            Print
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={empty}
            className={`${TOOL_BTN} ${
              confirmClear ? "border-brick/50 bg-brick-soft text-brick hover:border-brick hover:text-brick" : ""
            }`}
            aria-live="polite"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {confirmClear ? "Confirm clear" : "Clear"}
          </button>
        </div>
      </div>

      {empty ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line bg-card/60 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl border border-line bg-paper-2 text-ink-3">
            <Inbox className="size-6" aria-hidden />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">The bank is empty</p>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-2">
            Compose a question on the left and press <kbd>Ctrl</kbd>+<kbd>↵</kbd> — every generated
            MCQ is stored here and survives page reloads.
          </p>
        </div>
      ) : (
        <ol className="stagger mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((m, i) => (
            <li key={m.id}>
              <McqCard
                mcq={m}
                index={i}
                onEdit={() => onEdit(m)}
                onDuplicate={() => onDuplicate(m)}
                onCopyJson={() => onCopyJson(m)}
                onDelete={() => onDelete(m.id)}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

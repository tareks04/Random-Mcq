/**
 * App.tsx — shell + state orchestration for MCQ Studio.
 *
 * State map:
 *   draft      → the composer's editable state (lives here so Preview stays live)
 *   items      → the session bank (persisted to localStorage on every change)
 *   preview    → the last committed MCQ (interactive quiz card); any edit clears it
 *   editingId  → when set, generating updates that bank item instead of appending
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleHelp, ListChecks } from "lucide-react";
import {
  buildMcq,
  parseJsonImport,
  toCsv,
  toJsonEnvelope,
  uid,
  validateDraft,
  type Draft,
  type Issue,
  type Mcq,
} from "./lib/mcq";
import { loadSession, saveSession } from "./lib/storage";
import { downloadText, exportFilename, readFileText } from "./lib/files";
import { ToastProvider, useToast } from "./components/Toast";
import QuestionForm from "./components/QuestionForm";
import PreviewPane from "./components/PreviewPane";
import Library from "./components/Library";
import HelpModal from "./components/HelpModal";
import PrintSheet from "./components/PrintSheet";

/** Drafts start with four slots — the classic MCQ shape (min 2 / max 8). */
const OPTION_SLOTS = 4;

function emptyOptions(n: number) {
  return Array.from({ length: n }, () => ({ id: uid(), text: "" }));
}

function freshDraft(): Draft {
  return {
    question: "",
    mode: "single",
    options: emptyOptions(OPTION_SLOTS),
    correctIds: [],
    shuffle: true,
    explanation: "",
  };
}

/* ------------------------------------------------------------------ shell */

function Shell() {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [showIssues, setShowIssues] = useState(false);
  const [items, setItems] = useState<Mcq[]>(() => loadSession());
  const [preview, setPreview] = useState<Mcq | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  /* persist the bank on every change */
  useEffect(() => saveSession(items), [items]);

  /* errors re-validate live once the user has attempted a submit */
  const issues: Issue[] = useMemo(
    () => (showIssues ? validateDraft(draft) : []),
    [draft, showIssues],
  );

  /** Move focus to the field behind a validation issue. */
  const focusField = useCallback(
    (field: string) => {
      requestAnimationFrame(() => {
        const firstOpt = draft.options[0];
        const id = field === "correct" && firstOpt ? `correct-${firstOpt.id}` : field;
        const el = document.getElementById(id);
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus({ preventScroll: true });
        }
      });
    },
    [draft.options],
  );

  /** Controlled edits from the composer. Any edit returns preview to draft mode. */
  const patchDraft = useCallback((patch: Partial<Draft>) => {
    setPreview(null);
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  /* ------------------------------------------------------------- generate */

  const generate = useCallback(() => {
    const problems = validateDraft(draft);
    if (problems.length > 0) {
      setShowIssues(true);
      toast(
        "error",
        problems.length === 1
          ? "One thing needs fixing before this can be generated."
          : `${problems.length} things need fixing before this can be generated.`,
      );
      focusField(problems[0].field);
      return;
    }
    const existing = editingId ? items.find((i) => i.id === editingId) : undefined;
    const mcq = buildMcq(
      draft,
      existing ? { id: existing.id, createdAt: existing.createdAt } : {},
    );
    setItems((prev) =>
      existing ? prev.map((i) => (i.id === existing.id ? mcq : i)) : [...prev, mcq],
    );
    setPreview(mcq);
    setShowIssues(false);
    setEditingId(null);
    toast("success", existing ? "Saved MCQ updated." : "MCQ added to the session bank.");
  }, [draft, editingId, items, toast, focusField]);

  /* Ctrl/Cmd + Enter anywhere = generate */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [generate]);

  /* ------------------------------------------------------- draft lifecycle */

  const newFromBase = useCallback(() => {
    const opts = emptyOptions(OPTION_SLOTS);
    setDraft((d) => ({
      question: d.question,
      mode: d.mode,
      options: opts,
      correctIds: [],
      shuffle: d.shuffle,
      explanation: "",
    }));
    setPreview(null);
    setEditingId(null);
    setShowIssues(false);
    requestAnimationFrame(() => document.getElementById(`option-${opts[0].id}`)?.focus());
    toast("info", "Same base question — options cleared for the next MCQ.");
  }, [toast]);

  const freshStart = useCallback(() => {
    setDraft(freshDraft());
    setPreview(null);
    setEditingId(null);
    setShowIssues(false);
    requestAnimationFrame(() => document.getElementById("question")?.focus());
  }, []);

  /* ------------------------------------------------------------ bank ops */

  const editItem = useCallback(
    (m: Mcq) => {
      setDraft({
        question: m.question,
        mode: m.multiple ? "multiple" : "single",
        options: m.options.map((o) => ({ ...o })),
        correctIds: [...m.correctIds],
        shuffle: m.shuffled,
        explanation: m.explanation ?? "",
      });
      setEditingId(m.id);
      setPreview(null);
      setShowIssues(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      requestAnimationFrame(() => document.getElementById("question")?.focus());
      toast("info", "Loaded into the composer — generating will update this MCQ.");
    },
    [toast],
  );

  const deleteItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setPreview((p) => (p?.id === id ? null : p));
      setEditingId((e) => (e === id ? null : e));
      toast("info", "MCQ deleted.");
    },
    [toast],
  );

  const duplicateItem = useCallback(
    (m: Mcq) => {
      const copy: Mcq = { ...m, id: uid(), createdAt: Date.now() };
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.id === m.id);
        const next = [...prev];
        next.splice(idx + 1, 0, copy);
        return next;
      });
      toast("success", "Duplicated right after the original.");
    },
    [toast],
  );

  const copyJson = useCallback(
    async (m: Mcq) => {
      try {
        await navigator.clipboard.writeText(toJsonEnvelope([m]));
        toast("success", "JSON copied to the clipboard.");
      } catch {
        toast("error", "Clipboard was blocked — use the JSON export button instead.");
      }
    },
    [toast],
  );

  /* ----------------------------------------------------------- import/export */

  const exportJson = useCallback(() => {
    if (items.length === 0) return;
    downloadText(exportFilename("json"), toJsonEnvelope(items), "application/json");
    toast("success", `Exported ${items.length} MCQ${items.length === 1 ? "" : "s"} as JSON.`);
  }, [items, toast]);

  const exportCsv = useCallback(() => {
    if (items.length === 0) return;
    downloadText(exportFilename("csv"), toCsv(items), "text/csv");
    toast("success", `Exported ${items.length} MCQ${items.length === 1 ? "" : "s"} as CSV.`);
  }, [items, toast]);

  const importFile = useCallback(
    async (file: File) => {
      try {
        const text = await readFileText(file);
        const result = parseJsonImport(text);
        if (result.error) {
          toast("error", result.error);
          return;
        }
        if (result.items.length === 0) {
          toast("error", "No valid MCQs found in that file.");
          return;
        }
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          const merged = result.items.map((i) => (seen.has(i.id) ? { ...i, id: uid() } : i));
          return [...prev, ...merged];
        });
        toast(
          "success",
          `Imported ${result.items.length} MCQ${result.items.length === 1 ? "" : "s"}${
            result.skipped ? ` — skipped ${result.skipped} invalid entr${result.skipped === 1 ? "y" : "ies"}` : ""
          }.`,
        );
      } catch {
        toast("error", "Could not read that file.");
      }
    },
    [toast],
  );

  const clearAll = useCallback(() => {
    setItems([]);
    setPreview(null);
    setEditingId(null);
    toast("info", "Session bank cleared.");
  }, [toast]);

  const startPrint = useCallback(() => {
    if (items.length === 0) {
      toast("error", "Nothing to print yet.");
      return;
    }
    setPrinting(true);
  }, [items.length, toast]);

  /* --------------------------------------------------------------- render */

  if (printing) {
    return <PrintSheet items={items} onExit={() => setPrinting(false)} />;
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[95] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper"
      >
        Skip to workspace
      </a>

      {/* --------------------------------------------------------- header */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[88rem] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <span className="grid size-10 place-items-center rounded-xl bg-ink text-paper" aria-hidden>
            <ListChecks className="size-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold leading-tight">MCQ Studio</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              Question builder · local-first
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 font-mono text-[11px] text-ink-2 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-leaf" aria-hidden />
              {items.length} in bank
            </span>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink-2 transition hover:border-ink/50 hover:text-ink"
            >
              <CircleHelp className="size-4" aria-hidden />
              Guide
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        {/* intro */}
        <section aria-label="Introduction" className="pb-9 pt-10 sm:pt-14">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-leaf">
            Assessment toolkit
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-[1.04] sm:text-5xl">
            One base question,{" "}
            <span className="italic text-leaf">a whole bank</span> of
            exam-ready variants.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
            Type the question, mark the key, and generate shuffled, print-ready MCQs. Everything is
            saved to this browser and exports cleanly to JSON or CSV for your real workflow.
          </p>
        </section>

        {/* workspace */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)]">
          <QuestionForm
            draft={draft}
            issues={issues}
            editingId={editingId}
            onPatch={patchDraft}
            onGenerate={generate}
            onClear={freshStart}
            onFocusIssue={focusField}
          />
          <PreviewPane
            draft={draft}
            preview={preview}
            onNewFromBase={newFromBase}
            onFreshStart={freshStart}
          />
        </div>

        {/* bank */}
        <Library
          items={items}
          onEdit={editItem}
          onDuplicate={duplicateItem}
          onCopyJson={copyJson}
          onDelete={deleteItem}
          onExportJson={exportJson}
          onExportCsv={exportCsv}
          onImportFile={importFile}
          onClearAll={clearAll}
          onPrint={startPrint}
        />
      </main>

      {/* footer */}
      <footer className="mt-20 border-t border-line">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <p className="font-mono text-[11px] text-ink-3">
            MCQ Studio v1.0 — your data never leaves this browser unless you wire a backend.
          </p>
          <p className="font-mono text-[11px] text-ink-3">
            WCAG-minded · keyboard-first · print-ready
          </p>
        </div>
      </footer>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

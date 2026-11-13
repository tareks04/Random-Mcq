/**
 * HelpModal.tsx — in-app documentation: workflow, accessibility, data formats,
 * backend hooks, testing and deployment. Closes on Esc / backdrop click.
 */
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-5 first:border-t-0 first:pt-0">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <div className="mt-2.5 space-y-2.5 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-paper">
      {children}
    </pre>
  );
}

export default function HelpModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-[2px] sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="MCQ Studio guide"
        className="w-full max-w-2xl animate-fade-up rounded-2xl border border-line bg-card shadow-lift"
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 rounded-t-2xl border-b border-line bg-card px-6 py-4">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
              Guide
            </p>
            <h2 className="font-display text-xl font-semibold">Working with MCQ Studio</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="grid size-9 rounded-lg border border-line text-ink-2 transition hover:border-ink/50 hover:text-ink"
          >
            <X className="m-auto size-4" aria-hidden />
          </button>
        </div>

        <div className="px-6 py-5">
          <Section title="Workflow in four steps">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Type the base question, then fill two to eight answer options.</li>
              <li>Mark the key with the round (single) or square (multiple) toggles.</li>
              <li>
                Press <kbd>Ctrl</kbd>+<kbd>↵</kbd> or <strong>Generate MCQ</strong>. The card on the
                right becomes an interactive quiz you can check and reveal.
              </li>
              <li>
                Hit <strong>Next MCQ from this base</strong> to immediately draft the next variant
                — the question, mode and shuffle setting carry over; options reset.
              </li>
            </ol>
          </Section>

          <Section title="Keyboard & accessibility">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> moves through every control; focus is always visible.</li>
              <li><kbd>Space</kbd> toggles an option's correct marker; radio/checkbox semantics are announced by screen readers.</li>
              <li><kbd>Ctrl</kbd>+<kbd>↵</kbd> generates from anywhere on the page; <kbd>Esc</kbd> closes dialogs.</li>
              <li>Validation errors are listed in a summary banner — each message is a button that jumps to the offending field.</li>
              <li>All status messages (toasts, verdicts, counts) use polite live regions.</li>
            </ul>
          </Section>

          <Section title="Data formats">
            <p>
              <strong>JSON exports</strong> use a versioned envelope and can be re-imported as-is.
              A bare array of items also imports fine; invalid entries are skipped, never fatal.
            </p>
            <Code>{`{
  "schema": "mcq-studio/v1",
  "exportedAt": "2026-05-21T09:30:00.000Z",
  "items": [
    {
      "id": "…", "question": "…",
      "options": [{ "id": "…", "text": "…" }],
      "correctIds": ["…"],
      "multiple": false, "shuffled": true,
      "explanation": "optional",
      "createdAt": 1779866400000
    }
  ]
}`}</Code>
            <p>
              <strong>CSV exports</strong> flatten one row per question:{" "}
              <code className="font-mono text-[12px]">ID, Question, Type, Correct, Option A…n, Explanation, Created</code>{" "}
              — ready for Excel, Sheets or an LMS import pipeline.
            </p>
          </Section>

          <Section title="Optional backend hooks">
            <p>
              The app is local-first. To sync with your own service, drop this in{" "}
              <code className="font-mono text-[12px]">index.html</code> before the bundle loads,
              then call <code className="font-mono text-[12px]">pushToBackend / pullFromBackend</code>{" "}
              from <code className="font-mono text-[12px]">src/lib/api.ts</code>:
            </p>
            <Code>{`<script>
  window.MCQ_API = {
    baseUrl: "https://api.example.com",
    apiKey:  "Bearer <token>"   // optional Authorization header
  };
</script>
// contract:  GET  {baseUrl}/mcqs  -> JSON array or envelope
//            POST {baseUrl}/mcqs  <- { schema, items }`}</Code>
          </Section>

          <Section title="Testing & deployment">
            <Code>{`npm install          # install
npx vitest run       # unit tests (validation, shuffle, CSV, JSON round-trip)
npm run build        # production build -> dist/index.html (single self-contained file)
npm run preview      # smoke-test the production build locally`}</Code>
            <p>
              Deploy <code className="font-mono text-[12px]">dist/</code> to any static host —
              Netlify drop, Vercel, GitHub Pages, S3 or a plain nginx folder. No server, env-vars
              or build secrets required.
            </p>
          </Section>

          <Section title="Roadmap ideas">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Tags/categories and per-set exports for question banking.</li>
              <li>Drag-and-drop option reordering and rich-text/code snippets.</li>
              <li>QTI 2.1 / xAPI export for LMS ingestion, plus weighted scoring.</li>
              <li>Optional account sync, team libraries and audit history.</li>
              <li>PWA install mode for fully offline exam prep sessions.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

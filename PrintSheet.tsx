/**
 * PrintSheet.tsx — print-friendly rendering of the whole session bank.
 * When mounted it replaces the working UI, waits a beat, opens the browser
 * print dialog, and unmounts again on afterprint. The sheet is ink-on-white,
 * with an answer key table at the end (starts on its own page).
 */
import { useEffect } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { answerLetters, letter, type Mcq } from "../lib/mcq";

interface Props {
  items: Mcq[];
  onExit: () => void;
}

export default function PrintSheet({ items, onExit }: Props) {
  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 350);
    window.addEventListener("afterprint", onExit);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", onExit);
    };
  }, [onExit]);

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* on-screen toolbar — never printed */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3 print:hidden sm:px-8">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs font-semibold transition hover:border-ink/50"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to studio
        </button>
        <p className="hidden font-mono text-[11px] text-ink-3 sm:block">
          Choose “Save as PDF” to archive the paper digitally
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper transition hover:bg-leaf-deep"
        >
          <Printer className="size-3.5" aria-hidden />
          Print
        </button>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
        {/* paper header */}
        <header className="border-b-2 border-ink pb-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-2">
            MCQ Studio · Question paper
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            Multiple-choice assessment
          </h1>
          <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-ink-2">
            <span>{items.length} questions</span>
            <span>{today}</span>
            <span>Name: ______________________</span>
            <span>Score: ______ / {items.length}</span>
          </p>
        </header>

        {/* questions */}
        <ol className="mt-8 space-y-8">
          {items.map((m, qi) => (
            <li key={m.id} className="break-inside-avoid">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm font-semibold">{qi + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-semibold leading-snug">
                    {m.question}
                  </p>
                  {m.multiple && (
                    <p className="mt-1 text-[11px] font-medium italic text-ink-2">
                      (Select all that apply.)
                    </p>
                  )}
                  <ol className="mt-3 space-y-1.5">
                    {m.options.map((o, oi) => (
                      <li key={o.id} className="flex items-baseline gap-2.5 text-sm">
                        <span className="grid size-5 shrink-0 translate-y-0.5 place-items-center rounded-full border border-ink/40 font-mono text-[10px] font-semibold">
                          {letter(oi)}
                        </span>
                        <span>{o.text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* answer key */}
        <section aria-label="Answer key" className="mt-12 break-before-page">
          <h2 className="border-b-2 border-ink pb-3 font-display text-2xl font-semibold">
            Answer key
          </h2>
          <table className="mt-5 w-full border-collapse text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-2">
                <th className="border-b border-line py-2 pr-4 font-medium">#</th>
                <th className="border-b border-line py-2 pr-4 font-medium">Key</th>
                <th className="border-b border-line py-2 pr-4 font-medium">Type</th>
                <th className="border-b border-line py-2 font-medium">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m, qi) => (
                <tr key={m.id} className="break-inside-avoid align-top">
                  <td className="border-b border-line/60 py-2 pr-4 font-mono">{qi + 1}</td>
                  <td className="border-b border-line/60 py-2 pr-4 font-mono font-semibold text-leaf-deep">
                    {answerLetters(m)}
                  </td>
                  <td className="border-b border-line/60 py-2 pr-4 font-mono text-xs">
                    {m.multiple ? "Multiple" : "Single"}
                  </td>
                  <td className="border-b border-line/60 py-2 text-ink-2">
                    {m.explanation ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-6 font-mono text-[10px] text-ink-3">
            Generated with MCQ Studio · {today}
          </p>
        </section>
      </main>
    </div>
  );
}

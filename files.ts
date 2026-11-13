/**
 * files.ts — browser file helpers (download / read).
 * Isolated here so the rest of the app never touches Blob/URL plumbing.
 */

/** Trigger a client-side file download from text content. */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Read a picked File as UTF-8 text. */
export function readFileText(file: File): Promise<string> {
  return file.text();
}

/** Timestamped export filename, e.g. `mcq-session-2026-05-21.json`. */
export function exportFilename(ext: "json" | "csv"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `mcq-session-${date}.${ext}`;
}

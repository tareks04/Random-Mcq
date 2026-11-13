# MCQ Studio

A local-first, single-page tool for turning a **base question + option set** into
formatted, exam-ready **multiple-choice questions** — single- or multi-answer,
option-shuffled, validated, banked, exportable and printable.

Built with **React 19 + Vite + Tailwind CSS 4**. The domain logic is pure
TypeScript, unit-tested, and framework-agnostic so it can move to a backend or
CLI unchanged.

---

## Quick start

```bash
npm install        # install dependencies
npm run dev        # dev server (http://localhost:5173)
npx vitest run     # run the unit test suite
npm run build      # production build -> dist/index.html (ONE self-contained file)
npm run preview    # serve the production build locally to smoke-test it
```

> The build uses `vite-plugin-singlefile`: everything (JS/CSS) is inlined into
> `dist/index.html`, so hosting = copying one file.

## Feature map

| Area | What you get |
| --- | --- |
| **Composer** | Base-question textarea, 2–8 dynamic options (add/remove), single/multiple answer modes, one-click correct marking (radio/checkbox semantics), option shuffle toggle, optional answer explanation |
| **Validation** | Inline per-field errors + a summary banner whose items jump focus to the offending field; catches empty question/options, duplicates, missing key, multi-key in single mode |
| **Preview** | Live draft render with a readiness checklist; committed MCQs become an interactive quiz card (select → check → reveal) with verdict + explanation |
| **Continuation** | “Next MCQ from this base” keeps question/mode/shuffle and resets options |
| **Bank** | Every generated MCQ auto-persists to `localStorage`; edit-in-place, duplicate, copy-JSON, delete |
| **Import/Export** | Versioned JSON envelope export *and* tolerant import (envelope or bare array, invalid entries skipped); spreadsheet-ready CSV |
| **Print** | A clean question paper with a page-break-separated answer key |
| **A11y** | WCAG-minded: real form controls, fieldsets/legends, `aria-invalid`/`aria-describedby`, live regions, visible focus rings, skip link, `Ctrl/⌘+Enter` generate, `Esc` closes dialogs |

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Move through every control (focus always visible) |
| `Space` | Toggle a correct-answer marker / the shuffle switch |
| `Ctrl` / `⌘` + `Enter` | Generate (or update) the MCQ |
| `Esc` | Close the guide dialog |

## Architecture

```
src/
├── App.tsx                  shell + all state orchestration
├── lib/
│   ├── mcq.ts               PURE domain logic: types, limits, validation,
│   │                        Fisher–Yates shuffle (injectable RNG), JSON/CSV
│   ├── mcq.test.ts          vitest unit tests for all of the above
│   ├── storage.ts           localStorage load/save (schema-sanitised)
│   ├── api.ts               OPTIONAL backend hooks (see below)
│   └── files.ts             Blob download / file-read helpers
└── components/
    ├── QuestionForm.tsx     the accessible composer
    ├── PreviewPane.tsx      live draft + interactive committed card
    ├── Library.tsx          session bank, import/export/print/clear
    ├── HelpModal.tsx        in-app documentation
    ├── PrintSheet.tsx       question paper + answer key
    └── Toast.tsx            polite-live-region notifications
```

## Data formats

**JSON export** (versioned envelope — also the accepted import shape):

```json
{
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
}
```

**CSV export**: one row per question —
`ID, Question, Type, Correct, Option A…n, Explanation, Created`
(`Correct` lists letters like `A;C`; the option columns are sized to the
widest question in the batch; RFC-4180 quoting).

## Optional backend integration

The app is fully local-first. To sync with your service, expose config before
the bundle boots, then wire `pushToBackend` / `pullFromBackend`
(`src/lib/api.ts`) to a UI action:

```html
<script>
  window.MCQ_API = { baseUrl: "https://api.example.com", apiKey: "Bearer <token>" };
</script>
```

Expected contract: `GET {baseUrl}/mcqs` returns a JSON array (or envelope);
`POST {baseUrl}/mcqs` accepts `{ schema, items }`. Unconfigured → both resolve
`null` and the app silently stays in local mode.

## Testing

```bash
npx vitest run                 # whole suite
npx vitest run src/lib/mcq     # domain-logic tests only
```

Covers: validation rules, shuffle correctness (permutation + deterministic
RNG), key stability across shuffles, CSV escaping, JSON round-trip, and
import tolerance for malformed entries. Manual checks worth doing before a
release: keyboard-only walkthrough, screen-reader pass (NVDA/VoiceOver),
`localStorage` disabled (private mode), and a print-to-PDF of 20+ questions.

## Deployment

Any static host works — no server runtime, env vars or secrets:

- **Netlify**: drag `dist/` into the dashboard, or `netlify deploy --dir=dist --prod`
- **Vercel**: `vercel deploy dist` (framework preset: *Other*)
- **GitHub Pages**: push `dist/index.html` to a `gh-pages` branch
- **S3/nginx**: upload `dist/index.html`; it is self-contained, so even
  `file://` and intranet shares work

CI sketch: `npm ci && npx vitest run && npm run build` → artifact `dist/index.html`.

## Roadmap

- Tags/categories, per-set exports, and bank search
- Drag-and-drop option reordering; rich-text/code blocks in questions
- QTI 2.1 / xAPI export for LMS ingestion; weighted scoring & timers
- Account sync + team libraries via the existing `api.ts` hooks
- PWA install mode for offline exam-prep sessions

## License

Internal tooling — reuse freely within your organisation.

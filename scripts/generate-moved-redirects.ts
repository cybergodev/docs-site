/**
 * Generate redirect pages for URLs that changed in the Phase 2 content
 * reorganization (each sidebar group became a directory; some pages moved).
 *
 * `docs/.vitepress/sidebar-moves.json` (emitted once by the migration) lists
 * every relocated page lang-neutrally: `{ from, to }` (e.g.
 * `json/api-reference/large-file` → `json/streaming/large-file`). This script
 * runs after `vitepress build` + `fix-clean-urls` and, for each move × language,
 * writes a static page at the OLD output path that redirects to the NEW one.
 *
 * Chained relocations (a `to` that is itself the `from` of a later entry, e.g.
 * dd hooks → security-audit/hooks → extensions/hooks → core/hooks) are
 * collapsed to their TERMINAL destination first (resolveTerminal), so every
 * redirect, canonical and refresh target points straight at the real page —
 * never at another noindex redirect page (a canonical chain old → noindex
 * redirect → real page is a contradictory signal for crawlers).
 *
 * Writing is two-phase: everything is resolved and validated first, and the
 * pages are written only when zero errors were found (all-or-nothing — bad
 * manifest data leaves dist with no half-applied redirects).
 *
 * The redirect is a same-language, 1:1 content move, so it stays simple:
 * canonical → new URL, `<meta http-equiv=refresh>` → new URL (followed by all
 * crawlers and JS-disabled clients), `robots: noindex,follow` so the old URL is
 * not indexed but passes link equity to the new canonical target. No client-side
 * language negotiation is needed (unlike the bare-path bridge pages).
 *
 * Modeled on `scripts/generate-project-redirects.ts`.
 */
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { DIST_DIR, HOST, LANGS } from '../docs/.vitepress/shared'
import { readFileSync } from 'fs'
import { fileExists } from './_lib/file-exists'
import { escapeHtml } from './_lib/escape-html'

interface Move {
  from: string
  to: string
}
// The moves manifest is a one-time migration artifact; it may be absent or
// emptied later. Parse defensively so a missing/corrupt file degrades to "no
// moves" (build still succeeds) rather than crashing the whole post-build chain.
let MOVES: Move[] = []
try {
  MOVES = JSON.parse(readFileSync(join('docs', '.vitepress', 'sidebar-moves.json'), 'utf8'))
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
    console.warn(
      `moved-redirects: sidebar-moves.json exists but could not be parsed (${e instanceof Error ? e.message : e}); skipping`
    )
  }
  // ENOENT (file removed after migration) is the quiet, expected case.
}

function redirectHtml(lang: string, terminal: string, canonical: string): string {
  const newUrl = `/${lang}/${terminal}/`
  return `<!DOCTYPE html>
<html lang="${lang}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirect</title>
<link rel="canonical" href="${canonical}">
<meta http-equiv="refresh" content="0; url=${newUrl}">
<meta name="robots" content="noindex, follow">
</head>
<body>
<p>Redirecting to <a href="${newUrl}">${escapeHtml(terminal)}</a>.</p>
</body>
</html>
`
}

/**
 * Canonical for the redirect page, replicating the TERMINAL page's own
 * canonical form (seo.ts transformHead derives it from the markdown source
 * shape): a directory page (`docs/{lang}/{terminal}/index.md`) canonicalizes
 * WITH a trailing slash, a leaf page (`docs/{lang}/{terminal}.md`) WITHOUT
 * one. Matching the exact form avoids a one-hop canonical chain
 * (old URL → redirect canonical → target canonical).
 *
 * `terminal` comes from resolveTerminal and, when the strict validation in
 * main() passed, exists as a real built page — so one of the two source
 * shapes normally matches. The trailing-slash fallback stays as
 * belt-and-braces. The `http-equiv=refresh` URL above always keeps the
 * trailing slash: after fix-clean-urls every built page is a directory
 * (`{path}/index.html`), so that form resolves on the static host for both
 * target shapes.
 */
async function targetCanonical(lang: string, terminal: string): Promise<string> {
  if (await fileExists(join('docs', lang, terminal, 'index.md'))) {
    return `${HOST}/${lang}/${terminal}/`
  }
  if (await fileExists(join('docs', lang, `${terminal}.md`))) {
    return `${HOST}/${lang}/${terminal}`
  }
  return `${HOST}/${lang}/${terminal}/`
}

/** from → to lookup for chain resolution (last entry wins on duplicates). */
const MOVE_MAP = new Map(MOVES.map((m) => [m.from, m.to] as const))

/**
 * Final destination of a move: follow `to` through chained relocations until
 * a path that is nobody's `from`. Cycles are impossible to satisfy — a chain
 * longer than the manifest must have revisited an entry — so the script dies
 * (during the validation phase, before anything is written).
 */
function resolveTerminal(to: string): string {
  let cur = to
  for (let hops = 0; hops < MOVES.length; hops++) {
    const next = MOVE_MAP.get(cur)
    if (next === undefined) return cur
    cur = next
  }
  console.error(
    `moved-redirects: sidebar-moves.json contains a move cycle reachable from "${to}" — chain never terminates`
  )
  process.exit(1)
}

/** Does the page exist in this language's SOURCE tree in either shape
 *  (leaf `docs/{lang}/{p}.md` or directory `docs/{lang}/{p}/index.md`)? */
async function sourceExists(lang: string, p: string): Promise<boolean> {
  return (
    (await fileExists(join('docs', lang, `${p}.md`))) ||
    (await fileExists(join('docs', lang, p, 'index.md')))
  )
}

interface PlannedWrite {
  lang: string
  /** Old path — where the redirect page is written. */
  from: string
  /** Resolved terminal destination — what the redirect points at. */
  terminal: string
  canonical: string
}

async function main(): Promise<void> {
  let created = 0
  let skipped = 0
  const errors: string[] = []
  const warnings: string[] = []
  const writes: PlannedWrite[] = []

  // ---- Phase 1: resolve + validate every (move × lang), write nothing. ----
  for (const lang of LANGS) {
    for (const { from, to } of MOVES) {
      const terminal = resolveTerminal(to)
      const fromFile = join(DIST_DIR, lang, from, 'index.html')
      // Never overwrite a page the build still produces at the old path.
      if (await fileExists(fromFile)) {
        skipped++
        continue
      }
      // The manifest is language-neutral, but a page may exist in only some
      // languages (e.g. not yet translated). When NEITHER end of the move has
      // ever existed in this language's source tree, the entry is simply
      // irrelevant here — warn and skip instead of failing the build over a
      // single-language page.
      if (!(await sourceExists(lang, from)) && !(await sourceExists(lang, terminal))) {
        warnings.push(
          `moved-redirects: [${lang}] "${from}" -> "${terminal}": page never existed in this language — skipping (single-language page)`
        )
        continue
      }
      // Strict guard (this language DOES own the page): the terminal target
      // must exist as a built page. A stale manifest entry would otherwise
      // silently emit a redirect into a 404 — fail the build (and thus CI)
      // instead of shipping the broken redirect.
      const toFile = join(DIST_DIR, lang, terminal, 'index.html')
      if (!(await fileExists(toFile))) {
        errors.push(
          `moved-redirects: [${lang}] "${from}" -> "${terminal}": target page missing (no built page at ${toFile.replace(/\\/g, '/')})`
        )
        continue
      }
      writes.push({ lang, from, terminal, canonical: await targetCanonical(lang, terminal) })
    }
  }

  // ---- Phase 2: all-or-nothing write. With any error above, dist keeps its
  // build output untouched — no half-applied redirect set. ----
  if (!errors.length) {
    for (const w of writes) {
      const fromDir = join(DIST_DIR, w.lang, w.from)
      await mkdir(fromDir, { recursive: true })
      await writeFile(
        join(fromDir, 'index.html'),
        redirectHtml(w.lang, w.terminal, w.canonical),
        'utf8'
      )
      created++
    }
  }

  console.log(
    `moved-redirects: ${created} page(s) across ${LANGS.length} languages` +
      (skipped ? ` (${skipped} skipped — old path still built)` : '')
  )
  for (const w of warnings) console.warn(w)
  if (errors.length) {
    for (const err of errors) console.error(err)
    console.error(
      `moved-redirects: ${errors.length} dangling target(s) in sidebar-moves.json — fix or remove the stale entries (nothing was written)`
    )
    process.exit(1)
  }
}

await main()

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

function redirectHtml(lang: string, to: string): string {
  const newUrl = `/${lang}/${to}/`
  const canonical = `${HOST}/${lang}/${to}/`
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
<p>Redirecting to <a href="${newUrl}">${escapeHtml(to)}</a>.</p>
</body>
</html>
`
}

async function main(): Promise<void> {
  let created = 0
  let skipped = 0
  for (const lang of LANGS) {
    for (const { from, to } of MOVES) {
      const fromDir = join(DIST_DIR, lang, from)
      const fromFile = join(fromDir, 'index.html')
      // Never overwrite a page the build still produces at the old path.
      if (await fileExists(fromFile)) {
        skipped++
        continue
      }
      await mkdir(fromDir, { recursive: true })
      await writeFile(fromFile, redirectHtml(lang, to), 'utf8')
      created++
    }
  }
  console.log(
    `moved-redirects: ${created} page(s) across ${LANGS.length} languages` +
      (skipped ? ` (${skipped} skipped — old path still built)` : '')
  )
}

await main()

/**
 * Locale parity audit — catch the "added a page in one language but forgot the
 * others" class of drift automatically.
 *
 * For each non-primary language, compares its page set against the primary
 * language (zh, the canonical / most-complete tree) and reports:
 *   - missing:  pages the primary has that this language doesn't (a translator
 *               needs to add them), and
 *   - dangling: pages this language has that the primary doesn't (a stale or
 *               misnamed page — likely a typo or a page removed from zh but not
 *               elsewhere).
 *
 * A page is identified by its path relative to docs/{lang}/ with `.md` stripped
 * and `index` collapsed (so `json/index.md` and `json/getting-started.md` in
 * different languages compare as the same logical page). This mirrors how
 * generate-llms.ts derives URLs, so "same page" means the same thing here.
 *
 * Writes a markdown report to report/locale-parity.md and prints a summary.
 * Exits non-zero when problems are found so this can gate CI (`npm run audit`).
 *
 * TODO (out of scope here): cross-check Go API signatures in api-reference pages
 * against the source in {project}-dev via go/ast — parity of *content*, not just
 * page existence. That needs a Go parser and is tracked separately.
 */
import { readdir, writeFile, mkdir } from 'fs/promises'
import { join, relative } from 'path'
import type { Dirent } from 'fs'
import { LANGS, PRIMARY_LANG } from '../docs/.vitepress/shared'

const DOCS_ROOT = 'docs'
const REPORT_DIR = 'report'
const REPORT_FILE = join(REPORT_DIR, 'locale-parity.md')

/** Collect every page under docs/{lang}/ as a normalized logical path. */
async function collectPages(langDir: string): Promise<Set<string>> {
  const pages = new Set<string>()
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return // language dir may not exist yet
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.md')) pages.add(normalize(relative(langDir, full)))
    }
  }
  await walk(langDir)
  return pages
}

/** `json/index.md` → `json`, `index.md` → ``, `getting-started.md` → `getting-started`. */
function normalize(rel: string): string {
  let p = rel.replace(/\\/g, '/').replace(/\.md$/, '')
  if (p === 'index') return ''
  if (p.endsWith('/index')) return p.slice(0, -'/index'.length)
  return p
}

function label(p: string): string {
  return p === '' ? '(首页)' : p
}

async function main(): Promise<void> {
  const sets = new Map<string, Set<string>>()
  for (const lang of LANGS) {
    sets.set(lang, await collectPages(join(DOCS_ROOT, lang)))
  }
  const base = sets.get(PRIMARY_LANG)!

  const lines: string[] = [
    '# Locale Parity Audit',
    '',
    `基准语言: \`${PRIMARY_LANG}\` (${base.size} 页)。其余语言与之比对。`,
    ''
  ]

  let problems = 0
  for (const lang of LANGS) {
    if (lang === PRIMARY_LANG) continue
    const s = sets.get(lang)!
    const missing = [...base].filter((p) => !s.has(p)).sort()
    const dangling = [...s].filter((p) => !base.has(p)).sort()
    problems += missing.length + dangling.length

    lines.push(`## ${lang} (${s.size} 页)`)
    if (missing.length) {
      lines.push('', `**缺失 ${missing.length}** — 基准有、本语言无:`)
      missing.forEach((p) => lines.push(`- ${label(p)}`))
    }
    if (dangling.length) {
      lines.push('', `**多余 ${dangling.length}** — 本语言有、基准无:`)
      dangling.forEach((p) => lines.push(`- ${label(p)}`))
    }
    if (!missing.length && !dangling.length) lines.push('', '✓ 与基准完全一致')
    lines.push('')
  }

  const report = lines.join('\n')
  await mkdir(REPORT_DIR, { recursive: true })
  await writeFile(REPORT_FILE, report, 'utf8')

  console.log(report)
  console.log(
    `\n${problems === 0 ? '✓ 无 parity 问题' : `⚠ ${problems} 个 parity 问题`} → ${REPORT_FILE}`
  )
  if (problems > 0) process.exitCode = 1
}

await main()

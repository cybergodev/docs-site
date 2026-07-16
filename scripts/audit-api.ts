/**
 * API drift detector — compares each project's exported Go API surface
 * (from scripts/apiscan) against the hand-written API-reference docs, flagging:
 *
 *   - DANGLING     a doc page references a symbol the source no longer exports
 *                  (deleted / renamed / typo) — a REAL error, fails the audit.
 *   - UNDOCUMENTED the source exports a symbol no doc page mentions —
 *                  informational only (many exports are intentional helpers).
 *
 * Pipeline per project:
 *   1. run scripts/apiscan (Go AST scanner) → report/api/{project}.json
 *   2. collect the source symbol set from that manifest
 *   3. scan every .md under docs/{PRIMARY_LANG}/{project}/ for backticked identifiers
 *   4. diff → undocumented (source − docs), dangling (docs − source)
 *
 * Exit non-zero iff any DANGLING reference is found.
 *
 * Requires the Go toolchain (`go`) and the source repos at SOURCE_ROOT (default
 * D:/MyProject, matching .claude/config/projects.yaml). A project whose source
 * is absent (e.g. CI without the repos checked out) is skipped, not failed.
 * Override the root with CYBERGO_SOURCE_ROOT. Local: `npm run audit:api`.
 */
import { execFileSync } from 'child_process'
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join, relative } from 'path'
import type { Dirent } from 'fs'
import { PROJECTS, PRIMARY_LANG } from '../docs/.vitepress/shared'

// Root holding the {project}-dev source repos. Override with CYBERGO_SOURCE_ROOT.
const SOURCE_ROOT = process.env.CYBERGO_SOURCE_ROOT || 'D:/MyProject'
const APISCAN_DIR = join('scripts', 'apiscan')
const REPORT_DIR = 'report'
const API_JSON_DIR = join(REPORT_DIR, 'api')
const DRIFT_REPORT = join(REPORT_DIR, 'api-drift.md')

interface Symbol {
  name: string
  signature?: string
  doc?: string
}
interface Type {
  name: string
  kind: string
  methods?: Symbol[]
  fields?: Symbol[]
}
interface Package {
  path: string
  functions?: Symbol[]
  types?: Type[]
  constants?: Symbol[]
  variables?: Symbol[]
}
interface Manifest {
  module: string
  packages: Package[]
}

// Run apiscan for one project; return the JSON path, or null if the source is
// missing / go failed (skip gracefully).
function runApiscan(project: string): string | null {
  const src = join(SOURCE_ROOT, `${project}-dev`)
  const module = `github.com/cybergodev/${project}`
  const out = join(process.cwd(), API_JSON_DIR, `${project}.json`)
  try {
    execFileSync(
      'go',
      ['-C', APISCAN_DIR, 'run', '.', '-src', src, '-module', module, '-out', out],
      { stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true }
    )
    return out
  } catch {
    console.warn(`audit-api: skip ${project} (source missing at ${src} or go failed)`)
    return null
  }
}

// Flatten a manifest into the set of symbol names a doc could reference:
// functions, types, methods (both Type.Method and the bare method name),
// constants and variables.
function collectSymbols(m: Manifest): Set<string> {
  const set = new Set<string>()
  for (const pkg of m.packages) {
    for (const f of pkg.functions ?? []) set.add(f.name)
    for (const t of pkg.types ?? []) {
      set.add(t.name)
      for (const meth of t.methods ?? []) {
        set.add(meth.name) // "Type.Method"
        set.add(meth.name.split('.').pop()!) // "Method"
      }
      for (const f of t.fields ?? []) {
        set.add(f.name) // field short name
        set.add(t.name + '.' + f.name) // "Type.Field"
      }
    }
    for (const c of pkg.constants ?? []) set.add(c.name)
    for (const v of pkg.variables ?? []) set.add(v.name)
  }
  return set
}

async function collectMd(root: string): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.md')) out.push(full)
    }
  }
  await walk(root)
  return out
}

// A backticked exported identifier: `GetString`, `Processor.Set`, `Config`.
const IDENT_RE = /`([A-Z][A-Za-z0-9_.]*)`/g

// Common all-caps acronyms (HTTP, JSON, TLS, SSRF…) appear in docs but are not
// symbols — exclude them from the DANGLING list to keep the signal clean.
function isAcronym(s: string): boolean {
  return s.length <= 5 && s === s.toUpperCase() && /[A-Z]/.test(s) && !s.includes('.')
}

// Scan a project's primary-language docs; return Map<ident, files[]>.
async function collectDocIdents(project: string): Promise<Map<string, string[]>> {
  const root = join('docs', PRIMARY_LANG, project)
  const files = await collectMd(root)
  const map = new Map<string, string[]>()
  for (const f of files) {
    const content = await readFile(f, 'utf8')
    for (const m of content.matchAll(IDENT_RE)) {
      const ident = m[1]
      if (!map.has(ident)) map.set(ident, [])
      map.get(ident)!.push(relative(join('docs', PRIMARY_LANG), f))
    }
  }
  return map
}

interface ProjectResult {
  project: string
  module: string
  sourceCount: number
  docCount: number
  undocumented: string[]
  dangling: { ident: string; files: string[] }[]
}

async function auditProject(project: string): Promise<ProjectResult | null> {
  const jsonPath = runApiscan(project)
  if (!jsonPath) return null
  const manifest: Manifest = JSON.parse(await readFile(jsonPath, 'utf8'))
  const source = collectSymbols(manifest)
  const docs = await collectDocIdents(project)

  const undocumented = [...source].filter((s) => !docs.has(s)).sort()
  const dangling: { ident: string; files: string[] }[] = []
  for (const [ident, files] of docs) {
    if (!source.has(ident) && !isAcronym(ident)) {
      dangling.push({ ident, files: [...new Set(files)] })
    }
  }
  dangling.sort((a, b) => a.ident.localeCompare(b.ident))

  return {
    project,
    module: manifest.module,
    sourceCount: source.size,
    docCount: docs.size,
    undocumented,
    dangling
  }
}

async function main(): Promise<void> {
  await mkdir(API_JSON_DIR, { recursive: true })

  const results: ProjectResult[] = []
  for (const project of PROJECTS) {
    const r = await auditProject(project)
    if (r) results.push(r)
  }

  // ---- report ----
  const lines: string[] = [
    '# API Drift Report',
    '',
    '> Generated by `npm run audit:api` (`scripts/audit-api.ts` + `scripts/apiscan`).',
    '> Compares each project’s exported Go API surface against the `zh` docs.',
    '',
    '- **DANGLING** = doc references a symbol the source no longer exports (real error).',
    '- **UNDOCUMENTED** = source exports a symbol no doc mentions (informational).',
    ''
  ]

  let totalDangling = 0
  for (const r of results) {
    totalDangling += r.dangling.length
    lines.push(`## ${r.project} (\`${r.module}\`)`, '')
    lines.push(
      `Source: ${r.sourceCount} symbols · Docs reference: ${r.docCount} identifiers · ` +
        `Dangling: ${r.dangling.length} · Undocumented: ${r.undocumented.length}`,
      ''
    )
    if (r.dangling.length) {
      lines.push(`### ❌ DANGLING (${r.dangling.length})`, '')
      for (const d of r.dangling) {
        lines.push(`- \`${d.ident}\` — ${d.files.slice(0, 3).join(', ')}${d.files.length > 3 ? ', …' : ''}`)
      }
      lines.push('')
    }
    if (r.undocumented.length) {
      lines.push(`<details><summary>⚠️ UNDOCUMENTED (${r.undocumented.length})</summary>`, '')
      for (const u of r.undocumented) lines.push(`- \`${u}\``)
      lines.push('', '</details>', '')
    }
  }

  lines.push('---', '', totalDangling ? `**Result: FAIL** — ${totalDangling} dangling reference(s).` : '**Result: PASS** — no dangling references.')

  await mkdir(REPORT_DIR, { recursive: true })
  await writeFile(DRIFT_REPORT, lines.join('\n') + '\n', 'utf8')

  console.log(`audit-api: wrote ${DRIFT_REPORT} (${results.length} projects, ${totalDangling} dangling)`)
  if (totalDangling) process.exit(1)
}

await main()

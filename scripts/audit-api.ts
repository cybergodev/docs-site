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
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, relative } from 'path'
import { PROJECTS, PRIMARY_LANG } from '../docs/.vitepress/shared'
import { collectMd } from './_lib/walk'

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

// A backticked exported identifier: `GetString`, `Processor.Set`, `Config`.
const IDENT_RE = /`([A-Z][A-Za-z0-9_.]*)`/g

// All-caps tokens — `HTTP`, `JSON`, `TLS`, `SSRF`, but also `API_KEY`,
// `DATABASE_URL`, `LD_LIBRARY_PATH`, `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`,
// `PATH_TRAVERSAL`… — show up in docs as acronyms, environment-variable names,
// stdlib crypto/tls constants, or example values. The cybergodev libraries
// consistently use PascalCase for exports (no CONSTANT_CASE exports), so an
// all-caps backticked token is never a cybergodev symbol. Excluding these
// keeps DANGLING focused on real (PascalCase) identifier drift.
function isAllCaps(s: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(s) && !s.includes('.')
}

// Well-known Go stdlib interface methods (json.Marshaler, encoding.TextMarshaler,
// fmt.Stringer, encoding.BinaryMarshaler). Docs legitimately say "implements
// json.Marshaler (MarshalJSON)" — these aren't cybergodev exports.
const STDLIB_INTERFACE_METHODS = new Set([
  'MarshalJSON',
  'UnmarshalJSON',
  'MarshalText',
  'UnmarshalText',
  'MarshalBinary',
  'UnmarshalBinary',
  'GoString'
])

// Standard-library struct fields docs reference when discussing stdlib types
// (e.g. net/http.Transport tuning in integration guides). cybergodev structs
// do not reuse these exact names today; if one ever does, remove it here so it
// is checked against source instead of silently passed.
const STDLIB_FIELDS = new Set([
  'IdleConnTimeout',
  'MaxIdleConns',
  'MaxIdleConnsPerHost',
  'Timeout' // net/http.Transport
])

// OS-level API / syscall function names referenced for cross-platform context
// (e.g. "Linux `mlock` / Windows `VirtualLock`"). These are not Go exports at
// all — they are platform C APIs — but PascalCase members like `VirtualLock`
// match the IDENT_RE pattern. Lowercase siblings (mlock, mmap) never trigger
// because they fail the [A-Z…] anchor. If a cybergodev export ever collides
// with one of these, drop it here so it is checked against source instead of
// being silently passed.
const OS_API_FUNCTIONS = new Set(['VirtualLock'])

function isLikelyNotSymbol(s: string): boolean {
  return (
    isAllCaps(s) ||
    STDLIB_INTERFACE_METHODS.has(s) ||
    STDLIB_FIELDS.has(s) ||
    OS_API_FUNCTIONS.has(s)
  )
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
    if (!source.has(ident) && !isLikelyNotSymbol(ident)) {
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
        lines.push(
          `- \`${d.ident}\` — ${d.files.slice(0, 3).join(', ')}${d.files.length > 3 ? ', …' : ''}`
        )
      }
      lines.push('')
    }
    if (r.undocumented.length) {
      lines.push(`<details><summary>⚠️ UNDOCUMENTED (${r.undocumented.length})</summary>`, '')
      for (const u of r.undocumented) lines.push(`- \`${u}\``)
      lines.push('', '</details>', '')
    }
  }

  lines.push(
    '---',
    '',
    totalDangling
      ? `**Result: FAIL** — ${totalDangling} dangling reference(s).`
      : '**Result: PASS** — no dangling references.'
  )

  await mkdir(REPORT_DIR, { recursive: true })
  await writeFile(DRIFT_REPORT, lines.join('\n') + '\n', 'utf8')

  console.log(
    `audit-api: wrote ${DRIFT_REPORT} (${results.length} projects, ${totalDangling} dangling)`
  )
  if (totalDangling) process.exit(1)
}

await main()

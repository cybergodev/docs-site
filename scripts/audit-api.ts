/**
 * API drift detector — compares each project's exported Go API surface
 * (from scripts/apiscan) against the hand-written API-reference docs, flagging:
 *
 *   - DANGLING     a doc page references a symbol the source no longer exports
 *                  (deleted / renamed / typo) — a REAL error, fails the audit.
 *   - UNDOCUMENTED the source exports a symbol no doc page mentions —
 *                  informational only (many exports are intentional helpers).
 *   - DEPRECATED-REFERENCED a doc page references a symbol the source still
 *                  exports but marks `// Deprecated:` — informational only,
 *                  same level as UNDOCUMENTED: docs legitimately mention
 *                  deprecated symbols (migration notes, "use X instead"),
 *                  so this is a human-review hint, never a CI gate. Sourced
 *                  from apiscan's `deprecated: true` manifest flag, which is
 *                  computed on the FULL doc comment — the manifest's `doc`
 *                  string is trimmed to its first line, and "Deprecated:"
 *                  paragraphs usually come after it, so a substring check on
 *                  `doc` would miss most markers.
 *
 * Dotted doc identifiers match on any ≥2-segment dotted suffix (a doc may
 * write `Config.Defaults.FollowRedirects` where the symbol set holds
 * `Defaults.FollowRedirects`) — see hasSourceMatch; DEPRECATED-REFERENCED
 * uses the same suffix rule (see deprecatedSymbolsFor) so both detections
 * share one matching path.
 *
 * Field-access-path aliases: docs also write legal field paths — `Config.
 * Retry.MaxRetries` or bare `Retry.MaxRetries` — where `Retry` is a FIELD of
 * Config typed RetryConfig; plain "Type.Member" symbols can never match those
 * (field name ≠ type name). Field signatures in the manifest carry the type
 * (`"Retry RetryConfig"`), so the symbol set additionally gets graph-walked
 * access paths (type-anchored and bare, ≤3 segments, cycle-guarded) — see
 * addAccessPathAliases. Aliases feed DANGLING matching only; UNDOCUMENTED
 * still enumerates the base exported surface, keeping that informational
 * list readable — and DEPRECATED-REFERENCED indexes the base surface only,
 * for the same reason. Finally, per-project whitelists
 * (PROJECT_KNOWN_NOT_SYMBOLS) cover stdlib / HTTP-header / Windows / teaching
 * -placeholder names docs legitimately backtick that are not cybergodev
 * exports.
 *
 * Pipeline per project:
 *   1. run scripts/apiscan (Go AST scanner) → report/api/{project}.json
 *   2. collect the source symbol set from that manifest
 *   3. scan every .md under docs/{PRIMARY_LANG}/{project}/ for backticked identifiers
 *   4. diff → undocumented (source − docs), dangling (docs − source),
 *      deprecated-referenced (docs ∩ deprecated source symbols)
 *
 * Exit non-zero iff any DANGLING reference is found.
 *
 * Requires the Go toolchain (`go`) and the source repos at SOURCE_ROOT (default
 * D:/MyProject, matching the repo-root projects.yaml). A project whose source
 * is absent (e.g. CI without the repos checked out) is skipped, not failed.
 * Override the root with CYBERGO_SOURCE_ROOT. Local: `npm run audit:api`.
 */
import { execFileSync } from 'child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, relative, resolve } from 'path'
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
  deprecated?: boolean
}
interface Type {
  name: string
  kind: string
  doc?: string
  deprecated?: boolean
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

// Run apiscan for one project; return the JSON path, or null if the source
// repo is absent (skip — local convention; in CI the checkout steps are the
// gate). `go -C scripts/apiscan` chdirs before the scanner runs, so a relative
// -src would resolve against scripts/apiscan/ — always pass an absolute path.
// With the source present, any apiscan failure is a tool/path fault and fails
// the audit instead of being skipped (a skip there would turn CI green with
// zero projects audited).
function runApiscan(project: string): string | null {
  const src = resolve(SOURCE_ROOT, `${project}-dev`)
  if (!existsSync(src)) {
    console.warn(`audit-api: skip ${project} (source missing at ${src})`)
    return null
  }
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
    console.error(`audit-api: apiscan failed for ${project} (src: ${src}) — see stderr above`)
    process.exit(1)
  }
}

// Flatten a manifest into the symbol sets a doc could reference:
//   base — exported API surface: functions, types, methods (both Type.Method
//          and the bare method name), Type.Field pairs, constants, variables.
//   all  — base + field-access-path aliases (see addAccessPathAliases).
//   deprecated — index of ONLY the deprecated symbols, keyed by every name
//          shape `base` emits them under (bare method/field name included) →
//          the canonical spelling ("Processor.Validate", "Type.Field").
// DANGLING matching consults `all` (aliases rescue legal field paths);
// UNDOCUMENTED enumerates `base` only, so the informational list stays a
// readable inventory of the real exported surface instead of every path alias;
// DEPRECATED-REFERENCED consults `deprecated` (base shapes only — same
// rationale). A bare method name lands in the index when ANY declaring type
// deprecates it (e.g. `Validate` via Processor.Validate), even if another
// type keeps a live method of the same name (TokenManager.Validate): the
// report entry shows WHICH deprecated symbol matched so a human can tell the
// legit interface mentions from calls into the deprecated one.
interface SymbolSets {
  base: Set<string>
  all: Set<string>
  deprecated: Map<string, Set<string>>
}

function collectSymbols(m: Manifest): SymbolSets {
  const base = new Set<string>()
  const deprecated = new Map<string, Set<string>>()
  const markDeprecated = (keys: string[], canonical: string): void => {
    for (const k of keys) {
      if (!deprecated.has(k)) deprecated.set(k, new Set())
      deprecated.get(k)!.add(canonical)
    }
  }
  for (const pkg of m.packages) {
    for (const f of pkg.functions ?? []) {
      base.add(f.name)
      if (f.deprecated) markDeprecated([f.name], f.name)
    }
    for (const t of pkg.types ?? []) {
      base.add(t.name)
      if (t.deprecated) markDeprecated([t.name], t.name)
      for (const meth of t.methods ?? []) {
        base.add(meth.name) // "Type.Method"
        base.add(meth.name.split('.').pop()!) // "Method"
        if (meth.deprecated) markDeprecated([meth.name, meth.name.split('.').pop()!], meth.name)
      }
      for (const f of t.fields ?? []) {
        base.add(f.name) // field short name
        base.add(t.name + '.' + f.name) // "Type.Field"
        if (f.deprecated) markDeprecated([f.name, t.name + '.' + f.name], t.name + '.' + f.name)
      }
    }
    for (const c of pkg.constants ?? []) {
      base.add(c.name)
      if (c.deprecated) markDeprecated([c.name], c.name)
    }
    for (const v of pkg.variables ?? []) {
      base.add(v.name)
      if (v.deprecated) markDeprecated([v.name], v.name)
    }
  }
  const all = new Set(base)
  addAccessPathAliases(all, m)
  return { base, all, deprecated }
}

/** Parse the type name out of a Go field signature like "Retry RetryConfig",
 *  "Meta *RequestMeta" or "RedirectChain []string": drop the leading field
 *  name, then strip pointer / slice / map[K]V decorations (repeatedly —
 *  `map[string]*Foo` → `Foo`). Returns null when what remains is not a bare
 *  unqualified identifier: builtins (string), qualified types (time.Duration,
 *  tls.Config, os.FileMode) and func types never alias to package types. */
function fieldTypeName(signature: string): string | null {
  const m = signature.match(/^\S+\s+(.+)$/)
  if (!m) return null
  let t = m[1].trim()
  for (;;) {
    if (t.startsWith('[]')) t = t.slice(2).trim()
    else if (t.startsWith('*')) t = t.slice(1).trim()
    else {
      const map = t.match(/^map\[[^\]]+\](.+)$/)
      if (!map) break
      t = map[1].trim()
    }
  }
  return /^[A-Za-z_]\w*$/.test(t) ? t : null
}

// Field-access-path aliases. Docs legitimately write field paths —
// `Config.Retry.MaxRetries` (type-anchored) or `Retry.MaxRetries` (bare) —
// where `Retry` is a FIELD of Config whose TYPE is RetryConfig; the plain
// "Type.Member" symbols can never match those because field name ≠ type name.
// The manifest's field signatures carry the type, so we walk the field-type
// graph and register every access path of ≤MAX_PATH_SEGS segments, both
// anchored at the owning type and at the bare field name. The cycle guard
// keeps the walk finite even if the cap is ever raised; a type already on the
// current path is not re-entered.
const MAX_PATH_SEGS = 3

function addAccessPathAliases(set: Set<string>, m: Manifest): void {
  // Exported types a doc can "dot into": struct AND alias kinds carry fields,
  // interfaces carry methods (apiscan records exported members only — e.g.
  // httpc's ClientError is kind "alias" with 8 fields). Types with the same
  // name across packages are merged: the symbol set is already flat per
  // project, so merging matches existing semantics.
  const graph = new Map<string, Type>()
  for (const pkg of m.packages) {
    for (const t of pkg.types ?? []) {
      if (!/^[A-Z]/.test(t.name)) continue
      if ((t.fields?.length ?? 0) === 0 && (t.methods?.length ?? 0) === 0) continue
      const existing = graph.get(t.name)
      if (existing) {
        existing.fields = [...(existing.fields ?? []), ...(t.fields ?? [])]
        existing.methods = [...(existing.methods ?? []), ...(t.methods ?? [])]
      } else {
        graph.set(t.name, { ...t })
      }
    }
  }

  // Members of a graph type: fields (carrying their type signature for the
  // next hop) and methods (bare name — method names arrive as "Type.Method").
  // Methods are path terminals: a call result has no named fields to walk.
  const membersOf = (t: Type): { name: string; typeSig?: string }[] => [
    ...(t.fields ?? []).map((f) => ({ name: f.name, typeSig: f.signature })),
    ...(t.methods ?? []).map((meth) => ({ name: meth.name.split('.').pop()! }))
  ]
  const resolve = (sig?: string): Type | undefined => {
    if (!sig) return undefined
    const n = fieldTypeName(sig)
    return n && /^[A-Z]/.test(n) ? graph.get(n) : undefined
  }

  const emit = (prefix: string[], t: Type, onPath: Set<string>): void => {
    if (prefix.length >= MAX_PATH_SEGS) return
    onPath.add(t.name)
    for (const mem of membersOf(t)) {
      if (!/^[A-Z]/.test(mem.name)) continue // defensive: unexported member
      const path = [...prefix, mem.name]
      set.add(path.join('.'))
      if (mem.typeSig) {
        const next = resolve(mem.typeSig)
        if (next && !onPath.has(next.name)) emit(path, next, onPath)
      }
    }
    onPath.delete(t.name)
  }

  for (const t of graph.values()) {
    // Type-anchored paths: "Config.Retry.MaxRetries" (2- and 3-segment).
    emit([t.name], t, new Set())
    // Bare-anchored paths: "Retry.MaxRetries" — drop the owning type and walk
    // the field's own type. (The bare field name is already in the base set.)
    for (const f of t.fields ?? []) {
      const s = resolve(f.signature)
      if (s && /^[A-Z]/.test(f.name)) emit([f.name], s, new Set())
    }
  }
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

// OS-level API / syscall names referenced for cross-platform context (e.g.
// "Linux `mlock` / Windows `VirtualLock`", its paired unlock API
// `VirtualUnlock`, and Windows privilege names like `SeLockMemoryPrivilege`
// cited in memory-locking docs). These are not Go exports at all — they are
// platform C APIs and OS privilege constants — but PascalCase members like
// `VirtualLock` match the IDENT_RE pattern. Lowercase siblings (mlock,
// munlock, mmap) never trigger because they fail the [A-Z…] anchor. If a
// cybergodev export ever collides with one of these, drop it here so it is
// checked against source instead of being silently passed.
const OS_API_FUNCTIONS = new Set(['VirtualLock', 'VirtualUnlock', 'SeLockMemoryPrivilege'])

// Per-project whitelist of backticked identifiers docs legitimately use that
// are NOT cybergodev exports: stdlib members (net/http.Client/Transport
// fields, crypto/tls constants, x509/context errors, strings/encoding
// helpers), HTTP header names (Authorization), Windows registry values
// (ProxyEnable/ProxyServer) and Win32 APIs (GetFinalPathNameByHandleW),
// option-pattern teaching placeholders (WithXxx, XxxConfig; likewise the
// preset-constructor colloquialisms Default/Performance/Secure), and engine
// symbols the docs explicitly attribute to an internal package (httpc's
// OnResponse/SetContext/CloneHeader/SanitizeURL/ValidateSSRFHost — wording
// verified against source). Scoped PER PROJECT so a name harmless in one
// library's prose is still checked against every other project's source.
// Same deal as STDLIB_FIELDS above: if cybergodev ever exports one of these
// names, remove it here so its drift is checked against source again (until
// then the entry only suppresses the DANGLING flag — hasSourceMatch can never
// turn a whitelisted REAL export into a pass it didn't already earn).
const PROJECT_KNOWN_NOT_SYMBOLS: Record<string, Set<string>> = {
  httpc: new Set([
    'Append',
    'Authorization',
    'CheckRedirect',
    'Clean',
    'Cookie',
    'DeadlineExceeded',
    'Decode',
    'Default',
    'Deprecated',
    'DialContext',
    'Do',
    'ExpectContinueTimeout',
    'ForceAttemptHTTP2',
    'GetBody',
    'IsTemporary',
    'IsTimeout',
    'Location',
    'MinVersion',
    'MkdirAll',
    'Performance',
    'Proxy',
    'ProxyEnable',
    'ProxyServer',
    // HTTP request header name (Range requests for resumed downloads).
    'Range',
    'RenegotiateNever',
    'ResponseHeaderTimeout',
    'Secure',
    // crypto/tls.Config field (SecurityConfig.TLSConfig is *tls.Config), not ours.
    'SecurityConfig.TLSConfig.InsecureSkipVerify',
    'TLSClientConfig',
    'Transport.DialContext',
    'Transport.IdleConnTimeout',
    'Transport.Proxy',
    'Transport.ResponseHeaderTimeout',
    'Transport.TLSHandshakeTimeout',
    'TrimSpace',
    'Use',
    'WithXxx',
    'XxxConfig',
    // The five below are engine/validation symbols the docs explicitly mark
    // as belonging to an internal package — doc wording matches source truth.
    'OnResponse',
    'SetContext',
    'CloneHeader',
    'SanitizeURL',
    'ValidateSSRFHost'
  ]),
  jwt: new Set(['ParsePKCS8PrivateKey', 'ParsePKIXPublicKey', 'WaitGroup']),
  html: new Set([
    'CacheHit',
    'Get',
    'GetFinalPathNameByHandleW',
    'NoCache',
    'Put',
    'DefaultScorer',
    'Record',
    'WithContext'
  ]),
  dd: new Set(['CreatedAt', 'UserId']),
  env: new Set([
    // Types defined inside doc code blocks (custom-parser / testing guides),
    // not cybergodev exports. Keep this list minimal: an unused entry silently
    // masks a future dangling reference to a symbol of the same name.
    'INIParser',
    'MockFile',
    'TOMLParser'
  ])
  // json needs no whitelist.
}

function isLikelyNotSymbol(s: string): boolean {
  return (
    isAllCaps(s) ||
    STDLIB_INTERFACE_METHODS.has(s) ||
    STDLIB_FIELDS.has(s) ||
    OS_API_FUNCTIONS.has(s)
  )
}

// Docs sometimes qualify a member more deeply than the source symbol set
// records it: collectSymbols only emits one-segment names plus two-segment
// "Type.Field" / "Type.Method" shapes, while a doc may write
// `Config.Defaults.FollowRedirects`. Treat a dotted identifier as present
// when ANY dotted suffix of ≥2 segments hits the symbol set — tried longest
// first (`Config.Defaults.FollowRedirects`, then `Defaults.FollowRedirects`).
// Single-segment suffixes are deliberately NOT tried: matching any bare
// member name would let an unrelated qualifier silently pass a typo.
// Identifiers without a dot behave exactly as before.
function hasSourceMatch(ident: string, source: Set<string>): boolean {
  if (!ident.includes('.')) return source.has(ident)
  const segs = ident.split('.')
  for (let start = 0; start <= segs.length - 2; start++) {
    if (source.has(segs.slice(start).join('.'))) return true
  }
  return false
}

// Which DEPRECATED source symbols a doc identifier resolves to — the SAME
// suffix semantics as hasSourceMatch (bare = exact key, dotted = any ≥2-
// segment suffix, longest-first), so a doc ident that hits here by
// construction also has a source match (deprecated keys are a subset of the
// base symbol set) and can never be DANGLING. The whitelists are deliberately
// NOT consulted: they exist to keep non-export names out of DANGLING, and a
// deprecated-index hit means a REAL export with that name — exactly the case
// the whitelist comments say should be un-whitelisted and checked. Returns
// the canonical names of the matched deprecated symbols (e.g.
// "Processor.Validate" for a doc's bare `Validate`), empty when none.
function deprecatedSymbolsFor(ident: string, deprecated: Map<string, Set<string>>): string[] {
  const hit = new Set<string>()
  const tryKey = (key: string): void => {
    for (const d of deprecated.get(key) ?? []) hit.add(d)
  }
  if (!ident.includes('.')) tryKey(ident)
  else {
    const segs = ident.split('.')
    for (let start = 0; start <= segs.length - 2; start++) tryKey(segs.slice(start).join('.'))
  }
  return [...hit].sort()
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
  deprecatedRef: { ident: string; symbols: string[]; files: string[] }[]
}

async function auditProject(project: string): Promise<ProjectResult | null> {
  const jsonPath = runApiscan(project)
  if (!jsonPath) return null
  const manifest: Manifest = JSON.parse(await readFile(jsonPath, 'utf8'))
  // Defensive: older apiscan marshalled an empty scan as "packages": null.
  manifest.packages ??= []
  // The source exists (runApiscan skips otherwise), so 0 packages can only be
  // a tool/path fault — crash-or-pass are both wrong; fail loudly instead.
  if (manifest.packages.length === 0) {
    console.error(`audit-api: ${project}: manifest has 0 packages (${jsonPath}) — tool/path fault`)
    process.exit(1)
  }
  const source = collectSymbols(manifest)
  const docs = await collectDocIdents(project)

  const undocumented = [...source.base].filter((s) => !docs.has(s)).sort()
  const knownNotSymbol = PROJECT_KNOWN_NOT_SYMBOLS[project]
  const dangling: { ident: string; files: string[] }[] = []
  for (const [ident, files] of docs) {
    if (
      !hasSourceMatch(ident, source.all) &&
      !isLikelyNotSymbol(ident) &&
      !knownNotSymbol?.has(ident)
    ) {
      dangling.push({ ident, files: [...new Set(files)] })
    }
  }
  dangling.sort((a, b) => a.ident.localeCompare(b.ident))

  // Informational: which doc idents resolve to a deprecated source symbol.
  // Runs over every doc ident (not just non-dangling ones) — but as noted on
  // deprecatedSymbolsFor, a hit implies a source match, so no gating is
  // needed and whitelists stay out of the way.
  const deprecatedRef: { ident: string; symbols: string[]; files: string[] }[] = []
  for (const [ident, files] of docs) {
    const symbols = deprecatedSymbolsFor(ident, source.deprecated)
    if (symbols.length) deprecatedRef.push({ ident, symbols, files: [...new Set(files)] })
  }
  deprecatedRef.sort((a, b) => a.ident.localeCompare(b.ident))

  return {
    project,
    module: manifest.module,
    sourceCount: source.base.size,
    docCount: docs.size,
    undocumented,
    dangling,
    deprecatedRef
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
    '- **DEPRECATED-REFERENCED** = doc references a symbol the source marks `// Deprecated:` (informational — migration notes legitimately mention such symbols; each entry names the deprecated symbol matched, for human review).',
    ''
  ]

  let totalDangling = 0
  let totalDeprecatedRef = 0
  for (const r of results) {
    totalDangling += r.dangling.length
    totalDeprecatedRef += r.deprecatedRef.length
    lines.push(`## ${r.project} (\`${r.module}\`)`, '')
    lines.push(
      `Source: ${r.sourceCount} symbols · Docs reference: ${r.docCount} identifiers · ` +
        `Dangling: ${r.dangling.length} · Undocumented: ${r.undocumented.length} · ` +
        `Deprecated-referenced: ${r.deprecatedRef.length}`,
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
    if (r.deprecatedRef.length) {
      lines.push(
        `<details><summary>⚠️ DEPRECATED-REFERENCED (${r.deprecatedRef.length})</summary>`,
        ''
      )
      for (const d of r.deprecatedRef) {
        lines.push(
          `- \`${d.ident}\` — ${d.symbols.map((s) => `\`${s}\``).join(', ')} — ` +
            `${d.files.slice(0, 3).join(', ')}${d.files.length > 3 ? ', …' : ''}`
        )
      }
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
    `audit-api: wrote ${DRIFT_REPORT} (${results.length} projects, ${totalDangling} dangling, ` +
      `${totalDeprecatedRef} deprecated-referenced)`
  )
  if (totalDangling) process.exit(1)
}

await main()

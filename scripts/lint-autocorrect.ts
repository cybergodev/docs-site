/**
 * lint-autocorrect.ts — local autocorrect gate (CJK typography).
 *
 * Engine selection — CLI first, WASM fallback (lint and --fix share it):
 *   1. $AUTOCORRECT_CLI   explicit binary path (invalid value: warn, resolve on)
 *   2. conventional path  D:/MyProject/tools/autocorrect-cli/autocorrect(.exe),
 *                         where `npm run setup:autocorrect` installs the pin
 *   3. `autocorrect` on PATH
 *   4. WASM fallback      devDep @huacnlee/autocorrect — weaker than the CLI:
 *                         it skips codeblock & inline-code content and does no
 *                         spellcheck. That gap let files CI flags pass locally
 *                         once (2026-10-27: Go comments inside ```go blocks),
 *                         so the CLI is the real gate; the WASM path is only a
 *                         degraded fallback and says so on every run.
 *
 * Why CLI parity matters: CI's lint job (.github/workflows/ci.yml) runs the
 * pinned release binary `autocorrect ./ --lint` from the repo root. With a CLI
 * resolved, this script runs the exact same command (same cwd, same scope,
 * config/ignore files read by the binary itself), so a green local run equals
 * a green CI run. The CLI's version is checked against PINNED_AUTOCORRECT_VERSION
 * (scripts/_lib/autocorrect.ts): a mismatch warns loudly — verdicts may diverge —
 * but still uses the CLI (stronger than the WASM fallback either way).
 *
 * Usage:
 *   npm run lint:autocorrect            # check only, non-zero exit on findings
 *   npm run fix:autocorrect             # rewrite files in place (--fix)
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ignore from 'ignore'
import { loadConfig, lintFor, formatFor } from '@huacnlee/autocorrect'
import {
  PINNED_AUTOCORRECT_VERSION,
  conventionalCliPath,
  probeCliVersion
} from './_lib/autocorrect'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const fix = process.argv.includes('--fix')

// ---------------------------------------------------------------------------
// CLI engine resolution
// ---------------------------------------------------------------------------

interface CliEngine {
  /** What to spawn. */
  cmd: string
  /** What to print as the engine's provenance. */
  desc: string
  /** Version reported by `--version` (null = ran but unparseable). */
  version: string | null
}

function probeCli(cmd: string, desc: string): CliEngine | null {
  const version = probeCliVersion(cmd)
  if (version === undefined) return null
  return { cmd, desc, version }
}

function resolveCli(): CliEngine | null {
  // 1. Explicit override — a bad value warns and resolution continues.
  const envCli = process.env.AUTOCORRECT_CLI
  if (envCli) {
    const probed = probeCli(envCli, envCli)
    if (probed) return probed
    console.warn(
      `autocorrect: AUTOCORRECT_CLI=${envCli} is not a runnable autocorrect binary — ignoring it and resolving further`
    )
  }

  // 2. Conventional install path (where setup:autocorrect puts the pin).
  const conventional = conventionalCliPath()
  if (existsSync(conventional)) {
    const probed = probeCli(conventional, conventional)
    if (probed) return probed
    console.warn(`autocorrect: ${conventional} exists but fails to run (--version) — ignoring it`)
  }

  // 3. PATH (probe the .exe form too on Windows: spawn does no PATHEXT lookup).
  const pathNames =
    process.platform === 'win32' ? ['autocorrect.exe', 'autocorrect'] : ['autocorrect']
  for (const name of pathNames) {
    const probed = probeCli(name, `${name} (on PATH)`)
    if (probed) return probed
  }
  return null
}

function warnVersionMismatch(engine: CliEngine): void {
  const found = engine.version ?? 'unknown'
  console.warn(
    `autocorrect: WARNING — CLI version ${found} does not match the pinned ${PINNED_AUTOCORRECT_VERSION}.`
  )
  console.warn(
    '  CI (.github/workflows/ci.yml lint job) runs the pinned binary, so verdicts may diverge.'
  )
  console.warn('  Fix by either:')
  console.warn('    npm run setup:autocorrect')
  console.warn('      -> reinstall the pinned binary at the conventional path')
  console.warn('    bump the pin: scripts/_lib/autocorrect.ts + the version and sha256')
  console.warn('      in .github/workflows/ci.yml (three places must move together)')
  console.warn('  Continuing with this CLI anyway — still stronger than the WASM fallback.')
}

const cli = resolveCli()
if (cli) {
  if (cli.version !== PINNED_AUTOCORRECT_VERSION) warnVersionMismatch(cli)
  console.log(`autocorrect: using CLI ${cli.version ?? 'unknown'} (${cli.desc})`)
  // Byte-identical to CI's lint job: repo-root cwd + `./` scope; the binary
  // picks up .autocorrectrc / .autocorrectignore itself.
  const r = spawnSync(cli.cmd, ['./', fix ? '--fix' : '--lint'], {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: true
  })
  if (r.error) {
    console.error(`autocorrect: failed to run CLI (${cli.desc}): ${r.error.message}`)
    process.exit(1)
  }
  // Propagate the CLI's exit code (lint: non-zero on any finding; fix: 0).
  process.exit(r.status ?? 1)
}

console.log(
  'autocorrect: CLI not found — falling back to WASM (weaker: skips codeblock & inline code & spellcheck)'
)

// ---------------------------------------------------------------------------
// WASM fallback — devDep-engine scan (degraded mode; see header). Behavior is
// kept from the original WASM-only gate.
// ---------------------------------------------------------------------------

// Load config first — lintFor/formatFor consult the engine's global config
// state, so every later call honors .autocorrectrc (spellcheck words etc.).
const config = loadConfig(await readFile(join(ROOT, '.autocorrectrc'), 'utf8')) as {
  fileTypes: Record<string, string>
}
const fileTypes = config.fileTypes

// Same ignore list the CLI's Ignorer would read. `ignore` implements the
// gitignore matching the Rust `ignore` crate uses, so path semantics line up.
const ig = ignore().add(await readFile(join(ROOT, '.autocorrectignore'), 'utf8'))

// A file is scanned when its basename (extensionless known names: Gemfile,
// Rakefile…) or lowercase extension is a key of the engine's fileTypes table.
function isScanTarget(file: string): boolean {
  const base = basename(file)
  if (fileTypes[base]) return true
  const dot = base.lastIndexOf('.')
  if (dot < 0) return false
  return Boolean(fileTypes[base.slice(dot).toLowerCase()])
}

// POSIX-style relative path — the ignore matcher expects forward slashes.
const relPosix = (full: string): string => relative(ROOT, full).split(sep).join('/')

async function walk(dir: string, out: string[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      // Trailing slash: gitignore dir rules ("node_modules/") only match a
      // directory when tested with one, and pruning here keeps the walk out
      // of huge trees entirely.
      if (ig.ignores(relPosix(full) + '/')) continue
      await walk(full, out)
    } else if (!ig.ignores(relPosix(full))) {
      out.push(full)
    }
  }
}

const files: string[] = []
await walk(ROOT, files)

interface LineFinding {
  l: number
  c: number
  old: string
  new: string
  severity: number
}

let errorCount = 0
let warningCount = 0
let changedFiles = 0
const report: string[] = []

for (const file of files.sort()) {
  if (!isScanTarget(file)) continue
  const rel = relPosix(file)
  const content = await readFile(file, 'utf8')

  if (!fix) {
    const res = lintFor(content, rel) as { lines?: LineFinding[]; error?: string }
    if (res.error) {
      console.error(`autocorrect: ${rel}: engine error: ${res.error}`)
      process.exit(1)
    }
    const findings = (res.lines ?? []).filter((ln) => ln.old !== ln.new)
    if (!findings.length) continue
    for (const ln of findings) {
      if (ln.severity === 1) {
        errorCount++
        report.push(`${rel}:${ln.l}:${ln.c}  ${ln.old}  →  ${ln.new}`)
      } else {
        warningCount++
        report.push(`${rel}:${ln.l}:${ln.c}  (warn)  ${ln.old}  →  ${ln.new}`)
      }
    }
  } else {
    const res = formatFor(content, rel) as { out: string; error?: string }
    if (res.error) {
      console.error(`autocorrect: ${rel}: engine error: ${res.error}`)
      process.exit(1)
    }
    if (res.out !== content) {
      await writeFile(file, res.out, 'utf8')
      changedFiles++
      console.log(`fixed: ${rel}`)
    }
  }
}

if (fix) {
  console.log(`autocorrect: ${changedFiles} file(s) rewritten. Re-run lint to verify.`)
  process.exit(0)
}

for (const line of report) console.log(line)
console.log(
  `autocorrect: ${files.length} candidate file(s) scanned · ${errorCount} error(s), ${warningCount} warning(s)`
)
if (errorCount > 0) process.exit(1)

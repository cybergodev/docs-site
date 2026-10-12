/**
 * lint-autocorrect.ts — local autocorrect gate (CJK typography) backed by the
 * official WASM build of autocorrect (@huacnlee/autocorrect).
 *
 * Why a wrapper script: the npm package is a wasm-pack library, NOT a CLI —
 * node_modules/.bin gets no `autocorrect` binary. CI runs the docker action
 * (huacnlee/autocorrect-action) with the same Rust engine and the same
 * config files, so wiring `npm run lint:autocorrect` to this script keeps
 * local and CI gates on one engine without a system-level install.
 *
 * Fidelity notes (matching the CLI's behavior):
 *   - config: .autocorrectrc is fed to loadConfig(); its returned fileTypes
 *     table doubles as the extension whitelist — unknown extensions are
 *     skipped, exactly like the CLI's walk.
 *   - ignore: the wasm build cannot read .autocorrectignore from disk (wasm
 *     has no fs — its Ignorer always answers false), so gitignore semantics
 *     are replicated here with the `ignore` package.
 *   - exit code: non-zero iff any severity-1 (Error) finding exists, mirroring
 *     `autocorrect --lint`.
 *
 * Usage:
 *   npm run lint:autocorrect            # check only, exit 1 on any error
 *   npm run fix:autocorrect             # rewrite files in place (--fix)
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ignore from 'ignore'
import { loadConfig, lintFor, formatFor } from '@huacnlee/autocorrect'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const fix = process.argv.includes('--fix')

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

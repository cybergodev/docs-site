/**
 * check-code-samples.ts — Go 代码示例编译校验（路线图 #1）
 *
 * 规范要求每个 go 代码示例是完整可编译的 `package main`
 * 程序，但此前无任何机制校验——错字、签名漂移、缺 import 只能靠肉眼。本脚本
 * 把文档承诺落到 CI gate 上：提取所有 ```go 代码块，把完整块写入临时 Go 模块
 * 的**独立子目录**（每块一目录，避免多个 package main 同目录冲突），跑一次
 * `go build ./...` + `gofmt -l`，把编译错误回贴为「相对路径#块序号」+ go 原文。
 *
 * 块分类（决定是否参与编译）：
 *   - exempt        命中豁免标记（见下）→ INFO 跳过，最高优先级，覆盖其余分类
 *   - fragment      无 `package <name>` 声明 → INFO 跳过（典型 API 签名片段）
 *   - test          `package <name>_test` → INFO 跳过（_test 后缀要求 _test.go
 *                   上下文，单文件无法独立编译）
 *   - missing-source 引用了源码根缺失的 cybergodev 库 → INFO 跳过（同 audit-api.ts
 *                   「源码缺失跳过该源」策略，打印提示）
 *   - build         其余完整块 → 写入临时模块，go build 校验
 *
 * 豁免机制（与内容团队约定的两种合法出口，给「渐进式披露」「多包演示」等教学法
 * 块——类型在别块定义 / 不同 package——一个不计错误的合法逃逸路径）：
 *   - 页级豁免：frontmatter `check_code: false` → 该页**所有** go 块计为 exempt。
 *     复用 `docs/.vitepress/utils/frontmatter.ts` 的 extractFrontmatter/parseFmField，
 *     值经去引号后字符串比较为 'false' 即生效（true/缺省/其他值均不豁免）。
 *   - 块级豁免：go fence 紧前一行（允许中间夹空白行）的 HTML 注释
 *     `<!-- check-code: skip -->`（精确匹配，大小写敏感，trim 后比较）→ 仅该块
 *     计为 exempt。在 extractGoBlocks 内：从 fence 行向上跳过空白行，检查最近的
 *     非空行 trim 后是否等于标记字符串。
 *
 * 退出码：编译错误 → 1（CI gate）；豁免块绝不计为错误；gofmt 仅警告，不影响退出码；
 * 无错误 → 0。
 *
 * 依赖：Go 工具链（go 1.25）+ 6 个 cybergodev 源码 repo（位于
 * CYBERGO_SOURCE_ROOT/{project}-dev，同 audit-api.ts 约定）。
 * 本地：`npm run check:code`（默认 zh；CLI 参数指定 lang 或 `--all` 全 5 语言）。
 * CI：ci.yml 的 `check-code-samples` job（6 源码 checkout + setup-go 1.25）。
 *
 * 与 audit-api.ts 的关系：audit-api 比对源码导出符号 vs 文档引用，查的是「文档
 * 提到了源码里不存在的东西」；本脚本查的是「文档里的示例代码本身能不能编译」。
 * 互补，不重叠。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROJECTS, PRIMARY_LANG, LANGS, type Lang } from '../docs/.vitepress/shared'
import { extractFrontmatter, parseFmField } from '../docs/.vitepress/utils/frontmatter'
import { collectMd } from './_lib/walk'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

// Root holding the {project}-dev source repos. Override with CYBERGO_SOURCE_ROOT
// (CI: ${{ github.workspace }}/src). Same convention as audit-api.ts.
const SOURCE_ROOT = process.env.CYBERGO_SOURCE_ROOT || 'D:/MyProject'

// Temp module name (used in go.mod); subdir naming uses b{NNNN} so a 4-digit
// zero-padded ordinal lexically sorts and is easy to grep in go's `# <pkg>`
// output (e.g. `codecheck/b0042`).
const MODULE_NAME = 'codecheck'

// --- CLI ------------------------------------------------------------------

interface CliArgs {
  langs: Lang[]
}

function parseArgs(argv: string[]): CliArgs {
  const rest = argv.slice(2) // drop `node` + script path
  if (rest.length === 0) return { langs: [PRIMARY_LANG] }
  if (rest[0] === '--all') return { langs: [...LANGS] }
  const lang = rest[0] as Lang
  if (!(LANGS as readonly string[]).includes(lang)) {
    console.error(`check-code: unknown lang "${rest[0]}". Valid: ${LANGS.join(', ')} or --all.`)
    process.exit(2)
  }
  return { langs: [lang] }
}

// --- Go block extraction --------------------------------------------------

interface GoBlock {
  /** 0-indexed ordinal of the go fence within the source .md (across all go fences). */
  index: number
  /** 1-indexed line of the opening ```go fence in the source .md. */
  fenceLine: number
  code: string
  /** Block-level exemption marker `<!-- check-code: skip -->` found on the nearest
   *  non-blank line above the fence (computed in extractGoBlocks). */
  exempt: boolean
}

// Verified against docs/** (1731+ files): every go fence is exactly ```go at
// column 0, no attrs, no indentation. Closing fence is exactly ``` at column 0.
// Keeping the match strict avoids swallowing indented code blocks (4+ spaces,
// which CommonMark treats as plain preformatted text) or info-string attrs like
// `go{.highlight}` — those we leave for a future generalization to handle.
const OPEN_FENCE = '```go'
const CLOSE_FENCE = '```'

// Block-level exemption marker. Must sit on the nearest non-blank line above
// the ```go fence (blank lines in between are allowed). Matched by exact string
// equality after trim() — case-sensitive, no extra internal whitespace, no
// trailing content. Authors opt in by writing this comment literally.
const SKIP_MARKER = '<!-- check-code: skip -->'

function extractGoBlocks(content: string): GoBlock[] {
  const lines = content.split(/\r?\n/)
  const blocks: GoBlock[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i] === OPEN_FENCE) {
      const fenceLine = i + 1 // 1-indexed for human-readable report
      // Block-level exemption: walk upward from the fence, skipping blank lines,
      // and check whether the nearest non-blank line is exactly the skip marker.
      // A blank line is an empty or whitespace-only line. If we hit the start of
      // the file (e.g. fence on line 1) without finding a non-blank line, the
      // block is not exempt.
      let j = i - 1
      while (j >= 0 && lines[j].trim() === '') j--
      const exempt = j >= 0 && lines[j].trim() === SKIP_MARKER
      const codeLines: string[] = []
      i++
      while (i < lines.length && lines[i] !== CLOSE_FENCE) {
        codeLines.push(lines[i])
        i++
      }
      // If we ran past EOF without a close fence, the block still gets recorded
      // (typically classified as fragment — no package decl) rather than
      // silently dropped.
      blocks.push({ index: blocks.length, fenceLine, code: codeLines.join('\n'), exempt })
    }
    i++
  }
  return blocks
}

// `package <name>` starting a line. Go permits leading whitespace (gofmt
// normalizes to column 0); the package name is an identifier.
const PKG_RE = /^[ \t]*package[ \t]+([A-Za-z_]\w*)[ \t]*$/m

// Any `"github.com/cybergodev/<name>"` import path. Captures just the project
// segment (`json` from `github.com/cybergodev/json` or `.../json/sub`).
const CYBER_IMPORT_RE = /"github\.com\/cybergodev\/([A-Za-z_]\w*)"/g

type BlockKind = 'fragment' | 'test' | 'missing-source' | 'build' | 'exempt'

interface ClassifiedBlock extends GoBlock {
  /** Absolute path of the source .md file the block came from. */
  file: string
  kind: BlockKind
  pkgName?: string
  /** Projects imported by this block whose source is unavailable (kind=missing-source). */
  missingProjects?: string[]
}

function classifyBlock(
  block: GoBlock,
  file: string,
  availableProjects: Set<string>,
  pageExempt: boolean
): ClassifiedBlock {
  // Exemption has top priority and short-circuits all other classification:
  // an exempt block is exempt whether it would otherwise be a fragment, test
  // package, missing-source, or build candidate. Page-level (`check_code: false`
  // in frontmatter) exempts every block on the page; block-level (the
  // `<!-- check-code: skip -->` marker detected in extractGoBlocks) exempts
  // just this one. Exempt blocks never reach go build and never count as errors.
  if (pageExempt || block.exempt) {
    return { ...block, file, kind: 'exempt' }
  }
  const pkgMatch = block.code.match(PKG_RE)
  if (!pkgMatch) return { ...block, file, kind: 'fragment' }
  const pkgName = pkgMatch[1]
  // `package foo_test` is an external test package — only legal inside *_test.go
  // and requires the `foo` package under test to exist. We can't synthesize that
  // context for a single fence, so skip.
  if (pkgName.endsWith('_test')) {
    return { ...block, file, kind: 'test', pkgName }
  }
  const imported = new Set<string>()
  for (const m of block.code.matchAll(CYBER_IMPORT_RE)) imported.add(m[1])
  const missing: string[] = []
  for (const p of imported) {
    // Only flag known cybergodev projects; stray imports of unknown paths are
    // left for the compiler to validate.
    if ((PROJECTS as readonly string[]).includes(p) && !availableProjects.has(p)) {
      missing.push(p)
    }
  }
  if (missing.length) {
    return { ...block, file, kind: 'missing-source', pkgName, missingProjects: missing }
  }
  return { ...block, file, kind: 'build', pkgName }
}

// --- go tooling wrappers --------------------------------------------------

function goAvailable(): boolean {
  const r = spawnSync('go', ['version'], { encoding: 'utf8', windowsHide: true })
  return r.status === 0
}

/** Format a subdir name from a 0-indexed block ordinal: 0 → "b0001". */
function subdirOf(index0: number): string {
  return `b${String(index0 + 1).padStart(4, '0')}`
}

/**
 * Parse `go build ./...` stderr into Map<block ordinal 0-indexed, error lines[]>.
 *
 * Go emits one `# <pkg-path>` line per failing package, followed by indented
 * `<file>:<line>:<col>: <msg>` errors until the next `#` marker. The pkg path
 * is the import path (e.g. `codecheck/b0042`); we strip everything except the
 * `b\d{4}` subdir tag so we can map back to a block ordinal.
 */
function parseBuildOutput(output: string): Map<number, string[]> {
  const errors = new Map<number, string[]>()
  let current: number | null = null
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(/^#\s+(.+)$/)
    if (m) {
      const sub = m[1].match(/\bb(\d{4})\b/)
      // Convert 1-indexed subdir suffix back to 0-indexed block ordinal.
      current = sub ? parseInt(sub[1], 10) - 1 : null
      if (current !== null && !errors.has(current)) errors.set(current, [])
      continue
    }
    if (current !== null && line.trim()) {
      errors.get(current)!.push(line)
    }
  }
  return errors
}

interface RunResult {
  /** Per-block compile errors (0-indexed block ordinal → error lines). */
  errors: Map<number, string[]>
  /** 0-indexed block ordinals whose file needs `gofmt -w`. */
  gofmtIssues: Set<number>
}

function runGo(moduleDir: string): RunResult {
  // Build all sample packages at once; Go parallelizes across packages and
  // reports per-package errors independently. GOFLAGS=-mod=mod lets go add
  // transitive deps (e.g. golang.org/x/text pulled in by json-dev) to go.sum
  // automatically — required because the temp module starts with no go.sum.
  const build = spawnSync('go', ['build', './...'], {
    cwd: moduleDir,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, GOFLAGS: '-mod=mod' }
  })
  const errors = parseBuildOutput((build.stderr || '') + (build.stdout || ''))

  // gofmt -l lists filenames whose formatting differs from gofmt's output.
  // Treated as warning only (does not affect exit code).
  const fmt = spawnSync('gofmt', ['-l', '.'], {
    cwd: moduleDir,
    encoding: 'utf8',
    windowsHide: true
  })
  const gofmtIssues = new Set<number>()
  const fmtOut = (fmt.stdout || '') + (fmt.stderr || '')
  for (const line of fmtOut.split(/\r?\n/)) {
    const m = line.trim().match(/\bb(\d{4})\b/)
    if (m) gofmtIssues.add(parseInt(m[1], 10) - 1)
  }
  return { errors, gofmtIssues }
}

// --- main -----------------------------------------------------------------

async function main(): Promise<void> {
  const { langs } = parseArgs(process.argv)

  if (!goAvailable()) {
    console.error('check-code: go toolchain not found on PATH. Install Go 1.25+.')
    process.exit(1)
  }

  // Resolve cybergodev source availability up front (audit-api.ts convention:
  // a missing source is skipped, not failed — the CI checkout step turns red
  // instead of the audit silently passing).
  const availableProjects = new Set<string>()
  for (const p of PROJECTS) {
    const path = join(SOURCE_ROOT, `${p}-dev`)
    if (existsSync(path)) {
      availableProjects.add(p)
    } else {
      console.warn(
        `check-code: source for "${p}" missing at ${path} — samples using it will be skipped.`
      )
    }
  }

  // ---- collect & classify blocks across requested languages ----
  const counts = {
    files: 0,
    blocks: 0,
    fragment: 0,
    test: 0,
    missingSource: 0,
    build: 0,
    exempt: 0
  }
  const buildBlocks: ClassifiedBlock[] = []
  for (const lang of langs) {
    const langDir = join(REPO_ROOT, 'docs', lang)
    const files = await collectMd(langDir)
    counts.files += files.length
    for (const f of files) {
      const content = await readFile(f, 'utf8')
      // Page-level exemption: `check_code: false` in frontmatter exempts every
      // go block on the page. parseFmField strips one matched pair of quotes, so
      // both `check_code: false` and `check_code: "false"` resolve to the string
      // 'false'. Any other value (true, missing, typos) leaves the page checked.
      const fm = extractFrontmatter(content)
      const pageExempt = parseFmField(fm, 'check_code') === 'false'
      for (const b of extractGoBlocks(content)) {
        counts.blocks++
        const cls = classifyBlock(b, f, availableProjects, pageExempt)
        if (cls.kind === 'build') {
          buildBlocks.push(cls)
          counts.build++
        } else if (cls.kind === 'fragment') counts.fragment++
        else if (cls.kind === 'test') counts.test++
        else if (cls.kind === 'missing-source') counts.missingSource++
        else if (cls.kind === 'exempt') counts.exempt++
      }
    }
  }

  console.log(
    `check-code: ${counts.files} files (${langs.join(', ')}) · ${counts.blocks} go blocks · ` +
      `${counts.build} buildable, ${counts.exempt} exempt, ${counts.fragment} fragments, ` +
      `${counts.test} test-pkg, ${counts.missingSource} missing-source.`
  )
  if (counts.exempt > 0) {
    console.log(`check-code: ${counts.exempt} block(s) exempted (page-level or per-block).`)
  }

  if (buildBlocks.length === 0) {
    console.log('check-code: nothing to build. ok.')
    return
  }

  // ---- set up temp Go module ----
  const tmpRoot = await mkdtemp(join(tmpdir(), 'cybergo-check-code-'))
  try {
    // go.mod: require all 6 (harmless if unused — Go only fetches what's
    // imported); replace only available sources (missing ones are skipped at
    // classify time, so no sample imports them).
    const requireLines = PROJECTS.map((p) => `\tgithub.com/cybergodev/${p} v0.0.0`)
    const replaceLines: string[] = []
    for (const p of PROJECTS) {
      if (availableProjects.has(p)) {
        replaceLines.push(`\tgithub.com/cybergodev/${p} => ${join(SOURCE_ROOT, `${p}-dev`)}`)
      }
    }
    const goMod = [
      `module ${MODULE_NAME}`,
      '',
      'go 1.25',
      '',
      'require (',
      ...requireLines,
      ')',
      '',
      'replace (',
      ...replaceLines,
      ')',
      ''
    ].join('\n')
    await writeFile(join(tmpRoot, 'go.mod'), goMod, 'utf8')

    for (let i = 0; i < buildBlocks.length; i++) {
      const dir = join(tmpRoot, subdirOf(i))
      await mkdir(dir, { recursive: true })
      // Ensure trailing newline — Go/gofmt complain otherwise.
      const code = buildBlocks[i].code.endsWith('\n')
        ? buildBlocks[i].code
        : buildBlocks[i].code + '\n'
      await writeFile(join(dir, 'main.go'), code, 'utf8')
    }

    // ---- go build + gofmt ----
    const { errors, gofmtIssues } = runGo(tmpRoot)

    // ---- report ----
    const relOf = (abs: string): string => relative(REPO_ROOT, abs).replace(/\\/g, '/')

    if (errors.size > 0) {
      console.error(`\n❌ ${errors.size} block(s) failed to compile:`)
      for (const i of sortBlockIndices(errors.keys(), buildBlocks)) {
        const b = buildBlocks[i]
        console.error(
          `\n  ${relOf(b.file)}#${b.index + 1}  (line ${b.fenceLine}, package ${b.pkgName})`
        )
        for (const e of errors.get(i)!) console.error(`    ${e}`)
      }
    }

    if (gofmtIssues.size > 0) {
      console.warn(`\n⚠️  ${gofmtIssues.size} block(s) need gofmt (warning only):`)
      for (const i of sortBlockIndices(gofmtIssues, buildBlocks)) {
        const b = buildBlocks[i]
        console.warn(`  ${relOf(b.file)}#${b.index + 1}  (line ${b.fenceLine})`)
      }
    }

    if (errors.size === 0) {
      console.log(`\n✓ all ${buildBlocks.length} sample(s) compiled cleanly.`)
    } else {
      // process.exit() would skip the `finally` cleanup below (Node terminates
      // immediately without unwinding the stack). Set exitCode instead so the
      // function returns naturally and tmpRoot is removed before exit.
      process.exitCode = 1
    }
  } finally {
    await rm(tmpRoot, { recursive: true, force: true })
  }
}

/** Sort block ordinals by source file then in-file fence order, for stable output. */
function sortBlockIndices(indices: Iterable<number>, buildBlocks: ClassifiedBlock[]): number[] {
  return [...indices].sort((a, b) => {
    const fa = buildBlocks[a].file
    const fb = buildBlocks[b].file
    return fa === fb ? buildBlocks[a].index - buildBlocks[b].index : fa.localeCompare(fb)
  })
}

await main()

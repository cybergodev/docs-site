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
 * Additionally audits internal-link *form* on every project page
 * (docs/{lang}/{project}/**): a link to another page of the SAME project must
 * be relative (./x#anchor, ../y) — the absolute /{lang}/{project}/ prefix
 * form is an error. Cross-project links (/zh/json/ from a jwt page)
 * legitimately use the absolute form and are skipped. A same-project absolute
 * link whose language prefix doesn't match the file's own language is reported
 * as a cross-language violation (language isolation). Fenced code blocks and
 * inline code spans are masked before scanning — Go signatures like
 * `GetSlice[T](...)` inside backticks otherwise trip the link regex (both were
 * real false-positive sources when this rule was first drafted).
 *
 * Additionally audits every content page (docs/{lang}/** plus the root mirror
 * docs/index.md) for a bare `{{` outside fenced code blocks. VitePress
 * v-pre-protects fenced blocks on its own, but `{{` in inline code or body
 * text is compiled as a Vue interpolation — and Go composite literals like
 * `[]http.Cookie{{...}}` are not valid JS expressions, so vite:vue kills the
 * whole build with "Error parsing JavaScript expression" (the httpc
 * migration.md incident this rule front-runs from build time to audit time).
 * `{{` inside a v-pre element (`<code v-pre>…</code>`) is the sanctioned
 * escape and is exempt; docs/404.md renders Vue interpolation on purpose via
 * its own <script setup> and is excluded from the scan.
 *
 * Additionally audits every content page for internal dead links — the class
 * of failure VitePress only reports at `vitepress build` time, which AI
 * sessions never run (the html `processor.md` incident: `../../faq` without a
 * trailing slash killed a build because `faq.md` doesn't exist while
 * `faq/index.md` does — VitePress resolves `X` to the page key `X` and `X/`
 * to `X/index`, page keys keeping the `index` segment). Target-page
 * resolution mirrors the build-time checker statement for statement:
 * query/fragment and trailing `.md`/`.html` suffixes are stripped, a trailing
 * `/` selects the directory-index page, absolute paths resolve against docs/
 * and relative ones against the page's own directory, external URLs and known
 * asset extensions (.png …) are skipped. Anchors go one step further than the
 * build ever does: a fragment must match a heading slug of the target page,
 * computed with the site's own slugifyHeading (via config/markdown.ts) so
 * audit verdicts and rendered ids cannot drift.
 *
 * TODO (out of scope here): cross-check Go API signatures in api-reference pages
 * against the source in {project}-dev via go/ast — parity of *content*, not just
 * page existence. That needs a Go parser and is tracked separately.
 */
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join, posix, relative } from 'path'
import { LANGS, PRIMARY_LANG, PROJECTS } from '../docs/.vitepress/shared'
import { markdownConfig } from '../docs/.vitepress/config/markdown'
import { collectMd } from './_lib/walk'

const DOCS_ROOT = 'docs'
const REPORT_DIR = 'report'
const REPORT_FILE = join(REPORT_DIR, 'locale-parity.md')

/** Collect every page under docs/{lang}/ as a normalized logical path. */
async function collectPages(langDir: string): Promise<Set<string>> {
  // collectMd returns [] for a missing dir (e.g. a language tree not yet
  // created), which is exactly the "no pages" semantics this needs.
  const files = await collectMd(langDir)
  return new Set(files.map((f) => normalize(relative(langDir, f))))
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

// ---------------------------------------------------------------------------
// Internal-link form audit (per project tree)
// ---------------------------------------------------------------------------

/** Markdown inline link URL (images excluded via the `(?<!!)` guard). */
const LINK_URL_RE = /(?<!!)\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g
/** `/{lang}/{rest}` — only lang-prefixed absolute paths are in scope. */
const ABS_LANG_PATH_RE = new RegExp(`^\\/(${LANGS.join('|')})\\/([^/?#]*)`)

interface LinkViolation {
  /** Repo-relative posix path of the offending page, e.g. `zh/env/guides/testing.md`. */
  file: string
  line: number
  url: string
  reason: string
}

/** Blank a line out with spaces, keeping its length (line/column stay meaningful). */
function blankLine(line: string): string {
  return ' '.repeat(line.length)
}

/** Toggle for `maskCode`: whether inline code spans are blanked as well. */
interface MaskCodeOptions {
  /**
   * Also blank inline code spans (default). The interpolation audit opts out:
   * inline code is exactly where an unescaped `{{` gets compiled as a Vue
   * expression, so those spans must stay visible to that scan — only fenced
   * blocks (which VitePress v-pre-protects on its own) are hidden from it.
   */
  maskInline?: boolean
}

/**
 * Mask fenced code blocks (whole lines) and inline code spans so link
 * extraction never sees markdown that renders as code. Line structure is
 * preserved, so reported line numbers match the source file.
 */
function maskCode(text: string, opts: MaskCodeOptions = {}): string {
  const { maskInline = true } = opts
  const lines = text.split('\n')
  let fence: { ch: string; len: number } | null = null
  return lines
    .map((line) => {
      const m = line.match(/^\s*(`{3,}|~{3,})/)
      if (m) {
        const marker = m[1]
        const ch = marker[0]
        const len = marker.length
        if (!fence) fence = { ch, len }
        else if (fence.ch === ch && len >= fence.len) fence = null
        return blankLine(line)
      }
      if (fence) return blankLine(line)
      return maskInline ? line.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length)) : line
    })
    .join('\n')
}

/**
 * Every internal link of the form /{lang}/{project}/... pointing back into the
 * project the page itself belongs to is a violation: same-language prefix means
 * the absolute-prefix form was used where a relative path is required; a
 * mismatched prefix is additionally a cross-language (isolation) violation.
 */
async function auditLinkForms(): Promise<LinkViolation[]> {
  const violations: LinkViolation[] = []
  for (const lang of LANGS) {
    for (const project of PROJECTS) {
      const dir = join(DOCS_ROOT, lang, project)
      for (const file of await collectMd(dir)) {
        const rel = relative(DOCS_ROOT, file).replace(/\\/g, '/')
        const masked = maskCode(await readFile(file, 'utf8')).split('\n')
        masked.forEach((line, i) => {
          for (const m of line.matchAll(LINK_URL_RE)) {
            const url = m[1].replace(/^<|>$/g, '')
            if (/^(https?:|mailto:|data:|#)/i.test(url)) continue
            const am = url.match(ABS_LANG_PATH_RE)
            if (!am) continue // relative form (the required one) or non-lang absolute path
            const linkLang = am[1]
            const target = am[2] ?? ''
            if (!(PROJECTS as readonly string[]).includes(target)) continue // /{lang}/about, /{lang}/ …
            if (target !== project) continue // cross-project absolute link — allowed
            violations.push({
              file: rel,
              line: i + 1,
              url,
              reason:
                linkLang !== lang
                  ? `跨语言内链：文件为 ${lang}，链接前缀为 /${linkLang}/`
                  : '项目内互链使用了绝对前缀，应为相对路径'
            })
          }
        })
      }
    }
  }
  return violations
}

// ---------------------------------------------------------------------------
// Vue interpolation audit (unescaped `{{` in inline code / body text)
// ---------------------------------------------------------------------------

/**
 * An HTML element carrying `v-pre` (e.g. `<code v-pre>…</code>`) opts its
 * contents out of Vue compilation — that is the escape hatch this audit
 * recommends, so such spans are blanked before scanning instead of flagged.
 * Line-scoped on purpose: the content convention is a single-line span
 * (typically inside a table cell).
 */
const VPRE_SPAN_RE = /<(\w+)[^>]*\bv-pre\b[^>]*>.*?<\/\1>/g

/**
 * Root-level pages deliberately built on Vue interpolation backed by their own
 * `<script setup>` — legitimate VitePress usage, unlike content pages. The
 * scans below only walk docs/{lang}/** plus the root mirror docs/index.md, so
 * these are out by construction; listed explicitly so a future widening of
 * the scope can't silently drag them back in. The dead-link audit shares this
 * exemption: 404.md is a Vue page whose hrefs never go through markdown
 * rendering, so they are not auditable as markdown links.
 */
const INTERP_EXEMPT_PAGES = new Set(['404.md'])

/**
 * Scan scope shared by the interpolation and dead-link audits: every content
 * page of every language tree plus the root mirror docs/index.md.
 */
async function collectContentPages(): Promise<string[]> {
  const files = [join(DOCS_ROOT, 'index.md')] // root mirror of the primary-language home
  for (const lang of LANGS) files.push(...(await collectMd(join(DOCS_ROOT, lang))))
  return files
}

interface InterpViolation {
  /** Repo-relative posix path of the offending page, e.g. `en/httpc/guides/migration.md`. */
  file: string
  line: number
  /** Whitespace-collapsed excerpt of the raw source line, for the report. */
  snippet: string
}

/** Collapse whitespace and cap the length of a raw source line for the report. */
function summarize(line: string, max = 100): string {
  const s = line.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/**
 * A `{{` that survives fence masking sits in inline code or body text, where
 * VitePress compiles it as a Vue interpolation; Go composite literals such as
 * `` `[]http.Cookie{{...}}` `` are not valid JS expressions, so vite:vue fails
 * the whole build with "Error parsing JavaScript expression". This front-runs
 * that class of build failure into `npm run audit`: fenced blocks are masked
 * (auto v-pre'd by VitePress), v-pre elements are masked (the sanctioned
 * escape), anything left is a violation.
 */
async function auditInterpolations(): Promise<InterpViolation[]> {
  const violations: InterpViolation[] = []
  for (const file of await collectContentPages()) {
    const rel = relative(DOCS_ROOT, file).replace(/\\/g, '/')
    if (INTERP_EXEMPT_PAGES.has(rel)) continue
    const raw = await readFile(file, 'utf8')
    const rawLines = raw.split('\n')
    // maskInline: false — inline code is the hazard, it must stay visible.
    const masked = maskCode(raw, { maskInline: false }).split('\n')
    masked.forEach((line, i) => {
      const visible = line.replace(VPRE_SPAN_RE, (s) => ' '.repeat(s.length))
      if (visible.includes('{{'))
        violations.push({ file: rel, line: i + 1, snippet: summarize(rawLines[i]) })
    })
  }
  return violations
}

// ---------------------------------------------------------------------------
// Dead-link audit (target-page existence + anchor validity)
// ---------------------------------------------------------------------------

/**
 * Mirrors VitePress's EXTERNAL_URL_RE: any URI scheme (`https:`, `mailto:`,
 * `data:`, custom protocols) or a protocol-relative `//` prefix marks a
 * non-page link the build-time checker never records — skipped here too.
 */
const EXTERNAL_URL_RE = /^(?:[a-z]+:|\/\/)/i

/**
 * Extensions VitePress's dead-link checker treats as assets rather than
 * pages (its `treatAsHtml` allowlist, verbatim from vitepress 1.6.4 so the
 * two stay in lockstep). A link whose last path segment carries one of
 * these — `[示例图](gopher.png)`, `/logo.svg` — is never page-checked.
 */
const KNOWN_EXTENSIONS = new Set(
  '3g2,3gp,aac,ai,apng,au,avif,bin,bmp,cer,class,conf,crl,css,csv,dll,doc,eps,epub,exe,gif,gz,ics,ief,jar,jpe,jpeg,jpg,js,json,jsonld,m4a,man,mid,midi,mjs,mov,mp2,mp3,mp4,mpe,mpeg,mpg,mpp,oga,ogg,ogv,ogx,opus,otf,p10,p7c,p7m,p7s,pdf,png,ps,qt,roff,rtf,rtx,ser,svg,t,tif,tiff,tr,ts,tsv,ttf,txt,vtt,wav,weba,webm,webp,woff,woff2,xhtml,xml,yaml,yml,zip'.split(
    ','
  )
)

/**
 * The site's heading slugifier, straight from config/markdown.ts so audit
 * verdicts can never drift from what rendered pages use. `slugifyHeading`
 * itself is module-private there; it is reached through the exported
 * markdownConfig because this script treats that file as read-only.
 */
const slugifyHeading = markdownConfig.slugify as (s: string) => string

/** Line index where the leading frontmatter block ends (0 when absent). */
function frontmatterEnd(lines: string[]): number {
  // Line-based twin of utils/frontmatter.ts's FM_RE — the audits report
  // source line numbers, so the body must be skipped by index, not sliced off.
  if (lines[0]?.trim() !== '---') return 0
  const close = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  return close === -1 ? 0 : close + 1
}

/**
 * The heading slugs a page renders with: line-start ATX headings only, outside
 * fenced blocks (a `# comment` in a Go fence is not a heading) and outside
 * frontmatter. The slug input is the heading's rendered *text* — markdown-it-
 * anchor concatenates text and code_inline token content and nothing else — so
 * link/image syntax unwraps to its text, backticks and raw HTML components
 * (`<Badge/>`) drop out while code content like `<form>` survives (code spans
 * are stashed before the tag strip for exactly that reason), and emphasis
 * markers vanish. Duplicate headings additionally get the `-1`, `-2`, …
 * suffixes markdown-it-anchor assigns, keeping `#标题-1` links valid.
 */
function headingSlugSet(raw: string): Set<string> {
  const slugs = new Set<string>()
  const seen = new Map<string, number>()
  let fence: { ch: string; len: number } | null = null
  const lines = raw.split('\n')
  for (let i = frontmatterEnd(lines); i < lines.length; i++) {
    const line = lines[i]
    const fm = line.match(/^\s*(`{3,}|~{3,})/)
    if (fm) {
      const marker = fm[1]
      if (!fence) fence = { ch: marker[0], len: marker.length }
      else if (fence.ch === marker[0] && marker.length >= fence.len) fence = null
      continue
    }
    if (fence) continue
    const hm = line.match(/^ {0,3}(#{1,6})\s+(.+)$/)
    if (!hm) continue
    const codes: string[] = []
    let text = hm[2]
      .replace(/(`+)([^`]*)\1/g, (_m, _ticks: string, content: string) => {
        codes.push(content)
        return `\u0000${codes.length - 1}\u0000`
      })
      .replace(/\s+#+\s*$/, '') // ATX closing sequence (`## 标题 ##`)
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // link/image → its text
      .replace(/<[^>]*>/g, '') // raw HTML (<Badge/>) is not part of the slug input
      .replace(/\*/g, '') // emphasis markers — dropped by rendering
    text = text.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)] ?? '')
    const slug = slugifyHeading(text)
    const n = seen.get(slug) ?? 0
    seen.set(slug, n + 1)
    slugs.add(n === 0 ? slug : `${slug}-${n}`)
  }
  return slugs
}

/**
 * Every page's key: docs-relative posix path with `.md` stripped and the
 * `index` segment KEPT (`docs/zh/json/faq/index.md` → `zh/json/faq/index`).
 * This is the exact shape VitePress's `pages` array uses for dead-link
 * lookups, and the kept `index` segment is the whole story of the `../../faq`
 * incident — `X` (no trailing slash) looks up `X`, never `X/index`. The root
 * mirror, 404.md and every docs/{lang} page all count as pages; .vitepress
 * (dist/cache build output) is skipped.
 */
async function collectPageKeys(): Promise<Set<string>> {
  const keys = new Set<string>()
  for (const file of await collectMd(DOCS_ROOT, { skipDirs: ['.vitepress'] })) {
    keys.add(relative(DOCS_ROOT, file).replace(/\\/g, '/').replace(/\.md$/, ''))
  }
  return keys
}

/** decodeURIComponent that falls back to the raw string on malformed escapes. */
function decodePath(p: string): string {
  try {
    return decodeURIComponent(p)
  } catch {
    return p
  }
}

/**
 * Internal dead-link audit. Target-page resolution mirrors VitePress's
 * build-time checker statement for statement: strip `?#…`, strip a trailing
 * `.md`/`.html`, a trailing `/` selects the directory-index page, absolute
 * paths resolve against docs/ and relative ones against the page's own
 * directory, then the result must be a page key. On top of that (the build
 * never checks anchors), a non-empty fragment must match a heading slug of
 * the target page — computed with the site's own slugifier — and a pure
 * `#fragment` link is checked against the current page. Known conservative
 * edges, accepted deliberately: links inside HTML comments or `<code v-pre>`
 * spans never render as links but are seen here (noise if a commented-out
 * link rots); reference-style links and setext / list-item-nested headings
 * are not recognized.
 */
async function auditDeadLinks(): Promise<LinkViolation[]> {
  const violations: LinkViolation[] = []
  const pageKeys = await collectPageKeys()
  /** Per-page heading slugs — every target file is read and slugified once. */
  const headingCache = new Map<string, Set<string>>()
  const headingsOf = async (key: string): Promise<Set<string>> => {
    let slugs = headingCache.get(key)
    if (!slugs) {
      slugs = headingSlugSet(await readFile(join(DOCS_ROOT, `${key}.md`), 'utf8'))
      headingCache.set(key, slugs)
    }
    return slugs
  }
  for (const file of await collectContentPages()) {
    const rel = relative(DOCS_ROOT, file).replace(/\\/g, '/')
    if (INTERP_EXEMPT_PAGES.has(rel)) continue
    const raw = await readFile(file, 'utf8')
    const bodyStart = frontmatterEnd(raw.split('\n'))
    const key = rel.replace(/\.md$/, '')
    headingCache.set(key, headingSlugSet(raw)) // pre-warm: `#自锚点` checks against this page
    const masked = maskCode(raw).split('\n')
    const dir = posix.dirname(rel)
    for (let i = bodyStart; i < masked.length; i++) {
      for (const m of masked[i].matchAll(LINK_URL_RE)) {
        const url = m[1].replace(/^<|>$/g, '')
        if (EXTERNAL_URL_RE.test(url)) continue
        const hashIdx = url.indexOf('#')
        const fragment = hashIdx === -1 ? '' : url.slice(hashIdx + 1).split('?')[0]
        const noFrag = url.replace(/[?#].*$/, '')
        const ext = noFrag.split('/').pop()
        if (ext && KNOWN_EXTENSIONS.has(ext.toLowerCase())) continue // asset, not a page
        const anchor = decodePath(fragment)
        if (noFrag === '') {
          // pure in-page anchor — VitePress never records it; anchor check only
          if (anchor && !(await headingsOf(key)).has(anchor))
            violations.push({
              file: rel,
              line: i + 1,
              url,
              reason: `锚点 \`${fragment}\` 不在本页标题中`
            })
          continue
        }
        const vpath = noFrag.replace(/\.(html|md)$/, '')
        const wantsIndex = vpath.endsWith('/')
        const trimmed = wantsIndex ? vpath.slice(0, -1) : vpath
        let target = decodePath(
          posix.normalize(trimmed.startsWith('/') ? trimmed.slice(1) : posix.join(dir, trimmed))
        )
        if (target === '.') target = ''
        if (wantsIndex) target = target === '' ? 'index' : `${target}/index`
        if (!pageKeys.has(target)) {
          let reason = `目标页不存在（解析为 \`${target || '/'}\`）`
          const plain = target.replace(/\/index$/, '')
          if (!wantsIndex && pageKeys.has(`${target}/index`))
            reason = `目标页不存在——目录索引页需 \`${target}/\` 尾斜杠形态`
          else if (wantsIndex && pageKeys.has(plain))
            reason = `目标页不存在——同名单页应去掉尾斜杠（\`${plain}\`）`
          violations.push({ file: rel, line: i + 1, url, reason })
          continue
        }
        if (anchor && !(await headingsOf(target)).has(anchor))
          violations.push({
            file: rel,
            line: i + 1,
            url,
            reason: `锚点 \`${fragment}\` 在目标页标题中不存在`
          })
      }
    }
  }
  return violations
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
    `基准语言：\`${PRIMARY_LANG}\` (${base.size} 页)。其余语言与之比对。`,
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

  const linkViolations = await auditLinkForms()
  lines.push('## 内链形态（link-form）')
  if (linkViolations.length) {
    lines.push(
      '',
      `**违规 ${linkViolations.length}** — 项目内互链禁止 \`/{lang}/{project}/\` 绝对前缀（跨项目允许；围栏与行内代码已掩蔽）:`
    )
    linkViolations.forEach((v) => lines.push(`- ${v.file}:${v.line} → \`${v.url}\` — ${v.reason}`))
  } else {
    lines.push('', '✓ 项目内互链均为相对路径形态')
  }
  lines.push('')
  problems += linkViolations.length

  const interpViolations = await auditInterpolations()
  lines.push('## 插值语法（interpolation）')
  if (interpViolations.length) {
    lines.push(
      '',
      `**违规 ${interpViolations.length}** — 行内 \`{{\` 会被 VitePress 当作 Vue 插值编译（内部非合法 JS 表达式即构建失败），需 \`<code v-pre>\` / \`<span v-pre>\` 转义或移入围栏代码块（围栏代码块与 v-pre 元素内的 \`{{\` 已豁免）:`
    )
    interpViolations.forEach((v) => lines.push(`- ${v.file}:${v.line} → ${v.snippet}`))
  } else {
    lines.push('', '✓ 正文与行内代码中无未转义的 `{{`')
  }
  lines.push('')
  problems += interpViolations.length

  const deadViolations = await auditDeadLinks()
  lines.push('## 死链（dead-link）')
  if (deadViolations.length) {
    lines.push(
      '',
      `**违规 ${deadViolations.length}** — 内链按 VitePress 构建期语义解析（无尾斜杠 → \`X.md\`、带尾斜杠 → \`X/index.md\`），目标页须在页面集合中；锚点须命中目标页标题 slug（与站点 slugify 一致，含重复标题的 \`-n\` 后缀）；外链与资产扩展名（\`.png\` 等）跳过，围栏与行内代码已掩蔽:`
    )
    deadViolations.forEach((v) => lines.push(`- ${v.file}:${v.line} → \`${v.url}\` — ${v.reason}`))
  } else {
    lines.push('', '✓ 内链目标页与锚点均有效')
  }
  lines.push('')
  problems += deadViolations.length

  const report = lines.join('\n')
  await mkdir(REPORT_DIR, { recursive: true })
  await writeFile(REPORT_FILE, report, 'utf8')

  console.log(report)
  console.log(
    `\n${problems === 0 ? '✓ 无 parity / 内链形态 / 插值语法 / 死链问题' : `⚠ ${problems} 个 parity / 内链形态 / 插值语法 / 死链问题`} → ${REPORT_FILE}`
  )
  if (problems > 0) process.exitCode = 1
}

await main()

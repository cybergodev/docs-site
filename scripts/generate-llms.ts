/**
 * Generate llms.txt + llms-full.txt (https://llmstxt.org) so LLM coding
 * assistants can ingest the whole doc set in one fetch.
 *
 * - llms.txt: a compact index — site title + description, then one bullet per
 *   document (title, absolute URL, description), grouped by project. This is
 *   the "table of contents" an assistant reads first to decide what to pull.
 * - llms-full.txt: every document's markdown body concatenated, each prefixed
 *   with its title + canonical URL, so an assistant receives the full text
 *   without crawling page by page.
 *
 * Source: the PRIMARY-language (zh) markdown under docs/zh/ — the canonical,
 * most-complete tree (it mirrors the root `/` homepage). Output goes to dist/
 * so both files deploy at the site root (/llms.txt, /llms-full.txt).
 *
 * frontmatter is parsed by hand (title/description only) to avoid pulling in a
 * YAML dependency; CLAUDE.md guarantees both fields are single-line and
 * double-quoted, which is all this needs.
 *
 * Run after `vitepress build` (see package.json `build`).
 */
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join, relative } from 'path'
import type { Dirent } from 'fs'
import { DIST_DIR, HOST, PRIMARY_LANG, PROJECTS } from '../docs/.vitepress/shared'

/** Markdown source tree for the primary language, relative to the repo root. */
const SRC_DIR = join('docs', PRIMARY_LANG)

interface Doc {
  title: string
  description: string
  /** Site URL path, e.g. `/zh/json/getting-started` or `/zh/json/`. */
  urlPath: string
  /** Markdown body with the frontmatter stripped. */
  body: string
}

// Recursively collect every *.md file under `root` (forward-slashed, absolute).
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

function unquote(s: string): string {
  const m = s.match(/^["']([\s\S]*)["']$/)
  return m ? m[1] : s
}

// Extract title/description from YAML frontmatter and return the body without
// it. Falls back to the first H1 if title is absent.
function parseMd(content: string): { title: string; description: string; body: string } {
  let title = ''
  let description = ''
  let body = content
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (fm) {
    body = content.slice(fm[0].length)
    const t = fm[1].match(/^title:\s*(.+?)\s*$/m)
    const d = fm[1].match(/^description:\s*(.+?)\s*$/m)
    if (t) title = unquote(t[1])
    if (d) description = unquote(d[1])
  }
  if (!title) {
    const h1 = body.match(/^#\s+(.+?)\s*$/m)
    if (h1) title = h1[1].replace(/[*_`]/g, '')
  }
  return { title: title.trim(), description: description.trim(), body: body.trim() }
}

// File path → site URL path. `index.md` collapses to its directory (cleanUrls),
// so json/index.md → /zh/json/ and the language home index.md → /zh/.
function toUrl(absFile: string): string {
  let rel = relative(SRC_DIR, absFile).replace(/\\/g, '/').replace(/\.md$/, '')
  if (rel === 'index') rel = '' // language home → /{lang}/
  else if (rel.endsWith('/index'))
    rel = rel.slice(0, -'/index'.length) + '/' // dir page → /{lang}/{dir}/
  return `/${PRIMARY_LANG}/${rel}`
}

async function main(): Promise<void> {
  const files = await collectMd(SRC_DIR)
  const docs: Doc[] = []
  for (const f of files) {
    const content = await readFile(f, 'utf8')
    const { title, description, body } = parseMd(content)
    if (!title) continue // skip title-less fragments
    docs.push({ title, description, urlPath: toUrl(f), body })
  }

  const url = (d: Doc) => `${HOST}${d.urlPath}`
  const bullet = (d: Doc) => `- [${d.title}](${url(d)})${d.description ? `: ${d.description}` : ''}`

  // ---- llms.txt (index) ----
  const index: string[] = [
    '# CyberGo',
    '',
    '> CyberGo — 高性能 Go 开源库文档 / High-Performance Go Open Source Libraries',
    '',
    'CyberGo 是一组高性能、生产就绪的 Go 开源库。本索引遵循 llms.txt 标准，供 LLM 一次性摄取。',
    '完整正文见 /llms-full.txt。',
    ''
  ]
  for (const p of PROJECTS) {
    const group = docs
      .filter((d) => d.urlPath.startsWith(`/${PRIMARY_LANG}/${p}`))
      .sort((a, b) => a.urlPath.localeCompare(b.urlPath))
    if (!group.length) continue
    index.push(`## ${p.toUpperCase()}`, '')
    group.forEach((d) => index.push(bullet(d)))
    index.push('')
  }
  const others = docs
    .filter((d) => !PROJECTS.some((p) => d.urlPath.startsWith(`/${PRIMARY_LANG}/${p}`)))
    .sort((a, b) => a.urlPath.localeCompare(b.urlPath))
  if (others.length) {
    index.push('## 其他', '')
    others.forEach((d) => index.push(bullet(d)))
    index.push('')
  }

  // ---- llms-full.txt (full text) ----
  const full: string[] = []
  for (const d of [...docs].sort((a, b) => a.urlPath.localeCompare(b.urlPath))) {
    full.push(`# ${d.title}`, '', `Canonical URL: ${url(d)}`, '', d.body, '', '---', '')
  }

  await mkdir(DIST_DIR, { recursive: true })
  await writeFile(join(DIST_DIR, 'llms.txt'), index.join('\n'), 'utf8')
  await writeFile(join(DIST_DIR, 'llms-full.txt'), full.join('\n'), 'utf8')
  console.log(`llms: generated llms.txt + llms-full.txt (${docs.length} docs)`)
}

await main()

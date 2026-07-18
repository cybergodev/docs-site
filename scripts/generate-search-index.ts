/**
 * Generate per-project + per-language search indexes for the in-site
 * ProjectSearch component.
 *
 * For every (lang, project) pair we emit a small JSON file of SearchDocs
 * covering only that project's tree under docs/{lang}/{project}/ — this is
 * the "isolated" scope (results on a project page only match that project +
 * the current language). For every language we also emit an aggregate
 * `_site.json` covering the whole docs/{lang}/ tree — the "site-wide" scope
 * used on non-project pages (home / about).
 *
 * Output: docs/public/search-index/{lang}/{project}.json and
 *         docs/public/search-index/{lang}/_site.json
 *
 * Because the files live under docs/public/, VitePress copies them verbatim
 * into dist/ at build time, and serves them as /search-index/... at runtime.
 * The runtime composable fetches the JSON that matches (current lang, current
 * scope key) and feeds it to a minisearch instance.
 *
 * Tokenization is shared with the runtime via `utils/searchTokenizer.ts` —
 * the index and the query MUST agree on how text is split, otherwise CJK
 * searches silently miss (see that file's header).
 *
 * This script is modeled on generate-llms.ts (same collectMd +
 * extractFrontmatter/extractBody/parseFmField pattern), but loops over every
 * LANGS×PROJECTS pair instead of just the primary language, and emits JSON
 * instead of text.
 *
 * Run BEFORE vitepress build (see package.json `build` — the script is
 * prepended so the freshly generated JSON is bundled into dist). Also exposed
 * as `npm run search-index` for ad-hoc regeneration during `npm run dev`.
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, relative } from 'path'
import { LANGS, PROJECTS, type Lang, type ProjectName } from '../docs/.vitepress/shared'
import { collectMd } from './_lib/walk'
import { parseMd } from './_lib/parse-md'

/** Output root, relative to the repo root. Lives under docs/public/ so the
 * VitePress static-asset pipeline ships it to dist verbatim. */
const OUT_DIR = join('docs', 'public', 'search-index')

interface SearchDoc {
  /** Unique within a scope (= the url). */
  id: string
  title: string
  description: string
  /** 'H2 · H3 · …' — result crumb context, only ## / ### extracted to stay compact. */
  headings: string
  /** Main searchable field: body markdown stripped of code/images/markup. */
  text: string
  /** /{lang}/{project}/... — cleanUrls: index.md collapses to its directory. */
  url: string
  lang: Lang
  /** '' for site-level pages (home / about) so the UI can render a "site" pill. */
  project: ProjectName | ''
}

/** File path → site URL path for the given language (cleanUrls-aware). */
function toUrl(absFile: string, lang: Lang): string {
  const srcDir = join('docs', lang)
  let rel = relative(srcDir, absFile).replace(/\\/g, '/').replace(/\.md$/, '')
  if (rel === 'index')
    rel = '' // language home → /{lang}/
  else if (rel.endsWith('/index')) rel = rel.slice(0, -'/index'.length) + '/' // dir page → /{lang}/{dir}/
  return `/${lang}/${rel}`
}

/** Resolve which project (if any) a URL belongs to. Mirrors
 * composables/useProjectContext.ts:getProjectFromPath, kept local so the
 * build script has zero client-runtime imports. */
function projectOf(url: string): ProjectName | '' {
  for (const p of PROJECTS) {
    if (url.includes(`/${p}/`) || url.endsWith(`/${p}`)) return p
  }
  return ''
}

/**
 * Strip markdown noise from a body so the searchable `text` field is compact
 * and matches what a user would actually type:
 *   - fenced + inline code blocks (often noisy import paths)
 *   - images (alt text and URL)
 *   - link URLs (keep the label)
 *   - heading leading #'s
 *   - list markers, blockquote markers
 *   - container fences (:::)
 *   - emphasis markers (* _ `)
 *   - table row pipes
 * HTML comments (frontmatter check / skip markers) are also dropped.
 */
function stripMarkdown(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, ' ') // HTML comments
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`[^`\n]*`/g, ' ') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links: keep label, drop URL
    .replace(/^#{1,6}\s+/gm, '') // heading #'s
    .replace(/^\s*[-*+]\s+/gm, ' ') // bullet list markers
    .replace(/^\s*\d+\.\s+/gm, ' ') // numbered list markers
    .replace(/^\s*>\s?/gm, '') // blockquote markers
    .replace(/^:::[^\n]*$/gm, ' ') // container fences (:::)
    .replace(/\|/g, ' ') // table pipes
    .replace(/[*_~]/g, '') // emphasis markers
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract ## and ### headings joined by ' · ' for the result crumb. */
function extractHeadings(body: string): string {
  const out: string[] = []
  for (const m of body.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)) {
    out.push(m[1].replace(/[*_`]/g, '').trim())
  }
  return out.join(' · ')
}

/** Build a SearchDoc from a markdown file path under docs/{lang}/. */
async function buildDoc(absFile: string, lang: Lang): Promise<SearchDoc | null> {
  const content = await readFile(absFile, 'utf8')
  const { title, description, body } = parseMd(content)
  if (!title) return null // skip title-less fragments
  const url = toUrl(absFile, lang)
  return {
    id: url,
    title,
    description,
    headings: extractHeadings(body),
    text: stripMarkdown(body),
    url,
    lang,
    project: projectOf(url)
  }
}

async function main(): Promise<void> {
  let totalFiles = 0
  let totalDocs = 0
  for (const lang of LANGS) {
    const langDir = join('docs', lang)
    const siteDocs: SearchDoc[] = []

    for (const project of PROJECTS) {
      const files = await collectMd(join(langDir, project))
      const docs: SearchDoc[] = []
      for (const f of files) {
        const d = await buildDoc(f, lang)
        if (!d) continue
        docs.push(d)
        siteDocs.push(d)
      }
      // Write the project-scoped file (whether or not empty — the runtime
      // fetches this URL unconditionally on a project page).
      const projectOutDir = join(OUT_DIR, lang)
      await mkdir(projectOutDir, { recursive: true })
      await writeFile(join(projectOutDir, `${project}.json`), JSON.stringify(docs), 'utf8')
      totalFiles++
      totalDocs += docs.length
    }

    // Site-level pages (about.md, language home index.md, …) — anything under
    // docs/{lang}/ that isn't already captured by a project tree. We walk the
    // whole language tree once and de-dup against what's already in siteDocs
    // (keyed by url) before appending.
    const allFiles = await collectMd(langDir)
    const seen = new Set(siteDocs.map((d) => d.url))
    for (const f of allFiles) {
      const d = await buildDoc(f, lang)
      if (!d || seen.has(d.url)) continue
      seen.add(d.url)
      siteDocs.push(d)
    }
    await writeFile(join(OUT_DIR, lang, '_site.json'), JSON.stringify(siteDocs), 'utf8')
    totalFiles++
    totalDocs += siteDocs.length
  }

  console.log(
    `search-index: generated ${totalFiles} files (${totalDocs} docs total) under ${OUT_DIR}/`
  )
}

await main()

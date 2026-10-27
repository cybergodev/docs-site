/**
 * Generate llms.txt + llms-full*.txt (https://llmstxt.org) so LLM coding
 * assistants can ingest the whole doc set in one fetch.
 *
 * - llms.txt: a compact index — site title + description, then one bullet per
 *   document (title, absolute URL, description), grouped by project. Sections
 *   cover EVERY language in shared.ts LANGS: the primary language keeps the
 *   bare heading (`## JSON`, `## 其他`), other languages append their display
 *   label (`## JSON (English)`). This is the "table of contents" an assistant
 *   reads first to decide what to pull.
 * - llms-full.txt: every primary-language document's markdown body
 *   concatenated, each prefixed with its title + canonical URL, so an
 *   assistant receives the full text without crawling page by page. Each
 *   non-primary language gets the same dump as llms-full-{lang}.txt
 *   (e.g. /llms-full-en.txt), announced in the llms.txt header.
 *
 * Language iteration derives from shared.ts (LANGS / NON_PRIMARY_LANGS +
 * LANGUAGES labels) — adding a language extends the outputs with no edit here.
 * frontmatter is parsed by hand (title/description only) to avoid pulling in a
 * YAML dependency (shared `parseMd`, see _lib/parse-md.ts).
 *
 * Run after `vitepress build` (see package.json `build`).
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, relative } from 'path'
import {
  DIST_DIR,
  HOST,
  LANGS,
  LANGUAGES,
  NON_PRIMARY_LANGS,
  PRIMARY_LANG,
  PROJECTS,
  PROJECT_META,
  type Lang
} from '../docs/.vitepress/shared'
import { collectMd } from './_lib/walk'
import { parseMd } from './_lib/parse-md'

interface Doc {
  title: string
  description: string
  /** Site URL path, e.g. `/zh/json/getting-started` or `/en/json/`. */
  urlPath: string
  /** Markdown body with the frontmatter stripped. */
  body: string
}

// File path → site URL path for the given language. `index.md` collapses to
// its directory (cleanUrls), so json/index.md → /{lang}/json/ and the language
// home index.md → /{lang}/.
function toUrl(absFile: string, lang: Lang): string {
  let rel = relative(join('docs', lang), absFile).replace(/\\/g, '/').replace(/\.md$/, '')
  if (rel === 'index')
    rel = '' // language home → /{lang}/
  else if (rel.endsWith('/index')) rel = rel.slice(0, -'/index'.length) + '/' // dir page → /{lang}/{dir}/
  return `/${lang}/${rel}`
}

/** Read one language tree into Docs (title-less fragments are skipped). */
async function collectDocs(lang: Lang): Promise<Doc[]> {
  const docs: Doc[] = []
  for (const f of await collectMd(join('docs', lang))) {
    const { title, description, body } = parseMd(await readFile(f, 'utf8'))
    if (!title) continue // skip title-less fragments
    docs.push({ title, description, urlPath: toUrl(f, lang), body })
  }
  return docs
}

// Section heading in llms.txt. The primary language keeps the bare name
// (`## JSON`, `## 其他`) — the original single-language layout — while other
// languages append their display label from LANGUAGES (`## JSON (English)`).
function sectionTitle(base: string, lang: Lang): string {
  return lang === PRIMARY_LANG ? base : `${base} (${LANGUAGES[lang].label})`
}

/**
 * Full-text dump of one language tree: title + canonical URL + body per doc.
 *
 * The language home is special-cased: its markdown body is a `<ProjectGrid>`
 * component placeholder plus a `<style>` block — pure noise for a text
 * consumer — so its entry is replaced by a plain-text project list rendered
 * from the same single source the component reads (PROJECT_META). The
 * llms.txt index is unaffected (it uses title/description only, which stay
 * clean).
 */
function buildFull(docs: Doc[], lang: Lang): string {
  const home = docs.find((d) => d.urlPath === `/${lang}/`)
  const rest = docs.filter((d) => d !== home)
  rest.sort((a, b) => a.urlPath.localeCompare(b.urlPath))

  const full: string[] = [
    `# ${home?.title ?? 'CyberGo'}`,
    '',
    // Match the site's canonical policy (seo.ts): the primary language's
    // home is served at BOTH `/` and `/{lang}/`, with `/` canonical — so the
    // primary dump must not advertise the non-canonical `/{lang}/` mirror.
    `Canonical URL: ${lang === PRIMARY_LANG ? `${HOST}/` : `${HOST}/${lang}/`}`,
    ''
  ]
  if (home?.description) full.push(home.description, '')
  for (const p of PROJECTS) {
    full.push(`- ${p.toUpperCase()}: ${PROJECT_META[p].desc[lang]} (${HOST}/${lang}/${p}/)`)
  }
  full.push('', '---', '')

  for (const d of rest) {
    full.push(`# ${d.title}`, '', `Canonical URL: ${HOST}${d.urlPath}`, '', d.body, '', '---', '')
  }
  return full.join('\n')
}

async function main(): Promise<void> {
  const docsByLang = new Map<Lang, Doc[]>()
  for (const lang of LANGS) docsByLang.set(lang, await collectDocs(lang))

  const url = (d: Doc) => `${HOST}${d.urlPath}`
  const bullet = (d: Doc) => `- [${d.title}](${url(d)})${d.description ? `: ${d.description}` : ''}`

  // ---- llms.txt (index, all languages) ----
  // Full-text companions: the primary dump keeps the bare /llms-full.txt name,
  // other languages suffix their code (/llms-full-en.txt).
  const fullLinks = ['/llms-full.txt', ...NON_PRIMARY_LANGS.map((l) => `/llms-full-${l}.txt`)]
  const index: string[] = [
    '# CyberGo',
    '',
    '> CyberGo — 高性能 Go 开源库文档 / High-Performance Go Open Source Libraries',
    '',
    `本索引遵循 llms.txt 标准，供 LLM 一次性摄取，完整正文见 ${fullLinks.join('、')} / This index follows the llms.txt spec; full text at ${fullLinks.join(' and ')}.`,
    ''
  ]
  for (const p of PROJECTS) {
    for (const lang of LANGS) {
      const group = (docsByLang.get(lang) ?? [])
        .filter((d) => d.urlPath.startsWith(`/${lang}/${p}/`))
        .sort((a, b) => a.urlPath.localeCompare(b.urlPath))
      if (!group.length) continue
      index.push(`## ${sectionTitle(p.toUpperCase(), lang)}`, '')
      group.forEach((d) => index.push(bullet(d)))
      index.push('')
    }
  }
  for (const lang of LANGS) {
    const others = (docsByLang.get(lang) ?? [])
      .filter((d) => !PROJECTS.some((p) => d.urlPath.startsWith(`/${lang}/${p}/`)))
      .sort((a, b) => a.urlPath.localeCompare(b.urlPath))
    if (!others.length) continue
    index.push(`## ${sectionTitle('其他', lang)}`, '')
    others.forEach((d) => index.push(bullet(d)))
    index.push('')
  }

  await mkdir(DIST_DIR, { recursive: true })
  await writeFile(join(DIST_DIR, 'llms.txt'), index.join('\n'), 'utf8')
  await writeFile(
    join(DIST_DIR, 'llms-full.txt'),
    buildFull(docsByLang.get(PRIMARY_LANG) ?? [], PRIMARY_LANG),
    'utf8'
  )
  for (const lang of NON_PRIMARY_LANGS) {
    await writeFile(
      join(DIST_DIR, `llms-full-${lang}.txt`),
      buildFull(docsByLang.get(lang) ?? [], lang),
      'utf8'
    )
  }
  const totalDocs = [...docsByLang.values()].reduce((n, ds) => n + ds.length, 0)
  console.log(
    `llms: generated llms.txt + ${fullLinks.length} full-text files (${totalDocs} docs across ${LANGS.length} languages)`
  )
}

await main()

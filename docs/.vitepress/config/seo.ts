import type { TransformContext, HeadConfig } from 'vitepress'
import { join } from 'node:path'
import {
  HOST,
  LANGS,
  LANGUAGES,
  PRIMARY_LANG,
  NON_PRIMARY_LANGS,
  PROJECTS,
  PROJECT_META,
  LOCALE_TO_SHORT,
  OGC_LOCALE,
  BARE_LANG_RE,
  LANG_PATH_RE,
  LANG_HOME_RE,
  LANG_PREFIX_RE,
  type Lang
} from '../shared'
import { UI_LABELS } from './labels'
import { categoryLabel } from '../locales/sidebars/builder'

// Minimal shape of a sitemap entry — only the fields we read/mutate in
// `transformItems`. Declared locally (rather than importing the `sitemap`
// package's SitemapItem, whose surface is larger and version-dependent) so this
// module stays decoupled from that dependency's exact type exports.
interface SitemapLink {
  lang: string
  url: string
}
interface SitemapItem {
  url: string
  links?: SitemapLink[]
}

// ---------------------------------------------------------------------------
// JSON-LD structured data (schema.org)
// ---------------------------------------------------------------------------

// GitHub organization URL for Organization.sameAs — derived from the first
// project's repo URL in PROJECT_META instead of declaring yet another
// shared.ts constant (every repo lives under the same org).
const GITHUB_ORG_URL = PROJECT_META[PROJECTS[0]].github.replace(/\/[^/]+$/, '')

/** Serialize a schema.org node into a JSON-LD `<script>` head entry. */
function jsonLd(obj: Record<string, unknown>): HeadConfig {
  return ['script', { type: 'application/ld+json' }, JSON.stringify(obj)]
}

// Site-wide entities, identical on every page.
const SITE_GRAPH: Record<string, unknown>[] = [
  {
    '@type': 'Organization',
    name: 'CyberGo',
    url: `${HOST}/`,
    logo: `${HOST}/logo.svg`,
    sameAs: [GITHUB_ORG_URL]
  },
  {
    '@type': 'WebSite',
    name: 'CyberGo',
    url: `${HOST}/`
  }
]

// Sidebar group label for a docs directory (its `_category_.json` label),
// looked up via the sidebar builder so breadcrumb names share the sidebar's
// filesystem source. Cached: transformHead runs per page and sibling pages
// repeat the same directory segments.
const dirLabelCache = new Map<string, string>()
function directoryLabel(dirRel: string): string {
  let label = dirLabelCache.get(dirRel)
  if (label === undefined) {
    label = categoryLabel(join('docs', dirRel))
    dirLabelCache.set(dirRel, label)
  }
  return label
}

/** Question-shaped heading? (FAQPage candidates — never fabricated.) */
function isQuestionTitle(title: string): boolean {
  return /[?？]$/.test(title) || /吗$/.test(title) || /^(how|why|what)\b/i.test(title)
}

/**
 * BreadcrumbList for a content page, built from its path segments: language
 * home → project → section directories → leaf. The project segment follows
 * the nav convention (`p.toUpperCase()`, see labels.ts buildNav), other
 * directories reuse the sidebar's `_category_.json` labels, and the leaf is
 * the frontmatter title cut at the first `|` (drops the SEO title suffix). A
 * directory's own index page skips the leaf crumb — the directory crumb
 * already points at it.
 */
function buildBreadcrumbList(
  relativePath: string,
  lang: Lang,
  canonical: string,
  fmTitle: string
): Record<string, unknown> | null {
  const segs = relativePath.replace(/(?:index)?\.md$/, '').split('/')
  if (segs.length < 2) return null // language home / bare page — no trail to build

  const items: Record<string, unknown>[] = [
    {
      '@type': 'ListItem',
      position: 1,
      // The zh home canonicalizes to the root `/`; other languages use their
      // own /{lang}/ landing (matches the canonical/hreflang policy above).
      name: UI_LABELS[lang].breadcrumbHome,
      item: lang === PRIMARY_LANG ? `${HOST}/` : `${HOST}/${lang}/`
    }
  ]
  let dirUrl = `/${lang}`
  segs.slice(1, -1).forEach((seg, i) => {
    dirUrl += `/${seg}`
    const name = (PROJECTS as readonly string[]).includes(seg)
      ? seg.toUpperCase()
      : directoryLabel(segs.slice(0, i + 2).join('/'))
    items.push({ '@type': 'ListItem', position: items.length + 1, name, item: `${HOST}${dirUrl}/` })
  })
  if (!/(^|\/)index\.md$/.test(relativePath)) {
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: fmTitle.split('|')[0].trim(),
      item: canonical
    })
  }
  return { '@type': 'BreadcrumbList', itemListElement: items }
}

// Chinese homepage is served at two URLs: the root `/` (the canonical one) and
// `/zh/` (kept for VitePress locale structure / nav). Both must collapse onto
// `/` so search engines do not see duplicate content.
function isZhHomePath(path: string): boolean {
  return path === '/' || path === '/zh/'
}

// Per-page SEO: canonical, hreflang, dynamic OG/Twitter
export function transformHead(ctx: TransformContext) {
  const { pageData } = ctx
  const relativePath = pageData.relativePath
  const path = '/' + relativePath.replace(/(?:index)?\.md$/, '')

  const head: HeadConfig[] = []

  // 404 page: noindex, skip all other SEO tags
  if (relativePath === '404.md') {
    head.push(['meta', { name: 'robots', content: 'noindex' }])
    return head
  }

  // The root `/` is the static Chinese homepage (primary language). There is
  // no client-side language redirect anymore — users switch languages via the
  // nav language menu. hreflang tells search engines about every language
  // version, and the `/zh/` mirror canonicalizes back to `/`.
  const zhHome = isZhHomePath(path)

  // Canonical — the Chinese homepage (both `/` and `/zh/`) canonicalizes to
  // the root `/` so the two identical pages do not compete.
  const canonical = zhHome ? `${HOST}/` : `${HOST}${path}`
  head.push(['link', { rel: 'canonical', href: canonical }])

  // AI/agent discovery: the raw Markdown source for this page (mirrored to
  // dist/ by scripts/generate-md-mirror.ts). Complementary to /llms.txt —
  // per-page precision instead of a site-wide dump.
  head.push(['link', { rel: 'alternate', type: 'text/markdown', href: `${HOST}/${relativePath}` }])

  // Any homepage (root `/` or a `/{lang}/` landing page): the Chinese
  // counterpart is the canonical root `/`, and x-default → `/`. Inner pages
  // map each language at the same sub-path instead.
  const isHome = path === '/' || LANG_HOME_RE.test(path)
  if (isHome) {
    head.push(['link', { rel: 'alternate', hreflang: PRIMARY_LANG, href: `${HOST}/` }])
    for (const altLang of NON_PRIMARY_LANGS) {
      head.push(['link', { rel: 'alternate', hreflang: altLang, href: `${HOST}/${altLang}/` }])
    }
    head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: `${HOST}/` }])
  } else {
    // Language sub-pages (incl. inner pages): generate alternates for every
    // language; x-default points to the Chinese version (site default).
    const langMatch = LANG_PATH_RE.exec(path)
    if (langMatch) {
      const subPath = langMatch[2] || ''
      for (const altLang of LANGS) {
        head.push([
          'link',
          { rel: 'alternate', hreflang: altLang, href: `${HOST}/${altLang}${subPath}` }
        ])
      }
      head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: `${HOST}/zh${subPath}` }])
    }
  }

  // Dynamic og:locale based on page language (root defaults to Chinese)
  const langFromPath = LANG_PREFIX_RE.exec(path)
  const currentLang = (langFromPath ? langFromPath[1] : PRIMARY_LANG) as Lang
  const locale = OGC_LOCALE[currentLang]
  const altLocales = Object.entries(OGC_LOCALE)
    .filter(([lang]) => lang !== currentLang)
    .map(([, loc]) => loc)
  head.push(['meta', { property: 'og:locale', content: locale }])
  for (const altLocale of altLocales) {
    head.push(['meta', { property: 'og:locale:alternate', content: altLocale }])
  }

  // Dynamic OG and Twitter tags from frontmatter. Fallbacks are language-aware:
  // a localized page missing frontmatter should not advertise itself in Chinese.
  // The per-locale `description` (from UI_LABELS) is the single source for the
  // fallback both here and for the VitePress locale `description` meta.
  const fmTitle = pageData.frontmatter?.title
  const fmDesc = pageData.frontmatter?.description
  const labelDesc = UI_LABELS[currentLang].description

  const ogTitle = fmTitle || `CyberGo - ${labelDesc}`
  const ogDesc = fmDesc || labelDesc

  head.push(['meta', { property: 'og:title', content: ogTitle }])
  head.push(['meta', { property: 'og:description', content: ogDesc }])
  head.push(['meta', { property: 'og:url', content: canonical }])
  head.push(['meta', { name: 'twitter:title', content: ogTitle }])
  head.push(['meta', { name: 'twitter:description', content: ogDesc }])

  // JSON-LD (@graph): Organization + WebSite on every page; TechArticle /
  // BreadcrumbList on content pages (a frontmatter title, not a landing
  // page); FAQPage on /faq/ routes that actually have question-shaped
  // headings. JSON.stringify keeps the payload a single text node — no raw
  // newlines, no </script> escaping concerns.
  const graph = [...SITE_GRAPH]
  if (!isHome && fmTitle) {
    const article: Record<string, unknown> = {
      '@type': 'TechArticle',
      headline: fmTitle,
      description: ogDesc,
      url: canonical,
      inLanguage: LANGUAGES[currentLang].lang
    }
    // Only present once `lastUpdated` is enabled — the git timestamp in ms.
    if (pageData.lastUpdated) {
      article.dateModified = new Date(pageData.lastUpdated).toISOString()
    }
    graph.push(article)
    const breadcrumb = buildBreadcrumbList(relativePath, currentLang, canonical, fmTitle)
    if (breadcrumb) graph.push(breadcrumb)

    if (path.includes('/faq/')) {
      const questions = pageData.headers.filter(
        (h) => (h.level === 2 || h.level === 3) && isQuestionTitle(h.title)
      )
      if (questions.length) {
        graph.push({
          '@type': 'FAQPage',
          mainEntity: questions.map((h) => ({
            '@type': 'Question',
            name: h.title,
            acceptedAnswer: { '@type': 'Answer', url: `${canonical}#${h.slug}` }
          }))
        })
      }
    }
  }
  head.push(jsonLd({ '@context': 'https://schema.org', '@graph': graph }))

  return head
}

// Sitemap configuration for SEO
export const sitemap = {
  hostname: HOST,
  transformItems(items: SitemapItem[]): SitemapItem[] {
    return items
      .filter((item) => !item.url.startsWith('404'))
      .map((item) => {
        // Any homepage (root `/` or `/{lang}/`): point hreflang `zh` and
        // `x-default` at the canonical root `/`.
        const trimmed = item.url.replace(/^\/+|\/+$/g, '')
        const isHome = trimmed === '' || BARE_LANG_RE.test(trimmed)
        if (isHome) {
          item.links = [
            { lang: PRIMARY_LANG, url: `${HOST}/` },
            ...NON_PRIMARY_LANGS.map((l) => ({ lang: l, url: `${HOST}/${l}/` })),
            { lang: 'x-default', url: `${HOST}/` }
          ]
        } else if (item.links) {
          // VitePress auto-generates locale hreflang (e.g. en-US); shorten to en
          item.links = item.links.map((link) => ({
            ...link,
            url: link.url?.replace(HOST, '').startsWith('/') ? `${HOST}${link.url}` : link.url,
            lang: LOCALE_TO_SHORT[link.lang] || link.lang
          }))
          // x-default points to the Chinese version (site default is Chinese)
          const urlMatch = LANG_PATH_RE.exec(item.url)
          if (urlMatch) {
            const subPath = urlMatch[2] || ''
            if (!item.links.some((l) => l.lang === 'x-default')) {
              item.links.push({ lang: 'x-default', url: `${HOST}/zh${subPath}` })
            }
          }
        }
        return item
      })
  }
}

// Static <head> tags (favicons + static OG/Twitter; per-page tags come from transformHead)
export const head: HeadConfig[] = [
  // Favicons
  ['link', { rel: 'icon', href: '/favicon.ico', sizes: 'any' }],
  ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' }],
  ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' }],
  ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
  ['link', { rel: 'mask-icon', href: '/logo.svg', color: '#76B900' }],
  ['meta', { name: 'theme-color', content: '#76B900' }],

  // Open Graph (static - per-page og:title/description/url/locale generated in transformHead)
  ['meta', { property: 'og:type', content: 'website' }],
  ['meta', { property: 'og:site_name', content: 'CyberGo' }],
  ['meta', { property: 'og:image', content: `${HOST}/og-image.png` }],
  ['meta', { property: 'og:image:type', content: 'image/png' }],
  ['meta', { property: 'og:image:width', content: '1200' }],
  ['meta', { property: 'og:image:height', content: '630' }],

  // Twitter Card (static - per-page title/description generated in transformHead)
  ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ['meta', { name: 'twitter:site', content: '@CyberGoDev' }],
  ['meta', { name: 'twitter:image', content: `${HOST}/og-image.png` }]
]

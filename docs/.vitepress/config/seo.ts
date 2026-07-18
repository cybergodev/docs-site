import type { TransformContext, HeadConfig } from 'vitepress'
import {
  HOST,
  LANGS,
  PRIMARY_LANG,
  NON_PRIMARY_LANGS,
  LOCALE_TO_SHORT,
  OGC_LOCALE,
  BARE_LANG_RE,
  LANG_PATH_RE,
  LANG_HOME_RE,
  LANG_PREFIX_RE,
  type Lang
} from '../shared'
import { UI_LABELS } from './labels'

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

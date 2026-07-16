import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { PRIMARY_LANG } from './shared'
import { markdownConfig } from './config/markdown'
import { bareProjectDevRedirect } from './config/redirects'
import { transformHead, sitemap, head } from './config/seo'
import { locales } from './config/locales'
import { search } from './config/search'
import { buildNav, UI_LABELS } from './config/labels'

// `withMermaid` wraps defineConfig to register the mermaid markdown-it plugin,
// so ```mermaid fences render as diagrams (loaded on demand per page — pages
// without a mermaid block pay no cost). See vitepress-plugin-mermaid.
export default withMermaid(defineConfig({
  title: 'CyberGo',
  description: 'CyberGo - Go Open Source Libraries',

  // Default <html lang> for the root page (the static Chinese homepage) and
  // any other non-locale page. Each locale's own `lang` overrides this under
  // its /{lang}/ prefix, so only the root `/` is affected.
  lang: 'zh-CN',

  lastUpdated: false,
  cleanUrls: true,

  // Dev-only Vite plugin: redirect bare project paths (/json) to the visitor's
  // language. See config/redirects.ts. No effect on production.
  vite: {
    plugins: [bareProjectDevRedirect]
  },

  // Heading-anchor slugify — see config/markdown.ts for the full rationale.
  markdown: markdownConfig,

  // Sitemap + per-page SEO (canonical, hreflang, OG/Twitter) — see config/seo.ts.
  sitemap,
  transformHead,
  head,

  // Locale configs (nav/sidebar/labels per language) — see config/locales.ts.
  locales,

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'CyberGo',

    // aria-label for the unified LanguageMenu switcher on the root `/` page
    // (non-locale pages fall back to this top-level value; each /{lang}/ locale
    // overrides it with its own translated label). See LanguageMenu.vue.
    langMenuLabel: UI_LABELS[PRIMARY_LANG].langMenuLabel,

    // Root-path nav: the `/` homepage isn't part of any locale (every locale
    // carries a /{lang}/ prefix), so without this the 项目 / 关于 top nav is
    // missing on `/`. Reuses the primary-language (zh) nav so `/` renders
    // navigation identical to /zh/. Each /{lang}/ locale overrides this.
    nav: buildNav(PRIMARY_LANG),

    // Algolia DocSearch — see config/search.ts (app id/key via env, per-language
    // placeholders from the shared UI_LABELS table).
    search,

    // Social links
    socialLinks: [{ icon: 'github', link: 'https://github.com/cybergodev' }],

    // Default footer (overridden by locale configs)
    footer: {
      message: 'Released under the MIT License',
      copyright: 'Copyright © 2026 CyberGoDev'
    }
  }
}))

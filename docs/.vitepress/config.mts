import { defineConfig } from 'vitepress'
import { zhConfig } from './locales/zh'
import { enConfig } from './locales/en'
import { koConfig } from './locales/ko'
import { jaConfig } from './locales/ja'
import { ruConfig } from './locales/ru'
import { PROJECTS } from './shared'

const COOKIE_NAME = 'vitepress-lang-preference'

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return cookieHeader.split(';').reduce((acc, c) => {
    const [k, ...v] = c.trim().split('=')
    if (k) acc[k] = v.join('=')
    return acc
  }, {} as Record<string, string>)
}

function localeRedirectPlugin() {
  return {
    name: 'vitepress-locale-redirect',
    configureServer(server: any) {
      const redirectMiddleware = (req: any, res: any, next: () => void) => {
        const url = (req.url || '/').split('?')[0].split('#')[0]

        // Bare project path redirect: /httpc, /json/getting-started, etc.
        const projectPattern = new RegExp(`^\\/(${PROJECTS.join('|')})(\\/.*)?$`)
        const match = url.match(projectPattern)
        if (match) {
          const cookies = parseCookies(req.headers.cookie)
          const savedPref = cookies[COOKIE_NAME]
          const acceptLang = req.headers['accept-language'] || ''

          let langPrefix = 'en'
          if (savedPref) {
            if (savedPref.startsWith('zh')) langPrefix = 'zh'
            else if (savedPref.startsWith('ko')) langPrefix = 'ko'
            else if (savedPref.startsWith('ja')) langPrefix = 'ja'
            else if (savedPref.startsWith('ru')) langPrefix = 'ru'
          } else {
            if (/zh/i.test(acceptLang)) langPrefix = 'zh'
            else if (/ko/i.test(acceptLang)) langPrefix = 'ko'
            else if (/ja/i.test(acceptLang)) langPrefix = 'ja'
            else if (/ru/i.test(acceptLang)) langPrefix = 'ru'
          }

          const prefix = `/${langPrefix}`
          const subPath = match[2] || ''
          res.writeHead(302, { Location: `${prefix}/${match[1]}${subPath}` })
          res.end()
          return
        }

        next()
      }

      return () => {
        server.middlewares.stack.unshift({
          route: '',
          handle: redirectMiddleware
        })
      }
    }
  }
}

export default defineConfig({
  title: 'CyberGo',
  description: 'CyberGo - Go Open Source Libraries',

  lastUpdated: false,
  cleanUrls: true,

  // Sitemap configuration for SEO
  sitemap: {
    hostname: 'https://www.cybergo.dev',
    transformItems(items) {
      const localeToShort: Record<string, string> = {
        'zh-CN': 'zh', 'en-US': 'en', 'ko-KR': 'ko', 'ja-JP': 'ja', 'ru-RU': 'ru'
      }
      const allLangs = ['zh', 'en', 'ko', 'ja', 'ru']
      const hostname = 'https://www.cybergo.dev'
      return items
        .filter(item => !item.url.startsWith('404'))
        .map(item => {
          const isRoot = item.url === '' || item.url === '/'
          // Root page: override auto-generated links with correct hreflang set
          if (isRoot) {
            item.links = allLangs.map(lang => ({
              lang, url: `${hostname}/${lang}/`
            }))
            item.links.push({ lang: 'x-default', url: `${hostname}/` })
          } else if (item.links) {
            // VitePress auto-generates locale hreflang (e.g. en-US); shorten to en
            item.links = item.links.map((link: any) => ({
              ...link,
              url: link.url?.replace(hostname, '').startsWith('/')
                ? `${hostname}${link.url}`
                : link.url,
              lang: localeToShort[link.lang] || link.lang
            }))
            // Add x-default pointing to English version
            const urlMatch = item.url.match(/^(zh|en|ko|ja|ru)(\/.*)?$/)
            if (urlMatch) {
              const subPath = urlMatch[2] || ''
              if (!item.links.some((l: any) => l.lang === 'x-default')) {
                item.links.push({ lang: 'x-default', url: `${hostname}/en${subPath}` })
              }
            }
          }
          return item
        })
    }
  },

  // Build optimization
  vite: {
    plugins: [localeRedirectPlugin()]
  },

  // Per-page SEO: canonical, hreflang, dynamic OG/Twitter
  transformHead({ pageData }) {
    const relativePath = pageData.relativePath
    let path = '/' + relativePath.replace(/(?:index)?\.md$/, '')
    const canonical = `https://www.cybergo.dev${path}`

    const head: any[] = []

    // 404 page: noindex, skip all other SEO tags
    if (relativePath === '404.md') {
      head.push(['meta', { name: 'robots', content: 'noindex' }])
      return head
    }

    // Root page: serves English homepage as default.
    // JS detects browser language and redirects non-English users.
    // hreflang links enable search engines to discover all language versions.
    const isRoot = path === '/'

    // Canonical URL for all pages including root
    head.push(['link', { rel: 'canonical', href: canonical }])

    // Root page: generate hreflang pointing to each language home
    if (path === '/') {
      const allLangs = ['zh', 'en', 'ko', 'ja', 'ru']
      for (const lang of allLangs) {
        head.push(['link', { rel: 'alternate', hreflang: lang, href: `https://www.cybergo.dev/${lang}/` }])
      }
      head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: 'https://www.cybergo.dev/' }])
    } else {
      // Language sub-pages: generate hreflang for alternates
      const langMatch = path.match(/^\/(zh|en|ko|ja|ru)(\/.*)?$/)
      let currentLang = 'en'
      if (langMatch) {
        currentLang = langMatch[1]
        const subPath = langMatch[2] || ''
        const allLangs = ['zh', 'en', 'ko', 'ja', 'ru']

        for (const altLang of allLangs) {
          head.push(['link', { rel: 'alternate', hreflang: altLang, href: `https://www.cybergo.dev/${altLang}${subPath}` }])
        }
        head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: `https://www.cybergo.dev/en${subPath}` }])
      }
    }

    // Dynamic og:locale based on page language
    const localeMap: Record<string, string> = { zh: 'zh_CN', en: 'en_US', ko: 'ko_KR', ja: 'ja_JP', ru: 'ru_RU' }
    const langFromPath = path.match(/^\/(zh|en|ko|ja|ru)/)
    const currentLang = langFromPath ? langFromPath[1] : 'en'
    const locale = localeMap[currentLang] || 'en_US'
    const altLocales = Object.entries(localeMap)
      .filter(([lang]) => lang !== currentLang)
      .map(([, loc]) => loc)
    head.push(['meta', { property: 'og:locale', content: locale }])
    for (const altLocale of altLocales) {
      head.push(['meta', { property: 'og:locale:alternate', content: altLocale }])
    }

    // Dynamic OG and Twitter tags from frontmatter
    const fmTitle = pageData.frontmatter?.title
    const fmDesc = pageData.frontmatter?.description

    const ogTitle = fmTitle || 'CyberGo - High-Performance Go Libraries'
    const ogDesc = fmDesc || 'Production-ready, high-performance Go open-source library collection.'

    head.push(['meta', { property: 'og:title', content: ogTitle }])
    head.push(['meta', { property: 'og:description', content: ogDesc }])
    head.push(['meta', { property: 'og:url', content: canonical }])
    head.push(['meta', { name: 'twitter:title', content: ogTitle }])
    head.push(['meta', { name: 'twitter:description', content: ogDesc }])

    return head
  },

  head: [
    // Inline language redirect — runs before any rendering for zero-flash redirect.
    // Only activates on root path (/). Non-English users are redirected instantly.
    // Search engines (Googlebot) have en-US Accept-Language → no redirect → index English content.
    // hreflang tags in <head> tell search engines about all language versions.
    [
      'script',
      { id: 'lang-redirect' },
      `(function(){` +
        `var p=window.location.pathname;` +
        `if(p!=='/'&&p!=='/index.html')return;` +
        `var s;try{s=localStorage.getItem('vitepress-lang-preference')}catch(e){}` +
        `if(s){var l=s.split('-')[0].toLowerCase();` +
        `if(l!=='en'&&/^(zh|ko|ja|ru)$/.test(l)){window.location.replace('/'+l+'/');return}}` +
        `var c=document.cookie.split(';');` +
        `for(var i=0;i<c.length;i++){var m=c[i].trim().match(/^vitepress-lang-preference=(.+)/);` +
        `if(m){l=m[1].split('-')[0].toLowerCase();` +
        `if(l!=='en'&&/^(zh|ko|ja|ru)$/.test(l)){window.location.replace('/'+l+'/');return}}}` +
        `var b=(navigator.language||'').toLowerCase().split('-')[0];` +
        `if(/^(zh|ko|ja|ru)$/.test(b)){window.location.replace('/'+b+'/')}` +
      `})()`
    ],

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
    ['meta', { property: 'og:image', content: 'https://www.cybergo.dev/og-image.png' }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],

    // Twitter Card (static - per-page title/description generated in transformHead)
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:site', content: '@CyberGoDev' }],
    ['meta', { name: 'twitter:image', content: 'https://www.cybergo.dev/og-image.png' }]
  ],

  locales: {
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      ...zhConfig
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      ...enConfig
    },
    ko: {
      label: '한국어',
      lang: 'ko-KR',
      link: '/ko/',
      ...koConfig
    },
    ja: {
      label: '日本語',
      lang: 'ja-JP',
      link: '/ja/',
      ...jaConfig
    },
    ru: {
      label: 'Русский',
      lang: 'ru-RU',
      link: '/ru/',
      ...ruConfig
    }
  },

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'CyberGo',

    search: {
      provider: 'algolia',
      options: {
        appId: 'PUYX7GZEVJ',
        apiKey: '656dcbb6d9a79cca32ee743ed2523ada',
        indexName: 'cybergo.dev',
        locales: {
          zh: { placeholder: '搜索文档...' },
          en: { placeholder: 'Search docs...' },
          ko: { placeholder: '문서 검색...' },
          ja: { placeholder: 'ドキュメントを検索...' },
          ru: { placeholder: 'Поиск в документации...' }
        }
      }
    },

    // Social links
    socialLinks: [{ icon: 'github', link: 'https://github.com/cybergodev' }],

    // Default footer (overridden by locale configs)
    footer: {
      message: 'Released under the MIT License',
      copyright: 'Copyright © 2026 CyberGoDev'
    }
  }
})

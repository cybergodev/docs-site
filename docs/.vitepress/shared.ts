/**
 * Single source of truth for site-wide constants.
 *
 * Consumed by build-time (`config.mts`), post-build scripts (`scripts/*.ts`,
 * run via tsx) and client runtime (`theme/*`). Because every consumer — the
 * browser bundle included — imports this module, it MUST stay pure data: no
 * side effects, no imports of vitepress/node built-ins, no env access.
 *
 * This is the one place the language list is defined. Derivations (locale
 * maps, regexes) are computed from it so that adding a language can never
 * leave a hardcoded `zh|en|ko|ja|ru` literal behind elsewhere.
 */

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export const PROJECTS = ['json', 'jwt', 'httpc', 'html', 'dd', 'env'] as const
export type ProjectName = (typeof PROJECTS)[number]

// ---------------------------------------------------------------------------
// Languages — the canonical list. Everything else language-related derives
// from LANGS / LANGUAGES below.
// ---------------------------------------------------------------------------
export const LANGS = ['zh', 'en', 'ko', 'ja', 'ru'] as const
export type Lang = (typeof LANGS)[number]

/** The primary language, served at the root path `/` (no `/{lang}/` prefix). */
export const PRIMARY_LANG: Lang = 'zh'

/**
 * Full per-language metadata.
 *
 * `lang` / `path` / `label` / `browserCodes` keep their original field names so
 * existing theme/ imports (`useLanguageDetect`, `LanguagePrompt`) work
 * unchanged; `code` and `ogLocale` are added for SEO and URL derivation.
 */
export interface LanguageConfig {
  /** URL prefix short code, e.g. `zh` */
  code: Lang
  /** Locale path prefix, e.g. `/zh/` */
  path: string
  /** VitePress `lang` value, e.g. `zh-CN` */
  lang: string
  /** Display label, e.g. `简体中文` */
  label: string
  /** `og:locale` value, e.g. `zh_CN` */
  ogLocale: string
  /** Browser language codes that should match this locale (lowercase) */
  browserCodes: string[]
}

export const LANGUAGES: Record<Lang, LanguageConfig> = {
  zh: {
    code: 'zh',
    path: '/zh/',
    lang: 'zh-CN',
    label: '简体中文',
    ogLocale: 'zh_CN',
    browserCodes: ['zh', 'zh-cn', 'zh-hans', 'zh-hans-cn', 'zh-hans-sg', 'zh-sg', 'zh-my']
  },
  en: {
    code: 'en',
    path: '/en/',
    lang: 'en-US',
    label: 'English',
    ogLocale: 'en_US',
    browserCodes: [
      'en',
      'en-us',
      'en-gb',
      'en-au',
      'en-ca',
      'en-nz',
      'en-ie',
      'en-za',
      'en-ph',
      'en-in',
      'en-ng',
      'en-tz',
      'en-ke'
    ]
  },
  ko: {
    code: 'ko',
    path: '/ko/',
    lang: 'ko-KR',
    label: '한국어',
    ogLocale: 'ko_KR',
    browserCodes: ['ko', 'ko-kr']
  },
  ja: {
    code: 'ja',
    path: '/ja/',
    lang: 'ja-JP',
    label: '日本語',
    ogLocale: 'ja_JP',
    browserCodes: ['ja', 'ja-jp']
  },
  ru: {
    code: 'ru',
    path: '/ru/',
    lang: 'ru-RU',
    label: 'Русский',
    ogLocale: 'ru_RU',
    browserCodes: ['ru', 'ru-ru']
  }
}

/** Ordered list (matches `LANGS` order), used by language-detection composables. */
export const supportedLanguages: LanguageConfig[] = LANGS.map((code) => LANGUAGES[code])

/** All non-primary languages (used for hreflang alternates excluding `zh`). */
export const NON_PRIMARY_LANGS: readonly Lang[] = LANGS.filter((l) => l !== PRIMARY_LANG)

/** VitePress emits hreflang as full locale codes (e.g. `en-US`); shorten to the URL code. */
export const LOCALE_TO_SHORT: Record<string, Lang> = Object.fromEntries(
  supportedLanguages.map((l) => [l.lang, l.code])
) as Record<string, Lang>

/** `og:locale` value per URL language code. */
export const OGC_LOCALE: Record<Lang, string> = Object.fromEntries(
  supportedLanguages.map((l) => [l.code, l.ogLocale])
) as Record<Lang, string>

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------
export const HOST = 'https://www.cybergo.dev'

/** Base URL for the "Edit this page on GitHub" link. The locale factory appends
 * `/{lang}/:path` (VitePress resolves the :path placeholder per page). */
export const EDIT_LINK_BASE = 'https://github.com/cybergodev/docs-site/edit/main/docs'

/** Issue template used by the footer "report a doc issue" link. */
export const DOC_ISSUE_URL =
  'https://github.com/cybergodev/docs-site/issues/new?template=doc-issue.md'

/** VitePress build output directory (relative to repo root). */
export const DIST_DIR = 'docs/.vitepress/dist'

/** localStorage / cookie keys for language preference (client-side only). */
export const STORAGE_KEYS = {
  preference: 'vitepress-lang-preference',
  detected: 'vitepress-lang-auto-detected',
  /** Set when the user dismisses the browser-language prompt; stops re-prompting. */
  langPromptDismissed: 'vitepress-lang-prompt-dismissed'
} as const

// ---------------------------------------------------------------------------
// Language-prefix regexes — derived from LANGS so the list stays in one place.
// Pre-compiled once at module load.
// ---------------------------------------------------------------------------
const ALT = LANGS.join('|')

/** Matches a bare language code with no slashes, e.g. `zh` or `en`. */
export const BARE_LANG_RE = new RegExp(`^(${ALT})$`)
/** Matches `/{lang}` with an optional trailing sub-path, e.g. `/en/json/foo`. */
export const LANG_PATH_RE = new RegExp(`^\\/(${ALT})(\\/.*)?$`)
/** Matches a language home, with optional trailing slash, e.g. `/en/` or `/en`. */
export const LANG_HOME_RE = new RegExp(`^\\/(${ALT})\\/?$`)
/** Matches a path that starts with a language prefix (captures `/{lang}`). */
export const LANG_PREFIX_RE = new RegExp(`^\\/(${ALT})`)

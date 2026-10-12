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
 * leave a hardcoded `zh|en` literal behind elsewhere.
 */

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export const PROJECTS = ['json', 'jwt', 'httpc', 'html', 'dd', 'env'] as const
export type ProjectName = (typeof PROJECTS)[number]

/**
 * Per-project display metadata driving the homepage project grid
 * (`<ProjectGrid>`), so adding a project = one entry here. The three
 * per-language `index.md` files (zh, en and the root mirror) render the grid
 * via `<ProjectGrid lang>` instead of hand-writing cards.
 *
 * `desc` and `features` are both localized across all supported languages, so
 * the grid renders translated tag chips on every locale.
 */
export interface ProjectMeta {
  /** Emoji icon shown on the card. */
  icon: string
  /** GitHub repository URL. */
  github: string
  /** One-line description per language. */
  desc: Record<Lang, string>
  /** Feature tag chips per language (all supported languages populated). */
  features: Record<Lang, string[]>
}

export const PROJECT_META: Record<ProjectName, ProjectMeta> = {
  json: {
    icon: '📦',
    github: 'https://github.com/cybergodev/json',
    desc: {
      zh: '高性能、线程安全的 JSON 处理库。提供丰富的 JSON 操作功能，包括解析、查询、修改、验证和格式化。',
      en: 'High-performance, thread-safe JSON processing library. Provides rich JSON operations including parsing, querying, modifying, validating, and formatting.'
    },
    features: {
      zh: ['JSONPath 路径查询', '流式处理', '类型安全转换', '零分配提取'],
      en: ['JSONPath queries', 'Streaming', 'Type-safe conversion', 'Zero-allocation extraction']
    }
  },
  jwt: {
    icon: '🔑',
    github: 'https://github.com/cybergodev/jwt',
    desc: {
      zh: '生产级 JWT 库，仅需 3 个函数即可完成所有 JWT 操作。内置安全保护、黑名单管理与令牌刷新/吊销功能。',
      en: 'Production-grade JWT library that handles all JWT operations with just 3 functions. Built-in security protection, blacklist management, and token refresh/revocation.'
    },
    features: {
      zh: ['多算法支持', '签名验证', '黑名单管理', 'Claims 解析', '刷新与轮换', '速率限制'],
      en: [
        'Multi-algorithm support',
        'Signature verification',
        'Blacklist management',
        'Claims parsing',
        'Refresh & rotation',
        'Rate limiting'
      ]
    }
  },
  httpc: {
    icon: '🌐',
    github: 'https://github.com/cybergodev/httpc',
    desc: {
      zh: '现代高性能 HTTP 客户端。支持 TLS 1.2+、SSRF 防护、中间件链、智能重试、零分配池，将 GC 减少 90%。',
      en: 'Modern high-performance HTTP client. Supports TLS 1.2+, SSRF protection, middleware chain, smart retry, zero-allocation pooling, reducing GC by 90%.'
    },
    features: {
      zh: ['TLS 1.2+', 'SSRF 防护', '中间件链', '连接池管理', '请求重试'],
      en: [
        'TLS 1.2+',
        'SSRF protection',
        'Middleware chain',
        'Connection pool management',
        'Request retry'
      ]
    }
  },
  html: {
    icon: '📄',
    github: 'https://github.com/cybergodev/html',
    desc: {
      zh: '生产级 HTML 内容提取工具。支持智能文章识别，可提取带元数据的图片、视频、音频及链接。',
      en: 'Production-grade HTML content extraction tool. Supports intelligent article recognition, extracting images, videos, audio, and links with metadata.'
    },
    features: {
      zh: [
        '智能文章识别',
        '元数据提取',
        '内容清洗',
        '自动编码检测',
        '多格式输出',
        '批量处理',
        '链接提取',
        '审计系统'
      ],
      en: [
        'Smart article recognition',
        'Metadata extraction',
        'Content cleaning',
        'Auto encoding detection',
        'Multi-format output',
        'Batch processing',
        'Link extraction',
        'Audit system'
      ]
    }
  },
  dd: {
    icon: '📝',
    github: 'https://github.com/cybergodev/dd',
    desc: {
      zh: '高性能日志库，每秒处理超过 300 万次操作。支持结构化日志、自动文件轮换、敏感数据过滤。',
      en: 'High-performance logging library processing over 3 million operations per second. Supports structured logging, automatic file rotation, and sensitive data filtering.'
    },
    features: {
      zh: [
        '结构化日志',
        '文件轮换',
        '多输出目标',
        '敏感数据过滤',
        '字段验证',
        '审计日志',
        '完整性签名',
        '钩子系统',
        '上下文集成',
        '日志采样',
        '零分配优化'
      ],
      en: [
        'Structured logging',
        'File rotation',
        'Multiple output targets',
        'Sensitive data filtering',
        'Field validation',
        'Audit logging',
        'Integrity signing',
        'Hook system',
        'Context integration',
        'Log sampling',
        'Zero-allocation optimization'
      ]
    }
  },
  env: {
    icon: '⚙️',
    github: 'https://github.com/cybergodev/env',
    desc: {
      zh: '生产就绪的环境变量管理库。支持内存锁定、审计日志记录和高并发，零依赖设计。',
      en: 'Production-ready environment variable management library. Supports memory locking, audit logging, and high concurrency with zero-dependency design.'
    },
    features: {
      zh: ['.env 文件支持', '类型转换', '安全存储', '审计日志'],
      en: ['.env file support', 'Type conversion', 'Secure storage', 'Audit logging']
    }
  }
}

// ---------------------------------------------------------------------------
// Languages — the canonical list. Everything else language-related derives
// from LANGS / LANGUAGES below.
// ---------------------------------------------------------------------------
export const LANGS = ['zh', 'en'] as const
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
 * `/:path`; VitePress resolves that placeholder to the page's path relative to
 * `srcDir` (`docs/`), which already includes the language segment
 * (e.g. `zh/json/index.md`). */
export const EDIT_LINK_BASE = 'https://github.com/cybergodev/docs-site/edit/main/docs'

/** Issue template used by the footer "report a doc issue" link. */
export const DOC_ISSUE_URL =
  'https://github.com/cybergodev/docs-site/issues/new?template=doc-issue.md'

/** VitePress build output directory (relative to repo root). */
export const DIST_DIR = 'docs/.vitepress/dist'

/** localStorage / cookie keys for language preference (client-side only). */
export const STORAGE_KEYS = {
  preference: 'vitepress-lang-preference',
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

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

/**
 * Per-project display metadata driving the homepage project grid
 * (`<ProjectGrid>`), so adding a project = one entry here. The six per-language
 * `index.md` files no longer each hand-write six cards (the old layout was
 * 6 languages × 6 projects = 36 duplicated HTML blocks).
 *
 * `desc` is localized; `features` is currently zh-only — other languages have
 * an empty array and the grid renders no tag chips for them (left as a
 * follow-up translation task rather than showing Chinese tags on localized
 * pages).
 */
export interface ProjectMeta {
  /** Emoji icon shown on the card. */
  icon: string
  /** GitHub repository URL. */
  github: string
  /** One-line description per language. */
  desc: Record<Lang, string>
  /** Feature tag chips per language (zh populated; others empty for now). */
  features: Record<Lang, string[]>
}

export const PROJECT_META: Record<ProjectName, ProjectMeta> = {
  json: {
    icon: '📦',
    github: 'https://github.com/cybergodev/json',
    desc: {
      zh: '高性能、线程安全的 JSON 处理库。提供丰富的 JSON 操作功能，包括解析、查询、修改、验证和格式化。',
      en: 'High-performance, thread-safe JSON processing library. Provides rich JSON operations including parsing, querying, modifying, validating, and formatting.',
      ko: '고성능 스레드 안전 JSON 처리 라이브러리. 파싱, 쿼리, 수정, 검증, 포맷팅 등 풍부한 JSON 조작 기능을 제공합니다.',
      ja: '高性能でスレッドセーフな JSON 処理ライブラリ。パース、クエリ、変更、検証、フォーマットなど、豊富な JSON 操作機能を提供します。',
      ru: 'Высокопроизводительная, потокобезопасная библиотека обработки JSON. Предоставляет богатый набор функций для работы с JSON, включая парсинг, запросы, модификацию, валидацию и форматирование.'
    },
    features: {
      zh: ['JSONPath 路径查询', '流式处理', '类型安全转换', '零分配提取'],
      en: [],
      ko: [],
      ja: [],
      ru: []
    }
  },
  jwt: {
    icon: '🔑',
    github: 'https://github.com/cybergodev/jwt',
    desc: {
      zh: '生产级 JWT 库，仅需 3 个函数即可完成所有 JWT 操作。内置安全保护和黑名单管理功能。',
      en: 'Production-grade JWT library that handles all JWT operations with just 3 functions. Built-in security protection and blacklist management.',
      ko: '프로덕션급 JWT 라이브러리. 단 3개의 함수로 모든 JWT 작업을 완료할 수 있습니다. 보안 보호 및 블랙리스트 관리 기능 내장.',
      ja: '本番レベルの JWT ライブラリ。わずか 3 つの関数で全ての JWT 操作を完了できます。セキュリティ保護とブラックリスト管理機能を内蔵。',
      ru: 'Библиотека JWT продакшен-уровня, для всех операций JWT достаточно 3 функций. Встроенная защита безопасности и управление чёрными списками.'
    },
    features: {
      zh: ['多算法支持', '签名验证', '黑名单管理', 'Claims 解析'],
      en: [],
      ko: [],
      ja: [],
      ru: []
    }
  },
  httpc: {
    icon: '🌐',
    github: 'https://github.com/cybergodev/httpc',
    desc: {
      zh: '现代高性能 HTTP 客户端。支持 TLS 1.2+、SSRF 防护、断路器、智能重试、零分配池，将 GC 减少 90%。',
      en: 'Modern high-performance HTTP client. Supports TLS 1.2+, SSRF protection, circuit breaker, smart retry, zero-allocation pooling, reducing GC by 90%.',
      ko: '모던 고성능 HTTP 클라이언트. TLS 1.2+, SSRF 방어, 서킷 브레이커, 스마트 재시도, 제로 할당 풀을 지원하며 GC를 90% 감소시킵니다.',
      ja: 'モダンで高性能な HTTP クライアント。TLS 1.2+、SSRF 防御、サーキットブレーカー、インテリジェントリトライ、ゼロアロケーションプールをサポートし、GC を 90% 削減。',
      ru: 'Современный высокопроизводительный HTTP-клиент. Поддержка TLS 1.2+, защита от SSRF, автоматические выключатели, интеллектуальные повторы, пулы без аллокаций, снижение GC на 90%.'
    },
    features: {
      zh: ['TLS 1.2+', 'SSRF 防护', '断路器', '连接池管理', '请求重试'],
      en: [],
      ko: [],
      ja: [],
      ru: []
    }
  },
  html: {
    icon: '📄',
    github: 'https://github.com/cybergodev/html',
    desc: {
      zh: '生产级 HTML 内容提取工具。支持智能文章识别，可提取带元数据的图片、视频、音频及链接。',
      en: 'Production-grade HTML content extraction tool. Supports intelligent article recognition, extracting images, videos, audio, and links with metadata.',
      ko: '프로덕션급 HTML 콘텐츠 추출 도구. 스마트 문서 인식을 지원하며 메타데이터가 포함된 이미지, 비디오, 오디오 및 링크를 추출할 수 있습니다.',
      ja: '本番レベルの HTML コンテンツ抽出ツール。スマート記事認識をサポートし、メタデータ付きの画像、動画、音声、リンクを抽出できます。',
      ru: 'Инструмент извлечения содержимого HTML продакшен-уровня. Поддержка интеллектуального распознавания статей, извлечение изображений, видео, аудио и ссылок с метаданными.'
    },
    features: {
      zh: ['智能文章识别', '元数据提取', '内容清洗', '自动编码检测', '多格式输出', '批量处理', '链接提取', '审计系统'],
      en: [],
      ko: [],
      ja: [],
      ru: []
    }
  },
  dd: {
    icon: '📝',
    github: 'https://github.com/cybergodev/dd',
    desc: {
      zh: '高性能日志库，每秒处理超过 300 万次操作。支持结构化日志、自动文件轮换、敏感数据过滤。',
      en: 'High-performance logging library processing over 3 million operations per second. Supports structured logging, automatic file rotation, and sensitive data filtering.',
      ko: '고성능 로깅 라이브러리. 초당 300만 회 이상의 작업을 처리합니다. 구조화된 로깅, 자동 파일 로테이션, 민감 데이터 필터링을 지원합니다.',
      ja: '高性能ログライブラリ。毎秒 300 万回以上の操作を処理。構造化ログ、自動ファイルローテーション、機密データフィルタリングをサポート。',
      ru: 'Высокопроизводительная библиотека логирования, обрабатывающая более 3 миллионов операций в секунду. Поддержка структурированного логирования, автоматической ротации файлов, фильтрации конфиденциальных данных.'
    },
    features: {
      zh: ['结构化日志', '文件轮换', '多输出目标', '敏感数据过滤', '审计日志', '完整性签名', '钩子系统', '上下文集成', '日志采样', '零分配优化'],
      en: [],
      ko: [],
      ja: [],
      ru: []
    }
  },
  env: {
    icon: '⚙️',
    github: 'https://github.com/cybergodev/env',
    desc: {
      zh: '生产就绪的环境变量管理库。支持内存锁定、审计日志记录和高并发，零依赖设计。',
      en: 'Production-ready environment variable management library. Supports memory locking, audit logging, and high concurrency with zero-dependency design.',
      ko: '프로덕션 준비 완료된 환경 변수 관리 라이브러리. 인메모리 잠금, 감사 로그 기록 및 고동시성을 지원하며 제로 의존성 설계.',
      ja: '本番対応の環境変数管理ライブラリ。インメモリロック、監査ログ記録、高並行性をサポートし、ゼロ依存設計。',
      ru: 'Библиотека управления переменными окружения продакшен-уровня. Поддержка блокировки в памяти, журналирования аудита и высокой параллельности, дизайн без зависимостей.'
    },
    features: {
      zh: ['.env 文件支持', '类型转换', '安全存储', '审计日志'],
      en: [],
      ko: [],
      ja: [],
      ru: []
    }
  }
}

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

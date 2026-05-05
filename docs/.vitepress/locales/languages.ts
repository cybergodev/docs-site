/**
 * Supported languages configuration
 *
 * To add a new language:
 * 1. Add the language config below with path prefix and matching browser codes
 * 2. Create the corresponding locale file (e.g., ja.ts)
 * 3. Add the locale to config.mts
 */
export interface LanguageConfig {
  /** Locale path prefix (e.g., '/en/', '/' for root) */
  path: string
  /** VitePress lang value */
  lang: string
  /** Browser language codes that should match this locale */
  browserCodes: string[]
  /** Display name for this language */
  label: string
}

/**
 * Language detection configuration
 * Order matters: first match wins
 */
export const supportedLanguages: LanguageConfig[] = [
  {
    path: '/zh/',
    lang: 'zh-CN',
    label: '简体中文',
    browserCodes: [
      'zh', 'zh-cn', 'zh-hans', 'zh-hans-cn', 'zh-hans-sg',
      'zh-sg', 'zh-my'
    ]
  },
  {
    path: '/en/',
    lang: 'en-US',
    label: 'English',
    browserCodes: [
      'en', 'en-us', 'en-gb', 'en-au', 'en-ca', 'en-nz', 'en-ie',
      'en-za', 'en-ph', 'en-in', 'en-ng', 'en-tz', 'en-ke'
    ]
  },
  {
    path: '/ko/',
    lang: 'ko-KR',
    label: '한국어',
    browserCodes: ['ko', 'ko-kr']
  },
  {
    path: '/ja/',
    lang: 'ja-JP',
    label: '日本語',
    browserCodes: ['ja', 'ja-jp']
  },
  {
    path: '/ru/',
    lang: 'ru-RU',
    label: 'Русский',
    browserCodes: ['ru', 'ru-ru']
  },
]

/** Default language path (fallback when no match) */
export const defaultLanguagePath = '/en/'

/** Storage keys */
export const STORAGE_KEYS = {
  preference: 'vitepress-lang-preference',
  detected: 'vitepress-lang-auto-detected'
} as const

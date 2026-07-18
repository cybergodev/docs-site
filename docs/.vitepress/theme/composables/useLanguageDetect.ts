import {
  supportedLanguages,
  LANGS,
  PRIMARY_LANG,
  LOCALE_TO_SHORT,
  LANGUAGES,
  type LanguageConfig,
  type Lang
} from '../../shared'

/**
 * Find the best matching locale for a browser language string
 */
export function findMatchingLanguage(browserLang: string): LanguageConfig | null {
  if (!browserLang) return null

  const normalizedLang = browserLang.toLowerCase()

  // Exact match
  for (const langConfig of supportedLanguages) {
    for (const code of langConfig.browserCodes) {
      if (normalizedLang === code) return langConfig
    }
  }

  // Prefix match (e.g. 'en-US' ↔ 'en')
  for (const langConfig of supportedLanguages) {
    for (const code of langConfig.browserCodes) {
      if (normalizedLang.startsWith(code + '-') || code.startsWith(normalizedLang + '-')) {
        return langConfig
      }
    }
  }

  // Base language match (e.g. 'zh-CN' base → 'zh')
  const baseLang = normalizedLang.split('-')[0]
  for (const langConfig of supportedLanguages) {
    for (const code of langConfig.browserCodes) {
      if (baseLang === code.split('-')[0]) return langConfig
    }
  }

  return null
}

/** Find the language path for a saved preference string (e.g., 'zh-CN') */
export function getPreferencePath(preference: string): string | null {
  const lower = preference.toLowerCase()
  for (const langConfig of supportedLanguages) {
    if (lower.startsWith(langConfig.lang.split('-')[0].toLowerCase())) {
      return langConfig.path
    }
  }
  return null
}

/**
 * Normalize a VitePress `useData().lang` value (e.g. `zh-CN`, `en-US`) to the
 * internal short language code (`zh`, `en`, …).
 *
 * Defaults to the primary language `zh` because the root path `/` serves the
 * Chinese homepage. This is the single language-detection routine for client
 * components.
 */
export function normalizeVpLang(vpLang: string): Lang {
  if (!vpLang) return PRIMARY_LANG
  // Exact locale-code hit first (e.g. 'en-US' → 'en' via the lookup table).
  const exact = LOCALE_TO_SHORT[vpLang]
  if (exact) return exact
  // Fallback: match by base prefix against every language's VitePress `lang`.
  const base = vpLang.toLowerCase().split('-')[0]
  for (const code of LANGS) {
    if (LANGUAGES[code].lang.toLowerCase().split('-')[0] === base) return code
  }
  return PRIMARY_LANG
}

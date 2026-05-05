import {
  supportedLanguages,
  defaultLanguagePath,
  STORAGE_KEYS,
  type LanguageConfig
} from '../../locales/languages'
import { PROJECTS } from './useProjectPath'

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

/** Check if the current URL is the site root */
function isRootPath(): boolean {
  const pathname = window.location.pathname
  return pathname === '/' || pathname === '/index.html'
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

/** Check if the current URL is a project path without language prefix */
function isBareProjectPath(): boolean {
  const pathname = window.location.pathname
  for (const lang of supportedLanguages) {
    if (pathname.startsWith(lang.path)) return false
  }
  for (const p of PROJECTS) {
    if (pathname === `/${p}` || pathname === `/${p}/` || pathname.startsWith(`/${p}/`)) {
      return true
    }
  }
  return false
}

/** Get the current locale path from URL */
function getCurrentLanguagePath(): string {
  const pathname = window.location.pathname
  for (const langConfig of supportedLanguages) {
    if (pathname.startsWith(langConfig.path)) return langConfig.path
  }
  return ''
}

/** Redirect root or mismatched visitors to the correct locale */
export function detectAndRedirectLanguage(): void {
  if (typeof window === 'undefined') return

  // Handle bare project paths (e.g., /httpc, /json/getting-started)
  if (isBareProjectPath()) {
    const savedPreference = localStorage.getItem(STORAGE_KEYS.preference)
    let prefix: string
    if (savedPreference) {
      const prefPath = getPreferencePath(savedPreference)
      prefix = prefPath ? prefPath.slice(0, -1) : '/en'
    } else {
      const browserLang = navigator.language.toLowerCase()
      const matchedLang = findMatchingLanguage(browserLang)
      prefix = matchedLang ? matchedLang.path.slice(0, -1) : '/en'
    }
    window.location.replace(prefix + window.location.pathname)
    return
  }

  const savedPreference = localStorage.getItem(STORAGE_KEYS.preference)
  if (savedPreference) {
    if (isRootPath()) {
      const prefPath = getPreferencePath(savedPreference)
      window.location.replace(prefPath || '/en/')
    }
    return
  }

  if (sessionStorage.getItem(STORAGE_KEYS.detected)) return
  sessionStorage.setItem(STORAGE_KEYS.detected, 'true')

  const browserLang = navigator.language || ''
  const matchedLang = findMatchingLanguage(browserLang)
  const targetPath = matchedLang?.path ?? defaultLanguagePath

  const currentPath = getCurrentLanguagePath()

  if (isRootPath() || currentPath !== targetPath) {
    const pathname = window.location.pathname
    let newPath = pathname

    // Strip existing locale prefix
    for (const lang of supportedLanguages) {
      if (newPath.startsWith(lang.path)) {
        newPath = newPath.slice(lang.path.length - 1)
        break
      }
    }

    if (newPath === '/' || newPath === '/index.html') {
      window.location.replace(targetPath)
      return
    }

    newPath = targetPath.slice(0, -1) + newPath
    window.location.replace(newPath || targetPath)
  }
}

/** Redirect from root index.md — lightweight version for SSR page */
export function redirectFromRoot(): void {
  if (typeof window === 'undefined') return

  const savedPreference = localStorage.getItem(STORAGE_KEYS.preference)

  if (savedPreference) {
    const prefPath = getPreferencePath(savedPreference)
    window.location.replace(prefPath || '/en/')
    return
  }

  const browserLang = navigator.language.toLowerCase()

  let targetPath = defaultLanguagePath

  for (const langConfig of supportedLanguages) {
    for (const code of langConfig.browserCodes) {
      if (
        browserLang === code ||
        browserLang.startsWith(code + '-') ||
        code.startsWith(browserLang + '-')
      ) {
        targetPath = langConfig.path
        break
      }
    }
    if (targetPath !== defaultLanguagePath) break
  }

  sessionStorage.setItem(STORAGE_KEYS.detected, 'true')
  window.location.replace(targetPath)
}

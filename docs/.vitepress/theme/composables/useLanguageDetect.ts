import {
  supportedLanguages,
  defaultLanguagePath,
  STORAGE_KEYS,
  type LanguageConfig
} from '../../locales/languages'
import { PROJECTS } from '../../shared'

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

/** Detect preferred language code from storage, cookie, or browser settings */
function detectPreferredLanguage(): string {
  const savedPreference = localStorage.getItem(STORAGE_KEYS.preference)
  if (savedPreference) {
    const prefPath = getPreferencePath(savedPreference)
    if (prefPath) return prefPath.split('/')[1]
  }

  const cookies = document.cookie.split(';').reduce((acc: Record<string, string>, c: string) => {
    const [k, ...v] = c.trim().split('=')
    if (k) acc[k] = v.join('=')
    return acc
  }, {} as Record<string, string>)
  if (cookies[STORAGE_KEYS.preference]) {
    const prefPath = getPreferencePath(cookies[STORAGE_KEYS.preference])
    if (prefPath) return prefPath.split('/')[1]
  }

  const browserLang = navigator.language.toLowerCase()
  const matchedLang = findMatchingLanguage(browserLang)
  if (matchedLang) return matchedLang.path.split('/')[1]
  return 'en'
}

/**
 * Detect language and redirect.
 *
 * Root path (/): redirect is handled by inline <script> in <head> (config.mts)
 * for zero-flash UX. This function is a fallback in case the inline script
 * didn't run (e.g. JS disabled in <head>, or edge-case).
 */
export function detectAndRedirectLanguage(): void {
  if (typeof window === 'undefined') return

  const pathname = window.location.pathname

  // Root path: fallback — inline head script should have handled this already
  if (pathname === '/' || pathname === '/index.html') {
    const detectedLang = detectPreferredLanguage()
    if (detectedLang !== 'en') {
      window.location.replace(`/${detectedLang}/`)
    }
    return
  }

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

  // Already on a language path: detect and store preference
  const savedPreference = localStorage.getItem(STORAGE_KEYS.preference)
  if (savedPreference) return

  try {
    if (sessionStorage.getItem(STORAGE_KEYS.detected)) return
    sessionStorage.setItem(STORAGE_KEYS.detected, 'true')
  } catch {}

  const browserLang = navigator.language || ''
  const matchedLang = findMatchingLanguage(browserLang)
  const targetPath = matchedLang?.path ?? '/en/'

  const currentPath = getCurrentLanguagePath()

  if (currentPath !== targetPath && currentPath !== '') {
    let newPath = pathname

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

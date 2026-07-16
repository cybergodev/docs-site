import { computed, type ComputedRef } from 'vue'
import { useData } from 'vitepress'
import { UI_LABELS, type UiLabels } from '../../config/labels'
import type { Lang } from '../../shared'
import { normalizeVpLang } from './useLanguageDetect'

/**
 * Reactive short language code for the current page, derived from VitePress
 * `useData().lang` via `normalizeVpLang` (defaults to the primary language
 * `zh`, matching the root `/` Chinese homepage). Components that need the code
 * itself (e.g. to build a `/{lang}/` URL) use this instead of hand-rolling a
 * `startsWith('zh')` chain.
 */
export function useCurrentLang(): ComputedRef<Lang> {
  const { lang } = useData()
  return computed<Lang>(() => normalizeVpLang(lang.value))
}

/**
 * Reactive access to the UI label set for the current page's language.
 *
 * Single entry point for component-facing strings: components no longer carry
 * their own i18n dictionaries or language-detection logic.
 *
 * Returns a `ComputedRef<UiLabels>`; templates auto-unwrap it (`t.field`),
 * script setup uses `t.value.field`.
 */
export function useUiLabels(): ComputedRef<UiLabels> {
  const current = useCurrentLang()
  return computed<UiLabels>(() => UI_LABELS[current.value])
}

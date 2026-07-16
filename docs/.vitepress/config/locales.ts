import type { LocaleConfig } from 'vitepress'
import { LANGS, LANGUAGES } from '../shared'
import { buildLocaleConfig } from './labels'
import { buildSidebars } from '../locales/sidebars/builder'

/**
 * Locale configs, generated from the single language list (shared.ts LANGS).
 *
 * Each entry = display metadata (label / lang / link, from LANGUAGES) spread
 * together with a LocaleSpecificConfig (nav / sidebar / labels / footer /
 * editLink), all derived in labels.ts. No per-language file exists — adding a
 * language is one row in shared.ts LANGS + one in labels.ts UI_LABELS.
 *
 * Note: zh (the primary language) is also served at the root `/` via the
 * static homepage; its `/zh/` mirror here lets the language switcher and
 * canonical/hreflang logic treat it uniformly.
 */
export const locales: LocaleConfig = Object.fromEntries(
  LANGS.map((lang) => [
    lang,
    {
      label: LANGUAGES[lang].label,
      lang: LANGUAGES[lang].lang,
      link: LANGUAGES[lang].path,
      ...buildLocaleConfig(lang, buildSidebars(lang))
    }
  ])
) as LocaleConfig

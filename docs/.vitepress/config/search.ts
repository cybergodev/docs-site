import { loadEnv } from 'vitepress'
import { LANGS } from '../shared'
import { UI_LABELS } from './labels'

/**
 * Algolia DocSearch config, centralized.
 *
 * App ID / API key come from env (see .env.example: VP_ALGOLIA_APP_ID /
 * VP_ALGOLIA_API_KEY) with bundled fallbacks so a deploy with no secrets
 * configured keeps working identically. Per-language search placeholders
 * derive from the shared UI_LABELS table — no duplicated strings.
 */
const VP_ENV = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')
const appId = VP_ENV.VP_ALGOLIA_APP_ID || 'PUYX7GZEVJ'
const apiKey = VP_ENV.VP_ALGOLIA_API_KEY || '656dcbb6d9a79cca32ee743ed2523ada'

export const search = {
  provider: 'algolia' as const,
  options: {
    appId,
    apiKey,
    indexName: 'cybergo.dev',
    locales: Object.fromEntries(
      LANGS.map((lang) => [lang, { placeholder: UI_LABELS[lang].searchPlaceholder }])
    )
  }
}

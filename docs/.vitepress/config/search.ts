import { loadEnv } from 'vitepress'
import { LANGS } from '../shared'
import { UI_LABELS } from './labels'

/**
 * Algolia DocSearch config.
 *
 * App ID / API key come from env ONLY (see .env.example: VP_ALGOLIA_APP_ID /
 * VP_ALGOLIA_API_KEY). There is no committed fallback: a stale bundled key
 * would silently serve a broken search with no signal. When the env vars are
 * absent, `search` is `undefined` (search box disabled) and a build-time
 * warning is logged. The DocSearch API key is a public front-end key by
 * design, so it is safe to put in `.env` for local dev.
 */
const VP_ENV = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')
const appId = VP_ENV.VP_ALGOLIA_APP_ID
const apiKey = VP_ENV.VP_ALGOLIA_API_KEY

if (!appId || !apiKey) {
  console.warn(
    '[search] VP_ALGOLIA_APP_ID / VP_ALGOLIA_API_KEY not set — Algolia DocSearch disabled. ' +
      'Set them in .env (the public DocSearch key is safe for local dev); production deploys must provide them.'
  )
}

export const search =
  appId && apiKey
    ? {
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
    : undefined

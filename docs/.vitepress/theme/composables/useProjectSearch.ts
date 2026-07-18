import { computed, ref } from 'vue'
import type MiniSearch from 'minisearch'
import { useProjectContext } from './useProjectContext'
import { useCurrentLang } from './useUiLabels'
import type { Lang, ProjectName } from '../../shared'
import { cjkTokenize, cjkProcessTerm } from '../../utils/searchTokenizer'

/**
 * Project-scoped local search backed by per-(lang,scope) JSON indexes that
 * scripts/generate-search-index.ts emits under docs/public/search-index/.
 *
 * Scope follows the current route automatically:
 *   - on a project page  → scope key = the project name → /search-index/{lang}/{project}.json
 *   - on any other page   → scope key = '_site'          → /search-index/{lang}/_site.json
 *
 * Indexes are loaded lazily (only when `search()` is first called for a given
 * scope) and cached at MODULE level, so navigating between two pages of the
 * same project reuses the same MiniSearch instance with zero refetch; the
 * cache is keyed by `${lang}::${scopeKey}` so a language switch or scope
 * switch transparently fetches the right file.
 *
 * SSR safety: this composable only sets up reactive Computeds and returns a
 * `search` function. The actual fetch / MiniSearch instantiation happens
 * inside `search()` itself, which is only ever called from a client
 * `onMounted` / event handler in ProjectSearch.vue. Nothing here touches
 * `window` / `fetch` at module load, so importing the composable during SSR
 * is a no-op.
 *
 * minisearch is dynamically imported — ~30KB, needed only after the user
 * actually opens the search box, so it stays out of the main chunk.
 *
 * Tokenization is shared with the build-time index via
 * `utils/searchTokenizer.ts` — index and query MUST agree on how text is
 * split, otherwise CJK searches silently miss.
 */

/** Shape of one entry in the generated index JSON. */
interface SearchDoc {
  id: string
  title: string
  description: string
  headings: string
  text: string
  url: string
  lang: Lang
  project: ProjectName | ''
}

/** A normalized search hit — MiniSearch.SearchResult's stored fields + score. */
export interface SearchResult {
  title: string
  description: string
  headings: string
  url: string
  project: ProjectName | ''
  score: number
}

export type SearchScope = 'project' | 'site'

/** Module-level cache: (lang, scopeKey) → MiniSearch instance. Survives route
 * changes within the same scope (e.g. paging through docs/zh/json/* reuses one
 * instance / one fetch). */
const cache = new Map<string, MiniSearch<SearchDoc>>()

/** Promise per in-flight first-load, so concurrent `search()` calls coalesce. */
const loading = new Map<string, Promise<MiniSearch<SearchDoc>>>()

export function useProjectSearch() {
  const { project } = useProjectContext()
  const lang = useCurrentLang()

  /** 'project' on a project route, 'site' everywhere else. */
  const scope = computed<SearchScope>(() => (project.value ? 'project' : 'site'))
  /** Project name on a project route, '_site' otherwise — used to build the index URL. */
  const scopeKey = computed(() => project.value ?? '_site')

  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  /**
   * Resolve the MiniSearch instance for the CURRENT (lang, scopeKey), loading
   * it on demand. Coalesces concurrent first-loads onto one promise.
   */
  async function getInstance(): Promise<MiniSearch<SearchDoc>> {
    const l = lang.value
    const key = scopeKey.value
    const ck = `${l}::${key}`

    const cached = cache.get(ck)
    if (cached) return cached

    const inflight = loading.get(ck)
    if (inflight) return inflight

    isLoading.value = true
    error.value = null
    const p = (async () => {
      try {
        const res = await fetch(`/search-index/${l}/${key}.json`)
        if (!res.ok) throw new Error(`search index HTTP ${res.status}`)
        const docs = (await res.json()) as SearchDoc[]
        const { default: MiniSearch } = await import('minisearch')
        const ms = new MiniSearch<SearchDoc>({
          fields: ['title', 'description', 'headings', 'text'],
          storeFields: ['title', 'description', 'headings', 'url', 'project'],
          tokenize: cjkTokenize as (text: string, fieldName?: string) => string[],
          processTerm: cjkProcessTerm as (term: string, fieldName?: string) => string | null,
          searchOptions: {
            boost: { title: 3, headings: 2, description: 1.5 },
            // Latin-friendly: short CJK unigram/bigram tokens (length 1–2) are
            // unaffected, so these only kick in for longer Latin words.
            prefix: (term: string) => term.length >= 4,
            fuzzy: (term: string) => (term.length >= 5 ? 0.2 : false),
            combineWith: 'AND'
          }
        })
        ms.addAll(docs)
        cache.set(ck, ms)
        return ms
      } catch (e) {
        // Allow the next attempt to retry from scratch.
        loading.delete(ck)
        error.value = e instanceof Error ? e : new Error(String(e))
        throw e
      } finally {
        isLoading.value = false
      }
    })()

    loading.set(ck, p)
    // On success, clear the in-flight slot (instance is now in `cache`).
    p.then(() => loading.delete(ck)).catch(() => loading.delete(ck))
    return p
  }

  /**
   * Run a query against the current scope's index. Triggers a fetch on first
   * call for a (lang, scope) pair. Returns up to `limit` (default 12) hits,
   * most relevant first; an empty array on a blank query.
   */
  async function search(query: string, limit = 12): Promise<SearchResult[]> {
    const q = query.trim()
    if (!q) return []
    const ms = await getInstance()
    const raw = ms.search(q).slice(0, limit)
    return raw.map((r) => ({
      title: r.title as string,
      description: r.description as string,
      headings: r.headings as string,
      url: (r.url as string) ?? r.id,
      project: r.project as ProjectName | '',
      score: r.score
    }))
  }

  return { scope, scopeKey, isLoading, error, search }
}

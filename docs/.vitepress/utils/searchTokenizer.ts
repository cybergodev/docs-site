/**
 * CJK-aware tokenizer shared by the build-time index generator
 * (`scripts/generate-search-index.ts`) and the runtime search composable
 * (`theme/composables/useProjectSearch.ts`).
 *
 * minisearch's default tokenizer splits on non-alphanumerics, which leaves a
 * whole CJK run (e.g. `配置选项`) as a single giant token — searching for
 * `配置` then matches nothing. This tokenizer instead:
 *   - keeps Latin / digit runs as whole words (case-folded downstream), and
 *   - splits every CJK run into UNIGRAMS plus BIGRAMS (overlapping pairs),
 *     so single-character queries (`配`) and two-character queries (`配置`)
 *     both hit the index. Bigrams lift precision for the common 2-char CJK
 *     search case without giving up recall.
 *
 * It is a PURE module — no fs, no async, no env, no vitepress — so it loads
 * safely into both Node (tsx) and the browser bundle. Mirrors the contract
 * of `frontmatter.ts` in the same folder.
 *
 * `cjkProcessTerm` is the matching-side companion to `cjkTokenize`: it lower-
 * cases a search term and returns `null` for the empty string so minisearch
 * skips it (matching the built-in behavior). Importing BOTH from this file
 * guarantees index-time and query-time tokenization agree.
 */

/**
 * A maximal run of CJK characters — Han (ext-A + unified), compatibility
 * ideographs, Hangul syllables, Hiragana, Katakana. Used to slice out the
 * segments that need unigram+bigram splitting.
 */
const CJK_RUN_RE = /[㐀-鿿豈-﫿가-힯぀-ゟ゠-ヿ]+/g

/**
 * A maximal run of non-CJK letters and digits — kept whole as a single token
 * (e.g. `GetString`, `TLS`, `1.2`). Covers Latin (basic + extended,
 * U+00C0–U+024F) AND Cyrillic (U+0400–U+052F, incl. supplement) so the
 * Russian (`ru`) tree is searchable — without this, Cyrillic runs produce
 * zero tokens and ru searches silently match nothing. CJK is handled
 * separately by CJK_RUN_RE (unigram+bigram), with which this never overlaps.
 * Case is folded by `cjkProcessTerm` at query time and matched against the
 * same fold applied at index time.
 */
const WORD_RE = /[0-9A-Za-zÀ-ɏЀ-ԯ]+/g

/**
 * Tokenize text for minisearch indexing. Returns an array of lowercase-ish
 * tokens: Latin words as-is (lowercased later by `processTerm`), CJK chars
 * as unigrams + overlapping bigrams.
 */
export function cjkTokenize(text: string): string[] {
  if (!text) return []
  const tokens: string[] = []
  for (const m of text.matchAll(WORD_RE)) tokens.push(m[0])
  for (const runMatch of text.matchAll(CJK_RUN_RE)) {
    const run = runMatch[0]
    for (const ch of run) tokens.push(ch) // unigram — supports single-char queries
    if (run.length >= 2) {
      for (let i = 0; i < run.length - 1; i++) tokens.push(run.slice(i, i + 2)) // bigram — precision boost
    }
  }
  return tokens
}

/**
 * Process a search term prior to lookup. Returns the term lowercased (so
 * Latin queries are case-insensitive against the same fold applied at index
 * time), or `null` for an empty term so minisearch skips it.
 */
export function cjkProcessTerm(term: string): string | null {
  return term ? term.toLowerCase() : null
}

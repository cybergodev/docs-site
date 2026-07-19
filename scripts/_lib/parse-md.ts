import {
  extractFrontmatter,
  extractBody,
  parseFmField
} from '../../docs/.vitepress/utils/frontmatter'

/**
 * Parse title / description from YAML frontmatter and return the body without
 * it. Falls back to the first H1 if `title` is absent (markdown emphasis
 * markers stripped). Frontmatter parsing delegates to `utils/frontmatter`
 * (single-line fields, no YAML dependency), shared with the
 * sidebar builder.
 *
 * Used by `generate-llms.ts` and `generate-search-index.ts` so the two
 * post-build scripts share one extraction routine instead of carrying a
 * near-identical copy each.
 */
export function parseMd(content: string): { title: string; description: string; body: string } {
  const fm = extractFrontmatter(content)
  let title = fm ? (parseFmField(fm, 'title') ?? '') : ''
  let description = fm ? (parseFmField(fm, 'description') ?? '') : ''
  const body = extractBody(content)
  if (!title) {
    const h1 = body.match(/^#\s+(.+?)\s*$/m)
    if (h1) title = h1[1].replace(/[*_`]/g, '')
  }
  return { title: title.trim(), description: description.trim(), body: body.trim() }
}

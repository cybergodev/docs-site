/**
 * Minimal frontmatter helpers shared by the sidebar builder (config-time,
 * sync fs) and the llms.txt generator (post-build, async fs).
 *
 * These are PURE functions — no fs, no async — so each caller keeps its own
 * I/O style while sharing one parsing implementation. CLAUDE.md guarantees the
 * frontmatter fields in use (`title` / `description` / `sidebar_label` /
 * `sidebar_position`) are single-line and double-quoted, so a regex is enough
 * and no YAML dependency is needed.
 */

/** Matches a leading YAML frontmatter block (capture group 1 = inner text). */
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/

/** Inner text between the `---` fences of a leading frontmatter block, or ''. */
export function extractFrontmatter(content: string): string {
  return content.match(FM_RE)?.[1] ?? ''
}

/** Content with a leading frontmatter block (and its trailing newline) removed. */
export function extractBody(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

/**
 * Read a single-line frontmatter field. Strips one matched pair of surrounding
 * quotes (both `"` or both `'`); leaves unquoted values untouched. `key` is
 * assumed to be a plain field name (word characters) — the callers only ever
 * pass `title` / `description` / `sidebar_label` / `sidebar_position`.
 */
export function parseFmField(fm: string, key: string): string | undefined {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))
  if (!m) return undefined
  const val = m[1]
  const q = val.match(/^["']([\s\S]*)["']$/)
  return q ? q[1] : val
}

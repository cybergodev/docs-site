/**
 * Escape `&`, `<`, `>` and `"` for safe interpolation into HTML attribute
 * values and inline text. Used by the redirect-page generators
 * (`generate-project-redirects.ts`, `generate-moved-redirects.ts`) when
 * interpolating a user-influenced path into a redirect page's `<title>`/`<a>`
 * text. Apostrophes (`'`) are intentionally NOT escaped — none of the callers
 * emit single-quoted attributes.
 */
export function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }
  return s.replace(/[&<>"]/g, (c) => map[c])
}

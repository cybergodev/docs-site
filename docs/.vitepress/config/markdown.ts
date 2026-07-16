// Heading-anchor slugify.
//
// VitePress's default slugify normalizes with NFKD, which *decomposes*
// composed scripts — Hangul syllables into conjoining jamo (확장 → 확장),
// voiced kana into base+kana-combining-mark (ジェ → シ+゙), and accented letters
// into base+combining-mark (ё → е+◌̈, й → и+◌̆) — then strips the combining
// marks. The resulting decomposed heading IDs never match internal
// `[text](#anchor)` links, which carry the source's composed (NFC) form
// verbatim, so every Korean / voiced-Japanese / ё / й in-page anchor is dead.
//
// Normalizing to NFC instead keeps those scripts composed (so IDs match the
// links). We treat any run of non-letter/non-number code points as a
// separator — that composes the above scripts while producing identical slugs
// to the default for ASCII, CJK, and fullwidth punctuation (so existing zh/en
// anchors are unaffected; fullwidth （） → - just like the NFKD default would).
//
// Applied to `markdown.slugify` (TOC), `markdown.anchor.slugify` (the actual
// heading id="..." via markdown-it-anchor) and `markdown.headers.slugify`
// (the right-side outline) so all three stay consistent.
const slugifyHeading = (s: string): string =>
  s
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase()

// VitePress's MarkdownOptions type omits the runtime-supported top-level `slugify`.
export const markdownConfig = {
  slugify: slugifyHeading,
  anchor: { slugify: slugifyHeading },
  headers: { slugify: slugifyHeading }
} as any

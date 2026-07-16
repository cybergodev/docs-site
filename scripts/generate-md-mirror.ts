/**
 * Mirror every Markdown source file into dist/ so each rendered page has a
 * fetchable raw-.md counterpart.
 *
 * The per-page `<link rel="alternate" type="text/markdown">` (emitted by
 * config/seo.ts transformHead) points at `${HOST}/{relativePath}` — i.e. this
 * mirrored file. That lets LLMs / crawlers pull the exact source for a page in
 * a single request. It is complementary to the llms.txt outputs:
 *   - /llms.txt      → site-wide index (table of contents)
 *   - /llms-full.txt → whole-site dump (aggregate)
 *   - /{page}.md     → per-page source (precision)  ← this script
 *
 * Mirrors every language tree (zh/en/ko/ja/ru) plus the root index.md,
 * preserving the docs/ relative path (docs/zh/json/x.md → dist/zh/json/x.md).
 * Skips the .vitepress/ internals.
 *
 * Run after `vitepress build` (see package.json `build`).
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { DIST_DIR } from '../docs/.vitepress/shared'
import { collectMd } from './_lib/walk'

/** Markdown source root, relative to the repo root. */
const SRC_DIR = 'docs'

async function main(): Promise<void> {
  // Skip VitePress internals (config/theme/scripts/cache/dist). The shared
  // helper skips a name at any depth; the original only skipped `.vitepress`
  // directly under `docs/`, but no nested `.vitepress` exists in a clean tree,
  // so this is equivalent and also guards against stray nested copies.
  const files = await collectMd(SRC_DIR, { skipDirs: ['.vitepress'] })
  let count = 0
  for (const f of files) {
    const content = await readFile(f, 'utf8')
    // docs/zh/json/x.md → dist/zh/json/x.md
    const rel = f.slice(SRC_DIR.length + 1).replace(/\\/g, '/')
    const dest = join(DIST_DIR, rel)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, content, 'utf8')
    count++
  }
  console.log(`md-mirror: copied ${count} markdown files to dist/`)
}

await main()

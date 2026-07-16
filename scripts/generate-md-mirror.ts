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
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import type { Dirent } from 'fs'
import { DIST_DIR } from '../docs/.vitepress/shared'

/** Markdown source root, relative to the repo root. */
const SRC_DIR = 'docs'

// Recursively collect every *.md file under `root`, skipping .vitepress/.
async function collectMd(root: string): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      // Skip VitePress internals (config/theme/scripts/cache/dist).
      if (dir === SRC_DIR && entry.name === '.vitepress') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.md')) out.push(full)
    }
  }
  await walk(root)
  return out
}

async function main(): Promise<void> {
  const files = await collectMd(SRC_DIR)
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

import { readdir } from 'fs/promises'
import { join } from 'path'
import type { Dirent } from 'fs'

export interface CollectOptions {
  /** Directory base names to skip entirely (matched at any depth). */
  skipDirs?: string[]
  /** File extension to collect, including the leading dot. Default `.md`. */
  ext?: string
}

/**
 * Recursively collect the path of every file whose name ends with `ext` under
 * `root`, descending into subdirectories except those whose base name appears
 * in `skipDirs`. Paths are returned joined under `root` (i.e. relative or
 * absolute depending on what was passed in).
 *
 * Centralizes the "walk a tree and gather matching files" logic shared by the
 * post-build and audit scripts (five near-identical copies used to live
 * inline). A missing or unreadable directory resolves to an empty list —
 * callers rely on that for optional trees such as a language dir that may not
 * exist yet.
 *
 * Named `collectMd` after its dominant use (gathering Markdown); the `ext`
 * option generalizes it, e.g. `collectMd(root, { ext: '.html' })`.
 */
export async function collectMd(root: string, opts: CollectOptions = {}): Promise<string[]> {
  const { skipDirs = [], ext = '.md' } = opts
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return // dir missing / unreadable — treat as empty
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (skipDirs.includes(entry.name)) continue
        await walk(join(dir, entry.name))
      } else if (entry.name.endsWith(ext)) {
        out.push(join(dir, entry.name))
      }
    }
  }
  await walk(root)
  return out
}

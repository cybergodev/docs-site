import type { DefaultTheme } from 'vitepress'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECTS, type Lang } from '../../shared'

/**
 * Filesystem-generated sidebars (Phase 2).
 *
 * The sidebar structure IS the directory tree. Each directory is a sidebar
 * group whose label / order / collapse come from its `_category_.json`; each
 * Markdown file is a leaf whose label comes from its frontmatter
 * `sidebar_label` (falling back to `title`) and whose order comes from
 * `sidebar_position`. There is no hand-written structure file.
 *
 *   - Add a page     → create the `.md` (its frontmatter is the label/order).
 *   - Add a group    → make a directory + a one-line `_category_.json`.
 *   - Restructure    → move files/directories; every language follows.
 *
 * Per-project layout: the project root `index.md` (概述) is hoisted to the top
 * of that project's sidebar; every other top-level entry is a group directory.
 *
 * VitePress resolves the sidebar at config time, in Node, so synchronous file
 * reads here are fine. This module is never shipped to the client bundle
 * (sidebars become serialized data in the build); `shared.ts` stays the only
 * pure-data module imported by the client.
 *
 * Dev note: editing `_category_.json` / `sidebar_position` / `sidebar_label`
 * does not trigger a VitePress config reload (`.md`/`.json` are content, not
 * config) — restart `vitepress dev` to see sidebar changes locally. Production
 * builds always read fresh.
 */

const DOCS = 'docs'

/** Matches a leading YAML frontmatter block, tolerating mixed line endings. */
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/

interface CategoryMeta {
  label?: string
  position?: number
  collapsed?: boolean
}

function readCategory(dirAbs: string): CategoryMeta | null {
  const f = join(dirAbs, '_category_.json')
  if (!existsSync(f)) return null
  try {
    return JSON.parse(readFileSync(f, 'utf8')) as CategoryMeta
  } catch {
    return null
  }
}

function frontmatter(raw: string): string {
  return raw.match(FM_RE)?.[1] ?? ''
}

function fmField(fm: string, key: string): string | undefined {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))
  return m ? m[1].replace(/^['"]|['"]$/g, '') : undefined
}

function titleCase(slug: string): string {
  return slug
    .replace(/\.md$/, '')
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

/** A leaf's sidebar label: frontmatter `sidebar_label` → `title` → pretty file name. */
function leafLabel(fileAbs: string, fileName: string): string {
  const fm = frontmatter(readFileSync(fileAbs, 'utf8'))
  return fmField(fm, 'sidebar_label') ?? fmField(fm, 'title') ?? titleCase(fileName)
}

function leafPosition(fileAbs: string): number {
  const v = fmField(frontmatter(readFileSync(fileAbs, 'utf8')), 'sidebar_position')
  const n = v == null ? NaN : Number(v)
  return Number.isFinite(n) ? n : Infinity
}

/** Does `dir` contain any `.md` file, at any depth? (Skips empty directories.) */
function hasMd(dirAbs: string): boolean {
  for (const e of readdirSync(dirAbs, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (hasMd(join(dirAbs, e.name))) return true
    } else if (e.name.endsWith('.md')) {
      return true
    }
  }
  return false
}

type RawItem = { item: DefaultTheme.SidebarItem; position: number }

/** Build the children of a directory (mix of leaves and group subdirs), sorted
 * by a unified position key so leaves and groups interleave in author order. */
function buildChildren(lang: Lang, dirAbs: string, dirRel: string): DefaultTheme.SidebarItem[] {
  const raw: RawItem[] = []
  for (const e of readdirSync(dirAbs, { withFileTypes: true })) {
    if (e.name === '_category_.json') continue
    const childAbs = join(dirAbs, e.name)
    const childRel = `${dirRel}/${e.name}`

    if (e.isDirectory()) {
      if (!hasMd(childAbs)) continue
      const meta = readCategory(childAbs)
      raw.push({
        item: {
          text: meta?.label ?? titleCase(e.name),
          collapsed: meta?.collapsed ?? true,
          items: buildChildren(lang, childAbs, childRel)
        },
        position: meta?.position ?? Infinity
      })
    } else if (e.name.endsWith('.md')) {
      const isIndex = e.name === 'index.md'
      raw.push({
        item: {
          text: leafLabel(childAbs, e.name),
          link: isIndex
            ? `/${lang}/${dirRel}/`
            : `/${lang}/${dirRel}/${e.name.replace(/\.md$/, '')}`
        },
        position: leafPosition(childAbs)
      })
    }
  }
  return raw.sort((a, b) => a.position - b.position).map((r) => r.item)
}

/** Build the full sidebar config (`/{lang}/{project}/` → items) for one language. */
export function buildSidebars(lang: Lang): Record<string, DefaultTheme.SidebarItem[]> {
  const result: Record<string, DefaultTheme.SidebarItem[]> = {}
  for (const project of PROJECTS) {
    const root = buildChildren(lang, join(DOCS, lang, project), project)
    // Hoist the project index page (概述) to the very top of the sidebar.
    const indexLink = `/${lang}/${project}/`
    const idx = root.find((it) => 'link' in it && it.link === indexLink)
    result[indexLink] = idx ? [idx, ...root.filter((it) => it !== idx)] : root
  }
  return result
}

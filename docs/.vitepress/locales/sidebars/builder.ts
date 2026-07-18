import type { DefaultTheme } from 'vitepress'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECTS, type Lang } from '../../shared'
import { extractFrontmatter, parseFmField } from '../../utils/frontmatter'

/**
 * Filesystem-generated sidebars (Phase 2).
 *
 * The sidebar structure IS the directory tree. Each directory is a sidebar
 * group whose label / order / collapse come from its `_category_.json`; each
 * Markdown file is a leaf whose label comes from its frontmatter
 * `sidebar_label` (falling back to `title`) and whose order comes from
 * `sidebar_position`. An optional emoji icon is prefixed to the rendered text
 * when present — from `_category_.json` `icon` (groups) or frontmatter
 * `sidebar_icon` (leaves) — matching the `PROJECT_META.icon` emoji style.
 * There is no hand-written structure file.
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
 * (sidebars become serialized data in the build). The pure-data modules that DO
 * reach the client bundle are `shared.ts` and `config/labels.ts` (the latter is
 * pulled in by `composables/useUiLabels.ts` for component-facing UI strings).
 *
 * Frontmatter parsing delegates to `utils/frontmatter.ts` (shared with the
 * llms.txt generator) so the unquote/field-extract logic lives in one place.
 *
 * Dev note: editing `_category_.json` / `sidebar_position` / `sidebar_label`
 * does not trigger a VitePress config reload (`.md`/`.json` are content, not
 * config) — restart `vitepress dev` to see sidebar changes locally. Production
 * builds always read fresh.
 */

const DOCS = 'docs'

interface CategoryMeta {
  label?: string
  position?: number
  collapsed?: boolean
  icon?: string
}

function readCategory(dirAbs: string): CategoryMeta | null {
  const f = join(dirAbs, '_category_.json')
  if (!existsSync(f)) return null
  try {
    return JSON.parse(readFileSync(f, 'utf8')) as CategoryMeta
  } catch (e) {
    // Surface a malformed _category_.json instead of silently falling back to
    // the title-cased directory name (which would quietly mislabel the group).
    console.warn(
      `[sidebar] failed to parse ${f}: ${e instanceof Error ? e.message : e} — falling back to directory name`
    )
    return null
  }
}

function titleCase(slug: string): string {
  return slug
    .replace(/\.md$/, '')
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
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
      const groupLabel = meta?.label ?? titleCase(e.name)
      raw.push({
        item: {
          text: meta?.icon ? `${meta.icon} ${groupLabel}` : groupLabel,
          collapsed: meta?.collapsed ?? true,
          items: buildChildren(lang, childAbs, childRel)
        },
        position: meta?.position ?? Infinity
      })
    } else if (e.name.endsWith('.md')) {
      const isIndex = e.name === 'index.md'
      // Read this page's frontmatter once; derive label / position / icon.
      const fm = extractFrontmatter(readFileSync(childAbs, 'utf8'))
      const label =
        parseFmField(fm, 'sidebar_label') ?? parseFmField(fm, 'title') ?? titleCase(e.name)
      const icon = parseFmField(fm, 'sidebar_icon')
      const posRaw = parseFmField(fm, 'sidebar_position')
      const posNum = posRaw == null ? NaN : Number(posRaw)
      raw.push({
        item: {
          text: icon ? `${icon} ${label}` : label,
          link: isIndex
            ? `/${lang}/${dirRel}/`
            : `/${lang}/${dirRel}/${e.name.replace(/\.md$/, '')}`
        },
        position: Number.isFinite(posNum) ? posNum : Infinity
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

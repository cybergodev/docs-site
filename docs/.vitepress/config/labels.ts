import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'
import { PROJECTS, type Lang } from '../shared'
import { EDIT_LINK_BASE, DOC_ISSUE_URL } from '../shared'

/**
 * Copyright year, stamped once at module load — the single source for every
 * footer copyright line (SiteFooter via UI_LABELS, and the VitePress
 * themeConfig footers via buildFooter / config.mts).
 *
 * Deliberately a build-time value, not an onMounted-corrected ref: this module
 * is imported by BOTH the Node build (SSG output) and the browser bundle, so
 * the rendered year is build year on the server and visitor year on the
 * client. An onMounted flip cannot remove that first-render difference (the
 * mismatch, if any, happens before mount); the only mismatch-free dynamic
 * option would be omitting the year from SSR output entirely, which no-JS
 * visitors would then never see. The site redeploys on every push to main, so
 * build year tracks the calendar and the only drift is a stale deploy crossing
 * New Year, where the client value (the newer year) wins after hydration
 * anyway.
 */
export const COPYRIGHT_YEAR = new Date().getFullYear()

/**
 * Per-language UI strings, in ONE place — keyed by language so a missing
 * translation is a type error, not a silent gap.
 *
 * The factory helpers below turn a language code + this table into a full
 * LocaleSpecificConfig, so config/locales.ts has zero per-language boilerplate
 * and adding a language is one row here + one in shared.ts LANGS.
 *
 * The `UiLabels` table is ALSO the single source for client-side component
 * strings (SiteFooter / NotFound / LanguagePrompt), consumed via
 * the `useUiLabels()` composable.
 */
export interface UiLabels {
  /** SEO `<meta name="description">` for the locale's pages. */
  description: string
  /** Top-nav group label for the project list. */
  navProjects: string
  /** Top-nav "About" link label (also reused as SiteFooter column title). */
  navAbout: string
  /** "Edit this page on GitHub" link text. */
  editLinkText: string
  /** Footer license note, e.g. "Released under the MIT License". */
  footerLicense: string
  /** Footer "report a doc issue" link text (reused by SiteFooter). */
  footerReportIssue: string
  /** Prev / next page footer labels. */
  docFooterPrev: string
  docFooterNext: string
  /** Right-side outline heading. */
  outlineLabel: string
  /** Prefix beside the page's git timestamp (shown when lastUpdated is on). */
  lastUpdatedText: string
  /** ProjectSearch trigger + modal input placeholder. */
  searchPlaceholder: string
  // --- VitePress themeConfig label fields ---
  langMenuLabel: string
  returnToTopLabel: string
  sidebarMenuLabel: string
  darkModeSwitchLabel: string
  lightModeSwitchTitle: string
  darkModeSwitchTitle: string

  // --- Component-facing strings (consumed via useUiLabels) ---
  // SiteFooter
  footerBrandDesc: string
  footerCommunity: string
  footerAboutSite: string
  footerEditDocs: string
  /** Standalone word "License", used in "MIT {license}". */
  footerLicenseWord: string
  footerCopyright: string
  footerOpensInNewWindow: string
  // NotFound
  notFoundTitle: string
  notFoundDesc: string
  notFoundGoHome: string
  notFoundGoBack: string
  /** Section heading above the 404 project grid. */
  notFoundBrowse: string
  // LanguagePrompt
  /** Prompt text template; `{label}` is replaced with the suggested language name. */
  langPromptTextTemplate: string
  langPromptSwitch: string
  langPromptDismiss: string
  // CliCommand / GoPlaygroundButton
  /** "Docs" link label on a CliCommand block. */
  cliDocs: string
  /** "Open in Go Playground" button label. */
  openInPlayground: string
  /** Toast shown when a snippet was copied as the share fallback. */
  codeCopied: string
  // Breadcrumb
  /** Home link label in the breadcrumb trail. */
  breadcrumbHome: string
  /** `aria-label` for the breadcrumb `<nav>` landmark. */
  breadcrumbAriaLabel: string
  // ProjectSearch — local minisearch with per-project + per-language scope
  /** Result list empty state. */
  searchNoResults: string
  /** Index-load failure state (distinct from "no results"). */
  searchError: string
  /** Scope badge on a project page; `{project}` is replaced with the upper-case project key. */
  searchScopeProject: string
  /** Scope badge on a non-project page (home / about). */
  searchScopeSite: string
  /** "Scope" word prefixing the badge. */
  searchScopeLabel: string
  /** Loading state shown while the index JSON is being fetched. */
  searchLoading: string
  /** `aria-label` for the search trigger button. */
  searchAriaLabel: string
  /** Modal close button label + its `aria-label`. */
  searchClose: string
}

export const UI_LABELS: Record<Lang, UiLabels> = {
  zh: {
    description: '高性能 Go 开源库文档',
    navProjects: '项目',
    navAbout: '关于',
    editLinkText: '在 GitHub 编辑此页',
    footerLicense: '基于 MIT 许可发布',
    footerReportIssue: '报告文档问题',
    docFooterPrev: '上一页',
    docFooterNext: '下一页',
    outlineLabel: '页面导航',
    lastUpdatedText: '最后更新',
    searchPlaceholder: '搜索文档...',
    langMenuLabel: '多语言',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    footerBrandDesc:
      '专为 Go 语言打造的高性能开源库集合，涵盖 JSON、JWT、HTTP 客户端、HTML 提取、日志和环境变量管理。',
    footerCommunity: '社区',
    footerAboutSite: '关于本站',
    footerEditDocs: '编辑文档',
    footerLicenseWord: '许可证',
    footerCopyright: `版权所有 © ${COPYRIGHT_YEAR} CyberGo (cybergo.dev)`,
    footerOpensInNewWindow: '（在新窗口打开）',
    notFoundTitle: '页面未找到',
    notFoundDesc: '抱歉，您访问的页面不存在或已被移除。',
    notFoundGoHome: '返回首页',
    notFoundGoBack: '返回上页',
    notFoundBrowse: '浏览项目文档',
    langPromptTextTemplate: '检测到您的浏览器语言为「{label}」，是否切换？',
    langPromptSwitch: '切换语言',
    langPromptDismiss: '暂不',
    cliDocs: '文档',
    openInPlayground: '在 Go Playground 打开',
    codeCopied: '代码已复制，请粘贴',
    breadcrumbHome: '首页',
    breadcrumbAriaLabel: '面包屑导航',
    searchNoResults: '未找到相关文档',
    searchError: '搜索索引加载失败，重新输入关键词将自动重试',
    searchScopeProject: '仅在 {project}',
    searchScopeSite: '全站',
    searchScopeLabel: '范围',
    searchLoading: '正在加载索引…',
    searchAriaLabel: '搜索',
    searchClose: '关闭'
  },
  en: {
    description: 'High-Performance Go Open Source Library Documentation',
    navProjects: 'Projects',
    navAbout: 'About',
    editLinkText: 'Edit this page on GitHub',
    footerLicense: 'Released under the MIT License',
    footerReportIssue: 'Report a doc issue',
    docFooterPrev: 'Previous',
    docFooterNext: 'Next',
    outlineLabel: 'On this page',
    lastUpdatedText: 'Last updated',
    searchPlaceholder: 'Search docs...',
    langMenuLabel: 'Language',
    returnToTopLabel: 'Return to top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Theme',
    lightModeSwitchTitle: 'Switch to light theme',
    darkModeSwitchTitle: 'Switch to dark theme',
    footerBrandDesc:
      'High-performance Go open-source library collection: JSON, JWT, HTTP client, HTML extraction, logging, and environment management.',
    footerCommunity: 'Community',
    footerAboutSite: 'About This Site',
    footerEditDocs: 'Edit Docs',
    footerLicenseWord: 'License',
    footerCopyright: `Copyright © ${COPYRIGHT_YEAR} CyberGo (cybergo.dev)`,
    footerOpensInNewWindow: '(opens in new window)',
    notFoundTitle: 'Page Not Found',
    notFoundDesc: 'Sorry, the page you are looking for does not exist or has been removed.',
    notFoundGoHome: 'Go Home',
    notFoundGoBack: 'Go Back',
    notFoundBrowse: 'Browse Documentation',
    langPromptTextTemplate: 'Your browser language appears to be {label}. Switch?',
    langPromptSwitch: 'Switch',
    langPromptDismiss: 'Not now',
    cliDocs: 'Docs',
    openInPlayground: 'Open in Go Playground',
    codeCopied: 'Code copied — paste it',
    breadcrumbHome: 'Home',
    breadcrumbAriaLabel: 'Breadcrumb',
    searchNoResults: 'No results found',
    searchError: 'Failed to load search index — type again to retry',
    searchScopeProject: 'In {project}',
    searchScopeSite: 'All projects',
    searchScopeLabel: 'Scope',
    searchLoading: 'Loading index…',
    searchAriaLabel: 'Search',
    searchClose: 'Close'
  }
}

/**
 * Top nav for a language. The structure is identical across languages — the
 * project list IS shared.ts PROJECTS, only the two group labels and the URL
 * prefix differ — so it is generated rather than hand-written per locale.
 * Project entries render as upper-case (`JSON`, `JWT`, …) matching the
 * original nav.
 */
export function buildNav(lang: Lang): DefaultTheme.NavItem[] {
  const l = UI_LABELS[lang]
  return [
    {
      text: l.navProjects,
      items: PROJECTS.map((p) => ({ text: p.toUpperCase(), link: `/${lang}/${p}/` }))
    },
    { text: l.navAbout, link: `/${lang}/about` }
  ]
}

/** VitePress themeConfig label fields for a language (spread into themeConfig). */
function themeLabels(lang: Lang) {
  const l = UI_LABELS[lang]
  return {
    langMenuLabel: l.langMenuLabel,
    returnToTopLabel: l.returnToTopLabel,
    sidebarMenuLabel: l.sidebarMenuLabel,
    darkModeSwitchLabel: l.darkModeSwitchLabel,
    lightModeSwitchTitle: l.lightModeSwitchTitle,
    darkModeSwitchTitle: l.darkModeSwitchTitle,
    docFooter: { prev: l.docFooterPrev, next: l.docFooterNext },
    outline: { label: l.outlineLabel },
    lastUpdatedText: l.lastUpdatedText
  }
}

/** "Edit this page" link — VitePress resolves `:path` to the page's path relative
 * to `srcDir` (i.e. `docs/`), which already includes the language segment
 * (e.g. `zh/json/index.md`). The base therefore only appends `/:path`;
 * adding `/${lang}` here would produce a duplicated language segment (`/zh/zh/`).
 * `lang` is still needed to localize the link text. */
function buildEditLink(lang: Lang) {
  return {
    pattern: `${EDIT_LINK_BASE}/:path`,
    text: UI_LABELS[lang].editLinkText
  }
}

/** Footer with the localized license note + report-issue link. */
function buildFooter(lang: Lang): DefaultTheme.Config['footer'] {
  const l = UI_LABELS[lang]
  return {
    // rel on the target="_blank" anchor: noopener (window.opener hardening,
    // same as SiteFooter's links) + noreferrer (referrerpolicy hygiene).
    message: `${l.footerLicense} · <a href="${DOC_ISSUE_URL}" target="_blank" rel="noopener noreferrer">${l.footerReportIssue}</a>`,
    copyright: `Copyright © ${COPYRIGHT_YEAR} CyberGoDev`
  }
}

/**
 * Build the full LocaleSpecificConfig for a language, given its sidebar.
 * Everything except the sidebar is derived from UI_LABELS + lang — the only
 * per-language input that ISN'T a flat string is the sidebar, which has
 * structure and is built separately by locales/sidebars/builder.ts.
 */
export function buildLocaleConfig(
  lang: Lang,
  sidebar: Record<string, DefaultTheme.SidebarItem[]>
): LocaleSpecificConfig<DefaultTheme.Config> {
  return {
    description: UI_LABELS[lang].description,
    themeConfig: {
      nav: buildNav(lang),
      sidebar,
      editLink: buildEditLink(lang),
      footer: buildFooter(lang),
      ...themeLabels(lang)
    }
  }
}

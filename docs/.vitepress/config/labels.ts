import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'
import { PROJECTS, type Lang } from '../shared'
import { EDIT_LINK_BASE, DOC_ISSUE_URL } from '../shared'

/**
 * Per-language UI strings, in ONE place.
 *
 * The five old locale files (locales/{zh,en,ko,ja,ru}.ts) each duplicated ~12
 * label fields — nav text, doc footer, outline, theme-switch titles, edit-link
 * text, footer license + report-issue, search placeholder — plus a structurally
 * identical nav. They now live here, keyed by language, so a translator
 * reviews the whole set at once and a missing translation is a type error,
 * not a silent gap.
 *
 * The factory helpers below turn a language code + this table into a full
 * LocaleSpecificConfig, so config/locales.ts has zero per-language boilerplate
 * and adding a language is one row here + one in shared.ts LANGS.
 */
export interface UiLabels {
  /** SEO `<meta name="description">` for the locale's pages. */
  description: string
  /** Top-nav group label for the project list. */
  navProjects: string
  /** Top-nav "About" link label. */
  navAbout: string
  /** "Edit this page on GitHub" link text. */
  editLinkText: string
  /** Footer license note, e.g. "Released under the MIT License". */
  footerLicense: string
  /** Footer "report a doc issue" link text. */
  footerReportIssue: string
  /** Prev / next page footer labels. */
  docFooterPrev: string
  docFooterNext: string
  /** Right-side outline heading. */
  outlineLabel: string
  /** Algolia search box placeholder. */
  searchPlaceholder: string
  // --- VitePress themeConfig label fields ---
  langMenuLabel: string
  returnToTopLabel: string
  sidebarMenuLabel: string
  darkModeSwitchLabel: string
  lightModeSwitchTitle: string
  darkModeSwitchTitle: string
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
    searchPlaceholder: '搜索文档...',
    langMenuLabel: '多语言',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式'
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
    searchPlaceholder: 'Search docs...',
    langMenuLabel: 'Language',
    returnToTopLabel: 'Return to top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Theme',
    lightModeSwitchTitle: 'Switch to light theme',
    darkModeSwitchTitle: 'Switch to dark theme'
  },
  ko: {
    description: '고성능 Go 오픈소스 라이브러리 문서',
    navProjects: '프로젝트',
    navAbout: '소개',
    editLinkText: 'GitHub에서 이 페이지 편집',
    footerLicense: 'MIT 라이선스로 배포',
    footerReportIssue: '문서 문제 보고',
    docFooterPrev: '이전',
    docFooterNext: '다음',
    outlineLabel: '이 페이지에서',
    searchPlaceholder: '문서 검색...',
    langMenuLabel: '언어',
    returnToTopLabel: '맨 위로',
    sidebarMenuLabel: '메뉴',
    darkModeSwitchLabel: '테마',
    lightModeSwitchTitle: '라이트 테마로 전환',
    darkModeSwitchTitle: '다크 테마로 전환'
  },
  ja: {
    description: '高性能 Go オープンソースライブラリドキュメント',
    navProjects: 'プロジェクト',
    navAbout: '概要',
    editLinkText: 'GitHub でこのページを編集',
    footerLicense: 'MIT ライセンスで公開',
    footerReportIssue: 'ドキュメントの問題を報告',
    docFooterPrev: '前へ',
    docFooterNext: '次へ',
    outlineLabel: 'このページの内容',
    searchPlaceholder: 'ドキュメントを検索...',
    langMenuLabel: '言語',
    returnToTopLabel: 'トップに戻る',
    sidebarMenuLabel: 'メニュー',
    darkModeSwitchLabel: 'テーマ',
    lightModeSwitchTitle: 'ライトモードに切り替え',
    darkModeSwitchTitle: 'ダークモードに切り替え'
  },
  ru: {
    description: 'Документация высокопроизводительных библиотек Go с открытым исходным кодом',
    navProjects: 'Проекты',
    navAbout: 'О проекте',
    editLinkText: 'Редактировать эту страницу на GitHub',
    footerLicense: 'Выпущено под лицензией MIT',
    footerReportIssue: 'Сообщить о проблеме в документации',
    docFooterPrev: 'Предыдущая',
    docFooterNext: 'Следующая',
    outlineLabel: 'Содержание страницы',
    searchPlaceholder: 'Поиск в документации...',
    langMenuLabel: 'Язык',
    returnToTopLabel: 'Вернуться наверх',
    sidebarMenuLabel: 'Меню',
    darkModeSwitchLabel: 'Тема',
    lightModeSwitchTitle: 'Переключить на светлую тему',
    darkModeSwitchTitle: 'Переключить на тёмную тему'
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
    outline: { label: l.outlineLabel }
  }
}

/** "Edit this page" link — pattern embeds the language segment, text is localized. */
function buildEditLink(lang: Lang) {
  return {
    pattern: `${EDIT_LINK_BASE}/${lang}/:path`,
    text: UI_LABELS[lang].editLinkText
  }
}

/** Footer with the localized license note + report-issue link. */
function buildFooter(lang: Lang): DefaultTheme.Config['footer'] {
  const l = UI_LABELS[lang]
  return {
    message: `${l.footerLicense} · <a href="${DOC_ISSUE_URL}" target="_blank">${l.footerReportIssue}</a>`,
    copyright: 'Copyright © 2026 CyberGoDev'
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

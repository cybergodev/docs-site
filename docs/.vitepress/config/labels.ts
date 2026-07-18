import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'
import { PROJECTS, type Lang } from '../shared'
import { EDIT_LINK_BASE, DOC_ISSUE_URL } from '../shared'

/**
 * Per-language UI strings, in ONE place — keyed by language so a missing
 * translation is a type error, not a silent gap.
 *
 * The factory helpers below turn a language code + this table into a full
 * LocaleSpecificConfig, so config/locales.ts has zero per-language boilerplate
 * and adding a language is one row here + one in shared.ts LANGS.
 *
 * The `UiLabels` table is ALSO the single source for client-side component
 * strings (DocFeedback / SiteFooter / NotFound / LanguagePrompt), consumed via
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
  // DocFeedback
  feedbackQuestion: string
  feedbackYes: string
  feedbackNo: string
  feedbackThanks: string
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
    searchPlaceholder: '搜索文档...',
    langMenuLabel: '多语言',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    feedbackQuestion: '本文有帮助吗？',
    feedbackYes: '有帮助',
    feedbackNo: '没帮助',
    feedbackThanks: '感谢您的反馈！',
    footerBrandDesc:
      '专为 Go 语言打造的高性能开源库集合，涵盖 JSON、JWT、HTTP 客户端、HTML 提取、日志和环境变量管理。',
    footerCommunity: '社区',
    footerAboutSite: '关于本站',
    footerEditDocs: '编辑文档',
    footerLicenseWord: '许可证',
    footerCopyright: '版权所有 © 2026 CyberGo (cybergo.dev)',
    footerOpensInNewWindow: '（在新窗口打开）',
    notFoundTitle: '页面未找到',
    notFoundDesc: '抱歉，您访问的页面不存在或已被移除。',
    notFoundGoHome: '返回首页',
    notFoundGoBack: '返回上页',
    langPromptTextTemplate: '检测到您的浏览器语言为「{label}」，是否切换？',
    langPromptSwitch: '切换语言',
    langPromptDismiss: '暂不',
    cliDocs: '文档',
    openInPlayground: '在 Go Playground 打开',
    codeCopied: '代码已复制，请粘贴',
    breadcrumbHome: '首页',
    breadcrumbAriaLabel: '面包屑导航',
    searchNoResults: '未找到相关文档',
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
    searchPlaceholder: 'Search docs...',
    langMenuLabel: 'Language',
    returnToTopLabel: 'Return to top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Theme',
    lightModeSwitchTitle: 'Switch to light theme',
    darkModeSwitchTitle: 'Switch to dark theme',
    feedbackQuestion: 'Was this page helpful?',
    feedbackYes: 'Yes',
    feedbackNo: 'No',
    feedbackThanks: 'Thanks for your feedback!',
    footerBrandDesc:
      'High-performance Go open-source library collection: JSON, JWT, HTTP client, HTML extraction, logging, and environment management.',
    footerCommunity: 'Community',
    footerAboutSite: 'About This Site',
    footerEditDocs: 'Edit Docs',
    footerLicenseWord: 'License',
    footerCopyright: 'Copyright © 2026 CyberGo (cybergo.dev)',
    footerOpensInNewWindow: '(opens in new window)',
    notFoundTitle: 'Page Not Found',
    notFoundDesc: 'Sorry, the page you are looking for does not exist or has been removed.',
    notFoundGoHome: 'Go Home',
    notFoundGoBack: 'Go Back',
    langPromptTextTemplate: 'Your browser language appears to be {label}. Switch?',
    langPromptSwitch: 'Switch',
    langPromptDismiss: 'Not now',
    cliDocs: 'Docs',
    openInPlayground: 'Open in Go Playground',
    codeCopied: 'Code copied — paste it',
    breadcrumbHome: 'Home',
    breadcrumbAriaLabel: 'Breadcrumb',
    searchNoResults: 'No results found',
    searchScopeProject: 'In {project}',
    searchScopeSite: 'All projects',
    searchScopeLabel: 'Scope',
    searchLoading: 'Loading index…',
    searchAriaLabel: 'Search',
    searchClose: 'Close'
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
    darkModeSwitchTitle: '다크 테마로 전환',
    feedbackQuestion: '이 페이지가 도움이 되었나요?',
    feedbackYes: '도움 됨',
    feedbackNo: '도움 안 됨',
    feedbackThanks: '피드백 감사합니다!',
    footerBrandDesc:
      'Go 언어를 위한 고성능 오픈소스 라이브러리 컬렉션: JSON, JWT, HTTP 클라이언트, HTML 추출, 로깅, 환경 변수 관리.',
    footerCommunity: '커뮤니티',
    footerAboutSite: '이 사이트에 대하여',
    footerEditDocs: '문서 편집',
    footerLicenseWord: '라이선스',
    footerCopyright: '저작권 © 2026 CyberGo (cybergo.dev)',
    footerOpensInNewWindow: '(새 창에서 열림)',
    notFoundTitle: '페이지를 찾을 수 없습니다',
    notFoundDesc: '죄송합니다. 요청하신 페이지가 존재하지 않거나 삭제되었습니다.',
    notFoundGoHome: '홈으로',
    notFoundGoBack: '뒤로 가기',
    langPromptTextTemplate: '브라우저 언어가 {label}인 것 같습니다. 전환할까요?',
    langPromptSwitch: '전환',
    langPromptDismiss: '나중에',
    cliDocs: '문서',
    openInPlayground: 'Go Playground에서 열기',
    codeCopied: '코드가 복사되었습니다 — 붙여넣으세요',
    breadcrumbHome: '홈',
    breadcrumbAriaLabel: '브레드크럼',
    searchNoResults: '결과를 찾을 수 없음',
    searchScopeProject: '{project} 내에서',
    searchScopeSite: '전체 사이트',
    searchScopeLabel: '범위',
    searchLoading: '인덱스 로딩 중…',
    searchAriaLabel: '검색',
    searchClose: '닫기'
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
    darkModeSwitchTitle: 'ダークモードに切り替え',
    feedbackQuestion: 'このページは役に立ちましたか？',
    feedbackYes: '役に立った',
    feedbackNo: '役に立たなかった',
    feedbackThanks: 'フィードバックありがとうございます！',
    footerBrandDesc:
      'Go 言語のための高性能オープンソースライブラリコレクション：JSON、JWT、HTTPクライアント、HTML抽出、ロギング、環境変数管理。',
    footerCommunity: 'コミュニティ',
    footerAboutSite: 'このサイトについて',
    footerEditDocs: 'ドキュメントを編集',
    footerLicenseWord: 'ライセンス',
    footerCopyright: 'Copyright © 2026 CyberGo (cybergo.dev)',
    footerOpensInNewWindow: '（新しいウィンドウで開く）',
    notFoundTitle: 'ページが見つかりません',
    notFoundDesc: '申し訳ありません。お探しのページは存在しないか、削除されました。',
    notFoundGoHome: 'ホームへ',
    notFoundGoBack: '戻る',
    langPromptTextTemplate: 'ブラウザの言語が「{label}」のようです。切り替えますか？',
    langPromptSwitch: '切り替え',
    langPromptDismiss: '後で',
    cliDocs: 'ドキュメント',
    openInPlayground: 'Go Playground で開く',
    codeCopied: 'コードをコピーしました — 貼り付けてください',
    breadcrumbHome: 'ホーム',
    breadcrumbAriaLabel: 'パンくずリスト',
    searchNoResults: '結果が見つかりません',
    searchScopeProject: '{project} 内で',
    searchScopeSite: 'サイト全体',
    searchScopeLabel: '範囲',
    searchLoading: 'インデックスを読み込み中…',
    searchAriaLabel: '検索',
    searchClose: '閉じる'
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
    darkModeSwitchTitle: 'Переключить на тёмную тему',
    feedbackQuestion: 'Была ли эта страница полезной?',
    feedbackYes: 'Да',
    feedbackNo: 'Нет',
    feedbackThanks: 'Спасибо за отзыв!',
    footerBrandDesc:
      'Коллекция высокопроизводительных библиотек Go: JSON, JWT, HTTP-клиент, извлечение HTML, логирование и управление переменными окружения.',
    footerCommunity: 'Сообщество',
    footerAboutSite: 'О сайте',
    footerEditDocs: 'Редактировать документацию',
    footerLicenseWord: 'Лицензия',
    footerCopyright: '© 2026 CyberGo (cybergo.dev)',
    footerOpensInNewWindow: '(откроется в новом окне)',
    notFoundTitle: 'Страница не найдена',
    notFoundDesc: 'Извините, запрашиваемая страница не существует или была удалена.',
    notFoundGoHome: 'На главную',
    notFoundGoBack: 'Назад',
    langPromptTextTemplate: 'Язык вашего браузера, вероятно, {label}. Переключить?',
    langPromptSwitch: 'Переключить',
    langPromptDismiss: 'Не сейчас',
    cliDocs: 'Документация',
    openInPlayground: 'Открыть в Go Playground',
    codeCopied: 'Код скопирован — вставьте его',
    breadcrumbHome: 'Главная',
    breadcrumbAriaLabel: 'Хлебные крошки',
    searchNoResults: 'Ничего не найдено',
    searchScopeProject: 'В {project}',
    searchScopeSite: 'Весь сайт',
    searchScopeLabel: 'Область',
    searchLoading: 'Загрузка индекса…',
    searchAriaLabel: 'Поиск',
    searchClose: 'Закрыть'
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

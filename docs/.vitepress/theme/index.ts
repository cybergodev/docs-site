import DefaultTheme from 'vitepress/theme'
import { h, watch } from 'vue'
import { useData } from 'vitepress'
import type { EnhanceAppContext } from 'vitepress'
import './style/index.css'
import { STORAGE_KEYS } from '../shared'
import {
  NotFound,
  LanguageMenu,
  LanguagePrompt,
  SiteFooter,
  DocFeedback,
  ProjectNavBarTitle,
  ProjectGitHubLink,
  ProjectSearch,
  ProjectGrid,
  CliCommand,
  GoPlaygroundButton,
  Breadcrumb
} from './components'

/**
 * CyberGo theme entry.
 *
 * Every Layout-slot component below (ProjectNavBarTitle, ProjectGitHubLink,
 * LanguageMenu, …) is pure Vue: it reads the current route reactively via a
 * composable and renders the right value, with NO post-render DOM surgery
 * against VitePress internals. See composables/useProjectContext.ts.
 *
 * The only setup() side effect is persisting the user's language choice
 * (cookie + localStorage) so the browser-language prompt and the dev
 * bare-path redirect can read it on the next visit.
 */
export default {
  extends: DefaultTheme,
  enhanceApp({ app }: EnhanceAppContext) {
    // ProjectGrid is registered globally so the homepage markdown can use
    // `<ProjectGrid lang="zh" />` directly, data-driven from PROJECT_META.
    app.component('ProjectGrid', ProjectGrid)
    // Content-facing interactive components, usable in any markdown body.
    app.component('CliCommand', CliCommand)
    app.component('GoPlaygroundButton', GoPlaygroundButton)
  },
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'not-found': () => h(NotFound),
      // Sole visible navbar title (native siteTitle span hidden via CSS).
      'nav-bar-title-after': () => h(ProjectNavBarTitle),
      // Project-scoped search flush against the LEFT of the nav menu ("Projects"
      // dropdown). The slot itself (`nav-bar-content-before`) is the FIRST child
      // of `.content-body` — a flex container VitePress lays out as
      // `justify-content: flex-end`. The trigger's `margin-left: auto`
      // (style/search.css) then absorbs all remaining free space to its LEFT,
      // packing the trigger hard against the menu that follows it.
      //
      // This only works because style/overrides.css hides VitePress's empty
      // `.VPNavBarSearch` wrapper (always rendered even with no search provider
      // configured, and carrying `flex-grow: 1` on ≥768px). Per the Flexbox spec
      // flex-grow is resolved BEFORE auto margins, so that empty wrapper would
      // otherwise swallow all free space and strand the trigger on the LEFT end
      // of the cluster. Native search is intentionally unset in config.mts;
      // ProjectSearch is the sole search surface.
      'nav-bar-content-before': () => h(ProjectSearch, { variant: 'bar' }),
      // Project-aware GitHub link + unified language switcher on the right.
      // The native social-links cluster (which only held GitHub) is hidden
      // via CSS.
      'nav-bar-content-after': () => [h(ProjectGitHubLink), h(LanguageMenu, { variant: 'bar' })],
      'nav-screen-content-after': () => [
        h(ProjectSearch, { variant: 'screen' }),
        h(LanguageMenu, { variant: 'screen' })
      ],
      'layout-top': () => h(LanguagePrompt),
      // Breadcrumb trail above the page <h1>. The composable hides it on
      // home / project-root / frontmatter `breadcrumb: false`.
      'doc-before': () => h(Breadcrumb),
      'doc-footer-before': () => h(DocFeedback),
      'layout-bottom': () => h(SiteFooter)
    })
  },
  setup() {
    const { lang } = useData()

    // Persist the user's language choice (cookie + localStorage) so the
    // browser-language prompt and the dev bare-path redirect can read it on
    // the next visit. Registered at setup level (client-only via the SSR
    // guard) rather than inside onMounted, so Vue owns the watcher's lifecycle
    // and disposes it on unmount automatically. The callback only ever runs in
    // the browser, so no window/document guard is needed inside it.
    if (!import.meta.env.SSR) {
      watch(lang, (newLang) => {
        localStorage.setItem(STORAGE_KEYS.preference, newLang)
        document.cookie = `${STORAGE_KEYS.preference}=${newLang};path=/;max-age=31536000;samesite=lax;secure`
      })
    }
  }
}

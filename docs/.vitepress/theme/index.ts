import DefaultTheme from 'vitepress/theme'
import { h, watch } from 'vue'
import { useData } from 'vitepress'
import type { EnhanceAppContext } from 'vitepress'
import './style/index.css'
import { STORAGE_KEYS } from '../shared'
import {
  GitHubIcon,
  NotFound,
  LanguageMenu,
  LanguagePrompt,
  SiteFooter,
  DocFeedback,
  ProjectNavBarTitle,
  ProjectGitHubLink,
  ProjectGrid,
  CliCommand,
  GoPlaygroundButton
} from './components'

/**
 * CyberGo theme entry.
 *
 * Every Layout-slot component below (ProjectNavBarTitle, ProjectGitHubLink,
 * LanguageMenu, …) is pure Vue: it reads the current route reactively via a
 * composable and renders the right value, with NO post-render DOM surgery.
 * This replaces the earlier approach of mutating VitePress internals
 * (`.VPNavBarTitle`, `.VPSocialLinks`) with querySelector after each
 * navigation — which was silently broken on every VitePress upgrade. See
 * composables/useProjectContext.ts.
 *
 * The only setup() side effect left is persisting the user's language choice
 * (cookie + localStorage) so the browser-language prompt and the dev
 * bare-path redirect can read it on the next visit.
 */
export default {
  extends: DefaultTheme,
  enhanceApp({ app }: EnhanceAppContext) {
    app.component('GitHubIcon', GitHubIcon)
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
      // Project-aware GitHub link + unified language switcher. The native
      // social-links cluster (which only held GitHub) is hidden via CSS.
      'nav-bar-content-after': () => [h(ProjectGitHubLink), h(LanguageMenu, { variant: 'bar' })],
      'nav-screen-content-after': () => h(LanguageMenu, { variant: 'screen' }),
      'layout-top': () => h(LanguagePrompt),
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

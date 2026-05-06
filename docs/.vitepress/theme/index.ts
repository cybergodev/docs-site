import DefaultTheme from 'vitepress/theme'
import { h, nextTick, onMounted, watch } from 'vue'
import { useData, useRouter } from 'vitepress'
import './custom.css'
import GitHubIcon from './components/GitHubIcon.vue'
import NotFound from './components/NotFound.vue'
import SiteFooter from './components/SiteFooter.vue'
import DocFeedback from './components/DocFeedback.vue'
import { STORAGE_KEYS } from '../locales/languages'
import { detectAndRedirectLanguage } from './composables/useLanguageDetect'
import { PROJECTS } from '../shared'

const GITHUB_ORG = 'https://github.com/cybergodev'
const DEFAULT_SITE_TITLE = 'CyberGo'

function updateProjectGitHubLink() {
  if (typeof window === 'undefined') return

  const links = document.querySelectorAll<HTMLAnchorElement>(
    '.VPSocialLinks a.VPSocialLink[href*="github.com"]'
  )
  if (!links.length) return

  const path = window.location.pathname
  let project: string | null = null
  for (const p of PROJECTS) {
    if (path.includes(`/${p}/`) || path.endsWith(`/${p}`)) {
      project = p
      break
    }
  }

  const href = project ? `${GITHUB_ORG}/${project}` : GITHUB_ORG
  links.forEach((link) => {
    link.href = href
  })
}

function updateProjectSiteTitle() {
  if (typeof window === 'undefined') return

  const navTitles = document.querySelectorAll('.VPNavBarTitle')
  if (!navTitles.length) return

  const path = window.location.pathname
  let project: string | null = null
  for (const p of PROJECTS) {
    if (path.includes(`/${p}/`) || path.endsWith(`/${p}`)) {
      project = p
      break
    }
  }

  navTitles.forEach((el) => {
    const link = el.querySelector<HTMLAnchorElement>('.title')
    if (!link) return

    const img = link.querySelector<HTMLImageElement>('.VPImage')
    const textSpan = link.querySelector('span')

    if (project) {
      el.setAttribute('data-project', project)
      if (textSpan) {
        const orgSpan = document.createElement('span')
        orgSpan.textContent = 'cybergodev/'
        textSpan.replaceChildren(orgSpan, document.createTextNode(project))
      }
    } else {
      el.removeAttribute('data-project')
      if (textSpan) textSpan.textContent = DEFAULT_SITE_TITLE
    }
  })
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('GitHubIcon', GitHubIcon)
  },
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'not-found': () => h(NotFound),
      'doc-footer-before': () => h(DocFeedback),
      'layout-bottom': () => h(SiteFooter)
    })
  },
  setup() {
    const { lang } = useData()
    const router = useRouter()

    onMounted(() => {
      detectAndRedirectLanguage()
      updateProjectGitHubLink()
      updateProjectSiteTitle()

      watch(() => router.route.path, () => {
        nextTick(() => {
          updateProjectGitHubLink()
          updateProjectSiteTitle()
        })
      })

      watch(lang, (newLang) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.preference, newLang)
          document.cookie = `${STORAGE_KEYS.preference}=${newLang};path=/;max-age=31536000;samesite=lax;secure`
        }
      })
    })
  }
}

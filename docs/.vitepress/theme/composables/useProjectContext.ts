import { computed } from 'vue'
import { useRouter } from 'vitepress'
import { PROJECTS, type ProjectName } from '../../shared'

/** GitHub org all project repos live under. */
export const GITHUB_ORG = 'https://github.com/cybergodev'

/**
 * Resolve which project (if any) a URL path belongs to. Pure & SSR-safe — no
 * `window` access — so it runs identically during SSR and on the client.
 *
 * A path belongs to project `p` when it contains `/{p}/` or ends with `/{p}`
 * (e.g. `/zh/json/getting-started`, `/en/json`). The leading language segment
 * is irrelevant to the match, which is why we test substrings rather than
 * parsing the language prefix.
 */
export function getProjectFromPath(path: string): ProjectName | null {
  for (const p of PROJECTS) {
    if (path.includes(`/${p}/`) || path.endsWith(`/${p}`)) return p
  }
  return null
}

/**
 * Reactive project context for the current route.
 *
 * Deriving from `router.route.path` lets the title and GitHub-link components
 * render the right value reactively, with no post-render DOM surgery, and
 * correctly during SSR so the first paint already shows the right title. Do
 * NOT reintroduce querySelector-based DOM surgery against VitePress internals
 * (`.VPSocialLinks`, `.VPNavBarTitle`, …) — that approach broke silently on
 * every VitePress upgrade.
 */
export function useProjectContext() {
  const router = useRouter()
  const project = computed(() => getProjectFromPath(router.route.path))
  const githubUrl = computed(() => {
    const p = project.value
    return p ? `${GITHUB_ORG}/${p}` : GITHUB_ORG
  })
  return { project, githubUrl }
}

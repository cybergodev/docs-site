import { computed } from 'vue'
import { useData, useRouter } from 'vitepress'
import { PROJECTS, type ProjectName } from '../../shared'

export { PROJECTS, type ProjectName }

const PROJECT_LABELS: Record<ProjectName, string> = {
  json: 'JSON',
  jwt: 'JWT',
  httpc: 'HTTPC',
  html: 'HTML',
  env: 'ENV',
  dd: 'DD'
}

export function useProjectPath() {
  const { localeIndex } = useData()
  const router = useRouter()

  const project = computed<ProjectName | null>(() => {
    const path = router.route.path
    for (const p of PROJECTS) {
      if (path.includes(`/${p}/`) || path.endsWith(`/${p}`)) {
        return p
      }
    }
    return null
  })

  const projectLabel = computed(() =>
    project.value ? PROJECT_LABELS[project.value] : null
  )

  const searchPrefix = computed<string | null>(() => {
    if (!project.value) return null
    const locale = localeIndex.value === 'root' ? '' : `/${localeIndex.value}`
    return `${locale}/${project.value}/`
  })

  return { project, projectLabel, searchPrefix, PROJECTS, PROJECT_LABELS }
}

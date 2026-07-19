/**
 * check-projects-sync.ts — 项目元信息双源一致性校验
 *
 * 解决问题：projects.yaml（AI 任务元信息源）与 docs/.vitepress/shared.ts
 * （站点运行时数据源 PROJECTS / PROJECT_META）描述同一组项目，但分两处维护，
 * 仅靠人工/任务记忆易漂移（典型故障：加了 yaml 忘加 ts，主页卡片/nav 静默失效）。
 *
 * 本脚本对比三源的项目键集合：
 *   - projects.yaml 的 projects 段键
 *   - shared.ts 的 PROJECTS 数组
 *   - shared.ts 的 PROJECT_META 键
 * 任一不一致 → 非零退出，可纳入 CI gate。
 *
 * 依赖：js-yaml（`npm i -D js-yaml @types/js-yaml`）
 * 运行：`npx tsx scripts/check-projects-sync.ts`（生产经 tsx；scripts/*.ts
 * 前提：shared.ts 为纯数据、无副作用、不 import vitepress/node，可安全 import。
 *
 * package.json 建议：在 scripts 段加 `"check:projects": "tsx scripts/check-projects-sync.ts"`
 * CI 建议：ci.yml 在 typecheck 后加一步 `- run: npm run check:projects`
 *
 * 深度校验（已实现）：PROJECT_META[p].desc 覆盖全部 LANGS、features.zh 非空（仅当项目键集合一致时执行）。
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'
// 生产路径：scripts/check-projects-sync.ts → ../docs/.vitepress/shared
// 若部署位置不同，按实际相对路径调整
import { PROJECTS, PROJECT_META, LANGS } from '../docs/.vitepress/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ① 解析 projects.yaml
const yamlPath = resolve(root, '.claude/config/projects.yaml')
const yamlText = readFileSync(yamlPath, 'utf8')
const yamlData = load(yamlText) as { projects?: Record<string, unknown> }
const yamlProjects = Object.keys(yamlData.projects ?? {})

// ② 从 shared.ts 取三源
const tsProjects: string[] = [...PROJECTS]
const tsMeta = Object.keys(PROJECT_META)

// ③ 集合差异
const inYamlNotTs = yamlProjects.filter((p) => !tsProjects.includes(p))
const inTsNotYaml = tsProjects.filter((p) => !yamlProjects.includes(p))
const inProjectsNotMeta = tsProjects.filter((p) => !tsMeta.includes(p))
const inMetaNotProjects = tsMeta.filter((p) => !tsProjects.includes(p))

const issues: string[] = []
if (inYamlNotTs.length)
  issues.push(
    `projects.yaml 有、shared.ts PROJECTS 无 → ${inYamlNotTs.join(', ')}（主页卡片/nav 会静默失效）`
  )
if (inTsNotYaml.length)
  issues.push(
    `shared.ts PROJECTS 有、projects.yaml 无 → ${inTsNotYaml.join(', ')}（AI 任务变量系统无法识别）`
  )
if (inProjectsNotMeta.length)
  issues.push(
    `PROJECTS 有、PROJECT_META 无 → ${inProjectsNotMeta.join(', ')}（typecheck 也会报错）`
  )
if (inMetaNotProjects.length)
  issues.push(`PROJECT_META 有、PROJECTS 无 → ${inMetaNotProjects.join(', ')}（孤儿元数据）`)

// ③b 深度校验：PROJECT_META 每项字段完整性（仅当项目键集合一致时执行，避免与键集错误叠加噪音）
if (!issues.length) {
  for (const p of PROJECTS) {
    const meta = PROJECT_META[p]
    if (!meta) continue // 键集合差异已报
    for (const lang of LANGS) {
      const d = meta.desc?.[lang]
      if (typeof d !== 'string' || d.trim() === '') {
        issues.push(`PROJECT_META.${p}.desc.${lang} 缺失或空（主页卡片该语言将空白）`)
      }
    }
    const fz = meta.features?.zh
    if (!Array.isArray(fz) || fz.length === 0) {
      issues.push(`PROJECT_META.${p}.features.zh 缺失或空（主页卡片至少需 zh 特性）`)
    }
  }
}

// ④ 输出
console.log('项目元信息双源一致性校验')
console.log(`  projects.yaml       : ${yamlProjects.length} 项 [${yamlProjects.join(', ')}]`)
console.log(`  shared.ts PROJECTS  : ${tsProjects.length} 项 [${tsProjects.join(', ')}]`)
console.log(`  shared.ts PROJECT_META: ${tsMeta.length} 项`)

if (issues.length) {
  console.error('\n❌ 发现不一致:')
  for (const i of issues) console.error(`  - ${i}`)
  process.exit(1)
}
console.log('\n✅ 双源一致')

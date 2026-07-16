# ADR-0001: 模块化配置、单一数据源与文件系统驱动侧边栏

- **状态**: Accepted
- **日期**: 2026-07-16
- **决策者**: CyberGo 文档团队

## 背景（Context）

重构前，站点配置存在三处高维护成本、易漂移的结构：

1. **Per-language locale 文件**：`docs/.vitepress/locales/{zh,en,ko,ja,ru}.ts` 各一份，UI 文案、nav、sidebar 重复手维护 5 次；加一种语言要新建并同步 5 处。
2. **Per-language 侧边栏**：`locales/sidebars/{zh,en,ko,ja,ru}.ts` 手写结构数组，加/移动一个页面要在 5 个文件里同步改，极易漏改导致结构不一致。
3. **单体配置与样式**：`config.mts` 逻辑臃肿；`theme/custom.css` 单文件 724 行；构建脚本为 `.js`。

痛点：加语言/页面的边际成本高、多语言 parity 无自动校验、新人/AI 难以推断「改一处还是改五处」。

## 决策（Decision）

1. **单一数据源 `shared.ts`**：语言列表（`LANGS`）、项目列表（`PROJECTS`）、语言元数据（`LANGUAGES`）、HOST、路径正则等只在 `shared.ts` 定义一次；所有派生（locale 映射、hreflang 正则、og:locale 表）从它计算。纯数据，构建期/脚本/客户端共用。
2. **UI 文案单表 `config/labels.ts`**：5 语言所有 UI 字符串集中于 `UI_LABELS` 表，工厂 `buildLocaleConfig` 生成完整 locale，消除 per-language 文件。缺翻译即类型错误。
3. **文件系统驱动侧边栏 `locales/sidebars/builder.ts`**：`buildSidebars(lang)` 遍历 `docs/{lang}/{project}/` 目录树——分组读目录 `_category_.json`，叶子读页面 frontmatter `sidebar_label`/`sidebar_position`，项目根 `index.md` 自动提升为概述。**侧边栏结构 = 目录树**，不再有手维护的结构文件。
4. **`config.mts` 仅组装**（~67 行）：逻辑拆到 `config/{labels,locales,markdown,redirects,seo,search}.ts`。
5. **样式按 concern 拆分**：`custom.css` → `style/{tokens,home,nav,overrides,components,utilities}.css`，`index.css` 按 cascade 聚合。
6. **构建脚本 `.ts` 化**：`scripts/*.ts` 经 `tsx` 运行，共享 `shared.ts` 类型。
7. **parity 自动审计**：`scripts/audit-locales.ts` 对比各语言页面集与 zh，差异即非零退出，接入 CI（`ci.yml`）。

## 考虑过的方案（Alternatives）

- **保留 per-language 文件，仅加 lint**：放弃——结构漂移是机制问题（5 处重复），lint 只能发现不能消除，且加语言成本不变。
- **代码生成 per-language 文件（codegen 而非工厂）**：放弃——会引入生成产物与源混淆，工厂函数（`buildLocaleConfig`）在运行时直接生成更简单、无中间文件。
- **中央侧边栏结构文件（JSON/YAML）**：放弃——仍需手动维护结构与目录的一致；文件系统驱动让「目录即结构」，零冗余。
- **vue-i18n + JSON 消息文件**（参考 Longbridge）：放弃——引入运行时依赖，且 UI 文案与 locale 元数据分离两处；单表 `UI_LABELS` + 工厂更内聚，类型安全。

## 后果（Consequences）

- **正向**：
  - 加一种语言 = `shared.ts` 的 `LANGS`/`LANGUAGES` 各一行 + `labels.ts` 的 `UI_LABELS` 一行 + 复制 `docs/{lang}/` 内容树。
  - 加一个页面 = 建一个 `.md`；加一个分组 = 建目录 + 一行 `_category_.json`。
  - parity 由 `audit-locales` CI 自动兜底，漏译会在合并前失败。
  - AI 会话有明确的单一数据源可读，减少「改几处」的歧义。
- **代价/权衡**：
  - 目录即结构 ⇒ **重命名目录会改变页面 URL**，需 `scripts/generate-moved-redirects.ts`（读 `sidebar-moves.json`）为旧 URL 生成重定向页，保外链与 SEO。
  - `shared.ts` 被浏览器 bundle 引用，必须保持**纯数据**（无副作用、不 import vitepress/node 内建/不访问 env）——这是强约束，违反会污染客户端包。
  - 文件系统驱动对 `_category_.json` 与 frontmatter 字段有隐式依赖，字段名变更需同步 `builder.ts`。
- **后续动作**：
  - 本次重构的 1214 个改动路径须尽快提交（当前仅存在于工作区）。
  - CLAUDE.md 已同步更新规则表（删除「5 个 sidebars .ts」过时表述）。

## 相关

- `docs/.vitepress/shared.ts`、`config/labels.ts`、`config/locales.ts`、`locales/sidebars/builder.ts`
- `scripts/audit-locales.ts`、`scripts/generate-moved-redirects.ts`
- `.github/workflows/ci.yml`（audit 已接入）
- `DESIGN.md`（样式拆分与 token 体系的设计规范）

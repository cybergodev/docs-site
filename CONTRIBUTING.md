# 贡献指南

> 本仓是 CyberGo 6 个 Go 库的 [VitePress](https://vitepress.dev/) 多语言文档站，部署于 [www.cybergo.dev](https://www.cybergo.dev)。库本身的源码在各自独立仓库，本仓只维护**文档**。

---

## 项目简介

CyberGo 是 **6 个生产级、高性能 Go 开源库**的集合，本仓是其文档站。

| 项目 | 说明 | Go 模块 |
|------|------|---------|
| `json` | 高性能 JSON 处理（路径查询、流式、零分配） | `github.com/cybergodev/json` |
| `jwt` | JWT 令牌生成与验证（多算法） | `github.com/cybergodev/jwt` |
| `httpc` | 安全 HTTP 客户端（重试、断路器、SSRF 防护） | `github.com/cybergodev/httpc` |
| `html` | HTML 内容提取与清洗 | `github.com/cybergodev/html` |
| `dd` | 结构化日志（文件轮换、敏感数据过滤） | `github.com/cybergodev/dd` |
| `env` | 多格式环境变量管理（安全存储） | `github.com/cybergodev/env` |

文档支持 **5 种语言**：中文 `zh`（**主语言**）、English `en`、한국어 `ko`、日本語 `ja`、Русский `ru`。

---

## 本地启动

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- npm 9+

### 安装与预览

```bash
git clone https://github.com/cybergodev/docs-site.git
cd docs-site
npm install
npm run dev          # 启动本地预览（含 dev 重定向中间件）
```

默认在 `http://localhost:5310` 提供预览。

### 常用脚本

| 脚本 | 作用 | 何时用 |
|------|------|--------|
| `npm run dev` | 本地预览 | 写作时实时查看 |
| `npm run typecheck` | 类型检查（`vue-tsc`） | 改了配置/脚本后必跑 |
| `npm run audit` | 多语言 parity 自检 | **新增/移动/删除页面后必跑**（漏译会非零退出） |
| `npm run check:projects` | `projects.yaml` ↔ `shared.ts` 双源一致性校验 | 改了项目元信息后跑 |
| `npm run check:code` | Go 代码示例编译校验（提取 ```go 块跑 `go build`+`gofmt`） | 改了 ```go 示例后跑（CI 必跑；本地需 Go 工具链+源码，可选） |
| `npm run format` | Prettier 格式化 | 提交前 |
| `npm run format:check` | 格式化检查（不写入） | CI 等价检查 |
| `npm run lint:autocorrect` | CJK 排版校验 | 提交前（需系统装 [autocorrect](https://github.com/huacnlee/autocorrect)） |
| `npm run fix:autocorrect` | CJK 排版自动修复 | 同上 |
| `npm run build` | 全量构建 | 由维护者/CI 执行，**本地一般不需要** |

> `audit`、`typecheck`、`check:projects`、`check:code`、`format:check`、`lint:autocorrect` 均在 CI 中运行，提交前本地跑一遍可避免反复来回。其中 `check:code` 与 `lint:autocorrect` 本地需额外工具（Go 工具链+源码 / 系统装 autocorrect），无此环境可交给 CI。

---

## 目录结构速览

```
docs/
├── .vitepress/          # 站点配置/主题/脚本（工程范畴，一般勿改）
├── public/              # 静态资源（logo、favicon、robots.txt）
├── index.md             # 根路径 / 的静态中文首页
├── zh/                  # 中文文档（主语言，优先完善）
├── en/                  # English
├── ko/                  # 한국어
├── ja/                  # 日本語
└── ru/                  # Русский
```

每个语言目录下：

```
docs/{lang}/
├── index.md             # 语言首页（项目卡片由数据驱动，勿手编卡片）
├── about.md             # 关于页
└── {project}/           # 6 个项目目录之一（json/jwt/httpc/html/dd/env）
    ├── index.md         # 项目概述（自动提升为侧边栏「概述」项）
    ├── getting-started/ # 分组=目录（含 _category_.json）
    ├── guides/
    ├── api-reference/
    └── ...
```

> **侧边栏由文件系统自动生成**：结构就是目录树。加页面/分组只需建文件/目录，无需手动维护侧边栏配置文件。

---

## 如何贡献内容

### 主语言先行

**先完善 `docs/zh/`**，确认无误后再同步翻译到 `en`/`ko`/`ja`/`ru`。5 种语言的页面集合必须一致（由 `npm run audit` 校验）。

### 加一个页面

1. 在目标目录建 `.md` 文件（如 `docs/zh/json/guides/my-topic.md`）。
2. 写好 frontmatter（见下方规范）。
3. 在其余 4 种语言的对应路径同步建文件并翻译。

### 加一个分组

1. 建子目录（如 `docs/zh/json/advanced/`）。
2. 在该目录放一个 `_category_.json`：

   ```json
   {
     "label": "进阶",
     "position": 6,
     "collapsed": true
   }
   ```

   | 字段 | 必需 | 说明 |
   |------|:----:|------|
   | `label` | 是 | 分组显示名（5 语言各自翻译） |
   | `position` | 是 | 排序，数字越小越靠前 |
   | `collapsed` | 否 | `true`=默认折叠；核心内容建议展开 |

3. 5 语言目录同步建（含 `_category_.json`）。

> 项目根目录（`docs/{lang}/{project}/`）**不放** `_category_.json`，仅子目录有。

---

## Frontmatter 规范

每个文档必须有 frontmatter，4 个字段：

```yaml
---
title: "快速开始 - CyberGo JWT | 5分钟入门指南"
description: "5 分钟上手 CyberGo JWT，涵盖安装、签发、验证与黑名单，附完整可运行示例。"
sidebar_label: "快速开始"
sidebar_position: 2
---
```

| 字段 | 要求 |
|------|------|
| `title` | ≤60 字符；正式页面用 `"{页面名} - CyberGo {project} \| {长尾关键词}"` 格式；**双引号包裹** |
| `description` | 120–160 字符，含 2–3 个关键词；**双引号包裹**（YAML 安全） |
| `sidebar_label` | 侧边栏显示名（省略则回退 `title`） |
| `sidebar_position` | 同目录排序，数字越小越靠前 |

### YAML 安全（重要）

`title`/`description` 的值**必须用双引号包裹**。未加引号的值若包含 `: `（冒号 + 空格）会被 YAML 解析为嵌套键值对，导致构建失败（俄语 description 尤其常见）。

```yaml
# 正确 — 双引号包裹
description: "Полный справочник API библиотеки CyberGo env: создание и управление"

# 错误 — 冒号+空格被误解析
description: Полный справочник API библиотеки CyberGo env: создание и управление
```

---

## 代码示例规范

### 必须完整可编译

每个 Go 示例须含 `package main` + `import` + `func main()` + 错误处理 + 输出注释：

```go
package main

import (
    "fmt"

    "github.com/cybergodev/json"
)

func main() {
    data := []byte(`{"name":"test"}`)
    result, err := json.GetString(data, "$.name")
    if err != nil {
        panic(err)
    }
    fmt.Println(result) // 输出: test
}
```

| 元素 | 说明 |
|------|------|
| `package main` | 包声明 |
| `import` | 完整导入语句 |
| `func main()` | 主函数 |
| `if err != nil` | 错误处理 |
| `// 输出: xxx` | 输出注释 |

### Import 不加冗余别名

直接用包路径导入，**不要**给项目包加别名：

```go
// 正确 — 无别名，默认包名
import "github.com/cybergodev/json"

// 错误 — 冗余别名；当项目名为 json/html/env 时会遮蔽同名标准库
import json "github.com/cybergodev/json"
```

若示例需**同时**用标准库（如 `encoding/json`），给**标准库**加别名区分：

```go
import (
    stdjson "encoding/json"         // 标准库加别名
    "github.com/cybergodev/json"    // 项目库用默认名
)
```

### 代码块语言标识

所有代码块必须指定语言标识符（`go`、`bash`、`json`、`yaml` 等），否则无语法高亮。

---

## 链接规则

站点已启用 clean URLs，内部链接**不带 `.md` 后缀**。

| 类型 | 格式 | 示例 |
|------|------|------|
| 项目内 | `[文本](./path#anchor)` | `[配置](./config#options)` |
| 跨项目 | `[文本](/{lang}/{project}/)` | `[JWT](/zh/jwt/)` |
| 语言前缀 | `/zh/`、`/en/` … | `/zh/json/` |

注意事项：

- **中文文档禁用 `/en/` 链接前缀**（语言隔离，各语言文档只链本语言）。
- 锚点经 NFC 规范化，校验 `#anchor` 以此为准（ko/ja/ru 锚点由此正常工作）。
- 禁止用绝对 URL 指向本站内部内容、禁止硬编码版本号。

---

## 术语一致性

翻译时**先查** [`.claude/templates/glossary.md`](./.claude/templates/glossary.md)（5 语言术语对照表），确保：

- 分组名与页面名在 5 语言间**逐字对应**（仅翻译语义）。
- 裸名保持裸名，**不加额外后缀**（如勿给 `Processor`/`Loader`/`Config` 加「处理器」等译名或 " API" 后缀）。
- 同义分组名全站统一（如 Advanced 在 zh 全站统一「进阶」，不与「高级」混用）。
- 函数名、类型名、常量名、import 路径、URL 一律保持原形，不翻译。

容器标题本地化对照（zh / en）：

| 中文 | 英文 |
|------|------|
| `:::tip 提示` | `:::tip` |
| `:::warning 注意` | `:::warning` |

---

## VitePress 常用语法

代码分组（同一示例的多种写法/格式用 tab 切换）：

````markdown
::: code-group

```go [包级函数]
env.Load(".env", "config.json")
```

```go [Loader 实例]
loader.LoadFiles(".env", "config.json")
```

:::
````

提示/警告容器：

```markdown
:::tip 提示
内容
:::

:::warning 注意
内容
:::
```

---

## 提交前检查清单

提交 Pull Request 前，请在本地跑一遍：

```bash
npm run format              # Prettier 格式化
npm run typecheck           # 类型检查
npm run audit               # 多语言 parity（新增/移动/删除页面后必跑）
npm run check:projects      # 项目元信息一致性（改了 projects.yaml/shared.ts 后跑）
npm run lint:autocorrect    # CJK 排版（需系统装 autocorrect）
npm run check:code          # Go 代码示例编译（改了 ```go 示例后跑；需 Go+源码，可选）
```

> 若本次改动包含 ```go 代码示例，且本地已具备 Go 工具链与 6 个源码 repo，建议跑 `npm run check:code`（或 `npm run check:code -- --all` 覆盖 5 语言）。**不可独立编译的教学片段**（渐进式披露、跨 package 多块演示、无 `func main()` 的方法/签名片段）用 go fence 紧前一行的 `<!-- check-code: skip -->` 标记豁免该块；整页都不参与校验则在 frontmatter 加 `check_code: false`。豁免仅用于这类合法场景，勿用以规避真实编译错误。

确认无误后按常规 Git 流程提交：

1. Fork 仓库并新建分支（`git checkout -b docs/your-topic`）。
2. 提交改动（`git commit -m 'docs: 简述改动'`）。
3. 推送并开 Pull Request，在 PR 描述中说明改了哪些页面、是否已 5 语言同步。

### 常见问题排查

| 现象 | 原因 / 处理 |
|------|-------------|
| `npm run audit` 失败 | 某语言缺少对应页面；补齐 5 语言同步 |
| 构建报 YAML 解析错误 | frontmatter 的 `title`/`description` 未加双引号（含 `: `） |
| 侧边栏顺序混乱 | 同目录页面未写 `sidebar_position`，或分组未写 `position` |
| CJK 与拉丁字符间距错乱 | 跑 `npm run fix:autocorrect` 自动修复 |

---

## 范围说明

本仓**只维护文档**。如果你发现的问题是 Go 库本身的 bug 或想新增库功能，请前往对应库的源码仓库提 issue/PR，而非本仓。

如果你需要改动**站点工程**（VitePress 配置、主题、样式、构建脚本、CI、SEO/搜索/重定向等，即 `docs/.vitepress/`、`scripts/`、`.github/` 下的内容），请先在 issue 中说明，由维护者评估。

---

## 许可证

本项目基于 [MIT License](https://opensource.org/licenses/MIT) 开源。提交的贡献将默认遵循同一许可证。

# ADR-0002: API 文档漂移检测（Go AST 扫描器）

- **状态**: Accepted
- **日期**: 2026-07-16
- **决策者**: CyberGo 文档团队

## 背景（Context）

API 参考文档（`docs/{lang}/{project}/api-reference/`）长期**手写**，与 Go 源码存在结构性漂移风险：函数改名/删除后文档未同步、文档引用了不存在的符号、`internal/` 符号被误暴露等。`CLAUDE.md` 虽有「公开 API 识别规则」，但靠人工遵守，无自动校验。这是与成熟文档站（如 Longbridge 用 `openapi.yaml` 实时渲染）最大的结构性差距。

## 决策（Decision）

采用**漂移检测器**（非生成器、非实时渲染）：

1. **`scripts/apiscan`**（Go 程序，独立 module `scripts/apiscan/go.mod`，**仅标准库**）：用 `go/parser` + `go/doc` 纯 AST 解析，提取一个 Go 模块的导出 API（函数、方法、类型、struct 字段、常量、变量 + 签名 + doc 注释）为 JSON 清单。应用 CLAUDE.md 排除规则（`*_test.go`/`*.pb.go`/`internal/`/`testdata/`/`vendor/` 等），并处理 `go/doc` 把工厂函数和有类型 var/const **关联到类型**（移入 `Type.Funcs/Vars/Consts`）的行为。
2. **`scripts/audit-api.ts`**（TS）：遍历 `PROJECTS`，对每个项目 `execFileSync('go', …)` 调 apiscan 生成 `report/api/{project}.json`，扫描 `docs/zh/{project}/` 的反引号标识符，与源码符号集 diff：
   - **DANGLING**（文档引用了源码不存在的符号）→ 报告并**退出非零**（真错误）。
   - **UNDOCUMENTED**（源码导出但无文档）→ 折叠展示，信息性（不致非零）。
3. 入口 `npm run audit:api`。

## 考虑过的方案（Alternatives）

- **生成器**（扫描源码直接生成 API markdown）：放弃——需对齐现有手写文档结构，迁移风险高；漂移检测器更轻、不改现有流程即可先消灭最痛的「文档指向错误符号」。
- **JSON + Vue 实时渲染**（类 Longbridge `openapi.yaml` → `ApiReference.vue`）：放弃——Go 库的「API」是导出符号非 HTTP 端点，openapi 不适用；且需改主题、偏离纯静态架构，工程过大。
- **扫描器放各 Go 项目仓库**（每库自带 `make docs-api`）：放弃——需改 6 个源码仓库并维护同步；放 docs repo 集中管理更简单。
- **TS 正则解析 Go 源码**：放弃——Go 语法（泛型、嵌套类型、方法接收者）用正则解析脆弱易漏。
- **`golang.org/x/tools/go/packages`**（替代弃用的 `parser.ParseDir`）：放弃——会引入外部依赖，破坏「标准库零依赖」；API 提取不需 build-tag 精度（见 `main.go` 注释）。

## 后果（Consequences）

- **正向**：
  - DANGLING 是高价值真信号——首次运行即发现各项目文档引用的过时/internal/不存在符号。
  - 不改现有文档生成流程，零迁移成本接入。
  - 纯标准库，apiscan 无外部依赖、`go run` 即用。
- **代价/权衡**：
  - 需 Go 工具链（CI 需 `setup-go`）；源码须在 `D:/MyProject/{project}-dev`（或 `CYBERGO_SOURCE_ROOT`）——CI 无源码时项目被跳过而非失败。
  - 噪音：标准接口方法（`MarshalJSON`/`MarshalText`）、interface 方法当前未单独提取，会产生少量假阳性；`UNDOCUMENTED` 数量大（源码导出符号远多于需文档化者），仅作信息。
  - 符号匹配靠反引号标识符 + 短名，无法检测**签名级**漂移（参数变了但函数名未变）。
- **后续动作**：
  - 建立 allowlist（标准方法、有意不文档化的 helper）降低 DANGLING 噪音。
  - 待报告稳定后接入 CI（需 workflow checkout 源码 repo）。
  - 可选：提取 interface 方法、签名级对比。

## 相关

- `scripts/apiscan/{main.go,go.mod,README.md}`、`scripts/audit-api.ts`
- `package.json`（`audit:api`）、`.claude/CLAUDE.md`「已实现的关键特性」表
- 首次报告：`report/api-drift.md`（gitignore，本地生成）

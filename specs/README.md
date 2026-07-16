# specs/ — 架构决策记录（ADR）

本目录记录 CyberGo 文档站点的**重大架构决策**（Architecture Decision Records），回答「为什么当初这么设计」——代码和 `CLAUDE.md` 只记录「结果是什么」，决策的**动因、权衡、被否方案**留在这里。

## 何时写 ADR

发生以下情况时写一份（由 `vitepress-engineer` 或人工起草）：

- 引入/移除一个核心依赖或构建机制
- 改变数据流或「单一数据源」的归属（如 language 列表换地方定义）
- 一次影响多文件/多语言的重构
- 确立一项新的全局约定（设计 token 体系、组件注入方式…）

> 日常 bug 修复、单页内容增删**不需要** ADR。

## 命名与编号

- 文件名：`NNNN-kebab-title.md`，`NNNN` 为 4 位递增编号（`0001`、`0002`…），按提出顺序，不复用、不重排
- 标题用英文 kebab-case，正文可中文

## 状态流转

`Proposed`（提案）→ `Accepted`（采纳）→ `Deprecated` / `Superseded by [ADR-NNNN]`（被取代）

只改状态、不改历史正文；推翻旧决策时新写一份并在旧文件顶部标注 `Superseded`。

## 模板

新建 ADR 复制 [`_template.md`](./_template.md)。

## 索引

| 编号 | 标题 | 状态 |
|------|------|------|
| [0001](./0001-modular-config-single-source-filesystem-sidebar.md) | 模块化配置、单一数据源与文件系统驱动侧边栏 | Accepted |
| [0002](./0002-api-doc-drift-detection.md) | API 文档漂移检测（Go AST 扫描器） | Accepted |

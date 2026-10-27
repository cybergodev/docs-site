---
sidebar_label: "配置"
title: "配置 - CyberGo html | Config 字段详解"
description: "CyberGo html Config 配置参考：31 个字段按资源管理、安全、内容提取、输出格式、链接提取与扩展分组列出默认值，附 DefaultConfig 等四种预设、零值语义与预设起点、Validate 校验约束及 MaxInputSize 等字段的取值上限。"
sidebar_position: 30
---

# 配置

## Config 结构体

`Config` 是 HTML 库的统一配置结构体，涵盖资源管理、安全、内容提取、输出格式与链接过滤。共 31 个字段：

| 字段 | 类型 | 分组 | 默认值 |
|------|------|------|--------|
| `Config.MaxInputSize` | `int` | 资源管理 | `52428800`（50MB） |
| `Config.MaxCacheEntries` | `int` | 资源管理 | `2000` |
| `Config.CacheTTL` | `time.Duration` | 资源管理 | `1h` |
| `Config.CacheCleanup` | `time.Duration` | 资源管理 | `5m` |
| `Config.WorkerPoolSize` | `int` | 资源管理 | `4` |
| `Config.ProcessingTimeout` | `time.Duration` | 资源管理 | `30s` |
| `Config.EnableSanitization` | `bool` | 安全 | `true` |
| `Config.MaxDepth` | `int` | 安全 | `500` |
| `Config.AllowedBaseDir` | `string` | 安全 | `""` |
| `Config.Audit` | `AuditConfig` | 安全 | `DefaultAuditConfig()` |
| `Config.ExtractArticle` | `bool` | 内容提取 | `true` |
| `Config.ExtractMetadata` | `bool` | 内容提取 | `true` |
| `Config.PreserveImages` | `bool` | 内容提取 | `true` |
| `Config.PreserveLinks` | `bool` | 内容提取 | `true` |
| `Config.PreserveVideos` | `bool` | 内容提取 | `true` |
| `Config.PreserveAudios` | `bool` | 内容提取 | `true` |
| `Config.InlineImageFormat` | `string` | 输出格式 | `none` |
| `Config.InlineLinkFormat` | `string` | 输出格式 | `none` |
| `Config.TableFormat` | `string` | 输出格式 | `markdown` |
| `Config.Encoding` | `string` | 输出格式 | `""`（自动检测） |
| `Config.ResolveRelativeURLs` | `bool` | 链接提取 | `true` |
| `Config.BaseURL` | `string` | 链接提取 | `""` |
| `Config.IncludeImages` | `bool` | 链接提取 | `true` |
| `Config.IncludeVideos` | `bool` | 链接提取 | `true` |
| `Config.IncludeAudios` | `bool` | 链接提取 | `true` |
| `Config.IncludeCSS` | `bool` | 链接提取 | `true` |
| `Config.IncludeJS` | `bool` | 链接提取 | `true` |
| `Config.IncludeContentLinks` | `bool` | 链接提取 | `true` |
| `Config.IncludeExternalLinks` | `bool` | 链接提取 | `true` |
| `Config.IncludeIcons` | `bool` | 链接提取 | `true` |
| `Config.Scorer` | `Scorer` | 扩展 | `nil`（内置默认评分器） |

### 资源管理

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `MaxInputSize` | `int` | `52428800` (50MB) | 最大输入字节数，正数且 ≤ `52428800`（50MB） |
| `MaxCacheEntries` | `int` | `2000` | 缓存条目上限，`0` 禁用缓存（上限 `100000`） |
| `CacheTTL` | `time.Duration` | `1h` | 缓存过期时间，不能为负 |
| `CacheCleanup` | `time.Duration` | `5m` | 过期缓存清理间隔，`0` 禁用后台清理 |
| `WorkerPoolSize` | `int` | `4` | 批量处理工作池大小，范围 `1`–`256` |
| `ProcessingTimeout` | `time.Duration` | `30s` | 单文档处理超时，`0` 表示不限时 |

:::tip 零值语义与预设起点
`MaxCacheEntries`、`CacheCleanup`、`ProcessingTimeout` 设为 `0` 有明确语义：禁用缓存、禁用后台清理、不限时。`MaxInputSize`、`WorkerPoolSize`、`MaxDepth` 必须为正，否则返回 `*ConfigError`。

因此**零值 `Config{}` 无法通过 `Validate()`，不可直接使用**。请从 `DefaultConfig()` 或其它预设出发，再覆写字段。`html.New()` 不传参时内部使用 `DefaultConfig()` 并在返回前调用 `Validate()`，始终安全。
:::

### 安全

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `EnableSanitization` | `bool` | `true` | 启用内容清洗，仅可信输入可禁用 |
| `MaxDepth` | `int` | `500` | 最大 DOM 深度，范围 `1`–`500` |
| `AllowedBaseDir` | `string` | `""` | 文件操作限定在该目录，留空表示不限制 |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | 审计配置 |

`AllowedBaseDir` 在文件路径来自不可信输入时必须设置。

### 内容提取

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ExtractArticle` | `bool` | `true` | 启用文章识别 |
| `ExtractMetadata` | `bool` | `true` | 收集 JSON-LD、OpenGraph、`<meta>` 与 canonical，填充 `Result`/`ReadResult` 的元数据字段，并让标题优先取元数据标题（JSON-LD `headline` > `og:title`，先于 `<title>`） |
| `PreserveImages` | `bool` | `true` | 保留图片信息 |
| `PreserveLinks` | `bool` | `true` | 保留链接信息 |
| `PreserveVideos` | `bool` | `true` | 保留视频信息 |
| `PreserveAudios` | `bool` | `true` | 保留音频信息 |

`ExtractMetadata=true` 时填充 `Author`、`PublishedTime`、`Description`、`SiteName`、`CanonicalURL` 五个字段，来源优先级见[类型定义](../types/type-defs#result)。关闭后这五个字段保持空值，`Title` 回退到 `<title>` → 正文 h1 → 文档首个 h1 → 首个 h2。

该字段也参与缓存 Key：`ExtractMetadata` 是缓存键中包含的 6 个布尔开关之一（另五个为 `ExtractArticle`、`PreserveImages`、`PreserveLinks`、`PreserveVideos`、`PreserveAudios`），因此改变它会得到不同的缓存条目。

`PreserveVideos`/`PreserveAudios` 另有一条输入规模边界：只出现在原始 HTML 文本（script 内 JSON、注释等处）而非媒体元素中的 URL，仅在文档不超过 1MB 时额外扫描；更大的文档只从解析后的 DOM 提取媒体元素。

### 输出格式

| 字段 | 类型 | 默认值 | 可选值 | 说明 |
|------|------|--------|--------|------|
| `InlineImageFormat` | `string` | `none` | `none`, `markdown`, `html`, `placeholder` | 内联图片格式 |
| `InlineLinkFormat` | `string` | `none` | `none`, `markdown`, `html` | 内联链接格式 |
| `TableFormat` | `string` | `markdown` | `markdown`, `html` | 表格格式 |
| `Encoding` | `string` | `""` | - | 指定编码（如 `utf-8`、`windows-1252`、`gbk`），留空自动检测 |

阅读模式（`ReadPage*`）中 `InlineLinkFormat="none"` 按 `markdown` 处理——链接是阅读视图的契约，`none` 只对 `Extract` 族生效（见[阅读模式](./reader)）。

### 链接提取

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ResolveRelativeURLs` | `bool` | `true` | 解析相对 URL；`BaseURL` 为空时从文档自动推导基准 |
| `BaseURL` | `string` | `""` | 解析相对路径的基础 URL |
| `IncludeImages` | `bool` | `true` | 包含图片链接 |
| `IncludeVideos` | `bool` | `true` | 包含视频链接 |
| `IncludeAudios` | `bool` | `true` | 包含音频链接 |
| `IncludeCSS` | `bool` | `true` | 包含 CSS 链接 |
| `IncludeJS` | `bool` | `true` | 包含 JS 链接 |
| `IncludeContentLinks` | `bool` | `true` | 包含内容链接 |
| `IncludeExternalLinks` | `bool` | `true` | 包含外部链接 |
| `IncludeIcons` | `bool` | `true` | 包含图标链接 |

### 扩展

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `Scorer` | `Scorer` | `nil` | 自定义内容评分器，为空时用内置评分器 |

## 预设配置

### DefaultConfig

`DefaultConfig` 返回均衡配置，是多数应用的起点，也是其余预设与自定义配置的构造基础。

```go
func DefaultConfig() Config
```

```go
cfg := html.DefaultConfig()
```

### TextOnlyConfig

`TextOnlyConfig` 在默认配置基础上把 `PreserveImages`、`PreserveLinks`、`PreserveVideos`、`PreserveAudios` 全部设为 `false`，即不保留任何媒体与链接信息。`ExtractAllLinks` 的 `Include*` 过滤不受此预设影响。

```go
func TextOnlyConfig() Config
```

```go
cfg := html.TextOnlyConfig()
```

### MarkdownConfig

`MarkdownConfig` 在默认配置基础上把 `InlineImageFormat` 与 `InlineLinkFormat` 设为 `markdown`，用于正文中内联图片与链接的 Markdown 渲染。`ExtractToMarkdown` 固定输出 Markdown，无需该预设。

```go
func MarkdownConfig() Config
```

```go
cfg := html.MarkdownConfig()
```

### HighSecurityConfig

`HighSecurityConfig` 收紧限额、缩短超时、开启完整审计。

```go
func HighSecurityConfig() Config
```

```go
cfg := html.HighSecurityConfig()
```

与 `DefaultConfig()` 的差异：

| 字段 | 默认值 | 高安全值 |
|------|--------|----------|
| `MaxInputSize` | `52428800` (50MB) | `10485760` (10MB) |
| `MaxCacheEntries` | `2000` | `500` |
| `CacheTTL` | `1h` | `30m` |
| `CacheCleanup` | `5m` | `1m` |
| `WorkerPoolSize` | `4` | `2` |
| `ProcessingTimeout` | `30s` | `10s` |
| `MaxDepth` | `500` | `100` |
| `Audit` | `DefaultAuditConfig()` | `HighSecurityAuditConfig()` |

## Validate

校验配置有效性（值接收者，可直接 `cfg.Validate()` 调用）。无效时返回包裹 `ErrInvalidConfig` 的 `*ConfigError`。

```go
func (c Config) Validate() error
```

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1
err := cfg.Validate() // 返回 ConfigError
```

### 验证约束

`Config.Validate` 对数值字段与格式字符串强制以下约束，违反时返回 `ConfigError`（可用 `errors.Is(err, html.ErrInvalidConfig)` 判断）：

| 字段 | 约束 | 非法示例 |
|------|------|----------|
| `MaxInputSize` | 正数且 ≤ `52428800`（50MB） | `0`、`-1`、`100000000` |
| `MaxCacheEntries` | ≥ `0` 且 ≤ `100000` | `-1`、`200000` |
| `CacheTTL` | ≥ `0` | `-1 * time.Second` |
| `CacheCleanup` | ≥ `0` | `-1 * time.Minute` |
| `WorkerPoolSize` | 正数且 ≤ `256` | `0`、`512` |
| `MaxDepth` | 正数且 ≤ `500` | `0`、`1000` |
| `ProcessingTimeout` | ≥ `0` | `-1 * time.Second` |
| `Audit.MaxEntries` | ≥ `0` 且 ≤ `100000`（`0` 表示使用默认值 10000） | `-1`、`200000` |
| `Audit.MaxRawValueLength` | ≥ `0`（`0` 表示使用默认值 200） | `-1` |
| `InlineImageFormat` | 空 / `none` / `markdown` / `html` / `placeholder` | `"pdf"` |
| `InlineLinkFormat` | 空 / `none` / `markdown` / `html` | `"pdf"` |
| `TableFormat` | 空 / `markdown` / `html` | `"csv"` |

格式字符串大小写不敏感，空值视为默认（`InlineImageFormat`/`InlineLinkFormat` → `none`，`TableFormat` → `markdown`）。`New()` 在返回前调用 `Validate()`，无效配置不会产出可用的 `Processor`。

## 相关文档

- [配置实战](../../guides/core-features/configuration) — 预设选择与常见配置组合
- [包函数](./functions) — 包级便捷函数参考
- [Processor](./processor) — 配置的消费方与并发语义
- [阅读模式](./reader) — `InlineLinkFormat`、`ExtractMetadata` 在 `ReadPage` 中的行为
- [常量与错误](../types/constants) — 哨兵错误与错误类型

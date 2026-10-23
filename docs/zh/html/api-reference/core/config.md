---
sidebar_label: "配置"
title: "配置 - CyberGo html | Config 字段详解"
description: "CyberGo html Config 配置结构体字段详解：覆盖资源管理、安全、内容提取、输出格式、链接提取与扩展六大类共 30 个字段，含 DefaultConfig 等四种预设配置、取值约束、零值语义与 Validate 验证方法，便于精准定制提取行为。"
sidebar_position: 30
---

# 配置

## Config 结构体

`Config` 是 HTML 库的统一配置结构体，涵盖资源管理、安全、内容提取、输出格式和链接过滤。

全部 30 个字段一览（详细约束与说明见下方分组小节）：

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
| `MaxInputSize` | `int` | `52428800` (50MB) | 最大输入大小（字节），取值范围 `1`–`52428800` |
| `MaxCacheEntries` | `int` | `2000` | 缓存最大条目数，设为 `0` 禁用缓存（上限 `100000`） |
| `CacheTTL` | `time.Duration` | `1h` | 缓存过期时间，不能为负 |
| `CacheCleanup` | `time.Duration` | `5m` | 过期缓存的后台清理间隔，设为 `0` 禁用后台清理 |
| `WorkerPoolSize` | `int` | `4` | 批量处理的工作池大小，取值范围 `1`–`256` |
| `ProcessingTimeout` | `time.Duration` | `30s` | 单文档处理超时，设为 `0` 表示不限时 |

:::tip 零值语义
`MaxCacheEntries`、`CacheCleanup`、`ProcessingTimeout` 设为 `0` 不是错误，而是有明确语义（分别表示禁用缓存、禁用后台清理、不限时）。`MaxInputSize`、`WorkerPoolSize`、`MaxDepth` 则必须为正数，否则触发 `ConfigError`。

因此**零值 `Config{}` 无法通过 `Validate()`，不可直接使用**——请始终从 `DefaultConfig()`（或其它预设）出发，按需覆写字段。
:::

### 安全

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `EnableSanitization` | `bool` | `true` | 启用内容清洗，仅对可信输入可禁用 |
| `MaxDepth` | `int` | `500` | 最大 DOM 深度，取值范围 `1`–`500` |
| `AllowedBaseDir` | `string` | `""` | 限制文件操作到此目录，留空（默认）表示不限制；接收不可信输入的文件路径时使用 |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | 审计配置 |

### 内容提取

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ExtractArticle` | `bool` | `true` | 启用智能文章识别 |
| `PreserveImages` | `bool` | `true` | 保留图片信息 |
| `PreserveLinks` | `bool` | `true` | 保留链接信息 |
| `PreserveVideos` | `bool` | `true` | 保留视频信息 |
| `PreserveAudios` | `bool` | `true` | 保留音频信息 |

### 输出格式

| 字段 | 类型 | 默认值 | 可选值 | 说明 |
|------|------|--------|--------|------|
| `InlineImageFormat` | `string` | `none` | `none`, `markdown`, `html`, `placeholder` | 内联图片格式 |
| `InlineLinkFormat` | `string` | `none` | `none`, `markdown`, `html` | 内联链接格式 |
| `TableFormat` | `string` | `markdown` | `markdown`, `html` | 表格格式 |
| `Encoding` | `string` | `""` | - | 指定编码（留空自动检测） |

### 链接提取

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ResolveRelativeURLs` | `bool` | `true` | 解析相对 URL，需要设置 BaseURL |
| `BaseURL` | `string` | `""` | 基础 URL（用于解析相对路径） |
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
| `Scorer` | `Scorer` | `nil` | 自定义内容评分器，为空时使用默认评分器 |

## 预设配置

### DefaultConfig

`DefaultConfig` 返回均衡配置，适合通用场景，是绝大多数应用的起点。

```go
func DefaultConfig() Config
```

```go
cfg := html.DefaultConfig()
```

### TextOnlyConfig

仅提取纯文本，禁用所有媒体和链接保留（`PreserveImages`、`PreserveLinks`、`PreserveVideos`、`PreserveAudios` 均设为 `false`）。

```go
func TextOnlyConfig() Config
```

```go
cfg := html.TextOnlyConfig()
```

### MarkdownConfig

`MarkdownConfig` 在默认配置基础上将 `InlineImageFormat` 与 `InlineLinkFormat` 均设为 `markdown`，适合内联图片和链接使用 Markdown 格式的输出。

```go
func MarkdownConfig() Config
```

```go
cfg := html.MarkdownConfig()
```

### HighSecurityConfig

高安全配置：缩减限制、更短超时、完整审计。

```go
func HighSecurityConfig() Config
```

```go
cfg := html.HighSecurityConfig()
```

相比 `DefaultConfig()` 的覆盖值：

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

`Validate` 验证配置的有效性（值接收者，可直接 `cfg.Validate()` 调用），无效时返回包裹 `ErrInvalidConfig` 的 `*ConfigError`。

```go
func (c Config) Validate() error
```

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1
err := cfg.Validate() // 返回 ConfigError
```

### 验证约束

`Config.Validate` 对数值字段与格式字符串强制以下约束（违反时返回 `ConfigError`，可经 `errors.Is(err, html.ErrInvalidConfig)` 判断）：

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
| `InlineImageFormat` | 空 / `none` / `markdown` / `html` / `placeholder` | `"pdf"` |
| `InlineLinkFormat` | 空 / `none` / `markdown` / `html` | `"pdf"` |
| `TableFormat` | 空 / `markdown` / `html` | `"csv"` |

格式字符串大小写不敏感且空值视为默认（`InlineImageFormat`/`InlineLinkFormat` → `none`，`TableFormat` → `markdown`）。`New()` 在创建 Processor 前会先调用 `Validate()`，因此无效配置不会产出可用的 Processor。

## 相关文档

- [配置实战](../../guides/core-features/configuration) — 预设选择与常见配置组合
- [包函数](./functions) — 包级便捷函数参考
- [Processor](./processor) — 配置的消费方与并发语义
- [常量与错误](../types/constants) — 哨兵错误与错误类型

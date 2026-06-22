---
title: "配置 - CyberGo HTML | Config 字段详解"
description: "CyberGo HTML Config 配置详解：资源管理（MaxInputSize、缓存、超时）、安全、内容提取、输出格式、链接过滤与 Validate 验证方法。"
---

# 配置

## Config 结构体

`Config` 是 HTML 库的统一配置结构体，涵盖资源管理、安全、内容提取、输出格式和链接过滤。

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

均衡配置，适合通用场景。

```go
cfg := html.DefaultConfig()
```

### TextOnlyConfig

仅提取纯文本，禁用所有媒体和链接保留（`PreserveImages`、`PreserveLinks`、`PreserveVideos`、`PreserveAudios` 均设为 `false`）。

```go
cfg := html.TextOnlyConfig()
```

### MarkdownConfig

优化 Markdown 输出，内联图片和链接使用 Markdown 格式。

```go
cfg := html.MarkdownConfig()
```

### HighSecurityConfig

高安全配置：缩减限制、更短超时、完整审计。

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

验证配置的有效性。

```go
func (c Config) Validate() error
```

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1
err := cfg.Validate() // 返回 ConfigError
```

### 验证约束

`Validate()` 对数值字段强制的取值范围（违反时返回 `ConfigError`，可经 `errors.Is(err, html.ErrInvalidConfig)` 判断）：

| 字段 | 约束 | 非法示例 |
|------|------|----------|
| `MaxInputSize` | 正数且 ≤ `52428800`（50MB） | `0`、`-1`、`100000000` |
| `MaxCacheEntries` | ≥ `0` 且 ≤ `100000` | `-1`、`200000` |
| `CacheTTL` | ≥ `0` | `-1 * time.Second` |
| `CacheCleanup` | ≥ `0` | `-1 * time.Minute` |
| `WorkerPoolSize` | 正数且 ≤ `256` | `0`、`512` |
| `MaxDepth` | 正数且 ≤ `500` | `0`、`1000` |
| `ProcessingTimeout` | ≥ `0` | `-1 * time.Second` |
| `InlineImageFormat` | 空 / `none` / `markdown` / `html` / `placeholder` | `"pdf"` |
| `InlineLinkFormat` | 空 / `none` / `markdown` / `html` | `"pdf"` |
| `TableFormat` | 空 / `markdown` / `html` | `"csv"` |

格式字符串大小写不敏感且空值视为默认（`InlineImageFormat`/`InlineLinkFormat` → `none`，`TableFormat` → `markdown`）。`New()` 在创建 Processor 前会先调用 `Validate()`，因此无效配置不会产出可用的 Processor。

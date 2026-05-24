---
title: "配置 - HTML"
description: "CyberGo HTML 库 Config 配置详解，包括资源管理（MaxInputSize、缓存、超时）、安全（清洗、深度限制、审计）、内容提取（文章识别、媒体保留）、输出格式（图片、链接、表格）、链接过滤（Include*、ResolveRelativeURLs）和 Validate 验证方法。"
---

# 配置

## Config 结构体

`Config` 是 HTML 库的统一配置结构体，涵盖资源管理、安全、内容提取、输出格式和链接过滤。

### 资源管理

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `MaxInputSize` | `int` | `52428800` (50MB) | 最大输入大小（字节） |
| `MaxCacheEntries` | `int` | `2000` | 缓存最大条目数 |
| `CacheTTL` | `time.Duration` | `1h` | 缓存过期时间 |
| `CacheCleanup` | `time.Duration` | `5m` | 缓存清理间隔 |
| `WorkerPoolSize` | `int` | `4` | 工作池大小 |
| `ProcessingTimeout` | `time.Duration` | `30s` | 处理超时时间 |

### 安全

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `EnableSanitization` | `bool` | `true` | 启用内容清洗，仅对可信输入可禁用 |
| `MaxDepth` | `int` | `500` | 最大 DOM 深度 |
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

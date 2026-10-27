---
sidebar_label: "安全防护"
title: "安全防护 - CyberGo html | 多层安全 API 参考"
description: "CyberGo html 安全防护 API 参考：内容清洗规则、MaxInputSize 与 MaxDepth 输入限制、路径遍历检测、AllowedBaseDir 文件沙箱与 FileError 路径脱敏、HighSecurityConfig 高安全预设、结构化错误类型与 panic 恢复机制。"
sidebar_position: 50
---

# 安全防护

html 库内置多层安全防护，相关配置都在 [Config](../core/config) 的安全字段里。本页汇总这些字段对应的 API；防护原理见 [安全概述](../../guides/security/)。

## 安全配置字段

| 字段 | 类型 | 默认值 | 安全作用 |
|------|------|--------|----------|
| `EnableSanitization` | `bool` | `true` | 内容清洗：移除危险标签、事件属性和危险协议 |
| `MaxInputSize` | `int` | `52428800`（50MB） | 输入大小上限，防止内存耗尽 |
| `MaxDepth` | `int` | `500` | DOM 嵌套深度上限，防止递归炸弹 |
| `ProcessingTimeout` | `time.Duration` | `30s` | 单文档处理超时 |
| `AllowedBaseDir` | `string` | `""` | 文件操作目录沙箱，防止路径遍历 |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | 安全审计配置（见 [审计系统](./audit)） |

:::warning 关闭 EnableSanitization 的前提
`EnableSanitization` 默认开启，只有**完全可信的输入**才可关闭。关闭后 HTML 原样解析，危险标签与事件属性都会进入输出。
:::

## 内容清洗

开启时（默认）执行以下清洗：

| 防护层 | 行为 |
|--------|------|
| 危险标签 | 整体移除 `<script>`、`<style>`、`<noscript>`、`<iframe>`、`<embed>`、`<object>`、`<input>`、`<button>`、`<svg>`、`<math>` 十种标签；`<form>` 容器本身保留（服务端框架常把整页包在表单里）。ReadPage 阅读模式对 `<button>` 改为保留其文本标签后移除元素 |
| 事件属性 | 移除所有 `on*` 属性（`onclick`、`onerror` 等），以及 `formaction`、`autofocus` |
| 危险协议 | 阻止 `javascript:`、`vbscript:`、`file:`，包括协议相对 `//` 形式（`//data:` 同样被阻止） |
| style 属性 | 值含 `expression(`、`javascript:`、`vbscript:`，或声明 `behavior` / `-moz-binding` 时，整个 `style` 属性被移除（空值 `style=""` 视为安全保留）；细节见[安全概述](../../guides/security/#css-危险模式) |
| Data URL | 只放行显式 MIME 白名单：图片（不含 `image/svg+xml`）、字体、`application/pdf`；完整清单见[安全概述](../../guides/security/#data-url-白名单) |

被阻止的内容经审计系统记录（需开启审计）。

## 路径安全

### AllowedBaseDir 沙箱

把文件操作（`ExtractFromFile` 等）限制在指定目录及其子目录内：

```go
cfg := html.DefaultConfig()
cfg.AllowedBaseDir = "/var/www/html"

p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()

// ✅ 允许：目录内文件
_, err = p.ExtractFromFile("/var/www/html/page.html")

// ❌ 拒绝：目录外文件
_, err = p.ExtractFromFile("/etc/passwd")
```

设置后，只有 `AllowedBaseDir` 内部的文件路径可读。跨平台行为：

- **Unix**：解析符号链接（symlink），防止通过链接逃逸
- **Windows**：解析 junction 与符号链接

留空（默认）表示不限制，适用于可信输入。目标文件存在但位于目录外时，返回的 `*FileError` 的 `FileErr` 为 `path outside allowed directory`；这是唯一**不匹配任何哨兵错误**的文件错误类型，需要检查 `FileErr` 的消息内容。

### 路径遍历检测

路径清洗后仍含 `..` 路径分量时即判定为路径遍历，返回包装为 `*FileError` 的错误：

```go
_, err := html.ExtractFromFile("../../../etc/passwd")
// err.Error() ≈ html: ReadFile "passwd": path traversal detected
```

此时 `FileErr` 形如 `path traversal detected: <清洗后的路径>: html: invalid file path`（Windows 上路径形如 `..\..\..\etc\passwd`），**包装 `ErrInvalidFilePath`**，因此 `errors.Is(err, html.ErrInvalidFilePath)` 为 `true`，可按哨兵直接判定。

### FileError 的路径脱敏

文件错误自动脱敏，避免泄露文件系统结构：

```go
type FileError struct {
	Op      string
	Path    string
	FileErr error
}

func (e *FileError) Error() string                // 仅显示文件名与脱敏后的原因
func (e *FileError) SafePath() string             // 仅返回文件名
func (e *FileError) MarshalJSON() ([]byte, error) // JSON 序列化时自动脱敏
```

```go
_, err := html.ExtractFromFile("/var/www/secret/secret.html")
if err != nil {
	var fileErr *html.FileError
	if errors.As(err, &fileErr) {
		fmt.Println(fileErr.SafePath()) // 输出：secret.html
	}
}
```

上例文件不存在时（`Path = "/var/www/secret/secret.html"`）三个方法的实际输出：

| 调用 | 结果 |
|------|------|
| `Error()` | `html: ReadFile "secret.html": file not found` |
| `SafePath()` | `secret.html` |
| `MarshalJSON()` | `{"op":"ReadFile","path":"secret.html","message":"file not found"}` |

完整路径仍保留在 `Path` 字段，供内部调试使用。

## 安全预设

### HighSecurityConfig

`HighSecurityConfig` 是面向高安全环境的预设，收紧各项限制并开启完整审计：

```go
func HighSecurityConfig() Config
```

相对 `DefaultConfig()` 的覆盖：

| 字段 | 默认值 | 高安全值 |
|------|--------|----------|
| `MaxInputSize` | `52428800`（50MB） | `10485760`（10MB） |
| `MaxCacheEntries` | `2000` | `500` |
| `CacheTTL` | `1h` | `30m` |
| `CacheCleanup` | `5m` | `1m` |
| `WorkerPoolSize` | `4` | `2` |
| `ProcessingTimeout` | `30s` | `10s` |
| `MaxDepth` | `500` | `100` |
| `Audit` | `DefaultAuditConfig()` | `HighSecurityAuditConfig()` |

该预设已设置 `Audit`，无需再次赋值。

```go
cfg := html.HighSecurityConfig()
p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()
```

## 安全相关错误

| 错误 | 触发条件 |
|------|----------|
| `ErrInputTooLarge` | 输入超过 `MaxInputSize` |
| `ErrMaxDepthExceeded` | DOM 深度超过 `MaxDepth`（未先被解析器拒绝时） |
| `ErrProcessingTimeout` | 库内 `ProcessingTimeout` 到期 |
| `ErrInvalidFilePath` | 文件路径为空等基础校验失败；路径遍历拒绝同样包装它（`errors.Is` 可命中） |
| `ErrInternalPanic` | 内部 panic 被恢复 |

:::info 用户 context 的 deadline 不归一化
`ExtractWithContext` 的 deadline 早于库内 `ProcessingTimeout` 到期时，返回原样的 `context.DeadlineExceeded`，不会被改写为 `ErrProcessingTimeout`。主动 `cancel()` 返回 `context.Canceled`。
:::

### 结构化错误类型

上述哨兵错误以三个结构化错误类型包裹返回，携带定位所需的上下文字段：

| 类型 | 字段 | 方法 | `Unwrap()` 目标 |
|------|------|------|-----------------|
| `*InputError` | `Op` / `Size` / `MaxSize` / `InputErr` | `Error` | `[]error{InputErr, ErrInputTooLarge}`（`InputErr` 为 `nil` 时只含后者） |
| `*ConfigError` | `Field` / `Value` / `Message` | `Error` | `ErrInvalidConfig` |
| `*FileError` | `Op` / `Path` / `FileErr` | `Error` / `SafePath` / `MarshalJSON` | `FileErr` 为 `ErrFileNotFound` 时返回它，否则返回 `FileErr`；两者皆空时返回 `ErrInvalidFilePath` |

用 `errors.Is(err, html.ErrXxx)` 判定哨兵类别，用 `errors.As(err, &typedErr)` 取回结构化上下文（如 `InputError.Size`/`MaxSize`、`ConfigError.Field`）。

:::info 错误类型的完整定义
三个错误类型的定义与 `errors.Is`/`errors.As` 用法见 [常量与错误](../types/constants)。
:::

## panic 恢复

所有提取操作内置 panic 恢复：处理过程中发生未预期的 panic 时返回 `ErrInternalPanic`，而不是让进程崩溃。

```go
_, err := html.Extract(maliciousData)
if err != nil {
	if errors.Is(err, html.ErrInternalPanic) {
		// 输入可能触发了内部 bug
		log.Printf("panic recovered: %v", err)
	}
}
```

## 相关文档

- [安全概述](../../guides/security/) — 安全特性的概念介绍与最佳实践
- [审计系统](./audit) — 审计管道、事件类型与 Sink
- [配置](../core/config) — 完整 Config 字段参考
- [常量与错误](../types/constants) — 哨兵错误与错误类型
- [生产检查清单](../../guides/security/production-checklist) — 上线安全核对

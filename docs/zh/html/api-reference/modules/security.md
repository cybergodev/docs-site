---
sidebar_label: "安全防护"
title: "安全防护 - CyberGo html | 多层安全 API 参考"
description: "CyberGo html 多层安全防护 API 参考：内容消毒自动移除危险标签、事件属性与恶意协议，配合 MaxInputSize 输入限制、MaxDepth DOM 深度防护、路径遍历检测与 AllowedBaseDir 文件沙箱，含 HighSecurityConfig 高安全预设、panic 恢复机制及 InputError 等安全错误类型。"
sidebar_position: 5
---

# 安全防护

HTML 库内置多层安全防护，所有配置集中在 [Config](../core/config) 的安全字段中。本页汇总安全相关的 API；安全特性的概念介绍详见 [安全概述](../../guides/security/)。

## 安全配置字段

| 字段 | 类型 | 默认值 | 安全作用 |
|------|------|--------|----------|
| `EnableSanitization` | `bool` | `true` | 内容消毒：移除危险标签、事件属性和恶意协议 |
| `MaxInputSize` | `int` | `52428800` (50MB) | 输入大小限制，防止内存耗尽 |
| `MaxDepth` | `int` | `500` | DOM 嵌套深度限制，防止递归炸弹 |
| `ProcessingTimeout` | `time.Duration` | `30s` | 单文档处理超时，防止无限处理 |
| `AllowedBaseDir` | `string` | `""` | 文件操作目录沙箱，防止路径遍历 |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | 安全审计配置（详见 [审计系统](./audit)） |

:::warning 禁用消毒的风险
`EnableSanitization` 默认启用，**仅对完全可信的输入**才可禁用。禁用后 HTML 原样解析，可能导致 XSS 风险。
:::

## 内容消毒

启用时（默认），自动执行以下清洗：

| 防护层 | 行为 |
|--------|------|
| 危险标签 | 移除 `<script>`、`<style>`、`<iframe>`、`<object>`、`<embed>` 等 |
| 事件属性 | 移除所有 `on*` 属性（`onclick`、`onerror` 等） |
| 危险协议 | 阻止 `javascript:`、`vbscript:`、`file:` 协议（含协议相对 `//` 形式的危险协议） |
| Data URL | 仅允许 `data:image/*`（`image/svg+xml` 除外）、`data:font/*`、`data:application/pdf` |

被阻止的内容通过审计系统记录（需启用审计）。

## 路径安全

### AllowedBaseDir 沙箱

限制文件操作（`ExtractFromFile` 等）到指定目录及其子目录：

```go
cfg := html.DefaultConfig()
cfg.AllowedBaseDir = "/var/www/html"

p, err := html.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer p.Close()

// ✅ 允许：目录内文件
result, err := p.ExtractFromFile("/var/www/html/page.html")

// ❌ 拒绝：目录外文件
_, err = p.ExtractFromFile("/etc/passwd")
```

设置后，文件路径必须在 `AllowedBaseDir` 内部才能被读取。跨平台支持：

- **Unix**：解析符号链接（symlink），防止通过链接逃逸
- **Windows**：解析 junction 和符号链接

留空（默认）表示不限制——适用于可信输入场景。

### 路径遍历检测

自动检测和阻止路径遍历尝试（如 `../../../etc/passwd`），返回包装为 `*FileError` 的错误：

```go
_, err := html.ExtractFromFile("../../../etc/passwd")
// err 包含 "path traversal detected" 信息
```

### FileError.SafePath

文件错误自动脱敏路径信息，防止文件系统结构泄露：

```go
type FileError struct {
    Op      string
    Path    string
    FileErr error
}

func (e *FileError) Error() string        // 输出已截断路径（仅文件名）
func (e *FileError) SafePath() string     // 仅返回文件名
func (e *FileError) MarshalJSON() ([]byte, error) // JSON 序列化时自动脱敏
```

```go
_, err := html.ExtractFromFile("/var/www/secret/config.html")
if err != nil {
    var fileErr *html.FileError
    if errors.As(err, &fileErr) {
        fmt.Println(fileErr.SafePath()) // 输出：config.html（不含路径）
    }
}
```

:::tip
`FileError.Error()` 和 `SafePath()` 都返回截断后的安全路径（仅文件名），防止路径泄露。内部调试需要完整路径时可直接访问 `Path` 字段。
:::

## 安全预设

### HighSecurityConfig

面向高安全环境的预设配置，收紧所有限制并启用完整审计：

```go
func HighSecurityConfig() Config
```

相比 `DefaultConfig()` 的安全字段覆盖：

| 字段 | 默认值 | 高安全值 |
|------|--------|----------|
| `MaxInputSize` | `52428800` (50MB) | `10485760` (10MB) |
| `MaxDepth` | `500` | `100` |
| `ProcessingTimeout` | `30s` | `10s` |
| `WorkerPoolSize` | `4` | `2` |
| `Audit` | `DefaultAuditConfig()` | `HighSecurityAuditConfig()` |

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
| `ErrMaxDepthExceeded` | DOM 深度超过 `MaxDepth` |
| `ErrProcessingTimeout` | 处理超过 `ProcessingTimeout` |
| `ErrInvalidFilePath` | 文件路径校验失败（含路径遍历） |
| `ErrInternalPanic` | 内部 panic 被恢复 |

### 结构化错误类型

上述哨兵错误实际以三个结构化错误类型包裹返回，携带定位所需的上下文字段：

| 类型 | 字段 | 方法 | `Unwrap()` 目标 |
|------|------|------|-----------------|
| `*InputError` | `Op` / `Size` / `MaxSize` / `InputErr` | `Error` | `InputErr`（非 nil 时），否则 `ErrInputTooLarge` |
| `*ConfigError` | `Field` / `Value` / `Message` | `Error` | `ErrInvalidConfig` |
| `*FileError` | `Op` / `Path` / `FileErr` | `Error` / `SafePath` / `MarshalJSON` | `ErrFileNotFound` / 原始错误 / `ErrInvalidFilePath` |

配合使用 `errors.Is(err, html.ErrXxx)` 判定哨兵类别，`errors.As(err, &typedErr)` 取回结构化上下文（如 `InputError.Size`/`MaxSize`、`ConfigError.Field`）。

:::info
三个错误类型的完整定义与 `errors.Is`/`errors.As` 错误处理模式详见 [常量与错误](../types/constants)。
:::

## 恐慌恢复

所有提取操作内置 panic 恢复机制。即使处理过程中发生未预期的 panic，也会返回 `ErrInternalPanic` 而非让服务崩溃：

```go
result, err := html.Extract(maliciousData)
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

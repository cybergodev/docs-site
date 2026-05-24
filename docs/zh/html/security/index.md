---
title: "安全概述 - HTML"
description: "CyberGo HTML 库安全防护概述，包括输入大小限制（默认 50MB）、DOM 深度限制（默认 500）、路径遍历防护、恐慌恢复机制、处理超时控制、内容清洗功能和可插拔审计系统，所有安全违规支持 errors.Is 和 errors.As 错误判断，确保生产环境的安全运行。"
---

# 安全概述

HTML 库在设计上优先考虑安全性，内置多层防护机制。

## 安全特性

### 输入大小限制

默认最大输入 50MB，防止内存耗尽：

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = 10 * 1024 * 1024 // 调整为 10MB
```

### DOM 深度限制

默认最大深度 500，防止递归炸弹攻击：

```go
cfg.MaxDepth = 200 // 收紧限制
```

### 路径遍历防护

文件操作自动检测和阻止路径遍历尝试（如 `../../../etc/passwd`），并通过审计系统记录。

### 恐慌恢复

所有提取操作内置 panic 恢复机制，返回 `ErrInternalPanic` 错误，确保服务不会因恶意输入崩溃。

### 处理超时

可配置处理超时，防止恶意 HTML 导致无限处理：

```go
cfg.ProcessingTimeout = 10 * time.Second
```

### 内容清洗

可选的内容清洗功能，移除潜在的恶意标签和属性：

```go
cfg.EnableSanitization = true
```

## 审计系统

详细的安全审计配置请参考 [审计系统](../api-reference/audit)。

审计系统可记录以下安全事件：

| 事件 | 说明 |
|------|------|
| `AuditEventBlockedTag` | 被阻止的 HTML 标签 |
| `AuditEventBlockedAttr` | 被阻止的属性 |
| `AuditEventBlockedURL` | 被阻止的 URL |
| `AuditEventInputViolation` | 输入大小违规 |
| `AuditEventDepthViolation` | DOM 深度违规 |
| `AuditEventPathTraversal` | 路径遍历尝试 |
| `AuditEventTimeout` | 处理超时 |
| `AuditEventEncodingIssue` | 编码异常 |

## 高安全配置

```go
cfg := html.HighSecurityConfig()
// 自动启用：缩减限制、更短超时、完整审计
```

## 错误处理

所有安全违规都会返回明确的错误，支持 `errors.Is` / `errors.As` 判断：

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // 记录并拒绝
    case errors.Is(err, html.ErrMaxDepthExceeded):
        // 可能是恶意构造
    case errors.Is(err, html.ErrInternalPanic):
        // 恐慌恢复，检查输入
    }
}
```

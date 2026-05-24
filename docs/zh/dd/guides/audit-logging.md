---
title: "审计日志 - CyberGo DD | 安全审计实战指南"
description: "CyberGo DD 审计日志实战指南，涵盖 AuditLogger 异步事件记录机制、11 种内置审计事件类型、严重等级过滤与分级、HMAC 完整性签名集成方案、审计统计与实时监控、日志验证与防篡改策略，帮助开发者构建符合合规要求的企业级安全审计系统。"
---

# 审计日志

审计日志独立于业务日志，专门记录安全相关事件（如敏感数据脱敏、ReDoS 攻击尝试等），适合合规审计和安全分析。

## 概述

```text
业务日志（Logger）          审计日志（AuditLogger）
    │                           │
    ├─ Info/Debug/Warn...       ├─ SensitiveDataRedacted
    ├─ 结构化字段               ├─ RateLimitExceeded
    └─ 文件/控制台输出          ├─ ReDoSAttempt
                                ├─ SecurityViolation
                                └─ IntegrityViolation
```

审计日志通过缓冲通道异步写入，不阻塞业务流程。

## 创建 AuditLogger

### 基本用法

```go
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer auditLogger.Close()

// 注意：AuditLogger 与 Logger 是独立组件
// 两者不自动集成，需要通过钩子或其他机制手动连接
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
    Targets: []dd.OutputTarget{dd.ConsoleOutput()},
})
```

### 自定义配置

```go
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           os.Stderr,           // 输出目标 (*os.File)
    BufferSize:       2000,                // 缓冲通道大小
    IncludeTimestamp: true,                // 包含时间戳
    JSONFormat:       true,                // JSON 格式
    MinimumSeverity:  dd.AuditSeverityWarning, // 最低严重等级
})
```

## 审计事件类型

AuditLogger 记录 11 种安全事件：

| 事件类型 | 说明 | 默认严重等级 |
|----------|------|-------------|
| `SensitiveDataRedacted` | 敏感数据被脱敏 | Info |
| `RateLimitExceeded` | 速率限制触发 | Warning |
| `ReDoSAttempt` | ReDoS 攻击尝试 | Critical |
| `SecurityViolation` | 安全违规 | Error |
| `IntegrityViolation` | 日志完整性被破坏 | Critical |
| `InputSanitized` | 输入被清洗 | Info |
| `PathTraversalAttempt` | 路径穿越尝试 | Critical |
| `Log4ShellAttempt` | Log4Shell 攻击尝试 | <Badge type="info" text="由调用者指定" /> |
| `NullByteInjection` | 空字节注入尝试 | <Badge type="info" text="由调用者指定" /> |
| `OverlongEncoding` | 超长编码攻击 | <Badge type="info" text="由调用者指定" /> |
| `HomographAttack` | 同形字攻击 | <Badge type="info" text="由调用者指定" /> |

## 与 HMAC 签名集成

审计日志与完整性签名结合，可防止日志被篡改：

```go
// 创建签名器
integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(integrityCfg)

// 创建带签名的审计Logger
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    BufferSize:       1000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer,    // HMAC 签名
})
```

## 审计统计

```go
stats := auditLogger.Stats()
fmt.Printf("总事件数: %d\n", stats.TotalEvents)
fmt.Printf("丢弃事件: %d\n", stats.Dropped)
fmt.Printf("缓冲区使用率: %.1f%%\n",
    float64(stats.BufferUsage)/float64(stats.BufferSize)*100)

// 按类型统计
for eventType, count := range stats.ByType {
    fmt.Printf("  %s: %d\n", eventType, count)
}
```

:::tip 监控建议
定期检查 `Dropped` 计数。如果丢弃事件数量增长，说明缓冲区不足，需要增大 `BufferSize` 或提高消费速度。
:::

## 日志验证

验证审计日志条目的完整性：

```go
// 验证单条审计日志
result := dd.VerifyAuditEvent(logLine, signer)
if result.Valid {
    fmt.Printf("已验证: %s\n", result.RawEvent)
    if result.Event != nil {
        fmt.Printf("  类型: %s, 消息: %s\n", result.Event.Type, result.Event.Message)
    }
} else {
    fmt.Printf("验证失败: %s\n", result.Error)
}
```

## 严重等级过滤

审计事件按严重等级过滤，低于 `MinimumSeverity` 的事件被忽略：

```go
// 只记录 Warning 及以上
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    MinimumSeverity: dd.AuditSeverityWarning,
})
```

| 等级 | 数值 | 适用场景 |
|------|------|----------|
| `AuditSeverityInfo` | 0 | 记录所有事件（开发/调试） |
| `AuditSeverityWarning` | 1 | 生产环境推荐 |
| `AuditSeverityError` | 2 | 高安全要求 |
| `AuditSeverityCritical` | 3 | 仅记录严重事件 |

## 完整示例

```go
package main

import (
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // 创建审计文件
    auditFile, _ := os.Create("logs/audit.json")
    defer auditFile.Close()

    // 创建签名器
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // 创建审计Logger
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // 创建业务Logger（带安全过滤）
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // 正常业务日志（敏感数据自动脱敏）
    logger.InfoWith("用户操作",
        dd.String("username", "alice"),
        dd.String("password", "secret123"), // → [REDACTED]
    )

    // 注意：AuditLogger 和 Logger 是独立组件
    // 需通过钩子将 Logger 的安全事件转发到 AuditLogger
}
```

## 下一步

- [HMAC 签名实战](../advanced/integrity) -- 完整性签名详解
- [行业合规配置](../security/compliance) -- HIPAA/PCI-DSS 审计要求
- [API 参考 - Audit](../api-reference/audit) -- AuditLogger 完整 API
- [API 参考 - Integrity](../api-reference/integrity) -- IntegritySigner API

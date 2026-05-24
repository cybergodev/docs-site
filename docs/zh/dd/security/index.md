---
title: "安全概述 - CyberGo DD | 日志安全"
description: "CyberGo DD 日志库安全特性全面概述，包括敏感数据自动检测与脱敏过滤机制、文件路径安全验证与防护策略、异步审计事件记录与链式追踪能力、HMAC 完整性签名防篡改技术和合规配置最佳实践指南，从数据过滤到审计追踪全面保障日志系统运行安全。"
---

# 安全概述

DD 日志库内置多层安全防护机制，从数据过滤到审计追踪全面保障日志安全。

## 安全层次

| 层次 | 机制 | 说明 |
|------|------|------|
| 数据层 | 敏感数据过滤 | 自动脱敏密码、密钥等 |
| 路径层 | 路径安全验证 | 防止路径遍历、符号链接攻击 |
| 模式层 | ReDoS 防护 | 检测危险正则模式 |
| 审计层 | 审计日志 | 记录所有安全事件 |
| 完整性层 | HMAC 签名 | 确保日志不可篡改 |

## 敏感数据过滤

DD 内置敏感数据自动检测和脱敏：

```go
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})

// password 字段自动脱敏
logger.InfoWith("登录",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // 输出: [REDACTED]
)
```

支持的自定义模式：

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,
    `(?i)api[_-]?key\s*[:=]\s*\S+`,
    `\b\d{16,19}\b`,  // 信用卡号
)
```

详见 [安全过滤 API](../api-reference/security)。

## 路径安全

FileWriter 内置多层路径安全验证：

| 防护 | 说明 |
|------|------|
| 路径遍历 | 拒绝 `../` 等路径遍历 |
| Null 字节 | 拒绝 null 字节注入 |
| 超长编码 | 检测 UTF-8 超长编码 |
| 符号链接 | 可配置禁止符号链接 |
| 硬链接 | 可配置禁止硬链接 |
| 路径长度 | 限制路径最大长度 |

```go
// 路径遍历攻击自动拒绝
fw, err := dd.NewFileWriter("../../../etc/passwd", dd.DefaultFileWriterConfig())
// err: PATH_TRAVERSAL
```

## 合规配置

DD 提供行业合规预设：

| 预设 | 合规标准 | 适用行业 |
|------|----------|----------|
| `HealthcareConfig()` | HIPAA | 医疗 |
| `FinancialConfig()` | PCI-DSS | 金融 |
| `GovernmentConfig()` | 政府标准 | 公共部门 |

```go
// HIPAA 合规
logger, _ := dd.New(dd.Config{
    Security: dd.HealthcareConfig(),
})
```

## 审计日志

所有安全事件可通过审计日志追踪：

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

audit.LogSecurityViolation("sql_injection", "SQL 注入", map[string]any{
    "input": "' OR 1=1 --",
})
```

详见 [审计日志 API](../api-reference/audit)。

## 日志完整性

通过 HMAC 签名确保日志不可篡改：

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
signature := signer.Sign(logMessage)
// 验证时：signer.Verify(signedEntry)
```

详见 [完整性签名 API](../api-reference/integrity)。

## 下一步

- [生产检查清单](./production-checklist) -- 上线前安全检查
- [安全过滤 API](../api-reference/security) -- SensitiveDataFilter 详解
- [审计日志 API](../api-reference/audit) -- AuditLogger 详解

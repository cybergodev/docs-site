---
sidebar_label: "概述"
title: "安全概述 - CyberGo DD | 日志安全"
description: "CyberGo DD 日志安全特性概述：敏感数据自动检测与脱敏、文件路径安全验证、审计日志、HMAC 完整性签名防篡改、合规配置与速率限制，从数据过滤到审计追踪保障日志系统安全。"
sidebar_position: 1
---

# 安全概述

DD 日志库内置多层安全防护机制，从数据过滤到审计追踪全面保障日志安全。

## 安全层次

| 层次 | 机制 | 说明 |
|------|------|------|
| 数据层 | 敏感数据过滤 | 自动脱敏密码、密钥等 |
| 路径层 | 路径安全验证 | 防止路径遍历、符号链接攻击 |
| 模式层 | ReDoS 防护 | 检测危险正则模式 |
| 审计层 | 审计日志 | 记录关键安全事件（脱敏、限流、违规等） |
| 完整性层 | HMAC 签名 | 确保日志不可篡改 |

### 先读哪页

- 只想让日志自动脱敏 → [敏感数据过滤](./sensitive-filtering)
- 要满足 HIPAA / PCI-DSS 等合规要求 → [行业合规配置](./compliance)
- 要防止日志被篡改 → [完整性签名](./integrity)
- 准备生产上线 → [生产检查清单](./production-checklist)

## 敏感数据过滤

DD 内置敏感数据自动检测和脱敏：

```go
cfg := dd.DefaultConfig()
cfg.Security = dd.DefaultSecurityConfig() // 基础过滤（DefaultConfig 默认已含）
logger, _ := dd.New(cfg)

// password 字段自动脱敏
logger.InfoWith("登录",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // 输出：[REDACTED]
)
```

支持的自定义模式：

```go
filter, err := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,
    `(?i)api[_-]?key\s*[:=]\s*\S+`,
    `\b\d{16,19}\b`,  // 信用卡号
)
if err != nil {
    log.Fatal(err) // 正则表达式安全性验证失败
}
```

详见 [安全过滤 API](../../api-reference/security-audit/security)。

## 路径安全

FileWriter 内置多层路径安全验证：

| 防护 | 说明 |
|------|------|
| 路径遍历 | 拒绝 `../` 等路径遍历 |
| Null 字节 | 拒绝 null 字节注入 |
| 超长编码 | 检测 UTF-8 超长编码 |
| 符号链接 | 无条件禁止符号链接 |
| 硬链接 | 无条件禁止硬链接 |
| 路径长度 | 限制路径最大长度 |

```go
// 路径遍历攻击自动拒绝
fw, err := dd.NewFileWriter("../../../etc/passwd", dd.DefaultFileWriterConfig())
// err.Error(): "path traversal detected"
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
cfg := dd.DefaultConfig()
cfg.Security = dd.HealthcareConfig()
logger, _ := dd.New(cfg)
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

详见 [审计日志 API](../../api-reference/security-audit/audit)。

## 日志完整性

通过 HMAC 签名确保日志不可篡改：

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
signature := signer.Sign(logMessage)
// 验证时：signer.Verify(signedEntry)
```

详见 [完整性签名 API](../../api-reference/security-audit/integrity)。

## 速率限制

`SecurityConfig.RateLimitConfig` 用于防止日志洪泛（DoS）。默认**关闭**——所有预设安全配置均不填充该字段，需显式启用：

```go
cfg := dd.DefaultConfig()
cfg.Security = dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
cfg.Security.RateLimitConfig = dd.DefaultRateLimitConfig() // 10000 条/秒、10MB/秒、burst 1000、RateLimitStrategyDrop 策略
logger, _ := dd.New(cfg)
```

三种超限策略：`RateLimitStrategyDrop` 直接丢弃（默认）；`RateLimitStrategySample` 超限后按采样率保留（如 1/100）；`RateLimitStrategyThrottle` 为 API 完整性保留，当前行为与 `RateLimitStrategyDrop` 相同（Logger 永不阻塞）。

:::tip 与日志采样是两套机制
`Config.Sampling`（[日志采样](../operations/sampling)）与 `SecurityConfig.RateLimitConfig`（限流）相互独立：采样按计数器周期性降量，限流按速率上限防洪泛，二者可同时启用。限流字段详见 [Security API](../../api-reference/security-audit/security)。
:::

## 下一步

- [生产检查清单](./production-checklist) -- 上线前安全检查
- [安全过滤 API](../../api-reference/security-audit/security) -- SensitiveDataFilter 详解
- [审计日志 API](../../api-reference/security-audit/audit) -- AuditLogger 详解

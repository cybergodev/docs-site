---
title: "敏感数据过滤 - CyberGo DD | 自动脱敏配置指南"
description: "CyberGo DD 敏感数据过滤配置指南，涵盖内置过滤模式（密码、API Key、信用卡、SSN、JWT 等）、自定义正则模式、五级安全等级、行业合规预设（HIPAA、PCI-DSS、政府标准）以及过滤统计与监控，帮助开发者构建合规的日志脱敏方案。"
---

# 敏感数据过滤

DD 内置敏感数据自动过滤，在日志写入前将密码、API Key、信用卡号等敏感信息替换为 `[REDACTED]`，防止敏感数据泄露到日志中。

## 快速启用

```go
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})

// password 字段自动脱敏
logger.InfoWith("用户登录",
    dd.String("username", "alice"),
    dd.String("password", "s3cr3t123"),    // 输出: password=[REDACTED]
)
```

## 内置过滤模式

`DefaultSecurityConfig()` 启用基础过滤，覆盖以下敏感信息：

| 类别 | 匹配目标 |
|------|----------|
| 密码 | `password`、`passwd`、`pwd` 等字段 |
| API Key | `api_key`、`apikey`、`access_token` 等 |
| 信用卡 | Visa、MasterCard 等卡号格式 |
| SSN | 美国社会安全号码格式 |
| 电话号码 | 全球电话号码格式（含国际格式） |

`DefaultSecureConfig()` 在基础之上增加：

| 类别 | 匹配目标 |
|------|----------|
| 邮箱 | email 地址格式 |
| IP 地址 | IPv4/IPv6 地址 |
| JWT Token | `eyJ` 开头的 JWT 格式 |
| 连接字符串 | 数据库连接字符串中的密码 |

## 自定义过滤模式

### 添加自定义模式

```go
filter := dd.NewEmptySensitiveDataFilter()

// 添加自定义正则模式（内置 ReDoS 防护）
_ = filter.AddPattern(`(?i)credit_card\s*[:=]\s*\d+`)
_ = filter.AddPattern(`(?i)phone\s*[:=]\s*\d{11}`)

logger, _ := dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: filter,
    },
})
```

### 从零创建自定义过滤器

```go
filter, err := dd.NewCustomSensitiveDataFilter(
    `(?i)secret_key\s*[:=]\s*\S+`,
    `(?i)private_token\s*[:=]\s*\S+`,
)
if err != nil {
    log.Fatal(err) // 正则表达式安全性验证失败
}
```

:::warning ReDoS 防护
`NewCustomSensitiveDataFilter` 内置 ReDoS 验证。如果正则表达式存在灾难性回溯风险，会返回错误。请使用非贪婪匹配和锚定模式来避免此问题。
:::

## 安全等级

DD 提供五个安全等级，每个等级有对应的预置配置：

```go
// 按等级获取配置
cfg := dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
```

| 等级 | 说明 | 适用场景 |
|------|------|----------|
| `Development` | 最宽松 | 本地开发 |
| `Basic` | 基础过滤 | 测试环境 |
| `Standard` | 标准过滤 | 一般生产环境 |
| `Strict` | 严格过滤 | 高安全要求 |
| `Paranoid` | 最严格 | 金融/医疗等敏感行业 |

## 行业合规预设

DD 提供三种行业合规配置：

### HIPAA（医疗行业）

```go
cfg := dd.HealthcareConfig()
```

额外过滤：ICD-10 编码、病历号 (MRN)、健康保险索赔号 (HICN)、患者标识号。

### PCI-DSS（金融支付）

```go
cfg := dd.FinancialConfig()
```

额外过滤：SWIFT 代码、IBAN 账号、CVV/CVC、银行路由号。

### 政府标准

```go
cfg := dd.GovernmentConfig()
```

额外过滤：护照号、驾照号、税务 ID、SSN 变体。

### 完整示例

```go
// 医疗系统：使用 HIPAA 合规配置
logger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/hipaa-audit.json"),
    },
})

// 含敏感信息的日志消息自动脱敏
logger.Info("患者记录 mrn=MRN-123456 diagnosis=J18.9 已更新")
// 消息中的 MRN 和 ICD-10 编码匹配模式会被脱敏

// 结构化字段根据键名敏感度过滤
logger.InfoWith("用户登录",
    dd.String("password", "s3cr3t123"),    // → [REDACTED]（键名敏感）
    dd.String("department", "内科"),         // 正常输出
)
```

## 过滤统计

监控过滤器的运行状态：

```go
filter := dd.NewSensitiveDataFilter()
stats := filter.GetFilterStats()
fmt.Printf("活跃 goroutines: %d\n", stats.ActiveGoroutines)
fmt.Printf("过滤模式数: %d\n", stats.PatternCount)
fmt.Printf("总脱敏次数: %d\n", stats.TotalRedactions)
fmt.Printf("超时次数: %d\n", stats.TotalTimeouts)
```

## 禁用过滤

```go
// 使用 Development 安全等级（无敏感数据过滤）
logger, _ := dd.New(dd.Config{
    Security: dd.SecurityConfigForLevel(dd.SecurityLevelDevelopment),
})

// 或手动设置空的 SensitiveFilter
logger, _ := dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: nil,
    },
})
```

:::warning 默认启用过滤
`DefaultConfig()` 默认启用基础敏感数据过滤（`DefaultSecurityConfig()`）。不设置 `Security` 字段时，也会使用默认安全配置。如需禁用过滤，必须显式设置 `SensitiveFilter` 为 `nil`。
:::

## 下一步

- [审计日志](./audit-logging) -- 安全事件审计
- [行业合规配置](../security/compliance) -- HIPAA/PCI-DSS 详解
- [API 参考 - Security](../api-reference/security) -- 安全 API 完整文档
- [生产检查清单](../security/production-checklist) -- 上线前检查

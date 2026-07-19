---
sidebar_label: "行业合规配置"
title: "行业合规配置 - CyberGo DD | HIPAA PCI-DSS 政府标准"
description: "CyberGo DD 行业合规日志配置专题，详细说明 HIPAA 医疗行业合规、PCI-DSS 金融支付合规和政府安全标准的敏感数据过滤规则配置、审计日志要求、日志保留与轮换策略以及完整合规配置示例，帮助开发者在严格合规要求下构建安全可靠的日志系统。"
sidebar_position: 2
---

# 行业合规配置

DD 提供三种行业合规预置配置，覆盖医疗、金融和政府领域的敏感数据保护要求。

## HIPAA 医疗合规

### 适用场景

- 电子健康记录（EHR）系统
- 医院信息管理系统
- 远程医疗平台
- 医疗数据研究平台

### 过滤规则

`HealthcareConfig()` 在 `DefaultSecureConfig()`（完整模式集）之上，额外过滤：

| 数据类型 | 模式 | 示例 |
|----------|------|------|
| ICD-10 编码 | 日志消息中的诊断码格式 | `diagnosis=J18.9` |
| 病历号 (MRN) | 日志消息中的医疗记录编号 | `mrn=MRN-123456` |
| 健康保险索赔号 (HICN) | 日志消息中的 HICN 编号 | `hicn=123456789A` |
| 患者标识号 | 日志消息中的患者标识符 | `patient_id=PAT-123456` |

### 配置示例

```go
func NewHIPAACompliantLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.HealthcareConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/hipaa-audit.json"),
        },
    })
}
```

### 审计要求

```go
// HIPAA 要求：安全事件审计 + 完整性保护
integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(integrityCfg)

auditFile, _ := os.OpenFile("logs/hipaa-audit.json", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    IncludeTimestamp: true,
    BufferSize:       2000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer,
})
```

## PCI-DSS 金融合规

### 适用场景

- 在线支付系统
- 信用卡处理服务
- 银行核心系统
- 电商交易平台

### 过滤规则

`FinancialConfig()` 在 `DefaultSecureConfig()`（完整模式集）之上，额外过滤：

| 数据类型 | 模式 | 示例 |
|----------|------|------|
| SWIFT 代码 | 日志消息中的国际银行代码 | `swift=BOFAUS3N` |
| IBAN 账号 | 日志消息中的国际银行账号 | `iban=DE89370400440532013000` |
| CVV/CVC | 日志消息中的卡片验证码 | `cvv=123` |
| 银行路由号 | 日志消息中的 ABA 路由号码 | `routing_number=021000021` |
| 银行账号 | 日志消息中的银行账号 | `account_number=12345678` |

### 配置示例

```go
func NewPCICompliantLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.FinancialConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/pci-audit.json"),
        },
    })
}
```

### 日志保留策略

```go
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 100    // 单文件 100MB
fwCfg.MaxAge = 365 * 24 * time.Hour // 保留 1 年（PCI-DSS 要求）
fwCfg.MaxBackups = 50    // 保留足够多的备份
fwCfg.Compress = true    // 压缩旧文件节省空间

fw, _ := dd.NewFileWriter("logs/pci-audit.json", fwCfg)
logger, _ := dd.New(dd.Config{
    Level:    dd.LevelInfo,
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.CustomOutput(fw)},
})
```

## 政府标准

### 适用场景

- 政务信息系统
- 公共服务平台
- 社保管理系统
- 税务处理系统

### 过滤规则

`GovernmentConfig()` 在 `DefaultSecureConfig()`（完整模式集）之上，额外过滤：

| 数据类型 | 模式 | 示例 |
|----------|------|------|
| 护照号 | 日志消息中的护照编号 | `passport_number=E12345678` |
| 驾照号 | 日志消息中的驾驶证编号 | `dl_number=D123456789` |
| 美国联邦税号 (EIN) | 日志消息中的 EIN 格式 | `12-3456789` |
| 英国国民保险号 | 日志消息中的 NINo 格式 | `AB123456C` |
| 加拿大社会保险号 | 日志消息中的 SIN 格式 | `123 456 789` |
| 案件编号 | 日志消息中的案件编号 | `case_number=CR-2024-00123` |

### 配置示例

```go
func NewGovernmentLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.GovernmentConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/gov-audit.json"),
        },
    })
}
```

## 合规对比

| 维度 | HIPAA | PCI-DSS | Government |
|------|-------|---------|------------|
| 额外过滤模式数 | +4 | +5 | +6 |
| 日志保留 | 6 年 | 1 年 | 按规定 |
| 完整性签名 | 推荐 | 必须 | 必须 |
| 审计日志 | 必须 | 必须 | 必须 |
| 加密传输 | 必须 | 必须 | 推荐 |

## 自定义合规配置

当预置配置不完全满足需求时，可以组合自定义：

```go
// 添加自定义模式
filter, _ := dd.NewCustomSensitiveDataFilter(
    // 自定义医疗系统特有模式
    `(?i)insurance_id\s*[:=]\s*\S+`,
    `(?i)prescription\s*[:=]\s*\S+`,
)

logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Security: &dd.SecurityConfig{
        SensitiveFilter: filter,
    },
    Targets: []dd.OutputTarget{dd.FileOutput("logs/custom.json")},
})
```

## 下一步

- [敏感数据过滤](../guides/sensitive-filtering) -- 过滤功能详解
- [审计日志](../guides/audit-logging) -- 安全审计集成
- [生产检查清单](./production-checklist) -- 上线前检查
- [API 参考 - Security](../api-reference/security-audit/security) -- 安全 API 文档

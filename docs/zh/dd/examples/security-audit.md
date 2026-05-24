---
title: "安全与审计实战 - CyberGo DD | 安全日志示例"
description: "CyberGo DD 安全过滤与审计日志的完整实战示例集合，涵盖敏感数据过滤规则配置、HMAC 完整性签名与验签、审计事件记录与批量验证、行业合规配置方案（HIPAA/PCI-DSS）以及生产环境安全日志架构设计与部署的最佳实践建议和注意事项。"
---

# 安全与审计实战

本示例展示如何配置 DD 的安全过滤、审计日志和完整性签名，构建生产级安全日志方案。

## 敏感数据过滤

### 基本过滤

```go
package main

import (
    "github.com/cybergodev/dd"
)

func main() {
    logger, _ := dd.New(dd.Config{
        Security: dd.DefaultSecurityConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // 密码自动脱敏
    logger.InfoWith("用户登录",
        dd.String("username", "alice"),
        dd.String("password", "s3cr3t123"),    // → password=[REDACTED]
    )

    // API Key 自动脱敏
    logger.InfoWith("API 调用",
        dd.String("endpoint", "/api/data"),
        dd.String("api_key", "sk-abc123xyz"),   // → api_key=[REDACTED]
    )
}
```

### 行业合规配置

```go
// HIPAA 医疗合规
medicalLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/medical.json")},
})

medicalLogger.InfoWith("患者就诊",
    dd.String("password", "s3cr3t123"),        // → [REDACTED]（键名敏感）
    dd.String("diagnosis", "常规检查"),         // 正常输出
)

// PCI-DSS 金融合规
paymentLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/payment.json")},
})

paymentLogger.InfoWith("支付处理",
    dd.String("card_number", "4111111111111111"),  // → [REDACTED]
    dd.String("amount", "99.99"),                  // 正常输出
)
```

## 审计日志

### 完整审计系统

```go
package main

import (
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // 审计日志文件
    auditFile, _ := os.Create("logs/audit.json")
    defer auditFile.Close()

    // HMAC 签名器（防篡改）
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // 审计Logger
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // 业务Logger
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // 正常业务操作
    logger.InfoWith("交易处理",
        dd.String("transaction_id", "TXN-001"),
        dd.String("amount", "1500.00"),
        dd.String("card_number", "4111111111111111"),  // → [REDACTED]
    )
}
```

## 完整性验证

### 签名与验证流程

```go
package main

import (
    "fmt"

    "github.com/cybergodev/dd"
)

func main() {
    // 创建签名器
    signer, err := dd.NewIntegritySigner(dd.IntegrityConfig{
        SecretKey:       []byte("your-32-byte-secret-key-here-1234"),
        IncludeTimestamp: true,
        IncludeSequence:  true,
    })
    if err != nil {
        panic(err)
    }

    // 签名日志条目
    logEntry := `{"level":"info","message":"重要操作","user":"admin"}`
    signature := signer.Sign(logEntry)
    signedEntry := logEntry + signature

    // 验证日志完整性
    result, err := signer.Verify(signedEntry)
    if err != nil {
        fmt.Printf("验证错误: %v\n", err)
    } else if result.Valid {
        fmt.Printf("验证通过 - 时间戳: %s, 序列号: %d\n",
            result.Timestamp, result.Sequence)
    } else {
        fmt.Printf("验证失败: 日志可能被篡改\n")
    }
}
```

### 批量验证审计日志

```go
func VerifyAuditLog(path string, signer *dd.IntegritySigner) error {
    file, err := os.Open(path)
    if err != nil {
        return err
    }
    defer file.Close()

    scanner := bufio.NewScanner(file)
    lineNum := 0
    for scanner.Scan() {
        lineNum++
        result := dd.VerifyAuditEvent(scanner.Text(), signer)
        if result == nil || !result.Valid {
            errMsg := "unknown error"
            if result != nil && result.Error != nil {
                errMsg = result.Error.Error()
            }
            return fmt.Errorf("line %d: integrity check failed - %s",
                lineNum, errMsg)
        }
    }
    return nil
}
```

## 生产环境安全配置

```go
func NewSecureLogger() (*dd.Logger, *dd.AuditLogger, error) {
    // 审计签名器
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // 审计Logger
    auditFile, _ := os.OpenFile("logs/audit.json", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       2000,
        MinimumSeverity:  dd.AuditSeverityWarning,
        IntegritySigner:  signer,
    })

    // 业务Logger
    fwCfg := dd.DefaultFileWriterConfig()
    fwCfg.MaxSizeMB = 50
    fwCfg.Compress = true
    fw, _ := dd.NewFileWriter("logs/app.json", fwCfg)

    logger, _ := dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.CustomOutput(fw)},
    })

    return logger, auditLogger, nil
}
```

## 下一步

- [API 参考 - Security](../api-reference/security) -- 安全过滤完整 API
- [API 参考 - Audit](../api-reference/audit) -- 审计日志完整 API
- [API 参考 - Integrity](../api-reference/integrity) -- 完整性签名 API
- [生产检查清单](../security/production-checklist) -- 上线安全检查

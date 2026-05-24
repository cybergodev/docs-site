---
title: "HMAC 签名实战 - CyberGo DD | 日志完整性保护"
description: "CyberGo DD HMAC-SHA256 日志完整性签名实战指南，涵盖 IntegritySigner 创建与初始化配置、签名与验签完整流程、时间戳与序列号递增机制、防篡改检测策略、与审计日志系统集成方案以及生产环境部署最佳实践，确保日志链路的完整性与可追溯性。"
---

# HMAC 签名实战

DD 的 `IntegritySigner` 使用 HMAC-SHA256 对日志条目进行签名，确保日志在存储和传输过程中不被篡改。

## 核心概念

```text
签名流程:
  原始日志 → HMAC-SHA256(密钥 + 时间戳 + 序列号) → 签名后日志

验证流程:
  签名后日志 → 提取签名 → 重新计算 HMAC → 对比签名 → 判断完整性
```

## 创建签名器

### 安全密钥配置

```go
// 方式一：自动生成安全密钥（推荐）
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
// cfg.SecretKey 已填充 32 字节随机密钥

signer, _ := dd.NewIntegritySigner(cfg)
```

### 自定义配置

```go
cfg := dd.IntegrityConfig{
    SecretKey:       []byte("your-32-byte-minimum-secret-key!!"),  // 至少 32 字节
    HashAlgorithm:   dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,    // 签名包含时间戳
    IncludeSequence:  true,    // 签名包含序列号
    SignaturePrefix:  "[SIG:",  // 签名前缀
}
```

:::danger 密钥管理
- 密钥至少 32 字节
- 不要将密钥硬编码在源码中，使用环境变量或密钥管理服务
- 定期轮换密钥
- 密钥泄露后立即轮换并重新验证所有日志
:::

## 签名流程

```go
// 创建签名器
signer, _ := dd.NewIntegritySigner(cfg)

// 签名单条日志
logEntry := `{"level":"info","message":"用户登录","user":"admin"}`
signature := signer.Sign(logEntry)
signedEntry := logEntry + signature

fmt.Println(signedEntry)
// 输出: {"level":"info","message":"用户登录","user":"admin"}[SIG:1713456789000000000:1:base64sig...]
```

### 签名统计

```go
stats := signer.Stats()
fmt.Printf("当前序列号: %d\n", stats.Sequence)
fmt.Printf("算法: %s\n", stats.Algorithm)
fmt.Printf("包含时间戳: %v\n", stats.IncludeTimestamp)
fmt.Printf("包含序列号: %v\n", stats.IncludeSequence)
```

## 验证流程

### 验证单条日志

```go
result, err := signer.Verify(signedEntry)
if err != nil {
    fmt.Printf("✗ 验证失败: %v\n", err)
    return
}

if result.Valid {
    fmt.Printf("✓ 日志完整 - 时间: %s, 序列号: %d\n",
        result.Timestamp, result.Sequence)
    fmt.Printf("消息: %s\n", result.Message)
} else {
    fmt.Printf("✗ 日志可能被篡改\n")
}
```

### 批量验证日志文件

```go
func VerifyLogFile(path string, signer *dd.IntegritySigner) (valid, invalid int, err error) {
    file, err := os.Open(path)
    if err != nil {
        return 0, 0, err
    }
    defer file.Close()

    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
        result, err := signer.Verify(scanner.Text())
        if err != nil || !result.Valid {
            invalid++
        } else {
            valid++
        }
    }

    return valid, invalid, scanner.Err()
}
```

### 验证审计事件

```go
result := dd.VerifyAuditEvent(auditLogLine, signer)
if result.Valid && result.Event != nil {
    fmt.Printf("审计事件: %s\n", result.Event.Message)
} else {
    fmt.Printf("验证失败: %s\n", result.Error)
}
```

## 与审计日志集成

```go
// 完整签名 + 审计方案
func NewSignedAuditSystem() (*dd.AuditLogger, *dd.IntegritySigner, error) {
    // 签名器
    cfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(cfg)

    // 审计文件
    auditFile, _ := os.OpenFile(
        "logs/audit-signed.json",
        os.O_CREATE|os.O_WRONLY|os.O_APPEND,
        0600,
    )

    // 审计Logger（带签名）
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        IncludeTimestamp: true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityWarning,
        IntegritySigner:  signer,
    })

    return auditLogger, signer, nil
}
```

## 时间戳与序列号

签名器支持在签名中嵌入时间戳和序列号：

```go
cfg := dd.IntegrityConfig{
    SecretKey:       secretKey,
    IncludeTimestamp: true,    // 签名中包含时间戳
    IncludeSequence:  true,    // 签名中包含递增序列号
}

// 启用后，Verify 结果包含额外信息
result, _ := signer.Verify(signedEntry)
result.Timestamp  // 签名时的时间戳
result.Sequence   // 签名时的序列号
```

:::tip 序列号检测
启用序列号后，可以检测日志是否被删除或重排。如果序列号不连续，说明日志可能被篡改。
:::

## 生产最佳实践

### 密钥管理

```go
// 从环境变量读取密钥
func loadSecretKey() ([]byte, error) {
    key := os.Getenv("DD_INTEGRITY_SECRET")
    if len(key) < 32 {
        return nil, fmt.Errorf("secret key must be at least 32 bytes")
    }
    return []byte(key), nil
}
```

### 定期验证

```go
// 每小时验证一次审计日志完整性
func startIntegrityChecker(signer *dd.IntegritySigner, logPath string) {
    ticker := time.NewTicker(time.Hour)
    go func() {
        for range ticker.C {
            valid, invalid, err := VerifyLogFile(logPath, signer)
            if err != nil {
                dd.Errorf("完整性检查失败: %v", err)
                continue
            }
            dd.InfoWith("完整性检查完成",
                dd.Int("valid", valid),
                dd.Int("invalid", invalid),
            )
            if invalid > 0 {
                dd.Error("检测到日志篡改")
            }
        }
    }()
}
```

## 下一步

- [审计日志](../guides/audit-logging) -- 安全审计集成
- [行业合规配置](../security/compliance) -- HIPAA/PCI-DSS 签名要求
- [API 参考 - Integrity](../api-reference/integrity) -- IntegritySigner 完整 API

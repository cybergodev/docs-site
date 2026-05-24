---
title: "セキュリティと監査実践 - CyberGo DD | セキュリティログサンプル"
description: "CyberGo DD セキュリティフィルタリングと監査ログの完全な実践サンプル集。機密データフィルタリングルール設定、HMAC 整合性署名と検証、監査イベント記録とバッチ検証、業界コンプライアンス設定スキーム（HIPAA/PCI-DSS）、本番環境セキュリティログアーキテクチャ設計とデプロイのベストプラクティス提案と注意事項。"
---

# セキュリティと監査実践

このサンプルでは、DD のセキュリティフィルタリング、監査ログ、整合性署名を設定し、本番レベルのセキュリティログソリューションを構築する方法を示します。

## 機密データフィルタリング

### 基本フィルタリング

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

    // パスワードは自動マスキング
    logger.InfoWith("ユーザーログイン",
        dd.String("username", "alice"),
        dd.String("password", "s3cr3t123"),    // → password=[REDACTED]
    )

    // API Key は自動マスキング
    logger.InfoWith("API 呼び出し",
        dd.String("endpoint", "/api/data"),
        dd.String("api_key", "sk-abc123xyz"),   // → api_key=[REDACTED]
    )
}
```

### 業界コンプライアンス設定

```go
// HIPAA 医療コンプライアンス
medicalLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/medical.json")},
})

medicalLogger.InfoWith("患者受診",
    dd.String("password", "s3cr3t123"),        // → [REDACTED]（キー名が機密）
    dd.String("diagnosis", "定期健診"),         // 正常に出力
)

// PCI-DSS 金融コンプライアンス
paymentLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/payment.json")},
})

paymentLogger.InfoWith("決済処理",
    dd.String("card_number", "4111111111111111"),  // → [REDACTED]
    dd.String("amount", "99.99"),                  // 正常に出力
)
```

## 監査ログ

### 完全な監査システム

```go
package main

import (
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // 監査ログファイル
    auditFile, _ := os.Create("logs/audit.json")
    defer auditFile.Close()

    // HMAC 署名器（改ざん防止）
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // 監査 Logger
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // 業務 Logger
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // 通常の業務操作
    logger.InfoWith("取引処理",
        dd.String("transaction_id", "TXN-001"),
        dd.String("amount", "1500.00"),
        dd.String("card_number", "4111111111111111"),  // → [REDACTED]
    )
}
```

## 整合性検証

### 署名と検証フロー

```go
package main

import (
    "fmt"

    "github.com/cybergodev/dd"
)

func main() {
    // 署名器を作成
    signer, err := dd.NewIntegritySigner(dd.IntegrityConfig{
        SecretKey:       []byte("your-32-byte-secret-key-here-1234"),
        IncludeTimestamp: true,
        IncludeSequence:  true,
    })
    if err != nil {
        panic(err)
    }

    // ログエントリに署名
    logEntry := `{"level":"info","message":"重要な操作","user":"admin"}`
    signature := signer.Sign(logEntry)
    signedEntry := logEntry + signature

    // ログの整合性を検証
    result, err := signer.Verify(signedEntry)
    if err != nil {
        fmt.Printf("検証エラー: %v\n", err)
    } else if result.Valid {
        fmt.Printf("検証成功 - タイムスタンプ: %s, シリアル番号: %d\n",
            result.Timestamp, result.Sequence)
    } else {
        fmt.Printf("検証失敗: ログが改ざんされた可能性\n")
    }
}
```

### 監査ログのバッチ検証

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

## 本番環境セキュリティ設定

```go
func NewSecureLogger() (*dd.Logger, *dd.AuditLogger, error) {
    // 監査署名器
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // 監査 Logger
    auditFile, _ := os.OpenFile("logs/audit.json", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       2000,
        MinimumSeverity:  dd.AuditSeverityWarning,
        IntegritySigner:  signer,
    })

    // 業務 Logger
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

## 次のステップ

- [API リファレンス - Security](../api-reference/security) -- セキュリティフィルタリング完全 API
- [API リファレンス - Audit](../api-reference/audit) -- 監査ログ完全 API
- [API リファレンス - Integrity](../api-reference/integrity) -- 整合性署名 API
- [本番チェックリスト](../security/production-checklist) -- リリース前セキュリティチェック

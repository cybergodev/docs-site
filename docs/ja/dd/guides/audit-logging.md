---
title: "監査ログ - CyberGo DD | セキュリティ監査実践ガイド"
description: "CyberGo DD 監査ログ実践ガイド。AuditLogger 非同期イベント記録メカニズム、11 種類の組み込み監査イベントタイプ、重大度レベルフィルタリングと段階別設定、HMAC 整合性署名統合ソリューション、監査統計とリアルタイムモニタリング、ログ検証と改ざん防止戦略をカバーし、コンプライアンス要件に準拠したエンタープライズグレードのセキュリティ監査システムを構築できます。"
---

# 監査ログ

監査ログは業務ログとは独立しており、セキュリティ関連イベント（機密データのマスキング、ReDoS 攻撃の試行など）を専用に記録し、コンプライアンス監査とセキュリティ分析に適しています。

## 概要

```text
業務ログ（Logger）          監査ログ（AuditLogger）
    │                           │
    ├─ Info/Debug/Warn...       ├─ SensitiveDataRedacted
    ├─ 構造化フィールド               ├─ RateLimitExceeded
    └─ ファイル/コンソール出力          ├─ ReDoSAttempt
                                ├─ SecurityViolation
                                └─ IntegrityViolation
```

監査ログはバッファチャネルを通じて非同期で書き込まれ、業務フローをブロックしません。

## AuditLogger の作成

### 基本的な使い方

```go
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer auditLogger.Close()

// 注意：AuditLogger と Logger は独立したコンポーネント
// 両者は自動的に統合されず、フックや他のメカニズムで手動接続が必要
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
    Targets: []dd.OutputTarget{dd.ConsoleOutput()},
})
```

### カスタム設定

```go
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           os.Stderr,           // 出力先 (*os.File)
    BufferSize:       2000,                // バッファチャネルサイズ
    IncludeTimestamp: true,                // タイムスタンプを含む
    JSONFormat:       true,                // JSON フォーマット
    MinimumSeverity:  dd.AuditSeverityWarning, // 最低重大度レベル
})
```

## 監査イベントタイプ

AuditLogger は 11 種類のセキュリティイベントを記録します：

| イベントタイプ | 説明 | デフォルト重大度 |
|----------|------|-------------|
| `SensitiveDataRedacted` | 機密データがマスキングされた | Info |
| `RateLimitExceeded` | レート制限がトリガーされた | Warning |
| `ReDoSAttempt` | ReDoS 攻撃の試行 | Critical |
| `SecurityViolation` | セキュリティ違反 | Error |
| `IntegrityViolation` | ログの整合性が破損 | Critical |
| `InputSanitized` | 入力がサニタイズされた | Info |
| `PathTraversalAttempt` | パストラバーサルの試行 | Critical |
| `Log4ShellAttempt` | Log4Shell 攻撃の試行 | <Badge type="info" text="呼び出し元が指定" /> |
| `NullByteInjection` | Null バイトインジェクションの試行 | <Badge type="info" text="呼び出し元が指定" /> |
| `OverlongEncoding` | オーバーロングエンコーディング攻撃 | <Badge type="info" text="呼び出し元が指定" /> |
| `HomographAttack` | ホモグラフ攻撃 | <Badge type="info" text="呼び出し元が指定" /> |

## HMAC 署名との統合

監査ログと整合性署名を組み合わせることで、ログの改ざんを防止できます：

```go
// 署名器を作成
integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(integrityCfg)

// 署名付き監査 Logger を作成
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    BufferSize:       1000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer,    // HMAC 署名
})
```

## 監査統計

```go
stats := auditLogger.Stats()
fmt.Printf("総イベント数: %d\n", stats.TotalEvents)
fmt.Printf("破棄イベント: %d\n", stats.Dropped)
fmt.Printf("バッファ使用率: %.1f%%\n",
    float64(stats.BufferUsage)/float64(stats.BufferSize)*100)

// タイプ別統計
for eventType, count := range stats.ByType {
    fmt.Printf("  %s: %d\n", eventType, count)
}
```

:::tip モニタリングのヒント
`Dropped` カウントを定期的にチェックしてください。破棄イベント数が増加している場合、バッファが不足していることを示しており、`BufferSize` を増やすか消費速度を上げる必要があります。
:::

## ログ検証

監査ログエントリの整合性を検証：

```go
// 監査ログエントリを検証
result := dd.VerifyAuditEvent(logLine, signer)
if result.Valid {
    fmt.Printf("検証成功: %s\n", result.RawEvent)
    if result.Event != nil {
        fmt.Printf("  タイプ: %s, メッセージ: %s\n", result.Event.Type, result.Event.Message)
    }
} else {
    fmt.Printf("検証失敗: %s\n", result.Error)
}
```

## 重大度レベルフィルタリング

監査イベントは重大度レベルでフィルタリングされ、`MinimumSeverity` 未満のイベントは無視されます：

```go
// Warning 以上のみ記録
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    MinimumSeverity: dd.AuditSeverityWarning,
})
```

| レベル | 数値 | 適用シナリオ |
|------|------|----------|
| `AuditSeverityInfo` | 0 | 全イベントを記録（開発/デバッグ） |
| `AuditSeverityWarning` | 1 | 本番環境推奨 |
| `AuditSeverityError` | 2 | 高セキュリティ要件 |
| `AuditSeverityCritical` | 3 | 重大イベントのみ記録 |

## 完全な例

```go
package main

import (
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // 監査ファイルを作成
    auditFile, _ := os.Create("logs/audit.json")
    defer auditFile.Close()

    // 署名器を作成
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // 監査 Logger を作成
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // 業務 Logger を作成（セキュリティフィルタリング付き）
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // 通常の業務ログ（機密データは自動マスキング）
    logger.InfoWith("ユーザー操作",
        dd.String("username", "alice"),
        dd.String("password", "secret123"), // → [REDACTED]
    )

    // 注意：AuditLogger と Logger は独立したコンポーネント
    // フックで Logger のセキュリティイベントを AuditLogger に転送する必要がある
}
```

## 次のステップ

- [HMAC 署名実践](../advanced/integrity) -- 整合性署名詳解
- [業界コンプライアンス設定](../security/compliance) -- HIPAA/PCI-DSS 監査要件
- [API リファレンス - Audit](../api-reference/audit) -- AuditLogger 完全 API
- [API リファレンス - Integrity](../api-reference/integrity) -- IntegritySigner API

---
sidebar_label: "監査ログ"
title: "監査ログ - CyberGo DD | セキュリティ監査実践ガイド"
description: "CyberGo DD 監査ログ実践ガイド。AuditLogger 非同期イベント記録メカニズム、11 種の組み込み監査イベントタイプ、重大度フィルタリングと段階的分類、HMAC 整合性署名統合ソリューション、監査統計とモニタリング、ログ検証と改ざん防止を網羅し、コンプライアンス準拠の監査システム構築を支援します。"
sidebar_position: 5
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
auditLogger, err := dd.NewAuditLogger(dd.DefaultAuditConfig())
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()

// AuditLogger は独立して作成することも（本例のように）、Config.Audit で Logger と自動統合することも可能
// ここでは独立用法をデモンストレーション：別途 logger を作成し、Config.Audit は未設定
logger, err := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
    Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### カスタム設定

```go
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           os.Stderr,               // 出力先 (*os.File)
    BufferSize:       2000,                    // バッファチャネルサイズ
    IncludeTimestamp: true,                    // タイムスタンプを含む
    JSONFormat:       true,                    // JSON フォーマット
    MinimumSeverity:  dd.AuditSeverityWarning, // 最低重大度レベル
})
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()
```

## 監査イベントタイプ

AuditLogger は 11 種類のセキュリティイベントを記録します：

| イベントタイプ | 説明 | デフォルト重大度 |
|----------|------|-------------|
| `AuditEventSensitiveDataRedacted` | 機密データがマスキングされた | Info |
| `AuditEventRateLimitExceeded` | レート制限がトリガーされた | Warning |
| `AuditEventReDoSAttempt` | ReDoS 攻撃の試行 | Critical |
| `AuditEventSecurityViolation` | セキュリティ違反 | Error |
| `AuditEventIntegrityViolation` | ログの整合性が破損 | Critical |
| `AuditEventInputSanitized` | 入力がサニタイズされた | Info |
| `AuditEventPathTraversalAttempt` | パストラバーサルの試行 | Critical |
| `AuditEventLog4ShellAttempt` | Log4Shell 攻撃の試行 | <Badge type="info" text="呼び出し元が指定" /> |
| `AuditEventNullByteInjection` | Null バイトインジェクションの試行 | <Badge type="info" text="呼び出し元が指定" /> |
| `AuditEventOverlongEncoding` | オーバーロングエンコーディング攻撃 | <Badge type="info" text="呼び出し元が指定" /> |
| `AuditEventHomographAttack` | ホモグラフ攻撃 | <Badge type="info" text="呼び出し元が指定" /> |

## HMAC 署名との統合

監査ログと整合性署名を組み合わせることで、ログの改ざんを防止できます：

```go
// 署名器を作成
integrityCfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(integrityCfg)
if err != nil {
    log.Fatal(err)
}

// 署名付き監査 Logger を作成
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    BufferSize:       1000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer, // HMAC 署名
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
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    MinimumSeverity: dd.AuditSeverityWarning,
})
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()
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
    "log"
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // 監査ファイルを作成
    auditFile, err := os.Create("logs/audit.json")
    if err != nil {
        log.Fatal(err)
    }
    defer auditFile.Close()

    // 署名器を作成
    integrityCfg, err := dd.DefaultIntegrityConfigSafe()
    if err != nil {
        log.Fatal(err)
    }
    signer, err := dd.NewIntegritySigner(integrityCfg)
    if err != nil {
        log.Fatal(err)
    }

    // 監査 Logger を作成
    auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    if err != nil {
        log.Fatal(err)
    }
    defer auditLogger.Close()

    // 業務 Logger を作成（セキュリティフィルタリング付き）
    logger, err := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    // 通常の業務ログ（機密データは自動マスキング）
    logger.InfoWith("ユーザー操作",
        dd.String("username", "alice"),
        dd.String("password", "secret123"), // → [REDACTED]
    )

    // 注：本例の Logger は Config.Audit を未設定のため、マスキングなどのセキュリティイベントは自動的に監査に入りません。
    // 業務 logger のセキュリティイベントを AuditLogger に自動転送したい場合は、その logger の
    // Config.Audit を設定してください（有効化するとマスキング、レート制限などのイベントが自動的に監査ストリームに転送されます）。
}
```

:::info 自動統合 vs 独立使用
AuditLogger は**独立して作成**することも（`dd.NewAuditLogger`、本節の例の使い方）、**`Config.Audit` 経由で Logger と自動統合**することも可能です。後者は `Config.Audit.Enabled` が true の場合、機密データのマスキングイベントやレート制限イベントなどを自動的に AuditLogger に転送し、フックを手動接続する必要はありません。
:::

## 次のステップ

- [HMAC 署名実践](../advanced/integrity) -- 整合性署名詳解
- [業界コンプライアンス設定](../security/compliance) -- HIPAA/PCI-DSS 監査要件
- [API リファレンス - Audit](../api-reference/security-audit/audit) -- AuditLogger 完全 API
- [API リファレンス - Integrity](../api-reference/security-audit/integrity) -- IntegritySigner API

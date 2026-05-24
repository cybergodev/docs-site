---
title: "機密データフィルタリング - CyberGo DD | 自動マスキング設定ガイド"
description: "CyberGo DD 機密データフィルタリング設定ガイド。組み込みフィルタリングパターン（パスワード、API Key、クレジットカード、SSN、JWT など）、カスタム正規表現パターン、5 段階セキュリティレベル、業界コンプライアンスプリセット（HIPAA、PCI-DSS、政府基準）、フィルタリング統計とモニタリングをカバーし、コンプライアンスに準拠したログマスキングソリューションを構築できます。"
---

# 機密データフィルタリング

DD は機密データの自動フィルタリングを組み込みで提供し、ログ書き込み前にパスワード、API Key、クレジットカード番号などの機密情報を `[REDACTED]` に置換し、機密データがログに漏洩するのを防ぎます。

## クイック有効化

```go
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})

// password フィールドは自動マスキング
logger.InfoWith("ユーザーログイン",
    dd.String("username", "alice"),
    dd.String("password", "s3cr3t123"),    // 出力: password=[REDACTED]
)
```

## 組み込みフィルタリングパターン

`DefaultSecurityConfig()` は基本フィルタリングを有効にし、以下の機密情報をカバーします：

| カテゴリ | マッチ対象 |
|------|----------|
| パスワード | `password`、`passwd`、`pwd` などのフィールド |
| API Key | `api_key`、`apikey`、`access_token` など |
| クレジットカード | Visa、MasterCard などのカード番号フォーマット |
| SSN | 米国社会保障番号フォーマット |
| 電話番号 | グローバル電話番号フォーマット（国際フォーマット含む） |

`DefaultSecureConfig()` は基本に追加：

| カテゴリ | マッチ対象 |
|------|----------|
| メールアドレス | email アドレスフォーマット |
| IP アドレス | IPv4/IPv6 アドレス |
| JWT Token | `eyJ` で始まる JWT フォーマット |
| 接続文字列 | データベース接続文字列内のパスワード |

## カスタムフィルタリングパターン

### カスタムパターンの追加

```go
filter := dd.NewEmptySensitiveDataFilter()

// カスタム正規表現パターンを追加（組み込み ReDoS 防護付き）
_ = filter.AddPattern(`(?i)credit_card\s*[:=]\s*\d+`)
_ = filter.AddPattern(`(?i)phone\s*[:=]\s*\d{11}`)

logger, _ := dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: filter,
    },
})
```

### ゼロからカスタムフィルターを作成

```go
filter, err := dd.NewCustomSensitiveDataFilter(
    `(?i)secret_key\s*[:=]\s*\S+`,
    `(?i)private_token\s*[:=]\s*\S+`,
)
if err != nil {
    log.Fatal(err) // 正規表現の安全性検証に失敗
}
```

:::warning ReDoS 防護
`NewCustomSensitiveDataFilter` は組み込みの ReDoS 検証を含みます。正規表現に破滅的バックトラックのリスクがある場合、エラーが返されます。非貪欲マッチとアンカーパターンを使用してこの問題を回避してください。
:::

## セキュリティレベル

DD は 5 つのセキュリティレベルを提供し、各レベルに対応するプリセット設定があります：

```go
// レベルで設定を取得
cfg := dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
```

| レベル | 説明 | 適用シナリオ |
|------|------|----------|
| `Development` | 最も緩やか | ローカル開発 |
| `Basic` | 基本フィルタリング | テスト環境 |
| `Standard` | 標準フィルタリング | 一般的な本番環境 |
| `Strict` | 厳格フィルタリング | 高セキュリティ要件 |
| `Paranoid` | 最も厳格 | 金融/医療などの機密業界 |

## 業界コンプライアンスプリセット

DD は 3 種類の業界コンプライアンス設定を提供します：

### HIPAA（医療業界）

```go
cfg := dd.HealthcareConfig()
```

追加フィルタリング：ICD-10 コード、病历番号 (MRN)、健康保険請求番号 (HICN)、患者識別番号。

### PCI-DSS（金融決済）

```go
cfg := dd.FinancialConfig()
```

追加フィルタリング：SWIFT コード、IBAN 口座番号、CVV/CVC、銀行ルーティング番号。

### 政府基準

```go
cfg := dd.GovernmentConfig()
```

追加フィルタリング：パスポート番号、運転免許番号、税務 ID、SSN バリアント。

### 完全な例

```go
// 医療システム：HIPAA 準拠設定を使用
logger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/hipaa-audit.json"),
    },
})

// 機密情報を含むログメッセージは自動マスキング
logger.Info("患者記録 mrn=MRN-123456 diagnosis=J18.9 が更新されました")
// メッセージ内の MRN と ICD-10 コードがパターンにマッチするとマスキングされる

// 構造化フィールドはキー名の機密度に基づいてフィルタリング
logger.InfoWith("ユーザーログイン",
    dd.String("password", "s3cr3t123"),    // → [REDACTED]（キー名が機密）
    dd.String("department", "内科"),         // 正常に出力
)
```

## フィルタリング統計

フィルターの動作状況をモニタリング：

```go
filter := dd.NewSensitiveDataFilter()
stats := filter.GetFilterStats()
fmt.Printf("アクティブ goroutines: %d\n", stats.ActiveGoroutines)
fmt.Printf("フィルタリングパターン数: %d\n", stats.PatternCount)
fmt.Printf("総マスキング回数: %d\n", stats.TotalRedactions)
fmt.Printf("タイムアウト回数: %d\n", stats.TotalTimeouts)
```

## フィルタリングの無効化

```go
// Development セキュリティレベルを使用（機密データフィルタリングなし）
logger, _ := dd.New(dd.Config{
    Security: dd.SecurityConfigForLevel(dd.SecurityLevelDevelopment),
})

// または SensitiveFilter を手動で nil に設定
logger, _ := dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: nil,
    },
})
```

:::warning デフォルトでフィルタリングが有効
`DefaultConfig()` はデフォルトで基本機密データフィルタリング（`DefaultSecurityConfig()`）が有効です。`Security` フィールドを設定しない場合も、デフォルトのセキュリティ設定が使用されます。フィルタリングを無効にするには、明示的に `SensitiveFilter` を `nil` に設定する必要があります。
:::

## 次のステップ

- [監査ログ](./audit-logging) -- セキュリティイベント監査
- [業界コンプライアンス設定](../security/compliance) -- HIPAA/PCI-DSS 詳解
- [API リファレンス - Security](../api-reference/security) -- セキュリティ API 完全ドキュメント
- [本番チェックリスト](../security/production-checklist) -- リリース前チェック

---
sidebar_label: "セキュリティフィルタ"
title: "セキュリティフィルタ - CyberGo DD | 機密データフィルタリング"
description: "CyberGo DD 機密データフィルタリング完全 API ドキュメント。SensitiveDataFilter フィルタリングルール設定、SecurityConfig セキュリティポリシーオプション、プリセットセキュリティ設定スキームを含み、ログ内のパスワード、API キー、Token、電話番号、ID 番号などの機密情報を自動検出・マスキングし、ログ漏洩リスクを効果的に防止します。"
sidebar_position: 2
---

# セキュリティフィルタ

DD は機密データフィルタリング機能を組み込みで提供し、ログ内のパスワード、キー、Token などの機密情報を自動検出してマスキングできます。

## SensitiveDataFilter

正規表現ベースの機密データフィルター。動的パターンとキャッシュをサポート。

### 作成

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `NewSensitiveDataFilter` | `() *SensitiveDataFilter` | 完全パターンセット |
| `NewEmptySensitiveDataFilter` | `() *SensitiveDataFilter` | 空のフィルター |
| `NewCustomSensitiveDataFilter` | `(patterns ...string) (*SensitiveDataFilter, error)` | カスタムパターン |

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `AddPattern` | `(pattern string) error` | 正規表現パターンを追加 |
| `AddPatterns` | `(patterns ...string) error` | パターンを一括追加 |
| `ClearPatterns` | `()` | 全パターンをクリア |
| `PatternCount` | `() int` | パターン数 |
| `Enable` | `()` | フィルタリングを有効化 |
| `Disable` | `()` | フィルタリングを無効化 |
| `IsEnabled` | `() bool` | 有効かどうか |
| `Filter` | `(input string) string` | 文字列をフィルタリング |
| `FilterFieldValue` | `(key string, value any) any` | 単一フィールド値をフィルタリング |
| `FilterValueRecursive` | `(key string, value any) any` | ネストされた構造を再帰的にフィルタリング |
| `GetFilterStats` | `() FilterStats` | フィルタリング統計を取得 |
| `ActiveGoroutineCount` | `() int32` | アクティブなフィルター goroutine 数 |
| `WaitForGoroutines` | `(timeout time.Duration) bool` | フィルター goroutine の完了を待機 |
| `Close` | `() bool` | フィルターを閉じてキャッシュを解放 |

### カスタムパターン

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,     // パスワード
    `(?i)api[_-]?key\s*[:=]\s*\S+`,  // API Key
    `\b\d{16,19}\b`,                  // クレジットカード番号
)
```

## SecurityConfig

セキュリティ設定構造体。フィルタリング動作とセキュリティレベルを制御します。

```go
type SecurityConfig struct {
    MaxMessageSize  int                       // メッセージサイズ上限（バイト、0 は制限なし、プリセット設定のデフォルトは 5MB）
    MaxWriters      int                       // 最大 Writer 数（プリセット設定のデフォルトは 100）
    SensitiveFilter *SensitiveDataFilter      // 機密データフィルター
    RateLimitConfig *internal.RateLimitConfig // レート制限設定（内部型、nil はレート制限無効を示す；プリセット設定はいずれもこのフィールドを埋めない）
}
```

:::info RateLimitConfig について
`RateLimitConfig` はログのレート制限を制御し、ログフラッディング（DoS）を防止して高負荷時のシステム安定性を維持します。このフィールドは内部型（`*internal.RateLimitConfig`）であり、直接生成できません。すべてのプリセット設定（`DefaultSecurityConfig`、`DefaultSecureConfig`、`SecurityConfigForLevel` など）はこのフィールドを**埋めません**、つまりデフォルトではレート制限が有効になりません；明示的に設定した場合のみ、Logger がそれに従いレートリミッターを初期化します。レート制限を無効にするには `nil` に設定してください。
:::

### FilterStats

フィルタリング統計データ構造。モニタリングとオブザーバビリティに使用します。

```go
type FilterStats struct {
    ActiveGoroutines  int32         // 現在アクティブなフィルター goroutine 数
    PatternCount      int32         // 登録済みの機密データパターン数
    SemaphoreCapacity int           // 最大同時フィルタリング操作数
    MaxInputLength    int           // 入力長さの切り詰め閾値
    Enabled           bool          // フィルタリングが有効かどうか
    TotalFiltered     int64         // 総フィルタリング操作数
    TotalRedactions   int64         // 総マスキング回数
    TotalTimeouts     int64         // 総タイムアウト回数
    AverageLatency    time.Duration // 平均フィルタリングレイテンシ
    CacheHits         int64         // キャッシュヒット回数
    CacheMiss         int64         // キャッシュミス回数
}
```

### SecurityLevel

セキュリティレベルの列挙型。`SecurityConfigForLevel` でプリセット設定を素早く取得するために使用します。

```go
type SecurityLevel int
```

`String()` メソッドを実装し、読み取り可能なレベル名を返します。

| 定数 | 説明 |
|------|------|
| `SecurityLevelDevelopment` | 開発環境（機密フィルタリングなし、レート制限なし） |
| `SecurityLevelBasic` | 基本フィルタリング（パスワード、トークン、API Key、クレジットカード、SSN、電話番号、SWIFT/CVV など約 40 種の一般的な機密データ） |
| `SecurityLevelStandard` | 標準フィルタリング（本番環境推奨） |
| `SecurityLevelStrict` | 厳格フィルタリング（PII/金融データ環境） |
| `SecurityLevelParanoid` | 最高レベルフィルタリング（高リスク環境） |

### プリセット設定

| 関数 | 説明 | 適用シナリオ |
|------|------|----------|
| `DefaultSecurityConfig()` | 基本機密データフィルタリング | 本番環境（推奨） |
| `DefaultSecureConfig()` | 完全機密データフィルタリング | 高セキュリティ要件 |
| `HealthcareConfig()` | HIPAA 準拠 | 医療業界 |
| `FinancialConfig()` | PCI-DSS 準拠 | 金融業界 |
| `GovernmentConfig()` | 政府基準 | 公共部門 |

### レベル別設定

```go
func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig
```

| レベル | 定数 | 説明 |
|------|------|------|
| Development | `SecurityLevelDevelopment` | 開発環境、最も緩やか |
| Basic | `SecurityLevelBasic` | 基本フィルタリング |
| Standard | `SecurityLevelStandard` | 標準フィルタリング |
| Strict | `SecurityLevelStrict` | 厳格フィルタリング |
| Paranoid | `SecurityLevelParanoid` | 最高レベルフィルタリング |

### Clone

```go
func (c *SecurityConfig) Clone() *SecurityConfig
```

セキュリティ設定のディープコピーを作成します。

## 使用方法

### Config で設定

```go
// DefaultConfig には DefaultSecurityConfig() が組み込み済みで、通常は明示的な代入は不要
cfg := dd.DefaultConfig()
logger, _ := dd.New(cfg)

// より高いセキュリティレベルの設定に置き換える場合は明示的に上書き
// cfg.Security = dd.DefaultSecureConfig()
```

### 実行時に変更

```go
// セキュリティ設定を更新
logger.SetSecurityConfig(dd.DefaultSecureConfig())

// 現在の設定を読み取り
sec := logger.GetSecurityConfig()
```

### ネストされた構造のフィルタリング

```go
filter := dd.NewSensitiveDataFilter()

// 文字列フィルタリング
filtered := filter.Filter("password=s3cr3t")
// → "password=[REDACTED]"

// ネストされた構造（自動再帰、循環参照検出をサポート）
data := map[string]any{
    "user": map[string]any{
        "name":     "admin",
        "password": "s3cr3t",
        "token":    "eyJhbGciOi...",
    },
}
filteredData := filter.FilterValueRecursive("data", data)
```

### フィルタリング統計のモニタリング

```go
filter := dd.NewSensitiveDataFilter()
// ... フィルタリングを使用 ...
stats := filter.GetFilterStats()
fmt.Printf("総フィルタリング: %d, マスキング: %d, 平均レイテンシ: %v\n",
    stats.TotalFiltered, stats.TotalRedactions, stats.AverageLatency)
```

## 次のステップ

- [設定](../core/config) -- SecurityConfig 設定
- [Logger](../core/logger) -- SetSecurityConfig メソッド
- [監査ログ](./audit) -- セキュリティイベント監査

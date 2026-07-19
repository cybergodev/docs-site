---
sidebar_label: "AuditLogger"
title: "監査ログ - CyberGo DD | AuditLogger"
description: "CyberGo DD 監査ログ完全 API ドキュメント。AuditLogger 非同期監査イベントレコーダー、AuditConfig 設定オプション（出力先、フォーマット、署名）、監査エントリ構造化フォーマットを含み、セキュリティ関連イベントの追跡記録でエンタープライズ級のコンプライアンス監査とデータセキュリティ監視の各種要件に対応。"
sidebar_position: 3
---

# 監査ログ

DD は非同期監査ログ機能を提供し、セキュリティ関連イベントを記録し、整合性署名とエントリシーケンス番号追跡をサポートします。

## AuditLogger

非同期セキュリティ監査イベントレコーダー。

### 作成

```go
func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)
```

渡された `AuditConfig` で非同期監査レコーダーを作成します。`DefaultAuditConfig()` で適切なデフォルト値を持つ設定を取得できます。

エラーを返すケース：設定の検証失敗（`BufferSize` が負の値など）。

```go
// デフォルト設定を使用
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())

// カスタム設定
cfg := dd.DefaultAuditConfig()
cfg.JSONFormat = true
cfg.MinimumSeverity = dd.AuditSeverityWarning
auditLogger, _ := dd.NewAuditLogger(cfg)
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Log` | `(event AuditEvent)` | 監査イベントを記録（非同期） |
| `LogSensitiveDataRedaction` | `(pattern, field, message string)` | 機密データマスキングイベント |
| `LogRateLimitExceeded` | `(message string, metadata map[string]any)` | レート制限イベント |
| `LogSecurityViolation` | `(violationType, message string, metadata map[string]any)` | セキュリティ違反イベント |
| `LogReDoSAttempt` | `(pattern, message string)` | ReDoS 攻撃イベント |
| `LogIntegrityViolation` | `(message string, metadata map[string]any)` | 整合性違反イベント |
| `LogPathTraversalAttempt` | `(path, message string)` | パストラバーサルイベント |
| `Stats` | `() AuditStats` | 監査統計 |
| `Close` | `() error` | 閉じて残りのイベントをフラッシュ |

### 使用例

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

// 機密データマスキングを記録
audit.LogSensitiveDataRedaction("password", "login_form", "パスワードフィールドの平文を検出")

// レート制限を記録
audit.LogRateLimitExceeded("API リクエストが制限を超過", map[string]any{
    "client_ip": "192.168.1.100",
    "limit":     100,
    "current":   150,
})

// セキュリティ違反を記録
audit.LogSecurityViolation("sql_injection", "SQL インジェクションの試行", map[string]any{
    "input": "' OR 1=1 --",
})
```

## AuditConfig

監査ログ設定。

```go
type AuditConfig struct {
    Enabled          bool             // 監査を有効にするか（デフォルト true）
    Output           *os.File         // 出力ファイル（デフォルト os.Stderr）；nil の場合は出力されず、イベントは統計に計上されるのみ
    BufferSize       int              // 非同期イベントバッファサイズ（デフォルト 1000；負の値は検証失敗）
    IncludeTimestamp bool             // タイムスタンプを含むか（デフォルト true）
    JSONFormat       bool             // JSON フォーマット出力（デフォルト true）
    MinimumSeverity  AuditSeverity    // 最低記録重大度レベル（デフォルト AuditSeverityInfo）
    IntegritySigner  *IntegritySigner // 整合性署名器（任意；設定すると各監査イベントが署名される）
}
```

### デフォルト設定

```go
func DefaultAuditConfig() AuditConfig
```

デフォルトの監査設定を返します。監査ログはデフォルトで有効です。

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Validate` | `() error` | 設定の妥当性を検証（`BufferSize` が負の値ならエラーを返す） |
| `Clone` | `() AuditConfig` | 設定をコピー（`IntegritySigner` は共有参照、ディープコピーしない） |

## AuditEvent

監査イベント構造体。

```go
type AuditEvent struct {
    Type      AuditEventType `json:"type"`
    Timestamp time.Time      `json:"timestamp"`
    Message   string         `json:"message"`
    Pattern   string         `json:"pattern,omitempty"`
    Field     string         `json:"field,omitempty"`
    Metadata  map[string]any `json:"metadata,omitempty"`
    Severity  AuditSeverity  `json:"severity"`
}
```

### AuditStats

監査統計データ構造。

```go
type AuditStats struct {
    TotalEvents int64                    // 総イベント数
    Dropped     int64                    // 破棄イベント数（バッファフル時に累積）
    ByType      map[AuditEventType]int64 // タイプ別統計
    BufferSize  int                      // バッファサイズ
    BufferUsage int                      // 現在のバッファ使用量
}
```

### AuditVerificationResult

監査検証結果。

```go
type AuditVerificationResult struct {
    Valid    bool         // 検証が通ったか
    Event    *AuditEvent  // 解析されたイベント
    RawEvent string       // 元のイベント文字列
    Error    error        // 検証エラー
}
```

## 監査イベントタイプ

| 定数 | String() | 説明 |
|------|----------|------|
| `AuditEventSensitiveDataRedacted` | `"SENSITIVE_DATA_REDACTED"` | 機密データがマスキングされた |
| `AuditEventRateLimitExceeded` | `"RATE_LIMIT_EXCEEDED"` | レート制限を超過 |
| `AuditEventReDoSAttempt` | `"REDOS_ATTEMPT"` | ReDoS 攻撃の試行 |
| `AuditEventSecurityViolation` | `"SECURITY_VIOLATION"` | セキュリティ違反 |
| `AuditEventIntegrityViolation` | `"INTEGRITY_VIOLATION"` | 整合性違反 |
| `AuditEventInputSanitized` | `"INPUT_SANITIZED"` | 入力がサニタイズされた |
| `AuditEventPathTraversalAttempt` | `"PATH_TRAVERSAL_ATTEMPT"` | パストラバーサルの試行 |
| `AuditEventLog4ShellAttempt` | `"LOG4SHELL_ATTEMPT"` | Log4Shell 攻撃の試行 |
| `AuditEventNullByteInjection` | `"NULL_BYTE_INJECTION"` | Null バイトインジェクション |
| `AuditEventOverlongEncoding` | `"OVERLONG_ENCODING"` | オーバーロングエンコーディング攻撃 |
| `AuditEventHomographAttack` | `"HOMOGRAPH_ATTACK"` | ホモグラフ攻撃 |

## 監査重大度レベル

| 定数 | String() | 説明 |
|------|----------|------|
| `AuditSeverityInfo` | `"INFO"` | 情報 |
| `AuditSeverityWarning` | `"WARNING"` | 警告 |
| `AuditSeverityError` | `"ERROR"` | エラー |
| `AuditSeverityCritical` | `"CRITICAL"` | 重大 |

### MarshalJSON

```go
func (s AuditSeverity) MarshalJSON() ([]byte, error)
```

`AuditSeverity` は `json.Marshaler` インターフェースを実装し、JSON シリアライズ時に整数ではなく文字列を出力します：

```go
event := dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Severity: dd.AuditSeverityCritical,
}
data, _ := json.Marshal(event)
// Severity は "CRITICAL" としてシリアライズされ、3 ではない
```

## 監査エントリの検証

```go
func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult
```

監査ログエントリの整合性を検証します。

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
result := dd.VerifyAuditEvent(logEntry, signer)
if result != nil && result.Valid {
    fmt.Println("監査エントリの検証に成功")
}
```

## 次のステップ

- [整合性署名](./integrity) -- IntegritySigner 詳解
- [セキュリティフィルタ](./security) -- 機密データフィルタリング
- [フックシステム](./hooks) -- OnError フック

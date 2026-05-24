---
title: "整合性署名 - CyberGo DD | IntegritySigner"
description: "CyberGo DD 整合性署名完全 API ドキュメント。HMAC-SHA256 アルゴリズム署名とシリアル番号インクリメント追跡メカニズムをサポートし、各ログエントリが改ざんされていないことを保証。IntegritySigner 署名器と Verify 検証器を提供し、セキュリティ監査やログ改ざん防止など各種コンプライアンス要件に対応。"
---

# 整合性署名

DD は HMAC ベースのログ整合性署名メカニズムを提供し、ログエントリが改ざんされていないことを検証できます。

## IntegritySigner

ログエントリ署名器。HMAC 署名とチェーン検証をサポート。

### 作成

```go
func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)
```

```go
// 安全に作成（本番環境推奨）
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// カスタム設定
cfg := dd.IntegrityConfig{
    SecretKey:      []byte("my-secret-key-that-is-at-least-32b!"),
    HashAlgorithm:  dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,
    IncludeSequence:  true,
}
signer, err = dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}
```

### 署名メソッド

#### Sign

```go
func (s *IntegritySigner) Sign(message string) string
```

ログメッセージに HMAC 署名を生成します。スレッドセーフで並行呼び出し可能。

```go
sig := signer.Sign("ユーザーログイン admin 192.168.1.1")
// → "[SIG:1713456789000000000:1:base64signature...]"
```

#### SignFields

```go
func (s *IntegritySigner) SignFields(message string, fields []Field) string
```

フィールド付きメッセージの署名を生成します。署名にはメッセージと全フィールド値が含まれます。スレッドセーフで並行呼び出し可能。

```go
sig := signer.SignFields("ユーザーログイン", []dd.Field{
    dd.String("user", "admin"),
    dd.String("ip", "192.168.1.1"),
})
```

### 検証メソッド

#### Verify

```go
func (s *IntegritySigner) Verify(entry string) (*LogIntegrity, error)
```

ログエントリの整合性を検証します。スレッドセーフで並行呼び出し可能。

```go
integrity, err := signer.Verify(signedEntry)
if err != nil {
    // 検証エラー（signer が nil など）
}
if !integrity.Valid {
    // 署名が無効：署名の不一致またはフォーマットエラー
}
if integrity.Sequence != expectedSeq {
    // シリアル番号が不連続：エントリが削除された可能性
}
```

### その他のメソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `GetSequence` | `() uint64` | 現在のシリアル番号 |
| `ResetSequence` | `()` | シリアル番号をリセット |
| `Stats` | `() IntegrityStats` | 署名統計 |

## IntegrityConfig

署名設定。

```go
type IntegrityConfig struct {
    SecretKey       []byte         // HMAC キー
    HashAlgorithm   HashAlgorithm  // ハッシュアルゴリズム
    IncludeTimestamp bool           // 署名にタイムスタンプを含む
    IncludeSequence  bool           // 署名にシリアル番号を含む
    SignaturePrefix  string        // 署名プレフィックス
}
```

### 安全な作成

```go
func DefaultIntegrityConfigSafe() (IntegrityConfig, error)
```

デフォルト設定を安全に作成（キーを自動生成）。本番環境での使用を推奨。

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Validate` | `() error` | 設定の妥当性を検証 |
| `Clone` | `() IntegrityConfig` | 設定をコピー |
| `MarshalJSON` | `() ([]byte, error)` | JSON シリアライズ（キーはシリアライズされず、長さのみ出力） |

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}
```

## LogIntegrity

ログ整合性検証結果。

```go
type LogIntegrity struct {
    Valid     bool       // 署名が有効か
    Timestamp time.Time  // 署名タイムスタンプ
    Sequence  uint64     // シリアル番号
    Message   string     // 元のメッセージ
}
```

## IntegrityStats

署名統計データ。

```go
type IntegrityStats struct {
    Sequence         uint64 // 現在のシリアル番号
    Algorithm        string // アルゴリズム名
    IncludeTimestamp bool   // タイムスタンプを含むか
    IncludeSequence  bool   // シリアル番号を含むか
}
```

## HashAlgorithm

| 定数 | 説明 |
|------|------|
| `HashAlgorithmSHA256` | SHA-256 アルゴリズム |

`String()` メソッドを実装し、アルゴリズム名を返します。

## 完全な例

### ログ署名フロー

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// ログに署名
message := "ユーザーログイン"
signature := signer.Sign(message)

// 署名付きログエントリを保存
logEntry := message + signature

// ログを検証
result, err := signer.Verify(logEntry)
if err != nil {
    fmt.Println("整合性検証失敗:", err)
} else if result.Valid {
    fmt.Printf("検証成功 - シリアル番号: %d\n", result.Sequence)
}
```

### 監査統合

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

auditCfg := dd.DefaultAuditConfig()
auditCfg.IntegritySigner = signer
audit, _ := dd.NewAuditLogger(auditCfg)
defer audit.Close()

// 監査ログは自動的に署名される
audit.Log(dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Message:  "SQL インジェクションの試行",
    Severity: dd.AuditSeverityCritical,
    Metadata: map[string]any{"input": "' OR 1=1"},
})

// 監査ログの検証
stats := signer.Stats()
fmt.Printf("アルゴリズム: %s, シリアル番号: %d\n", stats.Algorithm, stats.Sequence)
```

## 次のステップ

- [監査ログ](./audit) -- AuditLogger 詳解
- [セキュリティフィルタ](./security) -- 機密データフィルタリング
- [定数とエラー](./constants) -- エラーコード

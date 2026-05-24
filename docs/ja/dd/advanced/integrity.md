---
title: "HMAC 署名実践 - CyberGo DD | ログ整合性保護"
description: "CyberGo DD HMAC-SHA256 ログ整合性署名実践ガイド。IntegritySigner の作成と初期化設定、署名と検証の完全なフロー、タイムスタンプとシリアル番号インクリメントメカニズム、改ざん検出戦略、監査ログシステムとの統合スキーム、本番環境デプロイのベストプラクティスをカバーし、ログチェーンの整合性とトレーサビリティを確保。"
---

# HMAC 署名実践

DD の `IntegritySigner` は HMAC-SHA256 を使用してログエントリに署名し、ログが保存・転送中に改ざんされないことを保証します。

## コア概念

```text
署名フロー:
  元のログ → HMAC-SHA256(キー + タイムスタンプ + シリアル番号) → 署名済みログ

検証フロー:
  署名済みログ → 署名を抽出 → HMAC を再計算 → 署名を比較 → 整合性を判定
```

## 署名器の作成

### 安全なキー設定

```go
// 方法 1：安全なキーを自動生成（推奨）
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
// cfg.SecretKey に 32 バイトのランダムキーが設定済み

signer, _ := dd.NewIntegritySigner(cfg)
```

### カスタム設定

```go
cfg := dd.IntegrityConfig{
    SecretKey:       []byte("your-32-byte-minimum-secret-key!!"),  // 最低 32 バイト
    HashAlgorithm:   dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,    // 署名にタイムスタンプを含む
    IncludeSequence:  true,    // 署名にシリアル番号を含む
    SignaturePrefix:  "[SIG:",  // 署名プレフィックス
}
```

:::danger キー管理
- キーは最低 32 バイト
- キーをソースコードにハードコードしない。環境変数やキー管理サービスを使用
- 定期的にキーをローテーション
- キーが漏洩した場合は直ちにローテーションし、全ログを再検証
:::

## 署名フロー

```go
// 署名器を作成
signer, _ := dd.NewIntegritySigner(cfg)

// 単一ログに署名
logEntry := `{"level":"info","message":"ユーザーログイン","user":"admin"}`
signature := signer.Sign(logEntry)
signedEntry := logEntry + signature

fmt.Println(signedEntry)
// 出力: {"level":"info","message":"ユーザーログイン","user":"admin"}[SIG:1713456789000000000:1:base64sig...]
```

### 署名統計

```go
stats := signer.Stats()
fmt.Printf("現在のシリアル番号: %d\n", stats.Sequence)
fmt.Printf("アルゴリズム: %s\n", stats.Algorithm)
fmt.Printf("タイムスタンプを含む: %v\n", stats.IncludeTimestamp)
fmt.Printf("シリアル番号を含む: %v\n", stats.IncludeSequence)
```

## 検証フロー

### 単一ログの検証

```go
result, err := signer.Verify(signedEntry)
if err != nil {
    fmt.Printf("✗ 検証失敗: %v\n", err)
    return
}

if result.Valid {
    fmt.Printf("✓ ログ整合 - 時間: %s, シリアル番号: %d\n",
        result.Timestamp, result.Sequence)
    fmt.Printf("メッセージ: %s\n", result.Message)
} else {
    fmt.Printf("✗ ログが改ざんされた可能性\n")
}
```

### ログファイルのバッチ検証

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

### 監査イベントの検証

```go
result := dd.VerifyAuditEvent(auditLogLine, signer)
if result.Valid && result.Event != nil {
    fmt.Printf("監査イベント: %s\n", result.Event.Message)
} else {
    fmt.Printf("検証失敗: %s\n", result.Error)
}
```

## 監査ログとの統合

```go
// 完全な署名 + 監査ソリューション
func NewSignedAuditSystem() (*dd.AuditLogger, *dd.IntegritySigner, error) {
    // 署名器
    cfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(cfg)

    // 監査ファイル
    auditFile, _ := os.OpenFile(
        "logs/audit-signed.json",
        os.O_CREATE|os.O_WRONLY|os.O_APPEND,
        0600,
    )

    // 監査 Logger（署名付き）
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

## タイムスタンプとシリアル番号

署名器は署名にタイムスタンプとシリアル番号を埋め込むことをサポート：

```go
cfg := dd.IntegrityConfig{
    SecretKey:       secretKey,
    IncludeTimestamp: true,    // 署名にタイムスタンプを含む
    IncludeSequence:  true,    // 署名にインクリメンタルシリアル番号を含む
}

// 有効にすると、Verify の結果に追加情報が含まれる
result, _ := signer.Verify(signedEntry)
result.Timestamp  // 署名時のタイムスタンプ
result.Sequence   // 署名時のシリアル番号
```

:::tip シリアル番号による検出
シリアル番号を有効にすると、ログが削除または並べ替えられたかを検出できます。シリアル番号が不連続な場合、ログが改ざんされた可能性があります。
:::

## 本番ベストプラクティス

### キー管理

```go
// 環境変数からキーを読み込み
func loadSecretKey() ([]byte, error) {
    key := os.Getenv("DD_INTEGRITY_SECRET")
    if len(key) < 32 {
        return nil, fmt.Errorf("secret key must be at least 32 bytes")
    }
    return []byte(key), nil
}
```

### 定期検証

```go
// 毎時監査ログの整合性を検証
func startIntegrityChecker(signer *dd.IntegritySigner, logPath string) {
    ticker := time.NewTicker(time.Hour)
    go func() {
        for range ticker.C {
            valid, invalid, err := VerifyLogFile(logPath, signer)
            if err != nil {
                dd.Errorf("整合性チェック失敗: %v", err)
                continue
            }
            dd.InfoWith("整合性チェック完了",
                dd.Int("valid", valid),
                dd.Int("invalid", invalid),
            )
            if invalid > 0 {
                dd.Error("ログの改ざんを検出")
            }
        }
    }()
}
```

## 次のステップ

- [監査ログ](../guides/audit-logging) -- セキュリティ監査統合
- [業界コンプライアンス設定](../security/compliance) -- HIPAA/PCI-DSS 署名要件
- [API リファレンス - Integrity](../api-reference/integrity) -- IntegritySigner 完全 API

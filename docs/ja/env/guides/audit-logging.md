---
title: 監査ログ - CyberGo env | セキュリティ監査設定
description: CyberGo env ライブラリの監査ログ設定と使用の完全ガイド。組み込み JSON ファイルハンドラー、標準ログハンドラー、Channel ハンドラーの設定方法、およびカスタム AuditHandler 監査ハンドラーの拡張開発を含み、すべての環境変数操作を記録して Go アプリケーションのセキュリティコンプライアンスチェックと実行時問題のトラブルシューティングに活用します。
---

# 監査ログ

監査ログ機能はすべての環境変数操作を記録し、セキュリティ監査、コンプライアンスチェック、トラブルシューティングに使用します。

## 監査の有効化

### 設定で有効化

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, _ := env.New(cfg)
```

### 設定プリセット

| プリセット | 監査状態 |
|------|----------|
| `DefaultConfig()` | 無効 |
| `DevelopmentConfig()` | 無効 |
| `TestingConfig()` | 無効 |
| `ProductionConfig()` | 有効 |

---

## 監査ハンドラー

### JSONAuditHandler

JSON 形式のログを出力します：

```go
import (
    "os"
    "github.com/cybergodev/env"
)

cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**出力例：**

```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration":1234567}
{"timestamp":"2024-01-15T10:30:01Z","action":"get","key":"API_KEY","success":true,"masked":true}
{"timestamp":"2024-01-15T10:30:02Z","action":"set","key":"CUSTOM_VAR","success":true}
```

---

### LogAuditHandler

標準 log パッケージを使用して出力します：

```go
import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**出力例：**

```text
[AUDIT] 2024/01/15 10:30:00 load .env (1.23ms)
[AUDIT] 2024/01/15 10:30:01 get API_KEY (masked)
[AUDIT] 2024/01/15 10:30:02 set CUSTOM_VAR
```

---

### ChannelAuditHandler

チャネルに送信して非同期処理を行います：

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// 監査イベントの非同期処理
go func() {
    for event := range ch {
        processAuditEvent(event)
    }
}()
```

**使用シーン：**
- リモートログサービスへの送信
- データベースへの書き込み
- リアルタイム監視アラート

---

### NopAuditHandler

何もしないハンドラーです。すべてのイベントを破棄します：

```go
cfg.AuditHandler = env.NewNopAuditHandler()
```

**使用シーン：**
- 監査の一時的な無効化
- テスト環境

---

## 監査イベント

### AuditEvent 構造体

```go
type AuditEvent struct {
    Timestamp time.Time   // タイムスタンプ
    Action    AuditAction // 操作タイプ
    Key       string      // キー名
    File      string      // ファイル名
    Reason    string      // 原因
    Success   bool        // 成功したかどうか
    Masked    bool        // マスク済みかどうか
    Details   string      // 詳細
    Duration  int64       // 処理時間（ナノ秒）
}
```

### AuditAction 操作タイプ

| 定数 | 値 | 説明 |
|------|---|------|
| `ActionLoad` | `load` | ファイル読み込み |
| `ActionParse` | `parse` | パース操作 |
| `ActionGet` | `get` | 変数の読み取り |
| `ActionSet` | `set` | 変数の設定 |
| `ActionDelete` | `delete` | 変数の削除 |
| `ActionValidate` | `validate` | 検証操作 |
| `ActionExpand` | `expand` | 変数展開 |
| `ActionSecurity` | `security` | セキュリティイベント |
| `ActionError` | `error` | エラーイベント |
| `ActionFileAccess` | `file_access` | ファイルアクセス |

---

## カスタムハンドラー

### FullAuditLogger インターフェースの実装

`FullAuditLogger` は完全な監査ログインターフェースで、最小インターフェース `AuditLogger`（`LogError` メソッドのみを含む）を拡張しています：

```go
type FullAuditLogger interface {
    AuditLogger  // 最小インターフェースを埋め込み（LogError）
    Log(action AuditAction, key, reason string, success bool) error
    LogWithFile(action AuditAction, key, file, reason string, success bool) error
    LogWithDuration(action AuditAction, key, reason string, success bool, duration time.Duration) error
    Close() error
}
```

### 例：データベース監査ハンドラー

```go
package main

import (
    "database/sql"
    "time"
    "github.com/cybergodev/env"
)

type DatabaseAuditHandler struct {
    db *sql.DB
}

func NewDatabaseAuditHandler(db *sql.DB) *DatabaseAuditHandler {
    return &DatabaseAuditHandler{db: db}
}

func (h *DatabaseAuditHandler) Log(action env.AuditAction, key, reason string, success bool) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, reason, success)
        VALUES (?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, reason, success)
    return err
}

func (h *DatabaseAuditHandler) LogError(action env.AuditAction, key, errMsg string) error {
    return h.Log(action, key, errMsg, false)
}

func (h *DatabaseAuditHandler) LogWithFile(action env.AuditAction, key, file, reason string, success bool) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, file, reason, success)
        VALUES (?, ?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, file, reason, success)
    return err
}

func (h *DatabaseAuditHandler) LogWithDuration(action env.AuditAction, key, reason string, success bool, duration time.Duration) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, reason, success, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, reason, success, duration.Milliseconds())
    return err
}

func (h *DatabaseAuditHandler) Close() error {
    return nil
}
```

---

## 完全なサンプル

### 本番環境の設定

```go
package main

import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // 監査ログファイルを作成
    auditFile, err := os.OpenFile("/var/log/app/env-audit.log",
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
    if err != nil {
        log.Fatal(err)
    }
    defer auditFile.Close()

    // 設定
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    // ローダーを作成
    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // 設定を読み込む
    err = loader.LoadFiles(".env")
    if err != nil {
        log.Fatal(err)
    }

    // バリデーション
    err = loader.Validate()
    if err != nil {
        log.Fatal(err)
    }

    // 設定を使用
    log.Println("Configuration loaded successfully")
}
```

### 非同期監査処理

```go
package main

import (
    "encoding/json"
    "log"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // 監査イベントチャネルを作成
    auditChan := make(chan env.AuditEvent, 1000)

    // 非同期プロセッサーを起動
    go processAuditEvents(auditChan)

    // 設定
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    cfg.AuditHandler = env.NewChannelAuditHandler(auditChan)

    loader, _ := env.New(cfg)
    defer loader.Close()

    // 通常の使用...
}

func processAuditEvents(ch chan env.AuditEvent) {
    file, _ := os.OpenFile("/var/log/app/audit.log",
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
    defer file.Close()

    encoder := json.NewEncoder(file)

    for event := range ch {
        // フィルタリング、集計などのロジックを追加可能
        if event.Action == env.ActionError {
            log.Printf("Audit error: %+v", event)
        }

        encoder.Encode(event)
    }
}
```

---

## セキュリティ上の注意事項

### 機密値の自動マスク

監査ログは機密キーの値を自動的にマスクします：

```go
// 機密値を取得する際、自動的にマスク
secret := loader.GetSecure("API_KEY")
// 監査レコード: {"action":"get","key":"API_KEY","masked":true}
```

### 監査ログの権限

```bash
# 監査ログファイルの権限を設定
chmod 600 /var/log/app/env-audit.log

# アプリケーションユーザーのみ読み書き可能にする
chown app:app /var/log/app/env-audit.log
```

### ログローテーション

logrotate を使用して監査ログを管理することを推奨します：

```bash
# /etc/logrotate.d/app-env-audit
/var/log/app/env-audit.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0600 app app
}
```

---

## 関連ドキュメント

- [セキュリティ概要](/ja/env/security/) - セキュリティアーキテクチャとコア機能
- [本番チェックリスト](/ja/env/security/production-checklist) - 監査設定チェック
- [インターフェース定義](/ja/env/api-reference/interfaces) - AuditLogger インターフェース
- [コンポーネントファクトリー](/ja/env/api-reference/factory) - 監査ハンドラーファクトリー

---
title: ミドルウェア - HTTPC
description: HTTPC ミドルウェアシステム API リファレンス。Chain 組み合わせ関数、8 つの組み込みミドルウェアファクトリ関数、設定型監査と AuditEvent 監査イベントタイプ定義。
---

# ミドルウェア

HTTPC はオニオンモデルのミドルウェアアーキテクチャを採用し、`MiddlewareFunc` でリクエスト処理ロジックをラップします。

```go
type MiddlewareFunc func(Handler) Handler
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

ミドルウェアは `Config.Middleware.Middlewares` で設定し、順序通りに実行されます：

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.RecoveryMiddleware(),
            httpc.LoggingMiddleware(log.Printf),
            httpc.RequestIDMiddleware("X-Request-ID", nil),
        },
    },
})
```

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

複数のミドルウェアを単一のミドルウェアに結合。渡された順序で実行され、最後のミドルウェアが処理を終えると最終 Handler を呼び出します。

```go
combined := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
)
```

## 組み込みミドルウェア

### RecoveryMiddleware

```go
func RecoveryMiddleware() MiddlewareFunc
```

panic リカバリーミドルウェア。処理チェーン内の panic をキャッチし、スタック情報を含む error に変換して返します。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.RecoveryMiddleware(),
        },
    },
})
```

### LoggingMiddleware

```go
func LoggingMiddleware(log func(format string, args ...any)) MiddlewareFunc
```

リクエストロギングミドルウェア。メソッド、URL、ステータスコード、所要時間を記録。URL は自動的にマスクされます（認証情報を除去）。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.LoggingMiddleware(log.Printf),
        },
    },
})
// 出力例: GET https://api.example.com/data -> 200 (125ms)
```

### RequestIDMiddleware

```go
func RequestIDMiddleware(headerName string, generator func() string) MiddlewareFunc
```

各リクエストにユニーク ID を追加。デフォルトでは `crypto/rand` で 32 文字の 16 進 ID を生成。

| パラメータ | 説明 |
|------------|------|
| `headerName` | ヘッダー名（例：`"X-Request-ID"`） |
| `generator` | カスタム ID 生成関数。`nil` でデフォルトの暗号セキュアジェネレーターを使用 |

```go
// デフォルトジェネレーターを使用
middleware := httpc.RequestIDMiddleware("X-Request-ID", nil)

// カスタムジェネレーターを使用
middleware := httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

:::tip ヒント
デフォルトジェネレーターは `crypto/rand` を使用し、予測不可能な ID を生成するため、セキュリティ重要シナリオに適しています。
:::

### TimeoutMiddleware

```go
func TimeoutMiddleware(timeout time.Duration) MiddlewareFunc
```

ミドルウェアレベルのタイムアウト制御。クライアント内蔵のタイムアウトより先に適用され、タイムアウト時にコンテキストをキャンセルしてエラーを返します。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.TimeoutMiddleware(10 * time.Second),
        },
    },
})
```

### HeaderMiddleware

```go
func HeaderMiddleware(headers map[string]string) MiddlewareFunc
```

各リクエストに静的ヘッダーを追加。作成時にヘッダーのセキュリティ検証を実行（CRLF インジェクション防止）。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.HeaderMiddleware(map[string]string{
                "X-API-Version": "v2",
                "X-Client":      "myapp/1.0",
            }),
        },
    },
})
```

### MetricsMiddleware

```go
func MetricsMiddleware(onMetrics func(method, url string, statusCode int, duration time.Duration, err error)) MiddlewareFunc
```

メトリクス収集ミドルウェア。各リクエスト完了後にコールバックを呼び出し、メソッド、URL、ステータスコード、所要時間、エラー情報を渡します。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.MetricsMiddleware(func(method, url string, status int, d time.Duration, err error) {
                metrics.Record(method, status, d, err)
            }),
        },
    },
})
```

### AuditMiddleware

```go
func AuditMiddleware(onAudit func(event AuditEvent)) MiddlewareFunc
```

セキュリティ監査ミドルウェア。金融、医療、行政などのコンプライアンスシナリオに適しています。完全なリクエスト/レスポンス情報を記録し、URL は自動的にマスクされます。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.AuditMiddleware(func(event httpc.AuditEvent) {
                log.Printf("[AUDIT] %s %s -> %d (%v) user=%s ip=%s",
                    event.Method, event.URL, event.StatusCode,
                    event.Duration, event.UserID, event.SourceIP)
            }),
        },
    },
})
```

### AuditMiddlewareWithConfig

```go
func AuditMiddlewareWithConfig(onAudit func(event AuditEvent), config *AuditMiddlewareConfig) MiddlewareFunc
```

設定付きセキュリティ監査ミドルウェア。

```go
config := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}

client, _ := httpc.New(&httpc.Config{
    Middleware: httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
                data, _ := json.Marshal(event)
                auditLog.Write(data)
            }, config),
        },
    },
})
```

## 監査タイプ

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`              // マスク済み（認証情報を除去）
    StatusCode    int                 `json:"statusCode"`
    Duration      time.Duration       `json:"duration"`
    Attempts      int                 `json:"attempts"`
    Error         error               `json:"error,omitempty"`
    SourceIP      string              `json:"sourceIP,omitempty"`
    UserID        string              `json:"userID,omitempty"`
    RedirectChain []string            `json:"redirectChain,omitempty"`
    ReqHeaders    map[string][]string `json:"reqHeaders,omitempty"`
    RespHeaders   map[string][]string `json:"respHeaders,omitempty"`
}
```

セキュリティ監査イベント。

#### MarshalJSON

```go
func (e AuditEvent) MarshalJSON() ([]byte, error)
```

カスタム JSON シリアライズ。2 つの特殊フィールドを処理：

| フィールド | 変換ルール |
|------------|-----------|
| `Duration` | 新規 `durationMs`（ミリ秒整数）を追加、元の `duration` フィールド（ナノ秒）は保持 |
| `Error` | `error`（エラーメッセージ文字列）に変換、nil の場合は省略 |

```go
event := httpc.AuditEvent{
    Method:    "GET",
    URL:       "https://api.example.com/data",
    Duration:  150 * time.Millisecond,
    StatusCode: 200,
}
data, _ := json.Marshal(event)
// {"timestamp":"...","method":"GET","url":"...","statusCode":200,"duration":150000000,"durationMs":150,"attempts":0}
```

### AuditMiddlewareConfig

```go
type AuditMiddlewareConfig struct {
    Format         string   // "text"（デフォルト）または "json"
    IncludeHeaders bool     // リクエスト/レスポンスヘッダーを含めるか
    MaskHeaders    []string // マスクするヘッダー名
    SanitizeError  bool     // エラー情報をマスクするか
}
```

| フィールド | デフォルト | 説明 |
|------------|-----------|------|
| Format | `"text"` | 出力形式 |
| IncludeHeaders | `false` | ヘッダーを記録するか |
| MaskHeaders | `["Authorization", "Cookie", ...]` | 標準の機密ヘッダーリスト |
| SanitizeError | `true` | エラー情報を `[sanitized]` に置換 |

### DefaultAuditMiddlewareConfig

```go
func DefaultAuditMiddlewareConfig() *AuditMiddlewareConfig
```

デフォルトの監査設定を返します。

### 監査コンテキストキー

リクエストコンテキストで監査情報を渡します：

```go
// 送信元 IP を設定
ctx = context.WithValue(ctx, httpc.SourceIPKey, "192.168.1.1")

// ユーザー ID を設定
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

result, err := client.Request(ctx, "GET", url)
```

| 定数 | タイプ | 説明 |
|------|--------|------|
| `SourceIPKey` | `auditContextKey` | 送信元 IP コンテキストキー |
| `UserIDKey` | `auditContextKey` | ユーザー識別子コンテキストキー |

## 関連項目

- [インターフェース定義](./interfaces) - MiddlewareFunc、Handler タイプ定義
- [ミドルウェアチェーン](../guides/middleware-chain) - ミドルウェア使用ガイド
- [定数とタイプ](./constants) - AuditEvent、AuditMiddlewareConfig タイプ

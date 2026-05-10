---
title: ミドルウェアチェーン - HTTPC
description: HTTPC ミドルウェアチェーンガイド。オニオンモデルの実行原理、8つの組み込みミドルウェアの機能設定、Chain 組み合わせパターン、カスタムミドルウェアの作成方法。
---

# ミドルウェアチェーン

## オニオンモデル

HTTPC ミドルウェアはオニオンモデルを採用しており、リクエストは外から内へ、レスポンスは内から外へ流れます：

```text
リクエスト →  Recovery  →  Logging  →  RequestID  → Handler
                                                          ↓
レスポンス ←  Recovery  ←  Logging  ←  RequestID  ← Response
```

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),    // 最外層：panic リカバリ
    httpc.LoggingMiddleware(log.Printf), // 第2層：ログ記録
    httpc.RequestIDMiddleware("X-Request-ID", nil), // 最内層：リクエスト ID
}

client, _ := httpc.New(cfg)
```

## 組み込みミドルウェア

### RecoveryMiddleware

panic リカバリにより、プロセスのクラッシュを防ぎます：

```go
httpc.RecoveryMiddleware()
```

### LoggingMiddleware

リクエスト/レスポンスのログを記録します。URL は自動的にマスク化されます：

```go
httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
// 出力: [HTTP] GET https://api.example.com/data -> 200 (150ms)
```

### RequestIDMiddleware

各リクエストに一意の ID を追加します。`crypto/rand` を使用して生成します：

```go
httpc.RequestIDMiddleware("X-Request-ID", nil) // デフォルト 32 文字の hex

// カスタムジェネレーター
httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

### TimeoutMiddleware

ミドルウェア層のタイムアウトで、クライアントのタイムアウトより前に強制実行されます：

```go
httpc.TimeoutMiddleware(30 * time.Second)
```

### HeaderMiddleware

すべてのリクエストに静的ヘッダーを追加します：

```go
httpc.HeaderMiddleware(map[string]string{
    "X-App-Version": "1.0.0",
    "X-Platform":    "server",
})
```

### MetricsMiddleware

リクエストメトリクスを収集します：

```go
httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
    metrics.IncrCounter("http.requests", 1)
    metrics.RecordTimer("http.latency", duration)
    if err != nil {
        metrics.IncrCounter("http.errors", 1)
    }
})
```

### AuditMiddleware

セキュリティ監査用で、金融や医療などのコンプライアンス要件に適しています：

```go
httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})
```

### AuditMiddlewareWithConfig

設定可能な監査ミドルウェア：

```go
auditCfg := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}

httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
    data, _ := json.Marshal(event)
    log.Println(string(data))
}, auditCfg)
```

監査イベントはコンテキストから SourceIP と UserID を抽出できます：

```go
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")
```

## 手動チェーン組み合わせ

`Chain` 関数を使用してミドルウェアを組み合わせます：

```go
middleware := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
)

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{middleware}
```

## カスタムミドルウェア

```go
func CORSMiddleware(origin string) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            // リクエストフェーズ：リクエストの変更
            req.SetHeader("Origin", origin)

            // 次のハンドラーを呼び出す
            resp, err := next(ctx, req)

            // レスポンスフェーズ：レスポンスの記録または変更
            if resp != nil {
                log.Printf("レスポンスステータス: %d", resp.StatusCode())
            }

            return resp, err
        }
    }
}
```

### ショートサーキットミドルウェア

```go
func CircuitBreakerMiddleware(threshold int) httpc.MiddlewareFunc {
    var failures int
    var mu sync.Mutex

    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            mu.Lock()
            if failures >= threshold {
                mu.Unlock()
                return nil, fmt.Errorf("circuit breaker open")
            }
            mu.Unlock()

            resp, err := next(ctx, req)
            if err != nil {
                mu.Lock()
                failures++
                mu.Unlock()
            }
            return resp, err
        }
    }
}
```

## ミドルウェア設定

```go
cfg := httpc.DefaultConfig()
cfg.Middleware = httpc.MiddlewareConfig{
    Middlewares: []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        httpc.LoggingMiddleware(log.Printf),
    },
    UserAgent:       "my-app/1.0",
    Headers:         map[string]string{"X-App": "my-app"},
    FollowRedirects: true,
    MaxRedirects:    10,
}

client, _ := httpc.New(cfg)
```

## 次のステップ

- [ミドルウェア API](../api-reference/middleware) - 完全なミドルウェアリファレンス
- [リトライとフォールトトレランス](./retry-fault-tolerance) - リトライ戦略ガイド
- [セキュリティ概要](../security/) - 監査ミドルウェアのセキュリティプラクティス

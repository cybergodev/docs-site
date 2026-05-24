---
title: "ミドルウェアチェーン - HTTPC"
description: "HTTPCミドルウェアチェーンガイド：オニオンモデルの実行原理とリクエスト/レスポンス双方向処理、Recovery/Logging/RequestID/Timeout/Header/Metrics/Auditの8つの組み込みミドルウェア設定、Chain手動組み合わせパターン、カスタムMiddlewareFuncの作成方法とサーキットブレーカーショートサーキットミドルウェアの例。"
---

# ミドルウェアチェーン

## オニオンモデル

HTTPCのミドルウェアはオニオンモデルを採用しています。リクエストは外から内へ、レスポンスは内から外へ流れます：

```text
リクエスト →  Recovery  →  Logging  →  RequestID  → Handler
                                                          ↓
レスポンス ←  Recovery  ←  Logging  ←  RequestID  ← Response
```

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),    // 最外層：panicリカバリ
    httpc.LoggingMiddleware(log.Printf), // 第2層：ログ記録
    httpc.RequestIDMiddleware("X-Request-ID", nil), // 最内層：リクエストID
}

client, _ := httpc.New(cfg)
```

## 組み込みミドルウェア

### RecoveryMiddleware

panicリカバリ。プロセスクラッシュを防止：

```go
httpc.RecoveryMiddleware()
```

### LoggingMiddleware

リクエスト/レスポンスログ。URLは自動的にマスク：

```go
httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
// 出力: [HTTP] GET https://api.example.com/data -> 200 (150ms)
```

### RequestIDMiddleware

各リクエストにユニークIDを追加。`crypto/rand`で生成：

```go
httpc.RequestIDMiddleware("X-Request-ID", nil) // デフォルト32文字hex

// カスタムジェネレーター
httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

### TimeoutMiddleware

ミドルウェアレベルのタイムアウト。クライアントのタイムアウトより前に強制適用：

```go
httpc.TimeoutMiddleware(30 * time.Second)
```

### HeaderMiddleware

全リクエストに静的ヘッダーを追加：

```go
httpc.HeaderMiddleware(map[string]string{
    "X-App-Version": "1.0.0",
    "X-Platform":    "server",
})
```

### MetricsMiddleware

リクエストメトリクスを収集：

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

セキュリティ監査。金融、医療などのコンプライアンスシナリオ向け：

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

監査イベントはコンテキストからSourceIPとUserIDの抽出をサポートします：

```go
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")
```

## 手動チェーン組み合わせ

`Chain`関数でミドルウェアを組み合わせます：

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
            // リクエストフェーズ：リクエストを変更
            req.SetHeader("Origin", origin)

            // 次のハンドラーを呼び出す
            resp, err := next(ctx, req)

            // レスポンスフェーズ：記録または変更
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

- [ミドルウェアAPI](../api-reference/middleware) - 完全なミドルウェアリファレンス
- [リトライとフォールトトレランス](./retry-fault-tolerance) - リトライ戦略ガイド
- [セキュリティ概要](../security/) - 監査ミドルウェアのセキュリティプラクティス

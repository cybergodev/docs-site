---
sidebar_label: "分散トレーシング統合"
title: "分散トレーシング統合 - CyberGo DD | Context とトレーシングガイド"
description: "CyberGo DD 分散トレーシング統合ガイド。TraceID、SpanID、RequestID 伝播、ContextExtractor 抽出器、HTTP ミドルウェア統合、リクエストスコープログと OpenTelemetry 連携でエンドツーエンド追跡を実現。"
sidebar_position: 7
---

# 分散トレーシング統合

DD は `context.Context` ベースのトレーシング識別子ツール関数（`WithTraceID`/`GetTraceID` など）を提供し、マイクロサービスアーキテクチャでのログ関連付けに便利です。注意：**DD のログメソッドは `context.Context` パラメータを受け取りません**、そのためリクエストスコープから TraceID を自動抽出できません——`WithFields()` でトレーシング識別子をフィールドとしてログに手動付与する必要があります（詳細は [HTTP ミドルウェア統合](#http-ミドルウェア統合) を参照）。

## コンテキストキー

DD は 3 種類のコンテキストキーを定義しています：

| キー | 説明 | 用途 |
|-----|------|------|
| `ContextKeyTraceID` | トレーシング ID | サービス間トレーシング、完全なリクエストチェーンの関連付け |
| `ContextKeySpanID` | Span ID | サービス内オペレーショントレーシング |
| `ContextKeyRequestID` | リクエスト ID | 単一リクエストの一意識別子 |

## 基本的な使い方

### 設定と取得

```go
ctx := context.Background()

// トレーシング識別子を設定
ctx = dd.WithTraceID(ctx, "trace-abc123")
ctx = dd.WithSpanID(ctx, "span-def456")
ctx = dd.WithRequestID(ctx, "req-789")

// トレーシング識別子を取得
traceID := dd.GetTraceID(ctx)    // "trace-abc123"
spanID := dd.GetSpanID(ctx)      // "span-def456"
requestID := dd.GetRequestID(ctx) // "req-789"
```

### なぜログに「自動抽出」できないのか

:::warning 現在の制限
DD のログメソッド（`Info`、`InfoWith` など）は `context.Context` パラメータを直接受け取りません。コンテキストエクストラクタは内部で `context.Background()` を呼び出すため（`logger.go:1414`）、リクエストスコープの context から TraceID などの値を直接取得できません。手動でフィールドを渡す方法（以下の HTTP ミドルウェア統合を参照）を推奨します。
:::

```go
// コンテキストエクストラクタは設定でプリセットされた静的コンテキストフィールドに使用
// 注意：ログメソッドは context を受け取らないため、エクストラクタ内の GetTraceID などの関数は
// リクエストスコープの context 値を取得できない

// 推奨方法：WithFields を使用してトレーシングフィールドを手動渡し
reqLog := logger.WithFields(
    dd.String("trace_id", traceID),
    dd.String("request_id", requestID),
)
reqLog.Info("リクエスト処理")
```

## HTTP ミドルウェア統合

### 基本的なトレーシングミドルウェア

```go
func TracingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // リクエストヘッダーから抽出またはトレーシング識別子を生成
            traceID := r.Header.Get("X-Trace-ID")
            if traceID == "" {
                traceID = uuid.New().String()
            }

            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = uuid.New().String()
            }

            // context に注入
            ctx := r.Context()
            ctx = dd.WithTraceID(ctx, traceID)
            ctx = dd.WithRequestID(ctx, requestID)

            // リクエストスコープのログ Entry を作成
            reqLog := logger.WithFields(
                dd.String("trace_id", traceID),
                dd.String("request_id", requestID),
            )

            // Logger をハンドラに渡す（カスタム型キーで衝突を回避）
            type ctxKey struct{}
            ctx = context.WithValue(ctx, ctxKey{}, reqLog)
            next.ServeHTTP(w, r.WithContext(ctx))

            reqLog.InfoWith("リクエスト完了",
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
            )
        })
    }
}
```

### 完全なリクエストトレーシングの例

<!-- check-code: skip -->
```go
package main

import (
    "net/http"

    "github.com/cybergodev/dd"
)

type Handler struct {
    log *dd.LoggerEntry
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // context からトレーシング情報を取得
    traceID := dd.GetTraceID(ctx)
    reqID := dd.GetRequestID(ctx)

    h.log.InfoWith("ユーザー検索",
        dd.String("trace_id", traceID),
        dd.String("request_id", reqID),
        dd.String("user_id", r.PathValue("id")),
    )

    // 業務ロジック...

    h.log.InfoWith("検索完了",
        dd.String("trace_id", traceID),
        dd.Int("status", 200),
    )
}
```

## ContextExtractor カスタムエクストラクタ

`ContextExtractor` は context からフィールドを抽出するために使用します。注意：ログメソッドは context パラメータを受け取らないため、エクストラクタは内部で `context.Background()` として呼び出され、以下のシナリオに適しています：

- グローバル context または goroutine-local ストレージから静的フィールドを抽出
- HTTP ミドルウェアと組み合わせてトレーシングフィールドを `WithFields` に手動渡し

### カスタムエクストラクタの例

```go
// カスタムエクストラクタ：すべてのログに静的/グローバルメタデータを付与
func tenantExtractor(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("service", "order-service"),
        dd.String("env", os.Getenv("APP_ENV")),
    }
}

// エクストラクタを登録
logger.AddContextExtractor(tenantExtractor)
```

:::warning コンテキストの制限
`ContextExtractor` 関数はリクエストスコープの context ではなく `context.Background()` を受け取ります。リクエストごとのトレース ID を付与するには、上記の `WithFields()` パターンを使用してリクエストスコープの `LoggerEntry` を作成してください。
:::

### 複数エクストラクタの組み合わせ

```go
// 異なるグローバルメタデータを収集するため複数のエクストラクタを登録
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("hostname", getHostname()),
        dd.String("version", buildVersion),
    }
})

logger.AddContextExtractor(tenantExtractor)
```

## マイクロサービス間伝播

マイクロサービス呼び出しでは、トレーシング識別子は HTTP ヘッダーで伝播します：

```go
// 送信側：トレーシング識別子をリクエストヘッダーに注入
func callUpstream(ctx context.Context, url string) (*http.Response, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }

    // トレーシング識別子を伝播
    if traceID := dd.GetTraceID(ctx); traceID != "" {
        req.Header.Set("X-Trace-ID", traceID)
    }
    if reqID := dd.GetRequestID(ctx); reqID != "" {
        req.Header.Set("X-Request-ID", reqID)
    }

    return http.DefaultClient.Do(req)
}
```

## リクエストスコープログパターン

```go
type RequestLogger struct {
    log    *dd.LoggerEntry
    ctx    context.Context
    start  time.Time
}

func NewRequestLogger(logger *dd.Logger, r *http.Request) *RequestLogger {
    ctx := r.Context()
    ctx = dd.WithTraceID(ctx, r.Header.Get("X-Trace-ID"))
    ctx = dd.WithRequestID(ctx, r.Header.Get("X-Request-ID"))

    return &RequestLogger{
        log: logger.WithFields(
            dd.String("trace_id", dd.GetTraceID(ctx)),
            dd.String("request_id", dd.GetRequestID(ctx)),
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
        ),
        ctx:   ctx,
        start: time.Now(),
    }
}

func (rl *RequestLogger) Info(msg string, fields ...dd.Field) {
    rl.log.InfoWith(msg, fields...)
}

func (rl *RequestLogger) Finish(status int) {
    rl.log.InfoWith("リクエスト完了",
        dd.Int("status", status),
        dd.Duration("elapsed", time.Since(rl.start)),
    )
}
```

## 次のステップ

- [フックシステム](./hooks) -- ライフサイクルフック拡張
- [監査ログ](./audit-logging) -- セキュリティ監査
- [API リファレンス - Context](../api-reference/output-integration/context) -- Context 完全 API
- [Web サービスサンプル](../examples/web-service) -- 完全 Web サービス例

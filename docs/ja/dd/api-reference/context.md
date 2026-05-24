---
title: "コンテキスト統合 - CyberGo DD | Context 統合"
description: "CyberGo DD コンテキスト統合完全 API ドキュメント。TraceID、SpanID、RequestID の自動伝播と抽出をサポート。カスタム ContextExtractor インターフェース実装、Context 伝播設定オプションと WithContext バインドメソッドを提供し、OpenTelemetry などの分散トレーシングシステムとシームレスに統合。"
---

# コンテキスト統合

DD は Go 標準ライブラリ `context.Context` との統合をサポートし、トレーシング情報の自動伝播とコンテキストフィールドの抽出が可能です。

## 組み込みコンテキストキー

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | TraceID を追加 |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | SpanID を追加 |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | RequestID を追加 |
| `GetTraceID` | `(ctx context.Context) string` | TraceID を取得 |
| `GetSpanID` | `(ctx context.Context) string` | SpanID を取得 |
| `GetRequestID` | `(ctx context.Context) string` | RequestID を取得 |

### 使用例

```go
func handleRequest(ctx context.Context) {
    // トレーシング情報を注入
    ctx = dd.WithTraceID(ctx, "trace-abc123")
    ctx = dd.WithSpanID(ctx, "span-def456")
    ctx = dd.WithRequestID(ctx, "req-789")

    // コンテキストフィールドを手動抽出してログに渡す
    logger.InfoWith("リクエスト処理",
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("span_id", dd.GetSpanID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
}
```

:::tip 一括抽出
`ContextExtractor` と `Config.ContextExtractors` を組み合わせて自動抽出を実現できます。エクストラクタは各ログ呼び出し時に実行されます。詳細は以下の [ContextExtractor](#contextextractor) セクションを参照。
:::

## ContextExtractor

コンテキストエクストラクタは `context.Context` からフィールドを自動抽出するために使用します。

```go
type ContextExtractor func(ctx context.Context) []Field
```

### エクストラクタの登録

```go
// Logger メソッドで登録
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// 一括置き換え
logger.SetContextExtractors(extractor1, extractor2)

// 現在のエクストラクタを取得
extractors := logger.GetContextExtractors()
```

## コンテキストキー定数

| 定数 | 型 | 値 |
|------|------|----|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## 完全な例

### HTTP ミドルウェア

```go
func tracingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        traceID := r.Header.Get("X-Trace-ID")
        if traceID == "" {
            traceID = generateTraceID()
        }
        ctx := dd.WithTraceID(r.Context(), traceID)
        ctx = dd.WithRequestID(ctx, generateRequestID())
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### gRPC インターセプター

```go
func loggingInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    md, _ := metadata.FromIncomingContext(ctx)
    ctx = dd.WithTraceID(ctx, md.Get("trace-id")[0])
    ctx = dd.WithRequestID(ctx, md.Get("request-id")[0])

    dd.InfoWith("gRPC リクエスト",
        dd.String("method", info.FullMethod),
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
    return handler(ctx, req)
}
```

## 次のステップ

- [Logger](./logger) -- AddContextExtractor メソッド
- [インターフェース定義](./interfaces) -- ContextExtractor 型定義
- [構造化フィールド](./fields) -- Field コンストラクタ

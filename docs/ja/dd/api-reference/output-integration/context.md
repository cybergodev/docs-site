---
sidebar_label: "コンテキスト統合"
title: "コンテキスト統合 - CyberGo DD | Context 統合"
description: "CyberGo DD コンテキスト統合 API：WithTraceID/WithSpanID/WithRequestID でトレース識別子を注入、ContextKey 型安全キーと ContextExtractor 関数型でフィールドを自動抽出し、OpenTelemetry などの分散トレーシングフレームワークとの統合をサポート。"
sidebar_position: 2
---

# コンテキスト統合

DD は Go 標準ライブラリ `context.Context` との統合をサポートし、トレーシング情報の自動伝播とコンテキストフィールドの抽出が可能です。

## ContextKey 型

`ContextKey` は `string` をベースとしたカスタムキー型で、他パッケージのコンテキストキーとの競合を回避します。

```go
type ContextKey string
```

TraceID / SpanID / RequestID に対応する 3 つのキー定数が定義済みです：

| 定数 | 型 | 値 |
|------|------|----|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## 注入と読み取り

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | TraceID を注入 |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | SpanID を注入 |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | RequestID を注入 |
| `GetTraceID` | `(ctx context.Context) string` | TraceID を読み取り（欠損時は `""` を返す） |
| `GetSpanID` | `(ctx context.Context) string` | SpanID を読み取り（欠損時は `""` を返す） |
| `GetRequestID` | `(ctx context.Context) string` | RequestID を読み取り（欠損時は `""` を返す） |

`With*` 関数は `context.WithValue` に基づいて新しい ctx を派生し（キーは対応する `ContextKey` 定数）、`Get*` 関数は ctx から string 値を取り出します；キーが存在しない、または値が string でない場合は、一律に空文字列を返します。

### 使用例

<!-- check-code: skip -->
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
手動 `Get*` は一回限りのシナリオに適しています。各ログにトレースフィールドを自動付与したい場合は、下記の `ContextExtractor` を Logger に登録します。エクストラクタは `*With` 呼び出しのたびに実行されます。
:::

## ContextExtractor

`ContextExtractor` は `context.Context` からフィールドを自動抽出する関数型で、OpenTelemetry、Jaeger などのトレーシングフレームワークとの連携に便利です。

```go
type ContextExtractor func(ctx context.Context) []Field
```

エクストラクタは Logger 内部が保持するスレッドセーフなレジストリ（`contextExtractorRegistry`、**プライベートで外部非公開**）で管理されます：追加順に実行され、読み取りは `atomic.Pointer` によるロックフリー高速パスを通ります；いずれかのエクストラクタが panic した場合は recover されて stderr に記録され、アプリケーションをクラッシュさせることはありません。

### エクストラクタの登録

エクストラクタ自体はこのファイルで型のみ定義されます；登録/管理 API は Logger 上にあります（core ドメイン）：

<!-- check-code: skip -->
```go
// エクストラクタを追加（error を返す、nil エクストラクタは拒否されます）
err := logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// 全エクストラクタを一括置き換え
_ = logger.SetContextExtractors(extractor1, extractor2)

// 現在登録済みのエクストラクタのスナップショットを取得
extractors := logger.GetContextExtractors()
```

### OpenTelemetry 例

<!-- check-code: skip -->
```go
// OTel span の trace_id / span_id を各ログに注入
otelExtractor := dd.ContextExtractor(func(ctx context.Context) []dd.Field {
    span := trace.SpanFromContext(ctx)
    if !span.SpanContext().IsValid() {
        return nil
    }
    return []dd.Field{
        dd.String("trace_id", span.SpanContext().TraceID().String()),
        dd.String("span_id", span.SpanContext().SpanID().String()),
    }
})
_ = logger.AddContextExtractor(otelExtractor)
```

## 完全な例

### HTTP ミドルウェア

<!-- check-code: skip -->
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

<!-- check-code: skip -->
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

- [Logger](../core/logger) -- `AddContextExtractor` / `SetContextExtractors` / `GetContextExtractors`
- [構造化フィールド](./fields) -- `Field` コンストラクタとフィールド検証
- [設定](../core/config) -- `Config.ContextExtractors`

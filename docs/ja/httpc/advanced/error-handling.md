---
title: "エラー処理 - CyberGo HTTPC | 分類とセンチネル"
description: "HTTPC エラー処理ガイド: ErrorType 12 種類のエラー分類、ClientError フィールドと IsRetryable、errors.Is/As センチネルマッチング、リトライ枯渇、コンテキストタイムアウト、ミドルウェア統合処理のベストプラクティスを解説します。"
---

# エラー処理

## エラー分類

HTTPC は `ClientError` でエラーを分類し、`errors.As` と `errors.Is` をサポートします。

### エラータイプの判定

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Printf("リクエストタイムアウト: %v", err)
        case httpc.ErrorTypeNetwork:
            log.Printf("ネットワークエラー: %v", err)
        case httpc.ErrorTypeDNS:
            log.Printf("DNS 解決失敗: %v", err)
        case httpc.ErrorTypeTLS:
            log.Printf("TLS エラー: %v", err)
        case httpc.ErrorTypeCertificate:
            log.Printf("証明書検証失敗: %v", err)
        case httpc.ErrorTypeRetryExhausted:
            log.Printf("リトライ枯渇: %v", err)
        case httpc.ErrorTypeValidation:
            log.Printf("リクエスト検証失敗: %v", err)
        case httpc.ErrorTypeContextCanceled:
            log.Printf("リクエストがキャンセルされました: %v", err)
        }
    }
}
```

### リトライ可否の判定

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) && clientErr.IsRetryable() {
    // エラーはリトライ可能
    log.Println("リトライ可能なエラー、後でリトライします")
}
```

## センチネルエラー

### エラー変数のマッチング

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // クライアントがクローズ済み
}

if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // レスポンスボディが空
}

if errors.Is(err, httpc.ErrInvalidHeader) {
    // リクエストヘッダーが無効
}
```

## リトライとエラー

リトライ設定の詳細は [リトライとフォールトトレランス](../guides/retry-fault-tolerance) をご覧ください。ここではリトライ枯渇後のエラー処理に焦点を当てます：

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("%d 回リトライ後も失敗", clientErr.Attempts)
        }
    }
    return err
}
```

## コンテキストのキャンセル

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := client.Request(ctx, "GET", url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeContextCanceled {
            log.Println("リクエストがキャンセルされました（タイムアウトまたは手動キャンセル）")
        }
    }
}
```

## エラー処理のベストプラクティス

### 1. クライアントエラーとサーバーエラーの区別

```go
result, err := client.Get(url)
if err != nil {
    // ネットワーク層エラー
    handleNetworkError(err)
    return
}

if result.IsClientError() {
    // 4xx - クライアントのリクエストに誤り
    log.Printf("クライアントエラー: %d", result.StatusCode())
} else if result.IsServerError() {
    // 5xx - サーバー障害
    log.Printf("サーバーエラー: %d", result.StatusCode())
}
```

### 2. ミドルウェアによる統一処理

```go
recoveryMiddleware := httpc.RecoveryMiddleware()
loggingMiddleware := httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
metricsMiddleware := httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
    if err != nil {
        metrics.Increment("http.errors")
    } else {
        metrics.RecordDuration("http.duration", duration)
    }
})
```

### 3. タイムアウトの階層化

```go
// クライアントデフォルトタイムアウト
cfg.Timeouts.Request = 30 * time.Second

// ミドルウェア強制タイムアウト
timeoutMiddleware := httpc.TimeoutMiddleware(30 * time.Second)

// 個別リクエストのオーバーライド
result, err := client.Get(url, httpc.WithTimeout(10 * time.Second))

// コンテキストタイムアウト（最も精密）
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, err := client.Request(ctx, "GET", url)
```

## 次のステップ

- [エラータイプ API](../api-reference/errors) - エラータイプと変数のリファレンス
- [リトライとフォールトトレランス](../guides/retry-fault-tolerance) - リトライポリシー設定
- [ミドルウェアチェーン](../guides/middleware-chain) - ミドルウェアによる統一エラー処理

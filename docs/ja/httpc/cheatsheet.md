---
title: "チートシート - CyberGo HTTPC | クイック参照"
description: "HTTPC チートシート: クライアント作成と 5 つのプリセット、7 種類のリクエストメソッド、主要な WithXxx オプション、Result 処理、ミドルウェアチェーン、エラー分類、ファイルダウンロードの再利用可能なコードスニペットを素早く参照できます。"
---

# チートシート

## クライアントの作成

```go
// デフォルト設定
client, _ := httpc.New()
defer client.Close()

// カスタム設定
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, _ = httpc.New(cfg)
```

## HTTP メソッド

```go
// パッケージ関数（デフォルトクライアントを使用）
result, _ := httpc.Get(url)
result, _ := httpc.Post(url)
result, _ := httpc.Put(url)
result, _ := httpc.Patch(url)
result, _ := httpc.Delete(url)
result, _ := httpc.Head(url)
result, _ := httpc.Options(url)

// インスタンスメソッド
result, _ := client.Get(url)

// コンテキスト付き
result, _ := httpc.Request(ctx, "GET", url)
result, _ := client.Request(ctx, "POST", url)
```

## リクエストオプション

### リクエストヘッダー

```go
httpc.WithHeader("Authorization", "Bearer token")
httpc.WithHeaderMap(map[string]string{"Key": "Value"})
httpc.WithUserAgent("my-app/1.0")
```

### リクエストボディ

```go
httpc.WithJSON(data)                    // application/json
httpc.WithXML(data)                     // application/xml
httpc.WithForm(map[string]string{...})  // x-www-form-urlencoded
httpc.WithFormData(formData)            // multipart/form-data
httpc.WithFile("file", "doc.pdf", data) // ファイルアップロード
httpc.WithBinary([]byte{...})           // application/octet-stream
httpc.WithBinary([]byte{...}, "image/png") // タイプ指定
httpc.WithBody(data)                    // タイプ自動検出
httpc.WithBody(data, httpc.BodyJSON)    // 明示的指定：BodyJSON/BodyXML/BodyForm/BodyBinary/BodyMultipart
```

### クエリパラメータ

```go
httpc.WithQuery("page", 1)
httpc.WithQueryMap(map[string]any{"page": 1, "limit": 10})
```

### 認証

```go
httpc.WithBearerToken(token)
httpc.WithBasicAuth("user", "pass")
```

### Cookie

```go
httpc.WithCookie(http.Cookie{Name: "session", Value: "abc"})
httpc.WithCookies([]http.Cookie{{Name: "a", Value: "1"}, {Name: "b", Value: "2"}})
httpc.WithCookieMap(map[string]string{"session": "abc"})
httpc.WithCookieString("session=abc; token=xyz")
httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig())
```

### 制御

```go
httpc.WithContext(ctx)
httpc.WithTimeout(30 * time.Second)
httpc.WithMaxRetries(3)
httpc.WithFollowRedirects(false)
httpc.WithMaxRedirects(5)
httpc.WithStreamBody(true)
```

### コールバック

```go
httpc.WithOnRequest(func(req httpc.RequestMutator) error {
    log.Printf("送信 %s %s", req.Method(), req.URL())
    return nil
})
httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
    log.Printf("レスポンス受信: %d", resp.StatusCode())
    return nil
})
```

## レスポンス処理

```go
result.StatusCode()                    // int
result.Body()                          // string
result.RawBody()                       // []byte
result.Proto()                         // "HTTP/1.1"
result.IsSuccess()                     // 2xx
result.IsRedirect()                    // 3xx
result.IsClientError()                 // 4xx
result.IsServerError()                 // 5xx
result.Unmarshal(&data)                // JSON 解析
result.GetCookie("name")               // レスポンス Cookie を取得
result.HasCookie("name")               // レスポンス Cookie を確認
result.ResponseCookies()               // 全レスポンス Cookie
result.RequestCookies()                // 全リクエスト Cookie
result.GetRequestCookie("name")        // リクエスト Cookie を取得
result.HasRequestCookie("name")        // リクエスト Cookie を確認
result.SaveToFile("/path/to/file")     // ファイルに保存
result.String()                        // 人間可読表現（機密ヘッダーはマスク済み）
```

## 設定

```go
cfg := httpc.DefaultConfig()

// タイムアウト
cfg.Timeouts.Request = 30 * time.Second
cfg.Timeouts.Dial = 10 * time.Second
cfg.Timeouts.TLSHandshake = 10 * time.Second
cfg.Timeouts.ResponseHeader = 30 * time.Second
cfg.Timeouts.IdleConn = 90 * time.Second

// 接続
cfg.Connection.MaxIdleConns = 50
cfg.Connection.MaxConnsPerHost = 10
cfg.Connection.ProxyURL = "http://proxy:8080"
cfg.Connection.EnableHTTP2 = true
cfg.Connection.EnableCookies = true

// セキュリティ
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024
cfg.Security.AllowPrivateIPs = false
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}

// リトライ
cfg.Retry.MaxRetries = 3
cfg.Retry.Delay = 1 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

## ミドルウェア

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(log.Printf),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
    httpc.TimeoutMiddleware(30 * time.Second),
    httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
        metrics.Record(method, statusCode, duration)
    }),
    httpc.AuditMiddleware(func(event httpc.AuditEvent) {
        log.Printf("[AUDIT] %s %s -> %d", event.Method, event.URL, event.StatusCode)
    }),
}
```

## エラー処理

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            // タイムアウト
        case httpc.ErrorTypeNetwork:
            // ネットワークエラー
        case httpc.ErrorTypeTLS:
            // TLS エラー
        case httpc.ErrorTypeDNS:
            // DNS 解決エラー
        case httpc.ErrorTypeContextCanceled:
            // コンテキストキャンセル
        case httpc.ErrorTypeRetryExhausted:
            // リトライ枯渇
        case httpc.ErrorTypeValidation:
            // リクエスト検証エラー
        case httpc.ErrorTypeHTTP:
            // HTTP 層エラー
        // その他: ErrorTypeUnknown, ErrorTypeResponseRead,
        //       ErrorTypeTransport, ErrorTypeCertificate
        }
        if clientErr.IsRetryable() {
            // リトライ可能
        }
    }
}
```

## ファイルダウンロード

```go
// 基本ダウンロード（ctx は context.Context、例えば context.Background()）
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlResult, err := client.Download(ctx, url, dlCfg)

// オプション付き（上書き、レジューム、進捗）
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlCfg.Overwrite = true
dlCfg.ResumeDownload = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%% (%.2f MB/s)", float64(downloaded)/float64(total)*100, float64(speed)/1024/1024)
}
dlResult, err := client.Download(ctx, url, dlCfg)

// dlResult の型は *DownloadResult（*Result ではない）
// フィールド: FilePath, BytesWritten, Duration, AverageSpeed, StatusCode, ContentLength, Resumed, ResponseCookies, ActualChecksum
```

## ドメインクライアント

```go
dc, _ := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, _ := dc.Get("/users")
```

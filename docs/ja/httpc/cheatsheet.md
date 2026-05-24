---
title: "チートシート - HTTPC"
description: "HTTPCチートシート：クライアント作成と5種のプリセット設定、Get/Postなど7種のHTTPメソッド、27個のWithXxxリクエストオプション、Resultレスポンス処理、ミドルウェアチェーン、ClientErrorエラータイプ、ファイルダウンロードの完全なコードスニペット。"
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

## HTTPメソッド

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
httpc.WithBody(data)                    // 自動検出
httpc.WithBody(data, httpc.BodyJSON)    // 明示指定：BodyJSON/BodyXML/BodyForm/BodyBinary/BodyMultipart
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
result.Unmarshal(&data)                // JSON解析
result.GetCookie("name")               // レスポンスCookieの取得
result.HasCookie("name")               // レスポンスCookieの確認
result.ResponseCookies()               // 全レスポンスCookie
result.RequestCookies()                // 全リクエストCookie
result.GetRequestCookie("name")        // リクエストCookieの取得
result.HasRequestCookie("name")        // リクエストCookieの確認
result.SaveToFile("/path/to/file")     // ファイルに保存
result.String()                        // 人間可読表現（機密ヘッダーはマスク済み）
httpc.ReleaseResult(result)            // オブジェクトプールに返却
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
            // TLSエラー
        case httpc.ErrorTypeDNS:
            // DNS解決エラー
        case httpc.ErrorTypeContextCanceled:
            // コンテキストキャンセル
        case httpc.ErrorTypeRetryExhausted:
            // リトライ枯渇
        case httpc.ErrorTypeValidation:
            // リクエスト検証エラー
        case httpc.ErrorTypeHTTP:
            // HTTP層エラー
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
dlResult, err := client.DownloadFile(url, "/path/to/file")

// オプション付き
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlCfg.Overwrite = true
dlCfg.ResumeDownload = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%% (%s/s)", float64(downloaded)/float64(total)*100, httpc.FormatSpeed(speed))
}
dlResult, err := client.DownloadWithOptions(url, dlCfg)

// dlResultのタイプは*DownloadResult（*Resultではない）
// フィールド: FilePath, BytesWritten, Duration, AverageSpeed, StatusCode, ContentLength, Resumed, ResponseCookies, ActualChecksum
```

## ドメインクライアント

```go
dc, _ := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, _ := dc.Get("/users")
``
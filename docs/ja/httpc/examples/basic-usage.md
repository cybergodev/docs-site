---
title: "基本的な使い方 - HTTPC"
description: "HTTPC基本的な使用例：クエリパラメータと認証付きGETリクエスト、JSON/フォーム/ファイルアップロードPOSTリクエスト、FormDataマルチフィールドフォーム、DefaultConfigカスタム設定、ProxyURLプロキシ、Recovery/Loggingミドルウェア、RequestID/Metricsメトリクス収集とプログレスコールバック付きファイルダウンロードの完全なコード。"
---

# 基本的な使い方

## GETリクエスト

### 基本的なGET

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://httpbin.org/get")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())
}
```

### クエリパラメータ付き

```go
result, err := httpc.Get("https://httpbin.org/get",
    httpc.WithQuery("name", "test"),
    httpc.WithQuery("page", 1),
    httpc.WithQueryMap(map[string]any{
        "limit": 10,
        "sort":  "desc",
    }),
)
```

### 認証付き

```go
result, err := httpc.Get("https://api.example.com/me",
    httpc.WithBearerToken("my-token"),
)
```

## POSTリクエスト

### JSONリクエストボディ

```go
data := map[string]any{
    "name":  "John",
    "email": "john@example.com",
}

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithJSON(data),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// JSONレスポンスの解析
var response map[string]any
if err := result.Unmarshal(&response); err != nil {
    log.Fatal(err)
}
fmt.Println(response)
```

### フォーム送信

```go
result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{
        "username": "admin",
        "password": "secret",
    }),
)
```

### ファイルアップロード

```go
fileContent, _ := os.ReadFile("document.pdf")

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithFile("file", "document.pdf", fileContent),
)
```

### マルチフィールドフォーム

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "title": "My Document",
        "type":  "pdf",
    },
    Files: map[string]*httpc.FileData{
        "file": {
            Filename: "report.pdf",
            Content:  fileContent,
        },
    },
}

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithFormData(form),
)
```

## クライアントの作成

### カスタム設定

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true

client, err := httpc.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()
```

### プロキシ設定

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"

client, _ := httpc.New(cfg)
```

## ミドルウェア

### ログ + リカバリ

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
}
cfg.Middleware.UserAgent = "my-app/1.0"

client, _ := httpc.New(cfg)
```

### リクエストID + メトリクス

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RequestIDMiddleware("X-Request-ID", nil),
    httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
        metrics.Record(method, statusCode, duration)
    }),
}

client, _ := httpc.New(cfg)
```

## ファイルダウンロード

```go
client, _ := httpc.New()
defer client.Close()

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rダウンロード中: %.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}

result, err := client.DownloadWithOptions("https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nダウンロード完了: %s, 所要時間 %v, 平均速度 %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

## ドメインクライアント

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// セッション情報を設定
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// リクエストに自動的にセッションヘッダーとCookieが付与される
users, _ := dc.Get("/users")
user, _ := dc.Get("/users/1")

fmt.Println(users.StatusCode()) // 200
```

## 次のステップ

- [高度な使用例](./advanced-usage) - カスタムリトライ、ミドルウェアチェーン、並行ダウンロード
- [リクエストとレスポンス](../guides/request-response) - リクエストオプションの詳細
- [ドメインクライアントとセッション](../guides/domain-session) - セッション管理

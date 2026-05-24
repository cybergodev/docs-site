---
title: "Basic Usage - HTTPC"
description: "HTTPC basic examples: GET/POST with JSON, file uploads, custom config, proxy, middleware, download with progress, and domain client usage."
---

# Basic Usage

## GET Requests

### Basic GET

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

### With Query Parameters

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

### With Authentication

```go
result, err := httpc.Get("https://api.example.com/me",
    httpc.WithBearerToken("my-token"),
)
```

## POST Requests

### JSON Request Body

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

// Parse JSON response
var response map[string]any
if err := result.Unmarshal(&response); err != nil {
    log.Fatal(err)
}
fmt.Println(response)
```

### Form Submission

```go
result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{
        "username": "admin",
        "password": "secret",
    }),
)
```

### File Upload

```go
fileContent, _ := os.ReadFile("document.pdf")

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithFile("file", "document.pdf", fileContent),
)
```

### Multi-Field Form

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

## Client Creation

### Custom Configuration

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

### Proxy Configuration

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"

client, _ := httpc.New(cfg)
```

## Middleware

### Logging + Recovery

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
}
cfg.Middleware.UserAgent = "my-app/1.0"

client, _ := httpc.New(cfg)
```

### Request ID + Metrics

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

## File Download

```go
client, _ := httpc.New()
defer client.Close()

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rDownloading: %.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}

result, err := client.DownloadWithOptions("https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nDownload complete: %s, duration %v, average speed %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

## Domain Client

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Set session info
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// Requests automatically carry session headers and cookies
users, _ := dc.Get("/users")
user, _ := dc.Get("/users/1")

fmt.Println(users.StatusCode()) // 200
```

## Next Steps

- [Advanced Examples](./advanced-usage) - Custom retry, middleware chains, concurrent downloads
- [Request and Response](../guides/request-response) - Request options in detail
- [Domain Client and Sessions](../guides/domain-session) - Session management

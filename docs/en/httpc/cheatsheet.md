---
title: Cheatsheet - HTTPC
description: HTTPC cheatsheet covering client creation, seven HTTP methods, request options, response handling, configuration presets, middleware, and error types quick reference.
---

# Cheatsheet

## Creating a Client

```go
// Default configuration
client, _ := httpc.New()
defer client.Close()

// Custom configuration
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, _ = httpc.New(cfg)
```

## HTTP Methods

```go
// Package-level functions (using default client)
result, _ := httpc.Get(url)
result, _ := httpc.Post(url)
result, _ := httpc.Put(url)
result, _ := httpc.Patch(url)
result, _ := httpc.Delete(url)
result, _ := httpc.Head(url)
result, _ := httpc.Options(url)

// Instance methods
result, _ := client.Get(url)

// With context
result, _ := httpc.Request(ctx, "GET", url)
result, _ := client.Request(ctx, "POST", url)
```

## Request Options

### Headers

```go
httpc.WithHeader("Authorization", "Bearer token")
httpc.WithHeaderMap(map[string]string{"Key": "Value"})
httpc.WithUserAgent("my-app/1.0")
```

### Request Body

```go
httpc.WithJSON(data)                    // application/json
httpc.WithXML(data)                     // application/xml
httpc.WithForm(map[string]string{...})  // x-www-form-urlencoded
httpc.WithFormData(formData)            // multipart/form-data
httpc.WithFile("file", "doc.pdf", data) // File upload
httpc.WithBinary([]byte{...})           // application/octet-stream
httpc.WithBinary([]byte{...}, "image/png") // Specify type
httpc.WithBody(data)                    // Auto-detect type
httpc.WithBody(data, httpc.BodyJSON)    // Explicit: BodyJSON/BodyXML/BodyForm/BodyBinary/BodyMultipart
```

### Query Parameters

```go
httpc.WithQuery("page", 1)
httpc.WithQueryMap(map[string]any{"page": 1, "limit": 10})
```

### Authentication

```go
httpc.WithBearerToken(token)
httpc.WithBasicAuth("user", "pass")
```

### Cookies

```go
httpc.WithCookie(http.Cookie{Name: "session", Value: "abc"})
httpc.WithCookies([]http.Cookie{{Name: "a", Value: "1"}, {Name: "b", Value: "2"}})
httpc.WithCookieMap(map[string]string{"session": "abc"})
httpc.WithCookieString("session=abc; token=xyz")
httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig())
```

### Control

```go
httpc.WithContext(ctx)
httpc.WithTimeout(30 * time.Second)
httpc.WithMaxRetries(3)
httpc.WithFollowRedirects(false)
httpc.WithMaxRedirects(5)
httpc.WithStreamBody(true)
```

### Callbacks

```go
httpc.WithOnRequest(func(req httpc.RequestMutator) error {
    log.Printf("Sending %s %s", req.Method(), req.URL())
    return nil
})
httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
    log.Printf("Received response: %d", resp.StatusCode())
    return nil
})
```

## Response Handling

```go
result.StatusCode()                    // int
result.Body()                          // string
result.RawBody()                       // []byte
result.Proto()                         // "HTTP/1.1"
result.IsSuccess()                     // 2xx
result.IsRedirect()                    // 3xx
result.IsClientError()                 // 4xx
result.IsServerError()                 // 5xx
result.Unmarshal(&data)                // JSON parsing
result.GetCookie("name")               // Get response cookie
result.HasCookie("name")               // Check response cookie
result.ResponseCookies()               // All response cookies
result.RequestCookies()                // All request cookies
result.GetRequestCookie("name")        // Get request cookie
result.HasRequestCookie("name")        // Check request cookie
result.SaveToFile("/path/to/file")     // Save to file
result.String()                        // Human-readable representation (sensitive headers masked)
httpc.ReleaseResult(result)            // Release to object pool
```

## Configuration

```go
cfg := httpc.DefaultConfig()

// Timeouts
cfg.Timeouts.Request = 30 * time.Second
cfg.Timeouts.Dial = 10 * time.Second
cfg.Timeouts.TLSHandshake = 10 * time.Second
cfg.Timeouts.ResponseHeader = 30 * time.Second
cfg.Timeouts.IdleConn = 90 * time.Second

// Connection
cfg.Connection.MaxIdleConns = 50
cfg.Connection.MaxConnsPerHost = 10
cfg.Connection.ProxyURL = "http://proxy:8080"
cfg.Connection.EnableHTTP2 = true
cfg.Connection.EnableCookies = true

// Security
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024
cfg.Security.AllowPrivateIPs = false
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}

// Retry
cfg.Retry.MaxRetries = 3
cfg.Retry.Delay = 1 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

## Middleware

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

## Error Handling

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            // Timeout
        case httpc.ErrorTypeNetwork:
            // Network error
        case httpc.ErrorTypeTLS:
            // TLS error
        case httpc.ErrorTypeDNS:
            // DNS resolution error
        case httpc.ErrorTypeContextCanceled:
            // Context canceled
        case httpc.ErrorTypeRetryExhausted:
            // Retries exhausted
        case httpc.ErrorTypeValidation:
            // Request validation error
        case httpc.ErrorTypeHTTP:
            // HTTP layer error
        // Others: ErrorTypeUnknown, ErrorTypeResponseRead,
        //         ErrorTypeTransport, ErrorTypeCertificate
        }
        if clientErr.IsRetryable() {
            // Retryable
        }
    }
}
```

## File Download

```go
dlResult, err := client.DownloadFile(url, "/path/to/file")

// With options
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlCfg.Overwrite = true
dlCfg.ResumeDownload = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%% (%s/s)", float64(downloaded)/float64(total)*100, httpc.FormatSpeed(speed))
}
dlResult, err := client.DownloadWithOptions(url, dlCfg)

// dlResult is of type *DownloadResult (not *Result)
// Fields: FilePath, BytesWritten, Duration, AverageSpeed, StatusCode, ContentLength, Resumed, ResponseCookies, ActualChecksum
```

## Domain Client

```go
dc, _ := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, _ := dc.Get("/users")
```

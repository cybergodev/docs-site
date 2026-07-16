---
sidebar_label: "Constants & Types"
title: "Constants and Types - CyberGo HTTPC | Constants & Types"
description: "HTTPC constants and types API reference: BodyKind body enums with auto-detection, FormData and FileData upload types, AuditEvent, and context keys."
sidebar_position: 2
---

# Constants and Types

## BodyKind

```go
type BodyKind int
```

Request body type, used with `WithBody` to specify the body format.

| Constant | Value | Description | Content-Type |
|----------|-------|-------------|-------------|
| `BodyAuto` | 0 | Auto-detect | Inferred from type |
| `BodyJSON` | 1 | Force JSON | application/json |
| `BodyXML` | 2 | Force XML | application/xml |
| `BodyForm` | 3 | Form | application/x-www-form-urlencoded |
| `BodyBinary` | 4 | Binary | application/octet-stream |
| `BodyMultipart` | 5 | Multipart | multipart/form-data |

### BodyAuto Detection Rules

| Input Type | Content-Type |
|------------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `*FormData` | multipart/form-data |
| `io.Reader` | Not set |
| `map[string]string` | application/x-www-form-urlencoded |
| Other types | application/json |

```go
// Auto-detect (default)
result, _ := client.Post(url, httpc.WithBody(data))

// Force JSON
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// Force XML
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

## FormData / FileData

### FormData

```go
type FormData struct {
    Fields map[string]string
    Files  map[string]*FileData
}
```

### FileData

```go
type FileData struct {
    Filename    string
    Content     []byte
    ContentType string  // MIME type, e.g. "image/png", "application/pdf"
}
```

```go
form := &httpc.FormData{
    Fields: map[string]string{"key": "value"},
    Files: map[string]*httpc.FileData{
        "file": {Filename: "test.txt", Content: []byte("hello"), ContentType: "text/plain"},
    },
}
result, err := client.Post(url, httpc.WithFormData(form))
```

## Audit Events

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`           // Masked (credentials removed)
    StatusCode    int                 `json:"statusCode"`
    Duration      time.Duration       `json:"duration"`
    Attempts      int                 `json:"attempts"`
    Error         error               `json:"error,omitempty"`
    SourceIP      string              `json:"sourceIP,omitempty"`
    UserID        string              `json:"userID,omitempty"`
    RedirectChain []string            `json:"redirectChain,omitempty"`
    ReqHeaders    map[string][]string `json:"reqHeaders,omitempty"`
    RespHeaders   map[string][]string `json:"respHeaders,omitempty"`
}
```

### AuditMiddlewareConfig

```go
type AuditMiddlewareConfig struct {
    Format         string   // "text" or "json"
    IncludeHeaders bool     // Include request/response headers
    MaskHeaders    []string // Header names to mask
    SanitizeError  bool     // Mask error messages
}
```

## Context Keys

| Constant | Type | Description |
|----------|------|-------------|
| `SourceIPKey` | `auditContextKey` | Source IP in audit events |
| `UserIDKey` | `auditContextKey` | User ID in audit events |

```go
// Pass audit information via context
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

// Configure audit middleware in Config
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.AuditMiddleware(func(event httpc.AuditEvent) {
        fmt.Println(event.SourceIP) // 192.168.1.1
        fmt.Println(event.UserID)   // user-123
    }),
}
client, _ := httpc.New(cfg)

// Values from context are read by the middleware when sending requests
result, err := client.Request(ctx, "GET", url)
```

## See Also

- [Error Types](./errors) - Complete reference for ClientError, ErrorType, and error variables
- [Request Options](../core/options) - BodyKind usage in WithBody
- [Middleware](../client-config/middleware) - AuditMiddleware and audit configuration

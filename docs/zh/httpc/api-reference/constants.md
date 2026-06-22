---
title: "常量与类型 - CyberGo HTTPC | 常量与辅助类型"
description: "HTTPC 常量与辅助类型 API 参考：BodyKind 六种请求体枚举及自动检测规则、FormData 与 FileData 文件上传类型、AuditEvent 审计事件结构体、AuditMiddlewareConfig 审计配置与 SourceIPKey 等上下文键定义。"
---

# 常量与类型

## BodyKind

```go
type BodyKind int
```

请求体类型，用于 `WithBody` 指定请求体格式。

| 常量 | 值 | 说明 | Content-Type |
|------|-----|------|-------------|
| `BodyAuto` | 0 | 自动检测 | 根据类型推断 |
| `BodyJSON` | 1 | 强制 JSON | application/json |
| `BodyXML` | 2 | 强制 XML | application/xml |
| `BodyForm` | 3 | 表单 | application/x-www-form-urlencoded |
| `BodyBinary` | 4 | 二进制 | application/octet-stream |
| `BodyMultipart` | 5 | 多部分 | multipart/form-data |

### BodyAuto 检测规则

| 输入类型 | Content-Type |
|----------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `*FormData` | multipart/form-data |
| `io.Reader` | 不设置 |
| `map[string]string` | application/x-www-form-urlencoded |
| 其他类型 | application/json |

```go
// 自动检测（默认）
result, _ := client.Post(url, httpc.WithBody(data))

// 强制 JSON
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// 强制 XML
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
    ContentType string  // MIME 类型，如 "image/png"、"application/pdf"
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

## 审计事件

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`           // 脱敏（凭据已移除）
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
    Format         string   // "text" 或 "json"
    IncludeHeaders bool     // 包含请求/响应头
    MaskHeaders    []string // 需脱敏的头名称
    SanitizeError  bool     // 脱敏错误信息
}
```

## 上下文键

| 常量 | 类型 | 说明 |
|------|------|------|
| `SourceIPKey` | `auditContextKey` | 审计事件中的源 IP |
| `UserIDKey` | `auditContextKey` | 审计事件中的用户 ID |

```go
// 通过 context 传递审计信息
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

// 在 Config 中配置审计中间件
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.AuditMiddleware(func(event httpc.AuditEvent) {
        fmt.Println(event.SourceIP) // 192.168.1.1
        fmt.Println(event.UserID)   // user-123
    }),
}
client, _ := httpc.New(cfg)

// 发送请求时 context 中的值会被中间件读取
result, err := client.Request(ctx, "GET", url)
```

## 另见

- [错误类型](./errors) - ClientError、ErrorType 和错误变量的完整参考
- [请求选项](./options) - BodyKind 在 WithBody 中的使用
- [中间件](./middleware) - AuditMiddleware 和审计配置

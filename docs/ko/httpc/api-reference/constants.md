---
title: "상수와 타입 - HTTPC"
description: "HTTPC 상수와 보조 타입 API 레퍼런스: BodyKind 6가지 요청 본문 열거형 및 자동 감지 규칙, FormData와 FileData 파일 업로드 타입, AuditEvent 감사 이벤트 구조체, AuditMiddlewareConfig 감사 구성과 SourceIPKey 등 컨텍스트 키 정의."
---

# 상수와 타입

## BodyKind

```go
type BodyKind int
```

요청 본문 타입으로, `WithBody`에서 요청 본문 형식을 지정하는 데 사용합니다.

| 상수 | 값 | 설명 | Content-Type |
|------|-----|------|-------------|
| `BodyAuto` | 0 | 자동 감지 | 타입에 따라 추론 |
| `BodyJSON` | 1 | JSON 강제 | application/json |
| `BodyXML` | 2 | XML 강제 | application/xml |
| `BodyForm` | 3 | 폼 | application/x-www-form-urlencoded |
| `BodyBinary` | 4 | 바이너리 | application/octet-stream |
| `BodyMultipart` | 5 | 멀티파트 | multipart/form-data |

### BodyAuto 감지 규칙

| 입력 타입 | Content-Type |
|----------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `*FormData` | multipart/form-data |
| `io.Reader` | 설정하지 않음 |
| `map[string]string` | application/x-www-form-urlencoded |
| 기타 타입 | application/json |

```go
// 자동 감지 (기본)
result, _ := client.Post(url, httpc.WithBody(data))

// JSON 강제
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// XML 강제
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
    ContentType string  // MIME 타입, 예: "image/png", "application/pdf"
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

## 감사 이벤트

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`           // 마스킹됨 (자격 증명 제거됨)
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
    Format         string   // "text" 또는 "json"
    IncludeHeaders bool     // 요청/응답 헤더 포함
    MaskHeaders    []string // 마스킹할 헤더 이름
    SanitizeError  bool     // 오류 정보 마스킹
}
```

## 컨텍스트 키

| 상수 | 타입 | 설명 |
|------|------|------|
| `SourceIPKey` | `auditContextKey` | 감사 이벤트의 출발지 IP |
| `UserIDKey` | `auditContextKey` | 감사 이벤트의 사용자 ID |

```go
// 컨텍스트를 통해 감사 정보 전달
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

// Config에서 감사 미들웨어 구성
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.AuditMiddleware(func(event httpc.AuditEvent) {
        fmt.Println(event.SourceIP) // 192.168.1.1
        fmt.Println(event.UserID)   // user-123
    }),
}
client, _ := httpc.New(cfg)

// 요청 시 컨텍스트의 값이 미들웨어에서 읽힘
result, err := client.Request(ctx, "GET", url)
```

## 참고

- [오류 타입](./errors) - ClientError, ErrorType 및 오류 변수의 완전한 참조
- [요청 옵션](./options) - BodyKind의 WithBody 사용
- [미들웨어](./middleware) - AuditMiddleware 및 감사 구성

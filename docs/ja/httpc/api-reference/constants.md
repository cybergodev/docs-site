---
title: "定数とタイプ - CyberGo HTTPC | 定数とタイプ"
description: "HTTPC 定数とタイプ API リファレンス: BodyKind リクエストボディ列挙と自動検出、FormData と FileData アップロードタイプ、AuditEvent 監査イベント構造、コンテキストキー定義の完全な説明を提供します。"
---

# 定数とタイプ

## BodyKind

```go
type BodyKind int
```

リクエストボディタイプ。`WithBody` でリクエストボディの形式を指定するために使用します。

| 定数 | 値 | 説明 | Content-Type |
|------|-----|------|-------------|
| `BodyAuto` | 0 | 自動検出 | タイプから推論 |
| `BodyJSON` | 1 | JSON を強制 | application/json |
| `BodyXML` | 2 | XML を強制 | application/xml |
| `BodyForm` | 3 | フォーム | application/x-www-form-urlencoded |
| `BodyBinary` | 4 | バイナリ | application/octet-stream |
| `BodyMultipart` | 5 | マルチパート | multipart/form-data |

### BodyAuto 検出ルール

| 入力タイプ | Content-Type |
|-----------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `*FormData` | multipart/form-data |
| `io.Reader` | 設定なし |
| `map[string]string` | application/x-www-form-urlencoded |
| その他のタイプ | application/json |

```go
// 自動検出（デフォルト）
result, _ := client.Post(url, httpc.WithBody(data))

// JSON を強制
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// XML を強制
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
    ContentType string  // MIME タイプ（例："image/png"、"application/pdf"）
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

## 監査イベント

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`           // マスク済み（認証情報は削除）
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
    Format         string   // "text" または "json"
    IncludeHeaders bool     // リクエスト/レスポンスヘッダーを含む
    MaskHeaders    []string // マスクが必要なヘッダー名
    SanitizeError  bool     // エラー情報をマスク
}
```

## コンテキストキー

| 定数 | タイプ | 説明 |
|------|--------|------|
| `SourceIPKey` | `auditContextKey` | 監査イベントのソース IP |
| `UserIDKey` | `auditContextKey` | 監査イベントのユーザー ID |

```go
// コンテキストで監査情報を渡す
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

// Config で監査ミドルウェアを設定
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.AuditMiddleware(func(event httpc.AuditEvent) {
        fmt.Println(event.SourceIP) // 192.168.1.1
        fmt.Println(event.UserID)   // user-123
    }),
}
client, _ := httpc.New(cfg)

// リクエスト時にコンテキストの値がミドルウェアに読み取られる
result, err := client.Request(ctx, "GET", url)
```

## 関連項目

- [エラータイプ](./errors) - ClientError、ErrorType、エラー変数の完全リファレンス
- [リクエストオプション](./options) - WithBody での BodyKind の使用
- [ミドルウェア](./middleware) - AuditMiddleware と監査設定

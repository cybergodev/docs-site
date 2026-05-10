---
title: リクエストとレスポンス - HTTPC
description: HTTPC リクエストとレスポンス処理ガイド。リクエストヘッダー設定、複数のリクエストボディ形式、クエリパラメータ、認証方式、Cookie 管理、ストリーミングレスポンスのコード例。
---

# リクエストとレスポンス

## リクエストの送信

### パッケージレベル関数

クライアントを作成せずに、直接リクエストを送信します：

```go
result, err := httpc.Get("https://api.example.com/data")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

fmt.Println(result.StatusCode())
fmt.Println(result.Body())
```

サポートされる HTTP メソッド：`Get`、`Post`、`Put`、`Patch`、`Delete`、`Head`、`Options`。

### クライアントインスタンス

```go
client, err := httpc.New()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://api.example.com/data")
```

### 汎用リクエストメソッド

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## リクエストオプション

### リクエストヘッダー

```go
result, err := client.Get(url,
    httpc.WithHeader("Authorization", "Bearer token"),
    httpc.WithHeader("X-Custom", "value"),
    httpc.WithHeaderMap(map[string]string{
        "Accept":        "application/json",
        "X-Request-ID":  "123",
    }),
    httpc.WithUserAgent("my-app/1.0"),
)
```

### リクエストボディ

```go
// JSON
result, err := client.Post(url, httpc.WithJSON(map[string]any{
    "name": "test",
}))

// XML
result, err := client.Post(url, httpc.WithXML(data))

// フォーム
result, err := client.Post(url, httpc.WithForm(map[string]string{
    "username": "admin",
    "password": "secret",
}))

// バイナリ（デフォルト application/octet-stream）
result, err := client.Post(url, httpc.WithBinary(data))
// タイプ指定
result, err := client.Post(url, httpc.WithBinary(data, "image/png"))

// タイプ自動検出
result, err := client.Post(url, httpc.WithBody(data))
// string → text/plain; charset=utf-8, []byte → application/octet-stream,
// map[string]string → application/x-www-form-urlencoded,
// *FormData → multipart/form-data, io.Reader → そのまま渡される,
// その他 → application/json
// 明示的な指定も可能: httpc.WithBody(data, httpc.BodyJSON)
```

### クエリパラメータ

```go
result, err := client.Get(url,
    httpc.WithQuery("page", 1),
    httpc.WithQuery("limit", 10),
)

// Map を使用する場合
result, err := client.Get(url,
    httpc.WithQueryMap(map[string]any{
        "page":  1,
        "limit": 10,
    }),
)
```

### 認証

```go
// Bearer Token
result, err := client.Get(url, httpc.WithBearerToken("my-token"))

// Basic Auth
result, err := client.Get(url, httpc.WithBasicAuth("user", "pass"))
```

### Cookie

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc"}),
    httpc.WithCookieMap(map[string]string{"session": "abc", "lang": "zh"}),
    httpc.WithCookieString("session=abc; lang=zh"),
)
```

### リクエスト制御

```go
// タイムアウト
result, err := client.Get(url, httpc.WithTimeout(10*time.Second))

// リトライ
result, err := client.Get(url, httpc.WithMaxRetries(5))

// リダイレクト
result, err := client.Get(url,
    httpc.WithFollowRedirects(false),    // リダイレクトを禁止
    httpc.WithMaxRedirects(3),           // 最大 3 回リダイレクト
)
```

### コールバック

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("リクエスト送信: %s %s", req.Method(), req.URL())
        return nil
    }),
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("レスポンス受信: %d", resp.StatusCode())
        return nil
    }),
)
```

## レスポンス処理

```go
result, err := client.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// ステータス確認
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsRedirect()     // false (3xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// レスポンスの読み取り
result.Body()           // 文字列
result.RawBody()        // []byte
result.Proto()          // "HTTP/1.1"

// JSON 解析
var user User
if err := result.Unmarshal(&user); err != nil {
    log.Fatal(err)
}

// Cookie
cookie := result.GetCookie("session")
if cookie != nil {
    fmt.Println(cookie.Value)
}

// リクエストメタデータ
fmt.Println(result.Meta.Duration)       // リクエスト所要時間
fmt.Println(result.Meta.Attempts)       // リトライ回数
fmt.Println(result.Meta.RedirectCount)  // リダイレクト回数
```

## コンテキスト制御

```go
// タイムアウト制御
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := httpc.Request(ctx, "GET", url)

// キャンセル制御
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(5 * time.Second)
    cancel() // 5 秒後にキャンセル
}()
result, err := httpc.Request(ctx, "GET", url)
```

## ストリーミングレスポンス

`WithStreamBody(true)` は内部メカニズムであり、ファイルダウンロード時に完全なレスポンスボディをメモリにキャッシュしないようにするためのものです。有効にすると、レスポンスボディは `Result` に読み込まれません（`Body()` と `RawBody()` は空の値を返します）。

:::warning 警告
`WithStreamBody(true)` はファイルダウンロード API（`DownloadFile`、`DownloadWithOptions`）が内部で使用します。レスポンスの内容をストリーミングで取得する必要がある場合は、[ファイルダウンロード API](./file-transfer) を使用してください。
:::

大きなファイルをダウンロードする場合は、ダウンロード API を使用してください：

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/path/to/file"
result, err := client.DownloadWithOptions(url, cfg)
```

## レスポンス解凍

HTTPC は gzip、deflate などのコンテンツエンコーディングの解凍を自動的に処理します。セキュリティ設定で解凍後のサイズを制限し、解凍爆弾攻撃を防ぐことができます：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024      // 圧縮ボディ最大 10MB
cfg.Security.MaxDecompressedBodySize = 100 * 1024 * 1024  // 解凍後最大 100MB
```

| 設定項目 | デフォルト値 | 説明 |
|----------|-------------|------|
| `MaxResponseBodySize` | 10MB | 元のレスポンスボディサイズの上限 |
| `MaxDecompressedBodySize` | 100MB | 解凍後のレスポンスボディサイズの上限 |

制限を超えると `"exceeds limit"` メッセージを含むエラーが返されます。`ClientError` タイプで確認して処理できます。`ErrResponseBodyTooLarge` は `Result.Unmarshal()` で 50MB の JSON サイズ制限を超えるレスポンスボディを解析する際に返されます（`MaxResponseBodySize` とは独立しています）。

## 次のステップ

- [ファイルアップロードとダウンロード](./file-transfer) - ファイル転送ガイド
- [ドメインクライアントとセッション](./domain-session) - セッション管理
- [リクエストオプション API](../api-reference/options) - 完全なオプションリファレンス
- [Result API](../api-reference/result) - レスポンス処理リファレンス

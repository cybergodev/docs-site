---
title: "リクエストオプション - HTTPC"
description: "HTTPC 27個のリクエストオプション関数APIリファレンス：WithHeaderリクエストヘッダー、WithBearerToken認証、WithJSON/WithXML/WithForm/WithBinary各種リクエストボディ、WithQueryクエリパラメータ、5種類のCookieオプションとWithOnRequest/WithOnResponseコールバック。"
---

# リクエストオプション

リクエストオプションは関数型の設定項目で、`RequestOption`タイプを通じてリクエストメソッドに渡し、きめ細かなリクエスト制御を実現します。

```go
result, err := client.Post(url,
    httpc.WithJSON(data),
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

すべてのオプションは自由に組み合わせ可能で、渡された順序で順次適用されます。

## リクエストヘッダー

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

単一のリクエストヘッダーを設定します。キーと値はセキュリティ検証を受けます（CRLFインジェクション防止）。

```go
result, err := client.Get(url,
    httpc.WithHeader("X-Custom", "value"),
)
```

### WithHeaderMap

```go
func WithHeaderMap(headers map[string]string) RequestOption
```

リクエストヘッダーを一括設定します。

```go
result, err := client.Get(url,
    httpc.WithHeaderMap(map[string]string{
        "Accept":        "application/json",
        "X-Request-ID":  "abc123",
    }),
)
```

### WithUserAgent

```go
func WithUserAgent(userAgent string) RequestOption
```

User-Agentヘッダーを設定します。`WithHeader("User-Agent", ...)`の便利なラッパーです。

## 認証

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

HTTP Basic認証を設定します。ユーザー名は空にできず、認証情報の長さに制限があります。

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

`Authorization: Bearer <token>`ヘッダーを設定します。Tokenは空にできません。

```go
result, err := client.Get(url,
    httpc.WithBearerToken("eyJhbGciOiJIUzI1NiIs..."),
)
```

## リクエストボディ

### WithJSON

```go
func WithJSON(data any) RequestOption
```

JSONリクエストボディを設定し、自動的に`Content-Type: application/json`を追加します。

```go
result, err := client.Post(url,
    httpc.WithJSON(map[string]any{
        "name":  "test",
        "email": "test@example.com",
    }),
)
```

### WithXML

```go
func WithXML(data any) RequestOption
```

XMLリクエストボディを設定し、自動的に`Content-Type: application/xml`を追加します。

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

URLエンコードフォームリクエストボディを設定し、自動的に`Content-Type: application/x-www-form-urlencoded`を追加します。

```go
result, err := client.Post(url,
    httpc.WithForm(map[string]string{
        "username": "admin",
        "password": "secret",
    }),
)
```

### WithFormData

```go
func WithFormData(data *FormData) RequestOption
```

`multipart/form-data`リクエストボディを設定します。ファイルとフィールドの混合アップロードをサポートします。

```go
result, err := client.Post(url,
    httpc.WithFormData(&httpc.FormData{
        Fields: map[string]string{"description": "upload"},
        Files: map[string]*httpc.FileData{
            "file": {Filename: "doc.pdf", Content: fileBytes},
        },
    }),
)
```

### WithFile

```go
func WithFile(fieldName, filename string, content []byte) RequestOption
```

簡単なファイルアップロード。自動的にmultipartリクエストボディを構築します。ファイル名はパストラバーサル防止処理を受けます。

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

バイナリリクエストボディを設定します。デフォルトのContent-Typeは`application/octet-stream`で、カスタマイズ可能です。

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

汎用リクエストボディ設定。自動検出と明示的なタイプ指定をサポートします。

**自動検出ルール**（デフォルト`BodyAuto`）：

| 入力タイプ | Content-Type |
|------------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `map[string]string` | application/x-www-form-urlencoded |
| `*FormData` | multipart/form-data |
| `io.Reader` | 設定しない（呼び出し元が処理） |
| その他のタイプ | application/json |

**明示的なタイプ指定**：

```go
// 自動検出（デフォルト）
result, _ := client.Post(url, httpc.WithBody(data))

// JSON強制
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// XML強制
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

| 定数 | 意味 |
|------|------|
| `BodyAuto` | 自動検出（デフォルト） |
| `BodyJSON` | JSON強制 |
| `BodyXML` | XML強制 |
| `BodyForm` | フォーム強制 |
| `BodyBinary` | バイナリ強制 |
| `BodyMultipart` | multipart強制（`*FormData`が必要） |

## クエリパラメータ

### WithQuery

```go
func WithQuery(key string, value any) RequestOption
```

単一のクエリパラメータを設定します。

```go
result, err := client.Get(url,
    httpc.WithQuery("page", 1),
    httpc.WithQuery("limit", 10),
)
```

### WithQueryMap

```go
func WithQueryMap(params map[string]any) RequestOption
```

クエリパラメータを一括設定します。

```go
result, err := client.Get(url,
    httpc.WithQueryMap(map[string]any{
        "page":  1,
        "limit": 10,
        "sort":  "created_at",
    }),
)
```

## Cookie

### WithCookie

```go
func WithCookie(cookie http.Cookie) RequestOption
```

単一のCookieを追加します。セキュリティ検証を受けます。

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc123"}),
)
```

### WithCookies

```go
func WithCookies(cookies []http.Cookie) RequestOption
```

Cookieを一括追加します。`WithCookie`の複数回呼び出しより効率的です。容量を事前に割り当て、一度の走査ですべてのCookieを検証します。

```go
cookies := []http.Cookie{
    {Name: "session_id", Value: "abc123"},
    {Name: "user_pref", Value: "dark_mode"},
    {Name: "lang", Value: "en"},
}
result, err := client.Get("https://api.example.com",
    httpc.WithCookies(cookies),
)
```

### WithCookieMap

```go
func WithCookieMap(cookies map[string]string) RequestOption
```

シンプルなCookieを一括追加します。name-valueのみ必要なシナリオに適しています。

```go
result, err := client.Get(url,
    httpc.WithCookieMap(map[string]string{
        "session_id": "abc123",
        "lang":       "ja",
    }),
)
```

### WithCookieString

```go
func WithCookieString(cookieString string) RequestOption
```

生のCookieヘッダー文字列からCookieを追加します。

```go
result, err := client.Get(url,
    httpc.WithCookieString("session=abc123; lang=ja"),
)
```

### WithSecureCookie

```go
func WithSecureCookie(securityConfig *CookieSecurityConfig) RequestOption
```

リクエストCookieのセキュリティ属性（Secure、HttpOnly、SameSite）の検証を強制します。

```go
result, err := client.Get(url,
    httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()),
)
```

## リクエスト制御

### WithContext

```go
func WithContext(ctx context.Context) RequestOption
```

リクエストコンテキストを設定します。タイムアウトとキャンセルをサポートします。コンテキストはnilにできません。

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

単一リクエストのタイムアウトを設定し、クライアントのデフォルトタイムアウトを上書きします。範囲：0〜30分。

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

単一リクエストの最大リトライ回数を設定し、クライアント設定を上書きします。範囲：0〜10。

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithFollowRedirects

```go
func WithFollowRedirects(follow bool) RequestOption
```

リダイレクトに追従するかどうかを制御します。

```go
// リダイレクト追従を禁止
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

単一リクエストの最大リダイレクト回数を設定します。範囲：0〜50。

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

ストリーミングモードを有効にします。レスポンスボディはメモリにキャッシュされません。ファイルダウンロードで内部的に使用され、大きなファイルによるメモリ消費を防ぎます。

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## コールバック

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

リクエスト送信前のコールバックを登録します。チェーン登録が可能で、追加した順序で実行されます。コールバックがエラーを返すとリクエストが中止されます。

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("送信 %s %s", req.Method(), req.URL())
        return nil
    }),
)
```

### WithOnResponse

```go
func WithOnResponse(callback func(resp ResponseMutator) error) RequestOption
```

レスポンス受信後のコールバックを登録します。チェーン登録が可能で、追加した順序で実行されます。

```go
result, err := client.Get(url,
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("レスポンス受信: %d %s", resp.StatusCode(), resp.Status())
        return nil
    }),
)
```

## 関連項目

- [定数とタイプ](./constants) - BodyKind定数とタイプエイリアス
- [インターフェース定義](./interfaces) - RequestMutator、ResponseMutatorインターフェース
- [リクエストとレスポンス](../guides/request-response) - リクエストオプション使用ガイド

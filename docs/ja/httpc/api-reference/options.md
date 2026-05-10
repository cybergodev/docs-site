---
title: リクエストオプション - HTTPC
description: HTTPC 27 個のリクエストオプション関数 API リファレンス。カテゴリ別にリクエストヘッダー、認証、複数のリクエストボディ形式、クエリパラメータ、Cookie 管理、コールバック関数。
---

# リクエストオプション

リクエストオプションは関数型の設定項目で、`RequestOption` タイプを通じてリクエストメソッドに渡し、きめ細かなリクエスト制御を実現します。

```go
result, err := client.Post(url,
    httpc.WithJSON(data),
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

全オプションは自由に組み合わせ可能で、渡された順序で順次適用されます。

## リクエストヘッダー

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

単一のリクエストヘッダーを設定。キーと値はセキュリティ検証を通過します（CRLF インジェクション防止）。

```go
result, err := client.Get(url,
    httpc.WithHeader("X-Custom", "value"),
)
```

### WithHeaderMap

```go
func WithHeaderMap(headers map[string]string) RequestOption
```

リクエストヘッダーを一括設定。

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

User-Agent ヘッダーを設定。`WithHeader("User-Agent", ...)` の便利なラッパー。

## 認証

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

HTTP Basic 認証を設定。ユーザー名は空にできず、認証情報の長さに制限があります。

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

`Authorization: Bearer <token>` ヘッダーを設定。Token は空にできません。

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

JSON リクエストボディを設定。`Content-Type: application/json` を自動追加。

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

XML リクエストボディを設定。`Content-Type: application/xml` を自動追加。

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

URL エンコードフォームリクエストボディを設定。`Content-Type: application/x-www-form-urlencoded` を自動追加。

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

`multipart/form-data` リクエストボディを設定。ファイルとフィールドの混在アップロードをサポート。

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

便利なファイルアップロード。multipart リクエストボディを自動構築。ファイル名はパストラバーサル防止処理を通過します。

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

バイナリリクエストボディを設定。デフォルトの Content-Type は `application/octet-stream`。カスタマイズ可能。

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

汎用リクエストボディ設定。タイプの自動検出と明示指定をサポート。

**自動検出ルール**（デフォルト `BodyAuto`）：

| 入力タイプ | Content-Type |
|------------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `map[string]string` | application/x-www-form-urlencoded |
| `*FormData` | multipart/form-data |
| `io.Reader` | 設定なし（呼び出し側で処理） |
| その他の型 | application/json |

**明示指定タイプ**：

```go
// 自動検出（デフォルト）
result, _ := client.Post(url, httpc.WithBody(data))

// JSON 強制
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// XML 強制
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

| 定数 | 意味 |
|------|------|
| `BodyAuto` | 自動検出（デフォルト） |
| `BodyJSON` | JSON 強制 |
| `BodyXML` | XML 強制 |
| `BodyForm` | フォーム強制 |
| `BodyBinary` | バイナリ強制 |
| `BodyMultipart` | multipart 強制（`*FormData` が必要） |

## クエリパラメータ

### WithQuery

```go
func WithQuery(key string, value any) RequestOption
```

単一のクエリパラメータを設定。

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

クエリパラメータを一括設定。

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

単一の Cookie を追加。セキュリティ検証を通過。

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc123"}),
)
```

### WithCookies

```go
func WithCookies(cookies []http.Cookie) RequestOption
```

Cookie を一括追加。`WithCookie` を複数回呼び出すより効率的 -- 容量を事前割り当てし、単一の走査ですべての Cookie を検証します。

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

シンプルな Cookie を一括追加。name-value のみ必要な場面に適しています。

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

生の Cookie ヘッダー文字列から Cookie を追加。

```go
result, err := client.Get(url,
    httpc.WithCookieString("session=abc123; lang=ja"),
)
```

### WithSecureCookie

```go
func WithSecureCookie(securityConfig *CookieSecurityConfig) RequestOption
```

リクエスト Cookie のセキュリティ属性（Secure、HttpOnly、SameSite）を強制検証。

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

リクエストコンテキストを設定。タイムアウトとキャンセルをサポート。コンテキストは nil にできません。

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

単一リクエストのタイムアウトを設定。クライアントのデフォルトタイムアウトを上書き。範囲：0 ～ 30 分。

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

単一リクエストの最大リトライ回数を設定。クライアント設定を上書き。範囲：0-10。

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithFollowRedirects

```go
func WithFollowRedirects(follow bool) RequestOption
```

リダイレクトの追従を制御。

```go
// リダイレクト追従を無効化
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

単一リクエストの最大リダイレクト回数を設定。範囲：0-50。

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

ストリーミングモードを有効化。レスポンスボディをメモリにキャッシュしません。ファイルダウンロードで大ファイルのメモリ消費を防ぐために内部使用。

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## コールバック

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

リクエスト送信前のコールバックを登録。複数のチェーン登録が可能で、追加順に実行。コールバックがエラーを返すとリクエストが中止されます。

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

レスポンス受信後のコールバックを登録。複数のチェーン登録が可能で、追加順に実行。

```go
result, err := client.Get(url,
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("レスポンス受信: %d %s", resp.StatusCode(), resp.Status())
        return nil
    }),
)
```

## 関連項目

- [定数とタイプ](./constants) - BodyKind 定数とタイプエイリアス
- [インターフェース定義](./interfaces) - RequestMutator、ResponseMutator インターフェース
- [リクエストとレスポンス](../guides/request-response) - リクエストオプション使用ガイド

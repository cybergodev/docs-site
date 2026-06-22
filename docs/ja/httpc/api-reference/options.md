---
title: "リクエストオプション - CyberGo HTTPC | WithXxxオプション"
description: "HTTPC リクエストオプション API リファレンス: WithHeader ヘッダー、WithBearerToken 認証、WithJSON/WithForm リクエストボディ、WithQuery パラメータ、コールバック関数の完全な使い方を提供します。"
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

すべてのオプションは自由に組み合わせ可能で、渡された順に適用されます。

## リクエストヘッダー

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

単一のリクエストヘッダーを設定します。キーと値はセキュリティ検証を通過します（CRLF インジェクション対策）。

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

User-Agent ヘッダーを設定します。`WithHeader("User-Agent", ...)` の便利なラッパーです。

## 認証

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

HTTP Basic 認証を設定します。ユーザー名は空にできず、認証情報の長さに制限があります。

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

`Authorization: Bearer <token>` ヘッダーを設定します。Token は空にできません。

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

JSON リクエストボディを設定します。自動的に `Content-Type: application/json` が追加されます。

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

XML リクエストボディを設定します。自動的に `Content-Type: application/xml` が追加されます。

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

URL エンコードフォームのリクエストボディを設定します。自動的に `Content-Type: application/x-www-form-urlencoded` が追加されます。

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

`multipart/form-data` リクエストボディを設定します。ファイルとフィールドの混合アップロードに対応します。

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

ファイルアップロードの便利な関数。自動的に multipart リクエストボディを構築します。ファイル名はパストラバーサル対策の処理を通過します。

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

バイナリリクエストボディを設定します。デフォルトの Content-Type は `application/octet-stream` で、カスタマイズ可能です。

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

汎用リクエストボディ設定。自動検出と明示的なタイプ指定に対応します。

**自動検出ルール**（デフォルト `BodyAuto`）：

| 入力タイプ | Content-Type |
|-----------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `map[string]string` | application/x-www-form-urlencoded |
| `*FormData` | multipart/form-data |
| `io.Reader` | 設定なし（呼び出し元が処理） |
| その他のタイプ | application/json |

**明示的なタイプ指定**：

```go
// 自動検出（デフォルト）
result, _ := client.Post(url, httpc.WithBody(data))

// JSON を強制
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// XML を強制
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

| 定数 | 意味 |
|------|------|
| `BodyAuto` | 自動検出（デフォルト） |
| `BodyJSON` | JSON を強制 |
| `BodyXML` | XML を強制 |
| `BodyForm` | フォームを強制 |
| `BodyBinary` | バイナリを強制 |
| `BodyMultipart` | multipart を強制（`*FormData` が必要） |

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

単一の Cookie を追加します。セキュリティ検証を通過します。

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc123"}),
)
```

### WithCookies

```go
func WithCookies(cookies []http.Cookie) RequestOption
```

Cookie を一括追加します。`WithCookie` を複数回呼び出すよりも効率的です。容量を事前に割り当て、1 回の走査ですべての Cookie を検証します。

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

シンプルな Cookie を一括追加します。name-value のみが必要なケースに適しています。

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

生の Cookie ヘッダー文字列から Cookie を追加します。

```go
result, err := client.Get(url,
    httpc.WithCookieString("session=abc123; lang=ja"),
)
```

### WithSecureCookie

```go
func WithSecureCookie(securityConfig *CookieSecurityConfig) RequestOption
```

リクエスト Cookie のセキュリティ属性（Secure、HttpOnly、SameSite）の検証を強制します。

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

リクエストコンテキストを設定します。タイムアウトとキャンセルに対応します。コンテキストは nil にできません。

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

単一リクエストのタイムアウトを設定します。クライアントのデフォルトタイムアウトをオーバーライドします。範囲：0 ～ 30 分。

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

単一リクエストの最大リトライ回数を設定します。クライアント設定をオーバーライドします。範囲：0-10。

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

単一リクエストの最大リダイレクト回数を設定します。範囲：0-50。

### WithAllowPrivateIPs

```go
func WithAllowPrivateIPs(allow bool) RequestOption
```

単一リクエストでクライアントの SSRF ポリシーを上書きします。`allow` が `true` の場合、そのリクエストは localhost やプライベート/予約済み IP 範囲（127.0.0.0/8、10.0.0.0/8、192.168.0.0/16、169.254.0.0/16 など）にアクセスでき、この種のアドレスへのリダイレクトも追従します。`false` の場合、クライアントで `Security.AllowPrivateIPs=true` が設定されていても、当該リクエストでは SSRF 防護が強制的に有効になります。

:::warning セキュリティヒント
これは SSRF 防護の**単一リクエスト用エスケープハッチ**であり、デフォルトで安全なクライアント（`AllowPrivateIPs=false`）が時折内部サービス、ループバックアドレス、ローカル開発サーバーにアクセスする必要がある场景に適しています。

リクエスト URL が信頼でき、かつ信頼できないユーザー入力に由来するもので**ない**場合にのみ有効にしてください。クライアント全体で内部サービスへのアクセスが必要な場合は、`Config` で直接 `Security.AllowPrivateIPs=true` を設定してください。
:::

```go
// デフォルトクライアントはプライベート IP をブロック。この呼び出しではリクエスト単位で許可
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

ストリーミングモードを有効にします。レスポンスボディはメモリにキャッシュされません。内部的にファイルダウンロードで使用され、大きなファイルのメモリ消費を防ぎます。

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## コールバック

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

リクエスト送信前のコールバックを登録します。チェーン登録が可能で、追加順に実行されます。コールバックがエラーを返すとリクエストが中止されます。

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

レスポンス受信後のコールバックを登録します。チェーン登録が可能で、追加順に実行されます。

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
- [リクエストとレスポンス](../guides/request-response) - リクエストオプションの使用ガイド

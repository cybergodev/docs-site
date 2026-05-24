---
title: "ドメインクライアント - HTTPC"
description: "HTTPCドメインクライアントAPIリファレンス：NewDomain作成関数、Get/Postなど7種類のHTTPメソッドとRequest汎用メソッド、4種類のダウンロードメソッド、URL自動結合ルール、DomainClienterインターフェースのSetHeader/SetCookieセッション管理とCloseライフサイクル。"
---

# ドメインクライアント

ドメインクライアントは特定のドメインに対するリクエスト管理を提供し、Cookieとヘッダーを自動的に維持します。

## NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

ドメインスコープのクライアントを作成します。Cookieは自動的に有効になります。

```go
// デフォルト設定を使用
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// カスタム設定を使用
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
dc, err := httpc.NewDomain("https://api.example.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer dc.Close()
```

**パラメータの説明：**

| パラメータ | タイプ | 説明 |
|------------|--------|------|
| `baseURL` | `string` | ベースURL（schemeとhostを含める必要があります） |
| `config` | `...*Config` | オプション設定。省略時はDefaultConfig()を使用 |

**戻り値：** `DomainClienter`インターフェース（具象タイプ`*DomainClient`ではありません）。

## HTTPメソッド

すべてのメソッドは相対パスまたは絶対URLを受け付けます：

```go
// 相対パス：baseURLと自動結合
result, err := dc.Get("/users")
result, err := dc.Post("/users", httpc.WithJSON(data))
result, err := dc.Put("/users/1", httpc.WithJSON(data))
result, err := dc.Patch("/users/1", httpc.WithJSON(data))
result, err := dc.Delete("/users/1")
result, err := dc.Head("/users/1")
result, err := dc.Options("/users")

// 絶対URL：そのまま使用
result, err := dc.Get("https://other-api.com/data")
```

### Request

```go
result, err := dc.Request(ctx, "GET", "/users", options...)
```

コンテキスト付きの汎用リクエストメソッド。タイムアウトとキャンセル制御をサポートします。

## ダウンロードメソッド

```go
// 基本ダウンロード
result, err := dc.DownloadFile("/files/report.pdf", "/tmp/report.pdf")

// 設定付きダウンロード
result, err := dc.DownloadWithOptions("/files/report.pdf", downloadOpts)

// コンテキスト付き
result, err := dc.DownloadFileWithContext(ctx, "/files/report.pdf", "/tmp/report.pdf")
result, err := dc.DownloadWithOptionsWithContext(ctx, "/files/report.pdf", downloadOpts)
```

ダウンロードのレスポンスCookieは自動的にセッションにキャプチャされます。

## アクセスメソッド

```go
dc.URL()      // string - ベースURL
dc.Domain()   // string - ドメイン（ポートを含まない）
dc.Session()  // *SessionManager - 内部セッションマネージャー
dc.Close()    // error - クライアントを閉じてリソースを解放
```

## URL結合ルール

| 入力パス | 結合結果（baseURL = `https://api.example.com/v1`） |
|----------|------|
| `/users` | `https://api.example.com/v1/users` |
| `users` | `https://api.example.com/v1/users` |
| `/users?page=1` | `https://api.example.com/v1/users?page=1` |
| `https://other.com/api` | `https://other.com/api`（絶対URL） |

:::warning 警告
`http://`と`https://`プロトコルの絶対URLのみ許可されます。その他のプロトコルは拒否されます（SSRF防止）。
:::

## DomainClienterインターフェース

```go
type DomainClienter interface {
    Client

    URL() string
    Domain() string

    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    Session() *SessionManager
}
```

テストや実装の差し替えに便利なインターフェースタイプの使用をお勧めします。

## 関連項目

- [セッション管理](./session) - SessionManagerの詳細リファレンス
- [ドメインクライアントとセッション](../guides/domain-session) - 使用ガイド
- [インターフェース定義](./interfaces) - Client、Doerインターフェースリファレンス

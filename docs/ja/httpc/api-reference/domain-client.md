---
title: ドメインクライアント - HTTPC
description: HTTPC ドメインクライアント API リファレンス。NewDomain 作成、7 種類の HTTP メソッド、4 種類のダウンロードメソッド、URL 自動結合、セッションヘッダーと Cookie 管理。
---

# ドメインクライアント

ドメインクライアントは、特定ドメインに対するリクエスト管理を提供し、Cookie とリクエストヘッダーを自動的に維持します。

## NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

ドメインスコープクライアントを作成します。Cookie は自動的に有効になります。

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

**パラメータ説明：**

| パラメータ | 型 | 説明 |
|------|------|------|
| `baseURL` | `string` | ベース URL（scheme と host を含める必要があります） |
| `config` | `...*Config` | オプション設定。省略時は DefaultConfig() を使用 |

**戻り値：** `DomainClienter` インターフェース（具象型 `*DomainClient` ではありません）。

## HTTP メソッド

すべてのメソッドは相対パスまたは絶対 URL を受け付けます：

```go
// 相対パス：baseURL に自動結合
result, err := dc.Get("/users")
result, err := dc.Post("/users", httpc.WithJSON(data))
result, err := dc.Put("/users/1", httpc.WithJSON(data))
result, err := dc.Patch("/users/1", httpc.WithJSON(data))
result, err := dc.Delete("/users/1")
result, err := dc.Head("/users/1")
result, err := dc.Options("/users")

// 絶対 URL：そのまま使用
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

ダウンロード時のレスポンス Cookie はセッションに自動的にキャプチャされます。

## アクセスメソッド

```go
dc.URL()      // string - ベース URL
dc.Domain()   // string - ドメイン（ポート番号なし）
dc.Session()  // *SessionManager - 内部セッションマネージャー
dc.Close()    // error - クライアントを閉じてリソースを解放
```

## URL 結合ルール

| 入力パス | 結合結果（baseURL = `https://api.example.com/v1`） |
|----------|------|
| `/users` | `https://api.example.com/v1/users` |
| `users` | `https://api.example.com/v1/users` |
| `/users?page=1` | `https://api.example.com/v1/users?page=1` |
| `https://other.com/api` | `https://other.com/api`（絶対 URL） |

:::warning
`http://` と `https://` プロトコルの絶対 URL のみ許可されます。その他のプロトコルは拒否されます（SSRF 攻撃を防止）。
:::

## DomainClienter インターフェース

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

テストや実装の差し替えに便利なため、具象型ではなくインターフェース型の使用を推奨します。

## 関連項目

- [セッション管理](./session) - SessionManager 詳細リファレンス
- [ドメインクライアントとセッション](../guides/domain-session) - 使用ガイド
- [インターフェース定義](./interfaces) - Client、Doer インターフェースリファレンス

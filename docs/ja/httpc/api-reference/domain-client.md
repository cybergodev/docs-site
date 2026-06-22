---
title: "ドメインクライアント - CyberGo HTTPC | NewDomainとセッション"
description: "HTTPC ドメインクライアント API リファレンス: NewDomain 作成、7 種類の HTTP メソッドと Request メソッド、URL 自動結合、SetHeader/SetCookie セッション管理、Close ライフサイクルの完全な使い方を提供します。"
---

# ドメインクライアント

ドメインクライアントは特定ドメインに対するリクエスト管理を提供し、Cookie とヘッダーを自動的に維持します。

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

**パラメータの説明：**

| パラメータ | タイプ | 説明 |
|-----------|--------|------|
| `baseURL` | `string` | ベース URL（scheme と host を含む必要があります） |
| `config` | `...*Config` | オプション設定。省略時は DefaultConfig() を使用 |

**戻り値：** `DomainClienter` インターフェース（具象タイプ `*DomainClient` ではありません）。

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

コンテキスト付きの汎用リクエストメソッド。タイムアウトとキャンセル制御に対応します。

## ダウンロードメソッド

```go
func (dc *DomainClient) Download(ctx context.Context, path string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

ファイルを `cfg.FilePath` にダウンロードします。`path` は `baseURL` に対して相対的に結合されます。パッケージレベルの `Download` および `Client.Download` とシグネチャが同一であり、`Download` はこれら 3 つを貫く唯一の正規ダウンロードエントリです。`cfg` を nil にすることはできず、`cfg.FilePath` の設定が必須です（未設定の場合は `ErrEmptyFilePath` を返します）。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"
cfg.Overwrite = true

result, err := dc.Download(ctx, "/files/report.pdf", cfg)
```

ダウンロードのレスポンス Cookie はセッションに自動的にキャプチャされます。

## アクセスメソッド

```go
dc.URL()      // string - ベース URL
dc.Domain()   // string - ドメイン（ポートを含まない）
dc.Session()  // *SessionManager - 内部セッションマネージャー
dc.Close()    // error - クライアントをクローズしてリソースを解放
```

## URL 結合ルール

| 入力パス | 結合結果（baseURL = `https://api.example.com/v1`） |
|---------|------|
| `/users` | `https://api.example.com/v1/users` |
| `users` | `https://api.example.com/v1/users` |
| `/users?page=1` | `https://api.example.com/v1/users?page=1` |
| `https://other.com/api` | `https://other.com/api`（絶対 URL） |

:::warning
`http://` と `https://` プロトコルの絶対 URL のみ許可されます。その他のプロトコルは拒否されます（SSRF 対策）。
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

テストや実装の差し替えに便利なインターフェースタイプの使用を推奨します。

## 関連項目

- [セッション管理](./session) - SessionManager の詳細リファレンス
- [ドメインクライアントとセッション](../guides/domain-session) - 使用ガイド
- [インターフェース定義](./interfaces) - Client、Doer インターフェースリファレンス

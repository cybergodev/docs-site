---
title: "ドメインクライアントとセッション - CyberGo HTTPC | セッションとドメイン"
description: "HTTPC ドメインクライアントとセッションガイド: NewDomain によるドメインスコープクライアント作成、URL 自動結合、SetHeader ヘッダー維持、Cookie セキュリティ検証、REST API クライアントラッパーの実践例を解説します。"
---

# ドメインクライアントとセッション

ドメインクライアント（DomainClient）は同一ドメインに対するセッション管理クライアントで、Cookie とヘッダーを自動的に維持します。

## ドメインクライアントの作成

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Cookie は自動的に有効
dc.SetHeader("Authorization", "Bearer "+token)

// 相対パスでリクエストを送信
result, err := dc.Get("/users")
```

:::tip
`NewDomain` は自動的に Cookie 管理を有効にします（`EnableCookies = true`）。手動設定は不要です。
:::

## セッションヘッダー管理

```go
// セッションヘッダーの設定（以降のすべてのリクエストに自動付与）
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// 一括設定
dc.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
    "X-Version":     "2.0",
})

// 削除とクリア
dc.DeleteHeader("X-Version")
dc.ClearHeaders()

// 取得
headers := dc.GetHeaders()
```

## Cookie 管理

```go
// Cookie の設定
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc123"})

// 一括設定
dc.SetCookies([]*http.Cookie{
    {Name: "session", Value: "abc123"},
    {Name: "lang", Value: "ja"},
})

// レスポンス Cookie の自動キャプチャ
result, _ := dc.Get("/login")
// サーバーが返す Set-Cookie は自動的にセッションに保存

// 取得
cookie := dc.GetCookie("session")
cookies := dc.GetCookies()

// 削除とクリア
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::tip
リクエストのたびに、サーバーが返す Cookie が自動的にセッションに更新されるため、手動で処理する必要はありません。
:::

## リクエスト方法

```go
// 相対パス
result, _ := dc.Get("/users")
result, _ := dc.Post("/users", httpc.WithJSON(data))
result, _ := dc.Put("/users/1", httpc.WithJSON(data))
result, _ := dc.Patch("/users/1", httpc.WithJSON(data))
result, _ := dc.Delete("/users/1")
result, _ := dc.Head("/users/1")
result, _ := dc.Options("/users")

// コンテキスト付き
result, _ := dc.Request(ctx, "GET", "/users")

// 絶対 URL（ベース URL の結合をスキップ）
result, _ := dc.Get("https://other-api.com/data")
```

## セッションアクセス

```go
// 基本情報の取得
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com"

// 内部 SessionManager へのアクセス
session := dc.Session()
if err := session.SetHeader("X-Trace-ID", traceID); err != nil {
    log.Fatal(err)
}
```

## Cookie セキュリティ検証

Cookie セキュリティポリシーを設定して、セキュリティ基準に準拠する Cookie のみを受け付けることができます：

```go
dc, _ := httpc.NewDomain("https://api.example.com")

// 厳格な Cookie セキュリティを設定
session := dc.Session()
session.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
// 要求: Secure=true, HttpOnly=true, SameSite=Strict

// セキュリティ要件を満たさない Cookie は SetCookie でエラーを返す
if err := dc.SetCookie(&http.Cookie{
    Name:  "insecure",
    Value: "test",
    // Secure, HttpOnly が不足 → 拒否される
}); err != nil {
    log.Println("Cookie が拒否されました:", err)
}
```

## 完全な例：REST API クライアント

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

func main() {
    // ドメインクライアントの作成
    dc, err := httpc.NewDomain("https://api.example.com")
    if err != nil {
        log.Fatal(err)
    }
    defer dc.Close()

    // ログインして Token を取得
    loginResult, err := dc.Post("/auth/login", httpc.WithJSON(map[string]string{
        "username": "admin",
        "password": "secret",
    }))
    if err != nil {
        log.Fatal(err)
    }

    // レスポンスから Token を解析
    var loginResp struct {
        Token string `json:"token"`
    }
    if err := loginResult.Unmarshal(&loginResp); err != nil {
        log.Fatal(err)
    }

    // セッションヘッダーの設定
    if err := dc.SetHeader("Authorization", "Bearer "+loginResp.Token); err != nil {
        log.Fatal(err)
    }

    // 以降のリクエストには自動的に Token と Cookie が付与される
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    users, err := dc.Request(ctx, "GET", "/users")
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println(users.StatusCode()) // 200
}
```

## 次のステップ

- [ドメインクライアント API](../api-reference/domain-client) - 完全な API リファレンス
- [セッション管理 API](../api-reference/session) - SessionManager リファレンス
- [リクエストとレスポンス](./request-response) - 基本リクエストガイド

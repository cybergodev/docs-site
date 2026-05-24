---
title: "ドメインクライアントとセッション - HTTPC"
description: "HTTPCドメインクライアントとセッション管理ガイド：NewDomain作成、URL自動結合、セッションヘッダーとCookieの自動維持、セキュリティ設定の使用方法。"
---

# ドメインクライアントとセッション

ドメインクライアント（DomainClient）は同じドメインに対するセッション管理クライアントで、Cookieとヘッダーを自動的に維持します。

## ドメインクライアントの作成

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Cookieは自動的に有効化
dc.SetHeader("Authorization", "Bearer "+token)

// 相対パスでリクエストを送信
result, err := dc.Get("/users")
```

:::tip ヒント
`NewDomain`は自動的にCookie管理を有効にします（`EnableCookies = true`）。手動設定は不要です。
:::

## セッションヘッダー管理

```go
// セッションヘッダーの設定（以降の全リクエストに自動付与）
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

// 照会
headers := dc.GetHeaders()
```

## Cookie管理

```go
// Cookieの設定
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc123"})

// 一括設定
dc.SetCookies([]*http.Cookie{
    {Name: "session", Value: "abc123"},
    {Name: "lang", Value: "ja"},
})

// レスポンスCookieの自動キャプチャ
result, _ := dc.Get("/login")
// サーバーが返すSet-Cookieは自動的にセッションに保存

// 照会
cookie := dc.GetCookie("session")
cookies := dc.GetCookies()

// 削除とクリア
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::tip ヒント
各リクエスト後、サーバーが返すCookieは自動的にセッションに更新されるため、手動処理は不要です。
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

// 絶対URL（ベースURLの結合をスキップ）
result, _ := dc.Get("https://other-api.com/data")
```

## セッションアクセス

```go
// 基本情報の取得
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com"

// 内部SessionManagerへのアクセス
session := dc.Session()
if err := session.SetHeader("X-Trace-ID", traceID); err != nil {
    log.Fatal(err)
}
```

## Cookieセキュリティ検証

Cookieセキュリティポリシーを設定し、セキュリティ基準に準拠するCookieのみ受け付けます：

```go
dc, _ := httpc.NewDomain("https://api.example.com")

// 厳格なCookieセキュリティを設定
session := dc.Session()
session.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
// 要求: Secure=true, HttpOnly=true, SameSite=Strict

// セキュリティ要件を満たさないCookieはSetCookieでエラーが返される
if err := dc.SetCookie(&http.Cookie{
    Name:  "insecure",
    Value: "test",
    // Secure, HttpOnlyが不足 → 拒否される
}); err != nil {
    log.Println("Cookieが拒否されました:", err)
}
```

## 完全な例：REST APIクライアント

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
    // ドメインクライアントを作成
    dc, err := httpc.NewDomain("https://api.example.com")
    if err != nil {
        log.Fatal(err)
    }
    defer dc.Close()

    // ログインしてTokenを取得
    loginResult, err := dc.Post("/auth/login", httpc.WithJSON(map[string]string{
        "username": "admin",
        "password": "secret",
    }))
    if err != nil {
        log.Fatal(err)
    }

    // レスポンスからTokenを解析
    var loginResp struct {
        Token string `json:"token"`
    }
    if err := loginResult.Unmarshal(&loginResp); err != nil {
        log.Fatal(err)
    }
    httpc.ReleaseResult(loginResult)

    // セッションヘッダーを設定
    if err := dc.SetHeader("Authorization", "Bearer "+loginResp.Token); err != nil {
        log.Fatal(err)
    }

    // 以降のリクエストには自動的にTokenとCookieが付与される
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    users, err := dc.Request(ctx, "GET", "/users")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(users)

    fmt.Println(users.StatusCode()) // 200
}
```

## 次のステップ

- [ドメインクライアントAPI](../api-reference/domain-client) - 完全なAPIリファレンス
- [セッション管理API](../api-reference/session) - SessionManagerリファレンス
- [リクエストとレスポンス](./request-response) - 基本的なリクエストガイド

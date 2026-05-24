---
title: "クイックスタート - HTTPC"
description: "5分でHTTPCセキュアHTTPクライアントライブラリを始めましょう。go getインストール、GET/POSTリクエスト、5つの設定プリセット、JSON解析、Bearer Token認証、ClientErrorエラー分類処理をカバーします。"
---

# クイックスタート

## インストール

```bash
go get github.com/cybergodev/httpc
```

## 基本的なリクエスト

クライアントを作成せず、パッケージ関数を直接使用：

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://httpbin.org/get")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())       // レスポンス内容
}
```

対応HTTPメソッド：`Get`、`Post`、`Put`、`Patch`、`Delete`、`Head`、`Options`。

## クライアントの作成

カスタム設定が必要な場合、クライアントインスタンスを作成：

```go
client, err := httpc.New()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://httpbin.org/get")
```

### プリセット設定

| 設定 | 用途 | 特徴 |
|------|------|------|
| `DefaultConfig()` | 汎用シナリオ | 安全なデフォルト値、SSRF防御有効 |
| `SecureConfig()` | セキュリティ重視 | 自動リダイレクト無効、厳格なタイムアウト |
| `PerformanceConfig()` | 高スループット | 大規模接続プール、長いタイムアウト、Cookie有効 |
| `TestingConfig()` | テスト環境 | セキュリティチェックとHTTP/2無効、短いタイムアウト |
| `MinimalConfig()` | 軽量リクエスト | リトライなし、リダイレクトなし |

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second

client, err := httpc.New(cfg)
```

## レスポンス処理

```go
result, err := client.Get("https://httpbin.org/json")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// ステータス確認
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// JSON解析
var data map[string]any
if err := result.Unmarshal(&data); err != nil {
    log.Fatal(err)
}
```

## データの送信

```go
// JSON
result, err := client.Post("https://httpbin.org/post",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

```go
// フォーム
result, err := client.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{"username": "admin"}),
)
```

```go
// 認証付き
result, err := client.Get("https://api.example.com/data",
    httpc.WithBearerToken("my-token"),
)
```

## エラー処理

HTTPCは**ネットワーク層エラー**と**HTTPステータスコード**を区別します：

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("エラーコード: %s", clientErr.Code())
    }
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// HTTPステータスコードは手動で確認
switch {
case result.IsSuccess():
    // 2xx 成功
case result.IsClientError():
    log.Printf("クライアントエラー: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("サーバーエラー: %d", result.StatusCode())
}
```

:::tip ヒント
4xx/5xxは`error`として返されません。`result.IsSuccess()`などのメソッドで確認します。詳しくは[エラー処理](./advanced/error-handling)をご覧ください。
:::

## 次のステップ

- **[チュートリアル](./guides/tutorial)** - 30分でGitHub APIクライアントを構築
- **[リクエストとレスポンス](./guides/request-response)** - 完全なリクエストオプションとレスポンス処理
- **[基本例](./examples/basic-usage)** - GET/POST/ミドルウェアなどの実例
- **[チートシート](./cheatsheet)** - よく使う操作のクイックリファレンス
- **[セキュリティ](./security/)** - セキュリティベストプラクティス

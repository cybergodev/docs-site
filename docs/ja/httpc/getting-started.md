---
title: クイックスタート - HTTPC
description: 5 分で HTTPC 安全 HTTP クライアントライブラリに素早く習得。モジュールのインストール、GET/POST リクエスト、クライアント設定、JSON 解析、エラー処理を網羅。
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
    fmt.Println(result.Body())       // レスポンス本文
}
```

対応 HTTP メソッド：`Get`、`Post`、`Put`、`Patch`、`Delete`、`Head`、`Options`。

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
| `DefaultConfig()` | 汎用シナリオ | セキュアなデフォルト値、SSRF 防護有効 |
| `SecureConfig()` | セキュリティ重要シナリオ | 自動リダイレクト無効、厳格なタイムアウト |
| `PerformanceConfig()` | 高スループット | 大規模コネクションプール、長いタイムアウト、Cookie 有効 |
| `TestingConfig()` | テスト環境 | セキュリティチェックと HTTP/2 無効、短いタイムアウト |
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

// JSON パース
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

HTTPC は**ネットワーク層エラー**と **HTTP ステータスコード**を区別します：

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

// HTTP ステータスコードは手動で確認
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
4xx/5xx は `error` として返されません。`result.IsSuccess()` などのメソッドで確認してください。詳しくは[エラー処理](./advanced/error-handling)を参照してください。
:::

## 次のステップ

- **[チュートリアル](./guides/tutorial)** - 30 分で GitHub API クライアントを構築
- **[リクエストとレスポンス](./guides/request-response)** - 完全なリクエストオプションとレスポンス処理
- **[基本サンプル](./examples/basic-usage)** - GET/POST/ミドルウェアなどの実用例
- **[チートシート](./cheatsheet)** - よく使う操作のクイックリファレンス
- **[セキュリティ](./security/)** - セキュリティベストプラクティス

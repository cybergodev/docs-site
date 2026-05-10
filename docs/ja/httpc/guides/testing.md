---
title: テストガイド - HTTPC
description: HTTPC テストガイド。TestingConfig 設定、httptest.Server シミュレーション、テーブル駆動テスト、ネットワークエラーシミュレーションとクライアントリソースクリーンアップ。
---

# テストガイド

## TestingConfig

`TestingConfig()` はテスト環境向けに設計されており、セキュリティチェックを無効化し、タイムアウトを短縮してテストの実行を高速化します：

```go
func TestAPI(t *testing.T) {
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("http://localhost:8080/test")
    // ...
}
```

:::danger 危険
`TestingConfig` は TLS 検証、SSRF 防護などのセキュリティ機能を無効にします。**テスト環境でのみ使用してください**。テスト以外の環境で使用すると、セキュリティ警告が表示されます。
:::

## httptest.Server との統合

標準ライブラリ `net/http/httptest` を使用してモックサーバーを作成し、実際のバックエンドなしでインテグレーションテストを実行します：

```go
package main

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/cybergodev/httpc"
)

func TestGetUser(t *testing.T) {
    // モックサーバーの作成
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/users/1" {
            t.Errorf("unexpected path: %s", r.URL.Path)
        }
        if r.Header.Get("Authorization") != "Bearer test-token" {
            t.Errorf("missing auth header")
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]any{
            "id":   1,
            "name": "Test User",
        })
    }))
    defer server.Close()

    // TestingConfig を使用してクライアントを作成
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    // モックサーバーにリクエストを送信
    result, err := client.Get(server.URL+"/users/1",
        httpc.WithBearerToken("test-token"),
    )
    if err != nil {
        t.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    if !result.IsSuccess() {
        t.Fatalf("expected success, got %d", result.StatusCode())
    }

    var user struct {
        ID   int    `json:"id"`
        Name string `json:"name"`
    }
    if err := result.Unmarshal(&user); err != nil {
        t.Fatal(err)
    }

    if user.Name != "Test User" {
        t.Errorf("expected Test User, got %s", user.Name)
    }
}
```

## 様々なシナリオのシミュレーション

### エラーレスポンスのシミュレーション

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusNotFound)
    json.NewEncoder(w).Encode(map[string]string{
        "error": "user not found",
    })
}))
defer server.Close()
```

### 遅延のシミュレーション

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    time.Sleep(5 * time.Second)
    w.WriteHeader(http.StatusOK)
}))
defer server.Close()

// タイムアウト処理のテスト
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
defer cancel()

_, err := httpc.Request(ctx, "GET", server.URL)
if err == nil {
    t.Fatal("expected timeout error")
}
```

### リダイレクトのシミュレーション

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    switch r.URL.Path {
    case "/old":
        http.Redirect(w, r, "/new", http.StatusMovedPermanently)
    case "/new":
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("redirected"))
    }
}))
defer server.Close()
```

### ファイルアップロードのシミュレーション

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        t.Errorf("expected POST, got %s", r.Method)
    }

    // multipart フォームの解析
    r.ParseMultipartForm(10 << 20)
    file, header, err := r.FormFile("upload")
    if err != nil {
        t.Fatal(err)
    }
    defer file.Close()

    if header.Filename != "test.txt" {
        t.Errorf("expected test.txt, got %s", header.Filename)
    }

    w.WriteHeader(http.StatusOK)
}))
defer server.Close()
```

## テーブル駆動テスト

```go
func TestHTTPMethods(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte(r.Method))
    }))
    defer server.Close()

    client, _ := httpc.New(httpc.TestingConfig())
    defer client.Close()

    tests := []struct {
        name   string
        method func(url string, opts ...httpc.RequestOption) (*httpc.Result, error)
    }{
        {"GET", client.Get},
        {"POST", client.Post},
        {"PUT", client.Put},
        {"PATCH", client.Patch},
        {"DELETE", client.Delete},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := tt.method(server.URL + "/test")
            if err != nil {
                t.Fatal(err)
            }
            defer httpc.ReleaseResult(result)

            if result.Body() != tt.name {
                t.Errorf("expected %s, got %s", tt.name, result.Body())
            }
        })
    }
}
```

## ベストプラクティス

| プラクティス | 説明 |
|-------------|------|
| `httptest.Server` の使用 | 実際の HTTP 動作をシミュレートし、ネットワーク依存なし |
| `TestingConfig()` の使用 | セキュリティチェックを無効化し、ローカル接続がブロックされるのを防止 |
| `ReleaseResult()` の呼び出し | オブジェクトプールに返却し、テストパフォーマンスを維持 |
| `defer` の使用 | テストが失敗してもリソースが確実に解放されるようにする |
| テーブル駆動 | 複数の入力をカバーし、コードを簡潔に保つ |

## 次のステップ

- [設定 API](../api-reference/config) - TestingConfig の詳細パラメータ
- [エラータイプ](../api-reference/errors) - エラーアサーションリファレンス
- [ミドルウェアチェーン](./middleware-chain) - ミドルウェアのテストパターン

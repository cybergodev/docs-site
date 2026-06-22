---
title: "高度な機能の例 - CyberGo JSON | 応用編"
description: "CyberGo JSON 高度な例：EncodeBatch、EncodeFields、PreParse、SafeGet、WarmupCache、メモリプール最適化など、プロダクション級の Go パフォーマンス手法を紹介します。"
---

# 高度な機能の例

このドキュメントでは、バッチエンコード、事前パース、フック、高度な設定など、高度な機能の完全なサンプルを提供します。

## バッチエンコード

### EncodeBatch

複数のキーと値のペアをすばやく JSON オブジェクトにエンコードします：

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 分散データから JSON を構築
    pairs := map[string]any{
        "id":      1001,
        "name":    "Alice",
        "email":   "alice@example.com",
        "active":  true,
        "tags":    []string{"admin", "user"},
        "balance": 1250.50,
    }

    // EncodeBatch を使用して JSON オブジェクトにバッチエンコード
    result, err := json.EncodeBatch(pairs)
    if err != nil {
        panic(err)
    }
    fmt.Println(result)

    // EncodeBatch と PrettyConfig を組み合わせてフォーマット出力
    pretty, err := json.EncodeBatch(pairs, json.PrettyConfig())
    if err != nil {
        panic(err)
    }
    fmt.Println(pretty)
}
```

## フィールド選択エンコード

### EncodeFields

構造体の指定したフィールドのみをエンコードします。API レスポンスの機密情報フィルタリングに適しています：

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    ID       int    `json:"id"`
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
    Salt     string `json:"salt"`
}

func main() {
    user := User{
        ID:       1,
        Name:     "Alice",
        Email:    "alice@example.com",
        Password: "secret123",
        Salt:     "randomsalt",
    }

    // 公開フィールドのみをエンコード（機密情報を除外）
    publicFields := []string{"id", "name", "email"}
    result, err := json.EncodeFields(user, publicFields)
    if err != nil {
        panic(err)
    }
    fmt.Println(result)
    // {"id":1,"name":"Alice","email":"alice@example.com"}
}
```

## 事前パース最適化
### PreParse
JSON を事前にパースし、重複パースを回避して複数回のクエリパフォーマンスを向上させます：
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 大規模な JSON データ
    largeJSON := `{
        "users": [
            {"id": 1, "name": "Alice", "email": "alice@example.com"},
            {"id": 2, "name": "Bob", "email": "bob@example.com"},
            {"id": 3, "name": "Charlie", "email": "charlie@example.com"}
        ],
        "metadata": {
            "total": 3,
            "page": 1,
            "perPage": 10
        }
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 事前パース（1回だけパース）
    parsed, err := p.PreParse(largeJSON)
    if err != nil {
        panic(err)
    }

    // 複数回のクエリで事前パース結果を再利用
    total, _ := p.GetFromParsed(parsed, "metadata.total")
    page, _ := p.GetFromParsed(parsed, "metadata.page")

    // ユーザーをイテレーション
    for i := 0; i < 3; i++ {
        path := fmt.Sprintf("users.%d.name", i)
        name, _ := p.GetFromParsed(parsed, path)
        fmt.Printf("User %d: %v\n", i, name)
    }

    fmt.Printf("Total: %v, Page: %v\n", total, page)
}
```

## セーフティ取得
### SafeGet
構造化された結果を返し、メソッドチェーンと型変換をサポートします：
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "user": {
            "id": 1001,
            "name": "Alice",
            "age": 28,
            "active": true,
            "balance": 1250.50
        }
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 単一フィールドのセーフティ取得
    nameResult := p.SafeGet(data, "user.name")
    if nameResult.Ok() {
        name, _ := nameResult.AsString()
        fmt.Println("Name:", name)
    }

    // セーフティ取得して型変換
    ageResult := p.SafeGet(data, "user.age")
    if ageResult.Ok() {
        age, _ := ageResult.AsInt()
        fmt.Println("Age:", age)
    }

    // ブーリアン値のセーフティ取得
    activeResult := p.SafeGet(data, "user.active")
    if activeResult.Ok() {
        active, _ := activeResult.AsBool()
        fmt.Println("Active:", active)
    }

    // 存在しないパスでも panic しない
    emailResult := p.SafeGet(data, "user.email")
    fmt.Println("Email exists:", emailResult.Ok()) // false

    // デフォルト値を使用
    email := emailResult.UnwrapOr("N/A")
    fmt.Println("Email:", email)
}
```

## キャッシュウォームアップ
### WarmupCache
よく使うパスのキャッシュをウォームアップし、後続のクエリパフォーマンスを向上させます：
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 大規模な JSON データ（シミュレーション）
    largeJSON := `{
        "products": [
            {"id": 1, "name": "Product A", "price": 100},
            {"id": 2, "name": "Product B", "price": 200},
            {"id": 3, "name": "Product C", "price": 300}
        ],
        "categories": ["electronics", "books", "clothing"],
        "settings": {"currency": "USD", "taxRate": 0.1}
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // よく使うパスを定義
    commonPaths := []string{
        "products",
        "products.0.id",
        "products.0.name",
        "products.1.id",
        "products.1.name",
        "categories",
        "settings.currency",
    }

    // キャッシュをウォームアップ
    result, err := p.WarmupCache(largeJSON, commonPaths)
    if err != nil {
        panic(err)
    }

    fmt.Printf("ウォームアップ完了: %d/%d 成功\n", result.Successful, result.TotalPaths)
    if len(result.FailedPaths) > 0 {
        fmt.Println("失敗したパス:", result.FailedPaths)
    }

    // 後続のクエリはキャッシュを使用
    for i := 0; i < 3; i++ {
        path := fmt.Sprintf("products.%d.name", i)
        name := p.GetString(largeJSON, path)
        fmt.Printf("Product %d: %s\n", i, name)
    }
}
```

## バッチ操作
### ProcessBatch
複数の操作をバッチで実行し、効率を向上させます：
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}`

    // バッチ操作を定義（ID は結果内の各操作を識別するために使用）
    operations := []json.BatchOperation{
        {ID: "get-name", Type: "get", Path: "users.0.name", JSONStr: data},
        {ID: "get-users", Type: "get", Path: "users", JSONStr: data},
        {ID: "set-name", Type: "set", Path: "users.0.name", Value: "Updated", JSONStr: data},
        {ID: "del-id", Type: "delete", Path: "users.0.id", JSONStr: data},
    }

    // バッチ操作を実行
    results, err := json.ProcessBatch(operations)
    if err != nil {
        panic(err)
    }

    // 結果を確認
    for _, r := range results {
        fmt.Printf("ID: %s\n", r.ID)
        if r.Error != nil {
            fmt.Printf("  エラー: %v\n", r.Error)
        } else if r.Result != nil {
            fmt.Printf("  値: %v\n", r.Result)
        }
    }
}
```

## キーと値のメモリ最適化

ライブラリは内部で文字列メモリプール（string interning）を使用し、重複するキーと値のメモリ使用量を自動的に最適化します。手動での管理は不要です。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // ライブラリは内部で重複するキーと値にメモリプールを自動使用
    // 大量のデータを処理する際、重複する文字列のキーと値は自動的にメモリを再利用
    records := make([]map[string]any, 10000)
    for i := range records {
        records[i] = map[string]any{
            "status": "active",
            "type":   "user",
            "role":   "member",
        }
    }

    // バッチエンコード時にライブラリが内部で自動的にメモリを最適化
    result, _ := json.Marshal(map[string]any{
        "status": "active",
        "type":   "user",
    })

    fmt.Println("Sample:", string(result))
}
```

## 次のステップ
- [パス式構文](./path-syntax) — 完全なパス構文リファレンス
- [大規模ファイル処理](./large-files) — ストリーム処理ガイド
- [API ドキュメント](./api-reference/) — 完全な API リファレンス

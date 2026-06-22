---
title: "クイックスタート - CyberGo JSON | 5分で始めるガイド"
description: "CyberGo JSON クイックスタート：インストール、パスクエリ GetString/GetInt、Marshal/Unmarshal、ファイル読み書きを 5 分で習得。標準ライブラリと 100% 互換の Go JSON 処理を始めましょう。"
---

# クイックスタート

このガイドでは、`github.com/cybergodev/json` ライブラリの基本的な使い方を素早く習得できます。

## インストール

```bash
go get github.com/cybergodev/json
```

## 基本的な使い方

### パッケージレベル関数

ライブラリはプロセッサを作成せずに直接使用できる便利なパッケージレベル関数を提供しています：

#### 値の取得

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "name": "CyberGo",
        "version": 1,
        "active": true,
        "price": 99.99,
        "tags": ["json", "go", "fast"],
        "meta": {"author": "dev"}
    }`

    // 汎用取得
    val, err := json.Get(data, "name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // CyberGo

    // 型安全な取得
    name := json.GetString(data, "name")
    version := json.GetInt(data, "version")
    active := json.GetBool(data, "active")
    price := json.GetFloat(data, "price")
    tags := json.GetArray(data, "tags")
    meta := json.GetObject(data, "meta")

    fmt.Println(name, version, active, price)
    fmt.Println(tags)  // [json go fast]
    fmt.Println(meta)  // map[author:dev]

    // デフォルト値付き取得
    desc := json.GetString(data, "description", "N/A")
    count := json.GetInt(data, "count", 0)
    fmt.Println(desc, count) // N/A 0
}
```

#### ネストされたパス

ドット区切りのネストされたパスをサポートしています：

```go
data := `{"user": {"profile": {"name": "Alice"}}}`

name := json.GetString(data, "user.profile.name")
fmt.Println(name) // Alice
```

#### 配列インデックス

配列インデックスによるアクセスをサポートしています：

```go
data := `{"items": ["a", "b", "c"]}`

// どちらの構文もサポート
item0 := json.GetString(data, "items.0")   // "a"
item1 := json.GetString(data, "items.1")   // "b"
last := json.GetString(data, "items.-1")   // "c"

// ブラケット構文
first := json.GetString(data, "items[0]")  // "a"
last2 := json.GetString(data, "items[-1]") // "c"

// 範囲取得（配列を返す）
arr := json.GetArray(data, "items[0:2]")   // ["a", "b"]
```

::: tip パス構文について
基本的なプロパティや配列インデックスに加えて、**配列スライス** `[1:5]`、**ワイルドカード** `[*]`、**フィールド抽出** `{name,email}` などの高度な構文もサポートしています。詳しくは [パス式の構文](./path-syntax) をご覧ください。
:::

#### 値の設定

```go
data := `{"name": "old"}`

// 新しい値の設定
updated, _ := json.Set(data, "name", "new")
fmt.Println(updated) // {"name":"new"}

// 新しいフィールドの追加
updated, _ = json.Set(data, "version", 1)
fmt.Println(updated) // {"name":"old","version":1}

// 複数フィールドの個別設定
updated, _ = json.Set(data, "name", "updated")
updated, _ = json.Set(updated, "version", 2)
updated, _ = json.Set(updated, "active", true)
```

#### 値の削除

```go
data := `{"name": "test", "temp": "remove"}`

// フィールドの削除
updated, _ := json.Delete(data, "temp")
fmt.Println(updated) // {"name":"test"}
```

### エンコードとデコード

標準ライブラリと完全に互換性があります：

```go
type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

// エンコード
user := User{Name: "Alice", Age: 30}
bytes, _ := json.Marshal(user)
fmt.Println(string(bytes)) // {"name":"Alice","age":30}

// フォーマット付きエンコード
pretty, _ := json.MarshalIndent(user, "", "  ")
fmt.Println(string(pretty))
// {
//   "name": "Alice",
//   "age": 30
// }

// デコード
var u User
json.Unmarshal(bytes, &u)
fmt.Println(u.Name, u.Age) // Alice 30
```

### 検証

```go
valid := `{"key": "value"}`
invalid := `{key: value}`

fmt.Println(json.Valid([]byte(valid)))   // true
fmt.Println(json.Valid([]byte(invalid))) // false
```

### フォーマット

```go
compact := `{"name":"test","nested":{"key":"value"}}`

// フォーマット出力
pretty, _ := json.Prettify(compact)
fmt.Println(pretty)
// {
//   "name": "test",
//   "nested": {
//     "key": "value"
//   }
// }

// 圧縮出力
jsonStr := `{
  "name": "test"
}`
var buf bytes.Buffer
err := json.Compact(&buf, []byte(jsonStr))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

## Processor の使用

頻繁に操作を行う場合は、`Processor` を使用することでパフォーマンスとキャッシュ効果が向上します：

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // デフォルト設定でプロセッサを作成
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close() // リソース解放のために必ずクローズ

    data := `{"name": "test", "value": 42}`

    // プロセッサを使用した操作
    name := p.GetString(data, "name")
    value := p.GetInt(data, "value")

    fmt.Println(name, value)
}
```

## 設定オプション

```go
// デフォルト設定
cfg := json.DefaultConfig()

// セキュリティ強化設定（信頼できない入力を処理する場合）
// cfg = json.SecurityConfig()

// フォーマット出力設定
// cfg = json.PrettyConfig()

// カスタム設定
cfg = json.DefaultConfig()
cfg.MaxJSONSize = 50 * 1024 * 1024 // 50MB
cfg.EnableCache = true
cfg.CacheTTL = 5 * time.Minute

// カスタム設定でプロセッサを作成
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## イテレーション

```go
data := `{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}`

err := json.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("User %v: %s (age %d)\n", key, name, age)
})
// User 0: Alice (age 30)
// User 1: Bob (age 25)
```

## 次のステップ

- [パス式の構文](./path-syntax) — 完全なパスクエリ構文を学ぶ
- [大規模ファイル処理](./large-files) — 大型 JSON ファイルの処理
- [API ドキュメント](./api-reference/) — 完全な API リファレンスを参照
- [使用例](./examples) — より多くの実践的なサンプルを閲覧

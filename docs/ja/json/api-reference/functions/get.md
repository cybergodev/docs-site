---
title: "クエリと取得関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON クエリと取得関数の完全リファレンス：Get/GetString/GetInt/GetFloat/GetBool などの型安全な取得、GetTyped[T] ジェネリック取得、Parse/ParseAny パース関数を含み、JSONPath パス式を全面的にサポートします。"
---

# クエリと取得関数

json パッケージが提供するクエリと取得関数は、パス式、型安全な取得、バッチ操作をサポートしています。

## パスクエリ関数

### Get

シグネチャ：`func Get(jsonStr, path string, cfg ...Config) (any, error)`

パスを指定して任意の型の値を取得します。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `jsonStr` | `string` | はい | JSON 文字列 |
| `path` | `string` | はい | パス式 |
| `cfg` | `Config` | いいえ | オプション設定 |

**例**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    val, err := json.Get(`{"items":[{"name":"test"}]}`, "items[0].name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // 出力: test
}
```

### GetWithContext

シグネチャ：`func GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

コンテキスト付きのパス取得。タイムアウトとキャンセル操作をサポートします。`Get` のコンテキスト対応版です。

::: info 注意
Context は操作の前後でチェックされ、パース/ナビゲーション中にはチェックされません。大型 JSON ドキュメントの場合、操作中にキャンセルに応答しない場合があります。
:::

```go
package main

import (
    "context"
    "fmt"
    "time"
    "github.com/cybergodev/json"
)

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    val, err := json.GetWithContext(ctx, `{"user":{"name":"Alice"}}`, "user.name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // 出力: Alice
}
```

## 型安全な取得関数

型安全な取得関数は、`defaultValue` 可変長引数によりゼロ値フォールバックを提供します。パスが存在しない、値が null、または型変換に失敗した場合、`defaultValue` を返します（指定されていない場合は対応する型のゼロ値を返します）。

### GetString

シグネチャ：`func GetString(jsonStr, path string, defaultValue ...string) string`

パスを指定して文字列値を取得します。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo"}}`

    name := json.GetString(jsonStr, "user.name")
    fmt.Println(name) // 出力: CyberGo

    // 存在しないパスはゼロ値（空文字列）またはカスタムデフォルト値を返す
    nickname := json.GetString(jsonStr, "user.nickname", "不明")
    fmt.Println(nickname) // 出力: 不明
}
```

### GetInt

シグネチャ：`func GetInt(jsonStr, path string, defaultValue ...int) int`

パスを指定して整数値を取得します。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"pagination": {"count": 42}, "timeout": 30}`

    count := json.GetInt(jsonStr, "pagination.count")
    fmt.Println(count) // 出力: 42

    timeout := json.GetInt(jsonStr, "timeout")
    fmt.Println(timeout) // 出力: 30

    // 存在しないパスはカスタムデフォルト値を返す
    page := json.GetInt(jsonStr, "pagination.page", 1)
    fmt.Println(page) // 出力: 1
}
```

### GetFloat

シグネチャ：`func GetFloat(jsonStr, path string, defaultValue ...float64) float64`

パスを指定して浮動小数点値を取得します。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"item": {"price": 19.99}, "rate": 0.85}`

    price := json.GetFloat(jsonStr, "item.price")
    fmt.Println(price) // 出力: 19.99

    rate := json.GetFloat(jsonStr, "rate")
    fmt.Println(rate) // 出力: 0.85

    // 存在しないパスはカスタムデフォルト値を返す
    discount := json.GetFloat(jsonStr, "item.discount", 0.0)
    fmt.Println(discount) // 出力: 0
}
```

### GetBool

シグネチャ：`func GetBool(jsonStr, path string, defaultValue ...bool) bool`

パスを指定して真偽値を取得します。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"feature": {"enabled": true}, "debug": false}`

    enabled := json.GetBool(jsonStr, "feature.enabled")
    fmt.Println(enabled) // 出力: true

    debug := json.GetBool(jsonStr, "debug")
    fmt.Println(debug) // 出力: false

    // 存在しないパスはカスタムデフォルト値を返す
    verbose := json.GetBool(jsonStr, "feature.verbose", false)
    fmt.Println(verbose) // 出力: false
}
```

### GetArray

シグネチャ：`func GetArray(jsonStr, path string, defaultValue ...[]any) []any`

パスを指定して配列を取得します。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"items": ["apple", "banana", "cherry"]}`

    items := json.GetArray(jsonStr, "items")
    for i, item := range items {
        fmt.Printf("[%d] %v\n", i, item)
    }

    // 存在しないパスはカスタムデフォルト値を返す
    empty := json.GetArray(jsonStr, "tags", []any{"default"})
    fmt.Println(empty) // 出力: [default]
}
```

### GetObject

シグネチャ：`func GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

パスを指定してオブジェクトを取得します。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"profile": {"name": "CyberGo", "level": 5}}}`

    profile := json.GetObject(jsonStr, "user.profile")
    fmt.Println(profile) // map[level:5 name:CyberGo]

    // 存在しないパスはカスタムデフォルト値を返す
    settings := json.GetObject(jsonStr, "user.settings", map[string]any{"theme": "dark"})
    fmt.Println(settings) // 出力: map[theme:dark]
}
```

## ジェネリック取得関数

### GetTyped[T]

シグネチャ：`func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

ジェネリック取得関数で、カスタム型をサポートします。パスが存在しない、または型変換に失敗した場合、`defaultValue` を返します（指定されていない場合は `T` のゼロ値を返します）。

**命名規則について**：`GetTyped[T]` は `GetAs[T]` と同等の意味を持ち、JSON 値を取得して指定された型 `T` に変換することを表します。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

    // 型付き構造体の取得
    user := json.GetTyped[User](jsonStr, "user")
    fmt.Printf("Name: %s, Age: %d\n", user.Name, user.Age)

    // 組み込み型の例
    name := json.GetTyped[string](jsonStr, "user.name")
    fmt.Println(name) // 出力: CyberGo

    age := json.GetTyped[int](jsonStr, "user.age")
    fmt.Println(age) // 出力: 30

    // 存在しないパスはカスタムデフォルト値を返す
    email := json.GetTyped[string](jsonStr, "user.email", "unknown@example.com")
    fmt.Println(email) // 出力: unknown@example.com
}
```

## パース関数

### Parse

シグネチャ：`func Parse(jsonStr string, target any, cfg ...Config) error`

JSON 文字列を `target` ポインタが指すオブジェクトにパースします。`target` はポインタである必要があります。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `jsonStr` | `string` | はい | JSON 文字列 |
| `target` | `any` | はい | ターゲットオブジェクトのポインタ |
| `cfg` | `Config` | いいえ | オプション設定 |

**基本的なパース**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    var data map[string]any
    err := json.Parse(`{"name": "test"}`, &data)
    if err != nil {
        panic(err)
    }
    fmt.Println(data) // map[name:test]
}
```

**構造体へのパース**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type Person struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

func main() {
    var person Person
    err := json.Parse(`{"name": "CyberGo", "age": 30}`, &person)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Name: %s, Age: %d\n", person.Name, person.Age)
}
```

**カスタム設定の使用**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    var data map[string]any
    err := json.Parse(`{"name": "test"}`, &data, cfg)
    if err != nil {
        panic(err)
    }
    fmt.Println(data)
}
```

### ParseAny

シグネチャ：`func ParseAny(jsonStr string, cfg ...Config) (any, error)`

JSON 文字列をパースし、ルート値を `any` 型として返します。ターゲット変数の事前宣言は不要です。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    result, err := json.ParseAny(`{"name": "test"}`)
    if err != nil {
        panic(err)
    }
    fmt.Println(result) // map[name:test]
}
```

::: tip Parse と ParseAny の違い
- `Parse(jsonStr, &target)` — ターゲットポインタにパース、変数の事前宣言が必要
- `ParseAny(jsonStr)` — `any` 型として直接返却、事前宣言不要
:::

### Processor.Parse

**シグネチャ**：`func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

Processor インスタンスを通じて JSON をターゲットポインタにパースします。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

var data map[string]any
err = p.Parse(`{"name": "test"}`, &data)
if err != nil {
    panic(err)
}
```

### Processor.ParseAny

**シグネチャ**：`func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

Processor インスタンスを通じて JSON をパースし、`any` 型として返します。パッケージレベルの `ParseAny` と同じ動作です。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

data, err := p.ParseAny(`{"name": "test"}`)
```

詳しくは [Processor パースメソッド](../processor/parse.md#パースメソッド) を参照してください。

## 検証関数

### Valid

シグネチャ：`func Valid(data []byte) bool`

JSON バイトスライスが有効かどうかを検証します。`encoding/json.Valid` と 100% 互換性があります。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := []byte(`{"name": "test"}`)
    if json.Valid(data) {
        fmt.Println("有効な JSON")
    }
}
```

### ValidWithConfig

シグネチャ：`func ValidWithConfig(jsonStr string, cfg ...Config) (bool, error)`

設定を使用して JSON 文字列が有効かどうかを検証し、エラー情報があれば返します。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    valid, err := json.ValidWithConfig(`{"name": "test"}`, cfg)
    if err != nil {
        panic(err)
    }
    if valid {
        fmt.Println("有効な JSON")
    }
}
```

### ValidateSchema

シグネチャ：`func ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

JSON Schema を使用して JSON データを検証します。すべての検証エラーのリストを返します。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    schema := &json.Schema{
        Type:     "object",
        Required: []string{"name", "email"},
        Properties: map[string]*json.Schema{
            "name":  {Type: "string", MinLength: 1},
            "email": {Type: "string", Format: "email"},
            "age":   {Type: "integer", Minimum: 0},
        },
    }

    errors, err := json.ValidateSchema(`{"name":"Alice","email":"alice@example.com","age":25}`, schema)
    if err != nil {
        panic(err)
    }
    for _, e := range errors {
        fmt.Printf("パス %s: %s\n", e.Path, e.Message)
    }
}
```

::: tip 詳しくは
完全な Schema 型定義とバリデータの使用方法については [バリデータ](../validator) を参照してください。
:::

## 安全な取得関数

### SafeGet（パッケージレベル関数）

シグネチャ：`func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

型安全な取得操作を実行し、`AccessResult` を返します。型変換メソッド（`AsString`、`AsInt`、`AsFloat64`、`AsBool`）を提供します。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

    result := json.SafeGet(jsonStr, "user.age")
    if result.Exists {
        age, _ := result.AsInt()
        fmt.Println(age) // 出力: 30
    }

    nameResult := json.SafeGet(jsonStr, "user.name")
    name, _ := nameResult.AsString()
    fmt.Println(name) // 出力: CyberGo
}
```

### SafeGet（Processor メソッド）

シグネチャ：`func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Processor インスタンスを通じて型安全な取得操作を実行します。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

result := p.SafeGet(jsonStr, "user.age")
if result.Exists {
    age, _ := result.AsInt()
    fmt.Println(age) // 出力: 30
}
```

## Processor 拡張メソッド

以下のメソッドはパッケージレベル関数と Processor メソッドの両方として提供されています。

### GetMultiple（パッケージレベル関数）

シグネチャ：`func GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

複数のパスの値をバッチ取得します（パッケージレベル関数、Processor の作成不要）。

```go
jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := json.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // 出力: CyberGo
```

### Processor.GetMultiple

シグネチャ：`func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

複数のパスの値をバッチ取得します。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := p.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // 出力: CyberGo
```

### Processor.ProcessBatch

シグネチャ：`func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

複数の JSON 操作をバッチ処理します。

**BatchOperation フィールド**：`Type string`、`JSONStr string`、`Path string`、`Value any`、`ID string`

**BatchResult フィールド**：`ID string`、`Result any`、`Error error`

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

operations := []json.BatchOperation{
    {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
    {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
}

results, err := p.ProcessBatch(operations)
if err != nil {
    panic(err)
}
for _, r := range results {
    if r.Error != nil {
        fmt.Printf("操作 %s 失敗: %v\n", r.ID, r.Error)
    } else {
        fmt.Printf("操作 %s 結果: %v\n", r.ID, r.Result)
    }
}
```

## 関連型

### AccessResult

`SafeGet` が使用する `AccessResult` 構造体のフィールド：

| フィールド | 型 | 説明 |
|------|------|------|
| `Value` | `any` | 取得された値 |
| `Exists` | `bool` | パスが存在するかどうか |
| `Type` | `string` | 検出された値の型 |

**メソッド**：`Ok()` · `Unwrap()` · `UnwrapOr()` · `AsString()` · `AsStringConverted()` · `AsInt()` · `AsFloat64()` · `AsBool()`

詳しくは [AccessResult 型](../types#accessresult-プロパティアクセス結果) を参照してください。

### Result[T]

`Result[T]` ジェネリック構造体のフィールド：

| フィールド | 型 | 説明 |
|------|------|------|
| `Value` | `T` | 取得された値 |
| `Exists` | `bool` | 値が見つかったかどうか |
| `Error` | `error` | エラー情報 |

## 関連

- [変更関数](./modify) - Set、Delete などの変更操作
- [エンコード・デコード](./encode-decode) - Marshal、Unmarshal などのシリアライズ操作
- [ヘルパー関数](../helpers) - CompareJSON、MergeJSON などのユーティリティ関数
- [設定オプション](../config) - Config 設定の詳細

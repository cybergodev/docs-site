---
title: "ジェネリクス操作 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON ジェネリック API：GetTyped[T]、Result[T]、AccessResult で Go 1.18+ のジェネリクスを活用し、コンパイル時の型安全性を実現します。"
---

# ジェネリクス操作

json ライブラリは Go 1.18+ のジェネリクス機能を活用した型安全な操作を提供し、コンパイル時の型チェックを実現します。

## GetTyped

シグネチャ：`func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

JSON から指定された型の値を取得します。カスタム型をサポートします。`T` を返し、error はありません。パスが存在しない、または型変換に失敗した場合はゼロ値、または `defaultValue` で指定されたデフォルト値を返します。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `jsonStr` | `string` | はい | JSON 文字列 |
| `path` | `string` | はい | JSON パス |
| `defaultValue` | `...T` | いいえ | オプションのデフォルト値。パスが存在しない、または型変換に失敗した場合に返される |

**戻り値**

| 戻り値 | 型 | 説明 |
|--------|------|------|
| 唯一の戻り値 | `T` | 取得された値。パスが存在しない、または型変換に失敗した場合はゼロ値またはデフォルト値 |

**サポートされる型**

- 基本型：`string`, `int`, `int64`, `float64`, `bool`
- スライス型：`[]any`
- マップ型: `map[string]any`
- カスタム構造体

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // 文字列の取得
    name := json.GetTyped[string](data, "user.name")
    fmt.Println(name) // 出力: Alice

    // 整数の取得
    age := json.GetTyped[int](data, "user.age")
    fmt.Println(age) // 出力: 30

    // 配列の取得
    arrData := `{"items": [1, 2, 3]}`
    items := json.GetTyped[[]any](arrData, "items")
    fmt.Println(items) // 出力: [1 2 3]

    // デフォルト値の使用
    email := json.GetTyped[string](data, "user.email", "unknown@example.com")
    fmt.Println(email) // 出力: unknown@example.com
}
```

---

## AccessResult

`AccessResult` は動的型アクセス結果で、動的型処理のための型変換メソッドを提供します。`SafeGet()` で取得します。

### 構造定義

```go
type AccessResult struct {
    Value  any    // 結果値
    Exists bool   // パスが存在するか
    Type   string // 実行時型情報（デバッグ用）
}
```

### メソッド

#### Ok

シグネチャ：`func (r AccessResult) Ok() bool`

値が存在し、エラーがないかを判定します。

```go
result := json.SafeGet(data, "user.name")
if result.Ok() {
    // 値が存在し、エラーなし
}
```

#### Unwrap

シグネチャ：`func (r AccessResult) Unwrap() any`

値を取得します。存在しない場合は nil を返します。

```go
value := result.Unwrap()
```

#### UnwrapOr

シグネチャ：`func (r AccessResult) UnwrapOr(defaultValue any) any`

値またはデフォルト値を取得します。

```go
value := result.UnwrapOr("default")
```

#### AsString

シグネチャ：`func (r AccessResult) AsString() (string, error)`

文字列への安全な変換。値自体が string 型の場合のみ成功します。

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    // 型不一致またはパスが存在しない
}
```

#### AsInt

シグネチャ：`func (r AccessResult) AsInt() (int, error)`

整数への安全な変換。すべての整数型と float（整数値の場合）をサポート。**注意：bool は int に変換されません。**

#### AsFloat64

シグネチャ：`func (r AccessResult) AsFloat64() (float64, error)`

浮動小数点数への安全な変換。すべての数値型をサポート。**注意：bool は float64 に変換されません。**

#### AsBool

シグネチャ：`func (r AccessResult) AsBool() (bool, error)`

ブール値への安全な変換。bool と string 型（"true", "false", "1", "0" など）をサポート。

### チェーン型変換メソッド

`AccessResult` は以下の型変換メソッドを提供します：

| メソッド | 戻り値の型 | 説明 |
|------|----------|------|
| `AsString()` | `(string, error)` | 文字列に変換（厳格な型チェック） |
| `AsStringConverted()` | `(string, error)` | フォーマット変換で文字列に変換 |
| `AsInt()` | `(int, error)` | 整数に変換（bool は変換しない） |
| `AsFloat64()` | `(float64, error)` | float64 に変換（bool は変換しない） |
| `AsBool()` | `(bool, error)` | ブール値に変換 |

### AsString と AsStringConverted の比較

| メソッド | 動作 | 使用シナリオ |
|------|------|----------|
| `AsString()` | 厳格な型チェック、string 型のみ成功 | 元の型を確保したい場合 |
| `AsStringConverted()` | 任意の型を文字列にフォーマット | 文字列表現が必要な場合 |

```go
// シナリオ：数値または文字列の可能性がある値の取得
result := json.SafeGet(data, "user.id")

// 厳格モード - 値が string の場合のみ成功
id, err := result.AsString()

// 緩やかなモード - 数値も文字列に変換
idStr, err := result.AsStringConverted()
```

---

## StreamLinesInto

シグネチャ：`func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

`io.Reader` から JSON を行ごとに読み取り、各行を型 `T` としてパースし、コールバック関数を呼び出します。JSONL 形式の大ファイル処理に適しています。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `reader` | `io.Reader` | はい | データソース |
| `fn` | `func(lineNum int, data T) error` | はい | 行ごとのコールバック関数。行番号とパース済みデータを受け取る |
| `cfg` | `...Config` | いいえ | オプション設定 |

**戻り値**

| 戻り値 | 型 | 説明 |
|--------|------|------|
| 1つ目 | `[]T` | 正常にパースされたすべての結果 |
| 2つ目 | `error` | エラー情報 |

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    jsonl := `{"name":"Alice","age":30}
{"name":"Bob","age":25}
{"name":"Charlie","age":35}`

    type Person struct {
        Name string `json:"name"`
        Age  int    `json:"age"`
    }

    reader := strings.NewReader(jsonl)
    results, err := json.StreamLinesInto[Person](reader, func(lineNum int, data Person) error {
        fmt.Printf("%d 行目: %s, %d 歳\n", lineNum, data.Name, data.Age)
        return nil
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("合計 %d 件のレコードを処理\n", len(results))
}
```

---

## 使用例

### 設定のパース

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type DatabaseConfig struct {
    Host     string `json:"host"`
    Port     int    `json:"port"`
    Database string `json:"database"`
    SSL      bool   `json:"ssl"`
}

func main() {
    config := `{
        "database": {
            "host": "localhost",
            "port": 5432,
            "database": "myapp",
            "ssl": true
        }
    }`

    // 設定を構造体にパース
    dbConfig := json.GetTyped[DatabaseConfig](config, "database")

    fmt.Printf("Host: %s:%d\n", dbConfig.Host, dbConfig.Port)
}
```

### 複数型の処理

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "name": "Alice",
        "age": 30,
        "active": true,
        "score": 95.5,
        "tags": ["admin", "user"]
    }`

    // 異なる型のジェネリック取得
    name := json.GetTyped[string](data, "name")
    age := json.GetTyped[int](data, "age")
    active := json.GetTyped[bool](data, "active")
    score := json.GetTyped[float64](data, "score")
    tags := json.GetTyped[[]any](data, "tags")

    fmt.Printf("Name: %s\n", name)
    fmt.Printf("Age: %d\n", age)
    fmt.Printf("Active: %v\n", active)
    fmt.Printf("Score: %.1f\n", score)
    fmt.Printf("Tags: %v\n", tags)
}
```

### エラー処理

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    config := `{"timeout": 30}`

    timeout := json.GetTyped[int](config, "timeout")
    fmt.Printf("Timeout: %d\n", timeout) // 出力: 30

    // パスが存在しない場合、ゼロ値を返す
    retries := json.GetTyped[int](config, "retries")
    fmt.Printf("Retries: %d\n", retries) // 出力: 0（ゼロ値）

    // パスが存在しない場合、デフォルト値を使用
    retries = json.GetTyped[int](config, "retries", 3)
    fmt.Printf("Retries: %d\n", retries) // 出力: 3（デフォルト値）
}
```

---

## パフォーマンスについて

ジェネリクス操作はランタイムでリフレクションを使用して型変換を行うため、型固有の getter（`GetString`、`GetInt` など）よりわずかに遅くなります。パフォーマンスが重要な場面では、型固有の関数の使用を推奨します。

| メソッド | パフォーマンス | 推奨シナリオ |
|------|------|----------|
| `GetString`, `GetInt` など | 最速 | パフォーマンス重視、型が既知 |
| `GetTyped[T]` | 中程度 | カスタム型が必要な場合 |
| `SafeGet` + `AccessResult` | 中程度 | 動的型処理 |

---

## Result[T] 型

`Result[T]` は型安全なジェネリック操作結果で、明確な型とエラー処理が必要な場面で使用します。

### 構造定義

```go
type Result[T any] struct {
    Value  T     // 結果値
    Exists bool  // パスが見つかったか
    Error  error // エラー情報
}
```

### メソッド

| メソッド | 戻り値の型 | 説明 |
|------|----------|------|
| `Ok()` | `bool` | 結果が有効かチェック（エラーなし、かつ見つかっている） |
| `Unwrap()` | `T` | 値を返す、失敗時はゼロ値を返す |
| `UnwrapOr(default T)` | `T` | 失敗時にデフォルト値を返す |

### 使用例

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // GetTyped は T を返す
    name := json.GetTyped[string](data, "user.name")
    fmt.Println("名前:", name)

    // 存在しないパスはゼロ値を返す
    email := json.GetTyped[string](data, "user.email")
    fmt.Println("メール:", email) // 出力: ""（ゼロ値）

    // デフォルト値の使用
    email = json.GetTyped[string](data, "user.email", "none@example.com")
    fmt.Println("メール:", email) // 出力: none@example.com
}
```

---

## Result[T] と AccessResult の比較

| 特徴 | Result[T] | AccessResult |
|------|-----------|---------------------|
| 型安全性 | ジェネリック T | any 型 |
| 存在判定 | `Exists bool` | `Exists bool` |
| エラー処理 | 組み込み Error フィールド | 型変換メソッドが error を返す |
| メソッドチェーン | 非対応 | チェーン型変換をサポート |
| 取得方法 | `GetTyped[T]` | `SafeGet()` |
| 適用シナリオ | 型が既知の取得 | 動的型処理 |

### 選択のアドバイス

- **型が既知**：`Result[T]` と `GetTyped[T]` を使用
- **動的型**：`AccessResult` と `SafeGet()` を使用
- **チェーン変換が必要**：`AccessResult` を使用
- **エラー処理が必要**：`Result[T]` の Error フィールドまたは `AccessResult` の型変換メソッドを使用

---

## 関連

- [パッケージ関数](./functions) - 型固有の getter 関数
- [型定義](./types) - AccessResult の詳細な定義
- [設定](./config) - Config 設定オプション

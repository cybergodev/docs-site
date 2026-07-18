---
sidebar_label: "パースと検証"
title: "パースと検証 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON パースと検証関数：Parse/ParseAny 解析、Valid/ValidWithConfig の妥当性チェックと ValidateSchema による JSON Schema 検証で、完全な処理チェーンをカバーします。"
sidebar_position: 6
---

# パースと検証関数

json パッケージが提供するパースと検証関数。JSON をターゲットオブジェクトにパース、Processor インスタンスを通じたパース、JSON 有効性検証、JSON Schema 検証をサポートします。

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

詳しくは [Processor パースメソッド](../processor/parse#パースメソッド) を参照してください。

## 検証関数

### Valid

シグネチャ：`func Valid(data []byte, cfg ...Config) bool`

JSON バイトスライスが有効かどうかを検証します。`encoding/json.Valid` と 100% 互換性があります：cfg なしで `json.Valid(data)` を呼び出すと標準ライブラリと完全に一致し、通常の `bool` を返します。

オプションの末尾 `Config` でセキュリティ制限（サイズ、ネスト深度、完全なセキュリティスキャンなど）を適用できます。cfg を渡すと、`Valid` は `Processor.Valid` に委譲し、エラーを `false` に折りたたみます。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := []byte(`{"name": "test"}`)
    // encoding/json 互換（cfg なし）
    if json.Valid(data) {
        fmt.Println("有効な JSON")
    }

    // 設定付き（非破壊的なオプションパラメータ）
    if json.Valid(data, json.SecurityConfig()) {
        fmt.Println("セキュリティ検証に合格")
    }
}
```

::: tip Valid と ValidWithConfig の違い
- `Valid(data, cfg)` は単一の `bool` を返します（`encoding/json` 互換）、エラーは `false` に折りたたまれます
- `ValidWithConfig(jsonStr, cfg)` は `(bool, error)` を返します、検証失敗の原因を確認しやすい

両者とも `cfg` を受け付けます。命名の違いは歴史的な経緯によるものです。
:::

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
完全な Schema 型定義とバリデータの使用方法については [バリデータ](../../extensions/validator) を参照してください。
:::

## 関連

- [クエリと取得関数](./query) - Get、GetString などのクエリ操作
- [Processor パースメソッド](../processor/parse) - Processor レベルのパースと検証メソッドの詳細

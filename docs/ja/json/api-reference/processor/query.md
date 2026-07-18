---
sidebar_label: "クエリと取得"
title: "Processor パスクエリ - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor パスクエリ：Get/GetString/GetInt 型取得、GetMultiple 一括、SafeGet は AccessResult を返し GetTyped[T] ジェネリック、JSONPath をサポートします。"
sidebar_position: 2
---

# パスクエリメソッド

Processor は複数の型安全なパスクエリメソッドを提供します。

## 基本クエリ

### Get

シグネチャ：`func (p *Processor) Get(jsonStr, path string, cfg ...Config) (result any, err error)`

指定したパスから任意の型の値を取得します。

```go
val, err := p.Get(data, "items[0]")
if err != nil {
    panic(err)
}
```

### GetString

シグネチャ：`func (p *Processor) GetString(jsonStr, path string, defaultValue ...string) string`

指定したパスから文字列値を取得します。パスが存在しない、値が null、または型変換に失敗した場合、空文字列または `defaultValue` を返します。

```go
// デフォルト値を指定しない場合
name := p.GetString(data, "user.name")

// デフォルト値を指定する場合
email := p.GetString(data, "user.email", "unknown@example.com")
```

### GetInt

シグネチャ：`func (p *Processor) GetInt(jsonStr, path string, defaultValue ...int) int`

指定したパスから整数値を取得します。パスが存在しない、値が null、または型変換に失敗した場合、0 または `defaultValue` を返します。

```go
count := p.GetInt(data, "count")
timeout := p.GetInt(data, "timeout", 30)
```

### GetFloat

シグネチャ：`func (p *Processor) GetFloat(jsonStr, path string, defaultValue ...float64) float64`

指定したパスから浮動小数点値を取得します。パスが存在しない、値が null、または型変換に失敗した場合、0 または `defaultValue` を返します。

```go
price := p.GetFloat(data, "price")
rate := p.GetFloat(data, "rate", 0.5)
```

### GetBool

シグネチャ：`func (p *Processor) GetBool(jsonStr, path string, defaultValue ...bool) bool`

指定したパスからブール値を取得します。パスが存在しない、値が null、または型変換に失敗した場合、false または `defaultValue` を返します。

```go
enabled := p.GetBool(data, "enabled")
debug := p.GetBool(data, "debug", false)
```

### GetWithContext

シグネチャ：`func (p *Processor) GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

コンテキスト付きのパス取得。タイムアウトとキャンセル操作をサポートします。`Get` のコンテキスト対応版です。

::: info 注意
Context は操作の前後でチェックされ、パース/ナビゲーション中にはチェックされません。大型 JSON ドキュメントの場合、操作中にキャンセルに応答しない場合があります。
:::

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

val, err := p.GetWithContext(ctx, data, "items[0].name")
if err != nil {
    panic(err)
}
fmt.Println(val)
```

## 安全なクエリ

### SafeGet

シグネチャ：`func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

安全に値を取得し、AccessResult 構造体を返します。型変換が必要な場面に適しています。

```go
result := p.SafeGet(data, "user.age")
if result.Ok() {
    age, err := result.AsInt()
    if err != nil {
        // 型変換失敗
    }
    fmt.Println(age)
}

// 他の型も取得可能
name, err := result.AsString()
price, err := result.AsFloat64()
enabled, err := result.AsBool()
```

**AccessResult メソッド**：

| メソッド | 説明 |
|----------|------|
| `Ok() bool` | 値が存在するか確認 |
| `Unwrap() any` | 生の値を取得 |
| `UnwrapOr(defaultValue any) any` | 値またはデフォルト値を取得 |
| `AsString() (string, error)` | 安全に文字列へ変換 |
| `AsStringConverted() (string, error)` | フォーマット付きで文字列へ変換 |
| `AsInt() (int, error)` | 安全に整数へ変換 |
| `AsFloat64() (float64, error)` | 安全に浮動小数点へ変換 |
| `AsBool() (bool, error)` | 安全にブール値へ変換 |

## コレクション取得

### GetArray

シグネチャ：`func (p *Processor) GetArray(jsonStr, path string, defaultValue ...[]any) []any`

指定したパスから配列を取得します。パスが存在しない、値が null、または型変換に失敗した場合、nil または `defaultValue` を返します。

```go
items := p.GetArray(data, "items")
tags := p.GetArray(data, "tags", []any{"default"})
```

### GetObject

シグネチャ：`func (p *Processor) GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

指定したパスからオブジェクトを取得します。パスが存在しない、値が null、または型変換に失敗した場合、nil または `defaultValue` を返します。

```go
profile := p.GetObject(data, "user.profile")
config := p.GetObject(data, "config", map[string]any{"timeout": 30})
```

## ジェネリック取得

::: tip パッケージレベル関数
`GetTyped[T]` はパッケージレベル関数であり、Processor のメソッドではありません。詳細は [ジェネリック操作](../generics#gettyped) を参照してください。
:::

```go
// パッケージレベルの GetTyped を使用
user := json.GetTyped[User](data, "user")

// デフォルト値付き
user = json.GetTyped[User](data, "user", User{Name: "unknown"})
```

## バッチクエリ

### GetMultiple

シグネチャ：`func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

複数のパスの値を一度に取得し、パスから値へのマッピングを返します。

```go
results, err := p.GetMultiple(data, []string{"user.name", "user.age", "user.email"})
if err != nil {
    panic(err)
}
fmt.Println(results["user.name"]) // Alice
fmt.Println(results["user.age"])  // 30
```

## パスのコンパイル

### CompilePath

シグネチャ：`func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

パス式を事前コンパイルし、以降の高速な繰り返し操作に使用します。

```go
cp, err := p.CompilePath("users[0].name")
if err != nil {
    panic(err)
}
defer cp.Release()

// コンパイル済みパスを使用して複数回クエリ
value, err := p.GetCompiled(data1, cp)
value, err = p.GetCompiled(data2, cp)
```

### GetCompiled

シグネチャ：`func (p *Processor) GetCompiled(jsonStr string, cp *CompiledPath) (any, error)`

事前コンパイル済みパスを使用して値を取得します。複数の JSON データで同じパスを繰り返しクエリする場合に適しています。

```go
cp, _ := p.CompilePath("items[0].id")
defer cp.Release()

for _, jsonStr := range jsonStrings {
    id, err := p.GetCompiled(jsonStr, cp)
    if err != nil {
        continue
    }
    fmt.Println(id)
}
```

## 関連

- [データ変更](./modify) - Set/Delete メソッド
- [バッチ操作](./batch) - ProcessBatch バッチ処理
- [ジェネリック操作](../generics) - GetTyped[T] ジェネリック取得

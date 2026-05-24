---
title: "型定義 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON コア型定義完全リファレンス：Result[T] ジェネリック結果、AccessResult 動的アクセス結果、BatchOperation、BatchResult、Schema バリデーションスキーマ、Stats、HealthStatus、IterableValue、エンコードエラー型を含む完全な型システム。"
---

# 型定義

json パッケージは JSON 操作結果を処理するための複数のタイプセーフな型を提供します。

## Result[T] - 統一結果型

`Result[T]` はジェネリック操作結果型で、タイプセーフなエラー処理と値アクセスを提供します。

### 構造定義

```go
type Result[T any] struct {
    Value  T     // 結果値
    Exists bool  // 値が見つかったか
    Error  error // エラー（ある場合）
}
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Ok()` | `func (r Result[T]) Ok() bool` | 結果が有効かチェック（エラーなし、かつ見つかっている） |
| `Unwrap()` | `func (r Result[T]) Unwrap() T` | 値を返す、失敗時はゼロ値を返す |
| `UnwrapOr()` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | 値またはデフォルト値を返す |

### 使用例

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // GetTyped で型付き値を取得
    name := json.GetTyped[string](data, "user.name")
    fmt.Printf("名前: %s\n", name)

    // defaultValue パラメータでデフォルト値を指定
    nickname := json.GetTyped[string](data, "user.nickname", "未設定")
    fmt.Printf("ニックネーム: %s\n", nickname)

    age := json.GetTyped[int](data, "user.age", 0)
    fmt.Printf("年齢: %d\n", age)
}
```

::: tip 命名規約
- **GetTyped[T]** - 指定型の値を取得、`T` を返す、`defaultValue` パラメータ対応
- **Result[T]** - 内部結果型、詳細なエラー処理が必要な場面で使用
:::

---

## CompiledPath - プリコンパイル済みパス

`CompiledPath` はプリコンパイル済みの JSON パス型エイリアスで、同じパスに頻繁にアクセスする際のパス文字列の再解析を回避し、パフォーマンスを向上させます。

### 型定義

```go
type CompiledPath = internal.CompiledPath
```

### ユースケース

同じパスに対して大量の繰り返し操作が必要な場合（ループ内での一括クエリなど）、パスを事前にコンパイルすることで、毎回のパス文字列解析のオーバーヘッドを削減できます。

### コンパイル関数

#### Processor.CompilePath

シグネチャ：`func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

Processor を通じて JSON パスをプリコンパイルし、後続の操作で再利用可能な `*CompiledPath` インスタンスを返します。

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

compiled, err := processor.CompilePath("user.profile.name")
if err != nil {
    panic(err)
}
// 後続の操作で compiled を再利用可能
val, err := processor.GetCompiled(data, compiled)
```

::: tip パフォーマンスのヒント
高頻度の繰り返しパスアクセスでは、パスのプリコンパイルによりパス解析のオーバーヘッドを大幅に削減できます。一括操作やループ内クエリなどのシナリオに適しています。
:::

---

## AccessResult - プロパティアクセス結果

`AccessResult` は安全なプロパティアクセス結果で、メソッドチェーンによる型変換を提供します。

### 構造定義

```go
type AccessResult struct {
    Value  any    // 結果値
    Exists bool   // パスが存在するか
    Type   string // 実行時型情報（デバッグ用）
}
```

### 作成メソッド

#### Processor.SafeGet

シグネチャ：`func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

安全にプロパティを取得し、チェーン型変換用の `AccessResult` を返します。

パッケージレベル関数 `SafeGet` も使用可能です：

シグネチャ：`func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

result := processor.SafeGet(data, "user.age")

if !result.Exists {
    fmt.Println("パスが存在しません")
    return
}

// 型の確認
fmt.Println("型:", result.Type)
```

### チェーン型変換メソッド

| メソッド | 戻り値の型 | 説明 |
|------|----------|------|
| `Unwrap()` | `any` | 値を返す、存在しない場合は nil を返す |
| `UnwrapOr(defaultValue)` | `any` | 値またはデフォルト値を返す |
| `AsString()` | `(string, error)` | 文字列に変換（厳格な型チェック） |
| `AsStringConverted()` | `(string, error)` | フォーマット変換で文字列に変換 |
| `AsInt()` | `(int, error)` | 整数に変換（bool は変換しない） |
| `AsFloat64()` | `(float64, error)` | float64 に変換（bool は変換しない） |
| `AsBool()` | `(bool, error)` | ブーリアンに変換 |
| `Ok()` | `bool` | 結果が有効かチェック（パスが存在し、エラーがない場合） |

::: warning 注意
`AsInt64()`, `AsArray()`, `AsObject()` メソッドは削除されました。これらの型を取得するには `GetTyped[T]` を使用してください。
:::

```go
result := processor.SafeGet(data, "user.profile")

// チェーン呼び出し
name, _ := result.AsString()
email, _ := result.AsString()
age, _ := result.AsInt()
price, _ := result.AsFloat64()
active, _ := result.AsBool()

// 配列やオブジェクト型が必要な場合は GetTyped を使用
arr := json.GetTyped[[]any](data, "items")
obj := json.GetTyped[map[string]any](data, "user.profile")
```

### 使用例

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    data := `{"user": {"name": "Alice", "age": 30, "active": true}}`

    // 安全に取得して変換
    result := processor.SafeGet(data, "user.age")

    // AccessResult メソッドを直接使用
    age, err := result.AsInt()
    if err != nil {
        panic(err)
    }
    fmt.Printf("年齢: %d\n", age)

    // 存在しないパスの取得
    missing := processor.SafeGet(data, "user.nickname")
    if !missing.Exists {
        fmt.Println("ニックネームは存在しません")
    }
}
```

---

## Schema - JSON Schema 型

`Schema` は JSON データの構造バリデーションルールを定義するために使用し、JSON Schema Draft 7 のサブセットをサポートします。

### 構造定義

```go
type Schema struct {
    Type                 string            `json:"type,omitempty"`
    Properties           map[string]*Schema `json:"properties,omitempty"`
    Items                *Schema           `json:"items,omitempty"`
    Required             []string          `json:"required,omitempty"`
    MinLength            int               `json:"minLength,omitempty"`
    MaxLength            int               `json:"maxLength,omitempty"`
    Minimum              float64           `json:"minimum,omitempty"`
    Maximum              float64           `json:"maximum,omitempty"`
    Pattern              string            `json:"pattern,omitempty"`
    Format               string            `json:"format,omitempty"`
    AdditionalProperties bool              `json:"additionalProperties,omitempty"`
    MinItems             int               `json:"minItems,omitempty"`
    MaxItems             int               `json:"maxItems,omitempty"`
    UniqueItems          bool              `json:"uniqueItems,omitempty"`
    Enum                 []any             `json:"enum,omitempty"`
    Const                any               `json:"const,omitempty"`
    MultipleOf           float64           `json:"multipleOf,omitempty"`
    ExclusiveMinimum     bool              `json:"exclusiveMinimum,omitempty"`
    ExclusiveMaximum     bool              `json:"exclusiveMaximum,omitempty"`
    Title                string            `json:"title,omitempty"`
    Description          string            `json:"description,omitempty"`
    Default              any               `json:"default,omitempty"`
    Examples             []any             `json:"examples,omitempty"`
}
```

### Schema の作成

#### 直接構築

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
        "age":   {Type: "integer", Minimum: 0},
    },
}
```

#### NewSchemaWithConfig の使用

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchemaWithConfig(cfg)
```

#### DefaultSchema の使用

シグネチャ：`func DefaultSchema() *Schema`

デフォルト設定を含む空の Schema インスタンスを返します。

```go
schema := json.DefaultSchema()
schema.Type = "object"
schema.Required = []string{"id"}
```

### SchemaConfig 構造体

```go
type SchemaConfig struct {
    Type                 string
    Properties           map[string]*Schema
    Items                *Schema
    Required             []string
    MinLength            *int
    MaxLength            *int
    Minimum              *float64
    Maximum              *float64
    Pattern              string
    Format               string
    AdditionalProperties *bool
    MinItems             *int
    MaxItems             *int
    UniqueItems          bool
    Enum                 []any
    Const                any
    MultipleOf           *float64
    ExclusiveMinimum     *bool
    ExclusiveMaximum     *bool
    Title                string
    Description          string
    Default              any
    Examples             []any
}
```

### 使用例

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 構造体リテラルで Schema を定義
    schema := &json.Schema{
        Type:     "object",
        Required: []string{"name", "email"},
        Properties: map[string]*json.Schema{
            "name": {
                Type:      "string",
                MinLength: 1,
                MaxLength: 100,
            },
            "email": {
                Type:   "string",
                Format: "email",
            },
            "age": {
                Type:    "integer",
                Minimum: 0,
                Maximum: 150,
            },
        },
        AdditionalProperties: false,
    }

    // JSON のバリデーション
    data := `{"name": "Alice", "email": "alice@example.com", "age": 30}`
    errors, err := json.ValidateSchema(data, schema)
    if err != nil {
        panic(err)
    }

    if len(errors) > 0 {
        for _, e := range errors {
            fmt.Printf("バリデーションエラー [%s]: %s\n", e.Path, e.Message)
        }
    } else {
        fmt.Println("バリデーション成功")
    }
}
```

---

## ValidationError

Schema バリデーションエラー型。

### 構造定義

```go
type ValidationError struct {
    Path    string // エラーが発生したパス
    Message string // エラーメッセージ
}
```

### メソッド

#### Error

シグネチャ：`func (ve *ValidationError) Error() string`

error インターフェースを実装します。

```go
for _, e := range errors {
    fmt.Println(e.Error())
}
```

---

## BatchOperation

一括操作の定義。

### 構造定義

```go
type BatchOperation struct {
    Type    string // 操作タイプ: "get", "set", "delete", "validate"
    JSONStr string // JSON データ文字列
    Path    string // 対象パス
    Value   any    // Set 操作の値
    ID      string // 操作識別子
}
```

---

## BatchResult

一括操作の結果。

### 構造定義

```go
type BatchResult struct {
    ID     string // 操作識別子（BatchOperation.ID に対応）
    Result any    // 操作結果
    Error  error  // エラー（ある場合）
}
```

---

## WarmupResult

キャッシュウォームアップ結果。

### 構造定義

```go
type WarmupResult struct {
    TotalPaths  int      // 合計パス数
    Successful  int      // ウォームアップ成功数
    Failed      int      // 失敗数
    SuccessRate float64  // 成功率
    FailedPaths []string // 失敗パスリスト
}
```

---

## ParsedJSON

事前パース済みの JSON ドキュメント。複数回のクエリ操作で再利用可能です。

### 構造定義

`ParsedJSON` の内部フィールドは非公開で、メソッドを通じてアクセスします。

```go
type ParsedJSON struct {
    // 内部フィールド（非公開）
    // Data() メソッドでパース済みデータを取得
}
```

### Data メソッド

シグネチャ：`func (p *ParsedJSON) Data() any`

内部のパース済みデータを返します。

### Release メソッド

シグネチャ：`func (p *ParsedJSON) Release()`

パース済みデータが保持しているリソースを解放します。`ParsedJSON` が不要になった時に呼び出し、内部リソースのガベージコレクションを許可します。

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// JSON の事前パース
parsed, err := processor.PreParse(`{"user": {"name": "Alice", "age": 30}}`)
if err != nil {
    panic(err)
}

// 事前パース結果に対する複数回のクエリ
name, _ := processor.GetFromParsed(parsed, "user.name")
age, _ := processor.GetFromParsed(parsed, "user.age")
```

### ユースケース

| シナリオ | 説明 |
|------|------|
| 高頻度クエリ | 同一 JSON の複数回クエリで再パースを回避 |
| 一括パス取得 | `GetMultiple` で複数パスを一括取得 |
| パフォーマンス最適化 | 事前パース後のクエリパフォーマンスが大幅に向上 |

::: tip パフォーマンスのヒント
同じ JSON 文字列に対して複数回クエリする必要がある場面では、`PreParse` による事前パースで再パースのオーバーヘッドを大幅に削減できます。
:::

---

## Stats

プロセッサの統計情報。

### 構造定義

```go
type Stats struct {
    CacheSize        int64         // 現在のキャッシュサイズ
    CacheMemory      int64         // キャッシュメモリ使用量（バイト）
    MaxCacheSize     int           // キャッシュ最大サイズ
    HitCount         int64         // キャッシュヒット数
    MissCount        int64         // キャッシュミス数
    HitRatio         float64       // キャッシュヒット率
    CacheTTL         time.Duration // キャッシュ有効期限
    CacheEnabled     bool          // キャッシュが有効か
    IsClosed         bool          // プロセッサがクローズされているか
    MemoryEfficiency float64       // メモリ効率
    OperationCount   int64         // 操作総数
    ErrorCount       int64         // エラー総数
}
```

---

## HealthStatus

ヘルスステータス情報。

### 構造定義

```go
type HealthStatus struct {
    Timestamp time.Time              // チェックのタイムスタンプ
    Healthy   bool                   // 健康かどうか
    Checks    map[string]CheckResult // 各チェック項目の結果
}
```

### CheckResult 構造体

```go
type CheckResult struct {
    Healthy bool   // このチェック項目が健康か
    Message string // チェックメッセージ
}
```

---

## IterableValue

反復値のラッパー。

### メソッド概要

**基本アクセス**

| メソッド | 説明 |
|------|------|
| `Get(path)` | パスで値を取得 |
| `GetString(path)` | 文字列を取得 |
| `GetInt(path)` | 整数を取得 |
| `GetFloat64(path)` | 浮動小数点数を取得 |
| `GetBool(path)` | ブーリアンを取得 |
| `GetArray(path)` | 配列を取得 |
| `GetObject(path)` | オブジェクトを取得 |

**デフォルト値付き取得**

| メソッド | 説明 |
|------|------|
| `GetWithDefault(path, defaultValue)` | 値を取得、存在しない場合はデフォルト値を返す |
| `GetStringWithDefault(path, defaultValue)` | 文字列を取得、存在しない場合はデフォルト値を返す |
| `GetIntWithDefault(path, defaultValue)` | 整数を取得、存在しない場合はデフォルト値を返す |
| `GetFloat64WithDefault(path, defaultValue)` | 浮動小数点数を取得、存在しない場合はデフォルト値を返す |
| `GetBoolWithDefault(path, defaultValue)` | ブーリアンを取得、存在しない場合はデフォルト値を返す |

**チェックと走査**

| メソッド | 説明 |
|------|------|
| `Exists(path)` | フィールドが存在するかチェック |
| `IsNull(path)` | 指定パスが null かチェック |
| `IsNullData()` | 内部値が null かチェック |
| `IsEmpty(path)` | 指定パスが空かチェック |
| `IsEmptyData()` | 内部値が空かチェック |
| `GetData()` | 内部の生データを取得 |
| `Break()` | 中断シグナルを返し、イテレーションを停止 |
| `ForeachNested(path, fn)` | ネストされた構造を再帰的に走査 |
| `Release()` | リソースを解放 |

詳細は[イテレータ](./iterator)ドキュメントを参照してください。

---

## エンコードエラー型

json パッケージはエンコード/デコードプロセス中の以下のエラー型をエクスポートし、きめ細かなエラー処理に使用します。

### SyntaxError - 構文エラー

JSON 構文解析エラー。入力データが有効な JSON 形式ではないことを示します。

#### 構造定義

```go
type SyntaxError struct {
    Offset int64 // エラー発生位置（バイトオフセット）
    // その他の非公開フィールドを含む
}
```

#### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Error` | `func (e *SyntaxError) Error() string` | オフセット位置を含むエラー説明を返す |

```go
data := `{invalid json}`
_, err := json.ParseAny(data)
if syntaxErr, ok := err.(*json.SyntaxError); ok {
    fmt.Printf("構文エラー、オフセット: %d\n", syntaxErr.Offset)
}
```

---

### UnmarshalTypeError - デシリアライズ型エラー

JSON 値をターゲットの Go 型に変換できない場合にこのエラーが返されます。

#### 構造定義

```go
type UnmarshalTypeError struct {
    Value  string       // JSON 値の説明（例："string", "number"）
    Type   reflect.Type // ターゲットの Go 型
    Offset int64        // エラー発生位置（バイトオフセット）
    Struct string       // このフィールドを含む構造体名（ある場合）
    Field  string       // フィールド名（ある場合）
    Err    error        // 内部エラー（ある場合）
}
```

#### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Error` | `func (e *UnmarshalTypeError) Error() string` | 型不一致のエラー説明を返す |
| `Unwrap` | `func (e *UnmarshalTypeError) Unwrap() error` | 内部エラーを返す |

```go
type User struct {
    Age int `json:"age"`
}
var user User
err := json.Unmarshal([]byte(`{"age": "not_a_number"}`), &user)
if typeErr, ok := err.(*json.UnmarshalTypeError); ok {
    fmt.Printf("型エラー: JSON 値 %s を %v に変換できません\n", typeErr.Value, typeErr.Type)
}
```

---

### UnsupportedTypeError - サポートされていない型エラー

Go でサポートされていない型をエンコードしようとした場合にこのエラーが返されます。

#### 構造定義

```go
type UnsupportedTypeError struct {
    Type reflect.Type // サポートされていない Go 型
}
```

#### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Error` | `func (e *UnsupportedTypeError) Error() string` | サポートされていない型の説明を返す |

```go
type Chan chan int
data := Chan(make(chan int))
_, err := json.Marshal(data)
if unsupportedErr, ok := err.(*json.UnsupportedTypeError); ok {
    fmt.Printf("サポートされていない型: %v\n", unsupportedErr.Type)
}
```

---

### UnsupportedValueError - サポートされていない値エラー

サポートされていない値（NaN、Infinity など）をエンコードしようとした場合にこのエラーが返されます。

#### 構造定義

```go
type UnsupportedValueError struct {
    Value reflect.Value // サポートされていない値
    Str   string        // エラー説明
}
```

#### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Error` | `func (e *UnsupportedValueError) Error() string` | サポートされていない値の説明を返す |

```go
val := math.NaN()
_, err := json.Marshal(val)
if valErr, ok := err.(*json.UnsupportedValueError); ok {
    fmt.Printf("サポートされていない値: %s\n", valErr.Str)
}
```

---

### InvalidUnmarshalError - 無効なデシリアライズ先エラー

`Unmarshal` のターゲット引数がポインタでない、または nil の場合にこのエラーが返されます。

#### 構造定義

```go
type InvalidUnmarshalError struct {
    Type reflect.Type // ターゲット引数の型
}
```

#### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Error` | `func (e *InvalidUnmarshalError) Error() string` | 無効なターゲットのエラー説明を返す |

```go
var target string // ポインタを渡すべき
err := json.Unmarshal([]byte(`"hello"`), target) // エラー：ポインタが渡されていない
if invalidErr, ok := err.(*json.InvalidUnmarshalError); ok {
    fmt.Printf("無効なデシリアライズ先: %v\n", invalidErr.Type)
}
```

---

### MarshalerError - エンコーダエラー

型の `MarshalJSON` または `MarshalText` メソッドがエラーを返した場合にこのエラーでラップされます。

#### 構造定義

```go
type MarshalerError struct {
    Type reflect.Type // MarshalJSON または MarshalText を実装する型
    Err  error        // MarshalJSON または MarshalText が返したエラー
    // その他の非公開フィールドを含む
}
```

#### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Error` | `func (e *MarshalerError) Error() string` | エンコーダエラーの説明を返す |
| `Unwrap` | `func (e *MarshalerError) Unwrap() error` | 内部エラーを返す |

```go
type BadMarshaler struct{}

func (BadMarshaler) MarshalJSON() ([]byte, error) {
    return nil, errors.New("marshal failed")
}

_, err := json.Marshal(BadMarshaler{})
if marshalErr, ok := err.(*json.MarshalerError); ok {
    fmt.Printf("エンコーダエラー (型: %v): %v\n", marshalErr.Type, marshalErr.Err)
}
```

---

## Encoder - JSON エンコーダ

`Encoder` は JSON 値を出力ストリームに書き込みます。`encoding/json.Encoder` と 100% 互換です。

### 作成

シグネチャ：`func NewEncoder(w io.Writer, cfg ...Config) *Encoder`

`w` に書き込むエンコーダを作成します。オプションの `Config` パラメータでエンコード動作をカスタマイズできます。

```go
file, _ := os.Create("output.json")
defer file.Close()

encoder := json.NewEncoder(file)
err := encoder.Encode(map[string]any{"name": "Alice"})
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Encode` | `func (enc *Encoder) Encode(v any) error` | Go 値を JSON にエンコードしてストリームに書き込む |
| `SetEscapeHTML` | `func (enc *Encoder) SetEscapeHTML(on bool)` | HTML 特殊文字のエスケープ設定 |
| `SetIndent` | `func (enc *Encoder) SetIndent(prefix, indent string)` | インデントフォーマットの設定 |

### 使用例

```go
package main

import (
    "bytes"
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    var buf bytes.Buffer
    encoder := json.NewEncoder(&buf)
    encoder.SetIndent("", "  ")
    encoder.SetEscapeHTML(true)

    err := encoder.Encode(map[string]any{
        "name":  "Alice",
        "email": "alice@example.com",
    })
    if err != nil {
        panic(err)
    }
    fmt.Println(buf.String())
}
```

---

## Decoder - JSON デコーダ

`Decoder` は入力ストリームから JSON 値を読み取ってデコードします。`encoding/json.Decoder` と 100% 互換です。

### 作成

シグネチャ：`func NewDecoder(r io.Reader, cfg ...Config) *Decoder`

`r` から読み取るデコーダを作成します。オプションの `Config` パラメータをサポートします。

```go
file, _ := os.Open("data.json")
defer file.Close()

decoder := json.NewDecoder(file)
for decoder.More() {
    var obj map[string]any
    if err := decoder.Decode(&obj); err != nil {
        break
    }
    fmt.Println(obj)
}
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Decode` | `func (dec *Decoder) Decode(v any) error` | ストリームから次の JSON 値を読み取ってデコード |
| `UseNumber` | `func (dec *Decoder) UseNumber()` | デコーダが数値を `float64` ではなく `Number` として解析するように設定 |
| `DisallowUnknownFields` | `func (dec *Decoder) DisallowUnknownFields()` | デコード時に未知フィールドがあるとエラーを返す |
| `Buffered` | `func (dec *Decoder) Buffered() io.Reader` | デコーダのバッファに残っているデータの Reader を返す |
| `InputOffset` | `func (dec *Decoder) InputOffset() int64` | 現在の入力位置のオフセットを返す |
| `More` | `func (dec *Decoder) More() bool` | ストリームにまだ JSON 値があるかチェック |
| `Token` | `func (dec *Decoder) Token() (Token, error)` | 次の JSON トークンを読み取る |

### 使用例

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    input := `{"name":"Alice","age":30}{"name":"Bob","age":25}`
    decoder := json.NewDecoder(strings.NewReader(input))

    for decoder.More() {
        var person map[string]any
        if err := decoder.Decode(&person); err != nil {
            break
        }
        fmt.Printf("名前: %s, 年齢: %v\n", person["name"], person["age"])
    }
}
```

### ストリーミングデコードの例

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    // JSON ストリーム内の複数の値をデコード
    input := `[1,2,3][4,5,6]`
    decoder := json.NewDecoder(strings.NewReader(input))

    for decoder.More() {
        var arr []any
        if err := decoder.Decode(&arr); err != nil {
            panic(err)
        }
        fmt.Println(arr)
    }
}
```

### トークン読み取りの例

```go
decoder := json.NewDecoder(strings.NewReader(`{"name":"Alice"}`))
for {
    token, err := decoder.Token()
    if err != nil {
        break
    }
    switch v := token.(type) {
    case json.Delim:
        fmt.Printf("デリミタ: %s\n", string(v))
    case string:
        fmt.Printf("文字列: %s\n", v)
    case float64:
        fmt.Printf("数値: %v\n", v)
    case bool:
        fmt.Printf("ブーリアン: %v\n", v)
    case nil:
        fmt.Println("null")
    }
}
```

---

## Token - JSON トークン

`Token` は JSON トークン値で、以下のいずれかの型を保持します：

- `Delim`：4つの JSON デリミタ `[ ] { }` を表す
- `bool`：JSON ブーリアンを表す
- `float64`：JSON 数値を表す
- `Number`：`UseNumber` 有効時の JSON 数値を表す
- `string`：JSON 文字列を表す
- `nil`：JSON null を表す

```go
type Token any
```

`Decoder.Token()` で取得します。

---

## Number - JSON 数値

`Number` は JSON 数値文字列を表し、`UseNumber` モードが有効な場合に Decoder で使用されます。

```go
type Number string
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `String` | `func (n Number) String() string` | 数値の文字列表現を返す |
| `Float64` | `func (n Number) Float64() (float64, error)` | float64 に変換 |
| `Int64` | `func (n Number) Int64() (int64, error)` | int64 に変換 |

```go
decoder := json.NewDecoder(strings.NewReader(`{"price": 19.99}`))
decoder.UseNumber()
var obj map[string]any
decoder.Decode(&obj)

if num, ok := obj["price"].(json.Number); ok {
    f, _ := num.Float64()
    fmt.Println(f) // 19.99
}
```

---

## Delim - JSON デリミタ

`Delim` は JSON デリミタ型で、`[`、`]`、`{`、`}` の 4 つの文字に対応します。

```go
type Delim rune
```

### メソッド

#### String

シグネチャ：`func (d Delim) String() string`

デリミタの文字列表現を返します。

```go
token, _ := decoder.Token()
if delim, ok := token.(json.Delim); ok {
    fmt.Println(delim.String()) // "[" や "{" など
}
```

---

## 関連

- [パッケージ関数](./functions) - パッケージレベル関数リファレンス
- [Config](./config) - 設定オプション
- [Processor](./processor/) - プロセッサメソッド
- [インターフェース定義](./interfaces) - 拡張インターフェース

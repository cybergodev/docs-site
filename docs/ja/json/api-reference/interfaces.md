---
title: "インターフェース定義 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON 拡張インターフェース：CustomEncoder、TypeEncoder、Validator、Hook、PathParser、DangerousPattern でエンコードや検証、セキュリティを柔軟に拡張します。"
---

# インターフェース定義

json パッケージは複数の拡張インターフェースを提供し、JSON 処理動作のカスタマイズを可能にします。

## エンコーダインターフェース

### CustomEncoder

カスタム JSON エンコーダインターフェース。

```go
type CustomEncoder interface {
    // Encode は Go 値を JSON 文字列に変換します
    Encode(value any) (string, error)
}
```

**使用例**

```go
import stdjson "encoding/json"

type UpperCaseEncoder struct{}

func (e *UpperCaseEncoder) Encode(value any) (string, error) {
    // カスタムエンコードロジック
    switch v := value.(type) {
    case string:
        return fmt.Sprintf(`"%s"`, strings.ToUpper(v)), nil
    default:
        // 標準エンコードを使用（無限再帰を回避）
        data, err := stdjson.Marshal(v)
        if err != nil {
            return "", err
        }
        return string(data), nil
    }
}

// 設定に適用
cfg := json.DefaultConfig()
cfg.CustomEncoder = &UpperCaseEncoder{}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### TypeEncoder

特定型のエンコーダインターフェース。

```go
type TypeEncoder interface {
    // Encode は特定型の値を JSON 文字列にエンコードします
    Encode(v reflect.Value) (string, error)
}
```

**使用例**

```go
type TimeEncoder struct{}

func (e *TimeEncoder) Encode(v reflect.Value) (string, error) {
    if v.Type() == reflect.TypeOf(time.Time{}) {
        t := v.Interface().(time.Time)
        return fmt.Sprintf(`"%s"`, t.Format(time.RFC3339)), nil
    }
    return "", fmt.Errorf("サポートされていない型: %v", v.Type())
}

// 型エンコーダを登録
cfg := json.DefaultConfig()
cfg.CustomTypeEncoders = map[reflect.Type]json.TypeEncoder{
    reflect.TypeOf(time.Time{}): &TimeEncoder{},
}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## バリデータインターフェース

### Validator

JSON バリデータインターフェース。

```go
type Validator interface {
    // Validate は JSON 文字列に問題がないかチェックします
    // 有効な場合は nil を返し、そうでない場合は問題を説明するエラーを返します
    Validate(jsonStr string) error
}
```

**使用例**

```go
type SizeValidator struct {
    MaxSize int64
}

func (v *SizeValidator) Validate(jsonStr string) error {
    // 入力データのサイズをチェック
    if int64(len(jsonStr)) > v.MaxSize {
        return fmt.Errorf("JSON が最大サイズを超過: %d", v.MaxSize)
    }
    return nil
}

// バリデータを設定
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}} // 1MB
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## フックインターフェース

### Hook

操作インターセプトインターフェース。前処理/後処理をサポートします。

```go
type Hook interface {
    // Before は操作の前に呼び出されます
    // エラーを返すと操作を中止します
    Before(ctx HookContext) error

    // After は操作の完了後に呼び出されます
    // 結果の変更やエラーのチェックが可能です
    After(ctx HookContext, result any, err error) (any, error)
}
```

### HookContext

フックコンテキスト。操作情報を提供します。

```go
type HookContext struct {
    Operation string        // 操作タイプ: "get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string        // 入力 JSON 文字列（marshal 時は空の可能性あり）。セキュリティ警告：機密データが含まれる可能性があります
    Path      string        // 対象パス（marshal/unmarshal 時は空の可能性あり）
    Value     any           // set 操作の値
    Config    *Config       // アクティブな設定
    StartTime time.Time     // 操作開始時刻
}
```

**使用例**

```go
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("操作開始",
        "operation", ctx.Operation,
        "path", ctx.Path,
    )
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("操作完了",
        "operation", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err,
    )
    return result, err
}

// フックを追加
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{&LoggingHook{logger: slog.Default()}}
```

### HookFunc

構造体アダプタ。関数をフックとして使用できるようにします。

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

**使用例**

```go
// After のみ必要な場合
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// Before のみ必要な場合
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

### 定義済みフック

#### LoggingHook

シグネチャ：`func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook`

ログ記録フックを作成します。

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

#### TimingHook

シグネチャ：`func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook`

タイミング記録フックを作成します。

```go
type MetricsRecorder struct{}

func (r *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.RecordDuration(op, duration)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

#### ValidationHook

シグネチャ：`func ValidationHook(validator func(jsonStr, path string) error) Hook`

入力バリデーションフックを作成します。

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON が大きすぎます")
    }
    return nil
}))
```

#### ErrorHook

シグネチャ：`func ErrorHook(handler func(ctx HookContext, err error) error) Hook`

エラーインターセプトフックを作成します。

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // 元のエラーまたは変換後のエラーを返す
}))
```

## セキュリティパターンインターフェース

### PatternLevel

危険パターンの重大度レベル。

```go
type PatternLevel int

const (
    // PatternLevelCritical - 常に操作をブロック
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - 厳格モードではブロック、緩やかなモードでは警告を記録
    PatternLevelWarning

    // PatternLevelInfo - 記録のみ、ブロックしない
    PatternLevelInfo
)
```

### DangerousPattern

危険パターン構造体。カスタムセキュリティルールの定義に使用します。

```go
type DangerousPattern struct {
    // Pattern は入力内で検出する部分文字列
    Pattern string

    // Name はパターンの説明的な名前
    Name string

    // Level はパターンの重大度レベルの処理方法を決定
    Level PatternLevel
}
```

**使用例**

```go
// 構造体リテラルでカスタム危険パターンを作成
customPattern := json.DangerousPattern{
    Pattern: "eval(",
    Name:    "JavaScript eval 呼び出し",
    Level:   json.PatternLevelCritical,
}

// 設定で追加
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(customPattern)
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "internal_api",
    Name:    "内部 API 参照",
    Level:   json.PatternLevelWarning,
})
```

## パス解析インターフェース

### PathParser

パスパーサーインターフェース。

```go
type PathParser interface {
    // ParsePath はパス文字列をパスセグメントに解析します
    ParsePath(path string) ([]PathSegment, error)
}
```

**使用例**

```go
type CustomPathParser struct{}

func (p *CustomPathParser) ParsePath(path string) ([]json.PathSegment, error) {
    // カスタムパス解析ロジック
    return nil, nil // カスタム解析を実装
}
```

## 基本型

### Number

JSON 数値型。数値精度を維持するために使用します。大きな数値や正確な小数を扱う場合に使用します。

```go
type Number string
```

::: tip 互換性について
ライブラリの `Number` 型は `encoding/json.Number` と 100% 互換があり、直接置き換えて使用できます。
:::

**メソッド**：

```go
func (n Number) String() string              // 数値のリテラルテキストを返す
func (n Number) Float64() (float64, error)   // float64 に変換
func (n Number) Int64() (int64, error)       // int64 に変換
```

**使用例**：

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Number 型の取得（Get メソッドで取得後に型アサーション）
val, err := processor.Get(data, "large_number")
if err != nil {
    panic(err)
}

// 型アサーションで Number を取得
if num, ok := val.(json.Number); ok {
    // Number は元の精度を維持
    fmt.Println(num.String()) // "9007199254740993"（完全な精度）

    // 他の型に変換
    f, _ := num.Float64()
    i, _ := num.Int64()
}
```

## 標準ライブラリ互換インターフェース

`json` パッケージは `encoding/json` と互換の以下の標準インターフェースをエクスポートし、カスタム型のエンコード/デコード動作の定義に使用します。

### Marshaler

```go
type Marshaler interface {
    MarshalJSON() ([]byte, error)
}
```

### Unmarshaler

```go
type Unmarshaler interface {
    UnmarshalJSON(data []byte) error
}
```

### TextMarshaler

```go
type TextMarshaler interface {
    MarshalText() ([]byte, error)
}
```

### TextUnmarshaler

```go
type TextUnmarshaler interface {
    UnmarshalText(text []byte) error
}
```

**使用例**

```go
type Person struct {
    Name string
}

// Marshaler インターフェースの実装
func (p Person) MarshalJSON() ([]byte, error) {
    return []byte(`{"name":"` + p.Name + `"}`), nil
}

// Unmarshaler インターフェースの実装
func (p *Person) UnmarshalJSON(data []byte) error {
    var v struct{ Name string `json:"name"` }
    if err := json.Unmarshal(data, &v); err != nil {
        return err
    }
    p.Name = v.Name
    return nil
}
```

`Encoder`、`Decoder`、`Token`、`Delim`、`Number` などのエンコード/デコード型の詳細は[型定義](./types#encoder-json-エンコーダ)を参照してください。

## 型定義

### Result[T]

タイプセーフな操作結果。ジェネリック対応の結果処理を提供します。

```go
type Result[T any] struct {
    Value  T     // 結果値
    Exists bool  // パスが存在するか
    Error  error // エラー情報（ある場合）
}
```

**メソッド**：

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Ok` | `func (r Result[T]) Ok() bool` | 結果が有効か（エラーがなく存在するか） |
| `Unwrap` | `func (r Result[T]) Unwrap() T` | 値を取得、無効な場合はゼロ値を返す |
| `UnwrapOr` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | 値またはデフォルト値を取得 |

**使用例**：

```go
// ジェネリック取得で値を取得
name := json.GetTyped[string](data, "user.name")
fmt.Println(name)

// デフォルト値付きで取得
name = json.GetTyped[string](data, "user.name", "unknown")
```

---

### AccessResult

動的型アクセス結果。Processor.SafeGet から返されます。

```go
type AccessResult struct {
    Value  any    // 結果値
    Exists bool   // パスが存在するか
    Type   string // 実行時型情報
}

// メソッド
func (r AccessResult) Ok() bool                           // 存在するか
func (r AccessResult) Unwrap() any                        // 値を取得
func (r AccessResult) UnwrapOr(defaultValue any) any      // 値またはデフォルト値を取得
func (r AccessResult) AsString() (string, error)          // 厳格変換
func (r AccessResult) AsStringConverted() (string, error) // フォーマット変換
func (r AccessResult) AsInt() (int, error)                // 厳格変換
func (r AccessResult) AsFloat64() (float64, error)        // 厳格変換
func (r AccessResult) AsBool() (bool, error)              // 厳格変換
```

**型変換メソッドの説明**：

| メソッド | 変換動作 | 説明 |
|------|----------|------|
| `AsString()` | 厳格 | string 型のみ受け入れ、非文字列はエラーを返す |
| `AsStringConverted()` | フォーマット | fmt.Sprintf を使用して任意の値を文字列表現に変換 |
| `AsInt()` | 厳格 | bool を int に変換しない、整数とパース可能な数値のみ受け入れ |
| `AsFloat64()` | 厳格 | bool を float に変換しない、浮動小数点数とパース可能な数値のみ受け入れ |
| `AsBool()` | 厳格 | bool と `strconv.ParseBool` が許可する文字列のみ受け入れ（"1"/"t"/"T"/"TRUE"/"true"/"True", "0"/"f"/"F"/"FALSE"/"false"/"False"） |

```go
result := p.SafeGet(data, "user.age")

// 厳格変換 - 値が整数でない場合はエラーを返す
age, err := result.AsInt()

// フォーマット変換 - 任意の値を文字列に変換
str, err := result.AsStringConverted() // 例: 30 -> "30"
```

## Schema 型

### Schema

JSON Schema は構造体として定義され、タイプセーフな Schema 定義をサポートします。

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

**使用例**：

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name"},
    Properties: map[string]*json.Schema{
        "name": {Type: "string"},
        "age":  {Type: "number"},
    },
}
```

### SchemaConfig

Schema バリデーション設定。`NewSchemaWithConfig` で Schema インスタンスを作成するために使用します。

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

**使用例**：

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
additionalProperties := false
cfg.AdditionalProperties = &additionalProperties
schema := json.NewSchemaWithConfig(cfg)
```

### ValidationError

Schema バリデーションエラー。

```go
type ValidationError struct {
    Path    string `json:"path"`    // エラーパス
    Message string `json:"message"` // エラーメッセージ
}

func (ve *ValidationError) Error() string
```

## 関連

- [Hook フックシステム](./hooks) - フックの詳細な使用ガイド
- [バリデータ](./validator) - バリデータの詳細な使用ガイド
- [CustomEncoder](./custom-encoder) - カスタムエンコーダガイド

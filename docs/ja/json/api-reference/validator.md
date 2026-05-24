---
title: "Validator - CyberGo JSON | Schema バリデータ"
description: "CyberGo JSON バリデータ完全リファレンス：Validator インターフェース定義、Schema バリデーション構造、ValidationError バリデーションエラー型、SchemaConfig 設定オプション、カスタムバリデータ実装ガイドを含み、完全な JSON データ構造とコンテンツのバリデーション機能を提供。"
---

# Validator

Validator は JSON データの構造とコンテンツをバリデーションするために使用します。

## Validator インターフェース

```go
type Validator interface {
    Validate(jsonStr string) error
}
```

JSON 文字列を受け取り、有効な場合は nil を返し、そうでない場合は問題を説明するエラーを返します。

## Schema 型

`Schema` は JSON Schema の構造体定義で、型安全な Schema 定義をサポートします。

```go
type Schema struct {
    Type                 string             `json:"type,omitempty"`
    Properties           map[string]*Schema `json:"properties,omitempty"`
    Items                *Schema            `json:"items,omitempty"`
    Required             []string           `json:"required,omitempty"`
    MinLength            int                `json:"minLength,omitempty"`
    MaxLength            int                `json:"maxLength,omitempty"`
    Minimum              float64            `json:"minimum,omitempty"`
    Maximum              float64            `json:"maximum,omitempty"`
    Pattern              string             `json:"pattern,omitempty"`
    Format               string             `json:"format,omitempty"`
    AdditionalProperties bool               `json:"additionalProperties,omitempty"`
    MinItems             int                `json:"minItems,omitempty"`
    MaxItems             int                `json:"maxItems,omitempty"`
    UniqueItems          bool               `json:"uniqueItems,omitempty"`
    Enum                 []any              `json:"enum,omitempty"`
    Const                any                `json:"const,omitempty"`
    MultipleOf           float64            `json:"multipleOf,omitempty"`
    ExclusiveMinimum     bool               `json:"exclusiveMinimum,omitempty"`
    ExclusiveMaximum     bool               `json:"exclusiveMaximum,omitempty"`
    Title                string             `json:"title,omitempty"`
    Description          string             `json:"description,omitempty"`
    Default              any                `json:"default,omitempty"`
    Examples             []any              `json:"examples,omitempty"`
}
```

使用例：

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name": {
            Type:      "string",
            MinLength: 1,
        },
        "email": {
            Type:   "string",
            Format: "email",
        },
    },
}
```

## SchemaConfig 構造体

`SchemaConfig` は Schema 構築時の設定オプションです。

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

`DefaultSchemaConfig()` でデフォルト設定を取得し、`NewSchemaWithConfig(cfg)` で Schema を作成します：

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchemaWithConfig(cfg)
```

または `DefaultSchema()` でプリセットのデフォルト Schema を取得します：

```go
schema := json.DefaultSchema()
```

## ValidationError 型

Schema バリデーションエラー。

```go
type ValidationError struct {
    Path       string // エラーパス
    Message    string // エラーメッセージ
}

func (ve *ValidationError) Error() string
```

## カスタムバリデータ

`Validator` インターフェースを実装してカスタムバリデーションロジックを作成します：

```go
type SizeValidator struct {
    MaxSize int64
}

func (v *SizeValidator) Validate(jsonStr string) error {
    // JSON 文字列のサイズをチェック
    if int64(len(jsonStr)) > v.MaxSize {
        return fmt.Errorf("JSON が最大サイズを超えています: %d バイト", v.MaxSize)
    }
    return nil
}
```

### Processor と組み合わせる

```go
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}} // 1MB
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## Config のバリデーション関連フィールド

| フィールド | 型 | 説明 |
|------|------|------|
| `EnableValidation` | `bool` | バリデーションを有効化 |
| `CustomValidators` | `[]Validator` | カスタムバリデータリスト |

### カスタムバリデータの使用

```go
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}}

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 関連

- [インターフェース定義](./interfaces) - Validator インターフェース
- [Config](./config) - バリデーション関連設定フィールド
- [セキュリティ概要](../security/) - セキュリティベストプラクティス

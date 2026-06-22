---
title: "Validator - CyberGo JSON | Schema 验证器"
description: "CyberGo JSON 验证器：Validator 接口、Schema 验证结构、ValidationError 错误、SchemaConfig 配置与自定义验证器实现指南，提供完整 JSON 数据验证能力。"
---

# Validator

Validator 用于验证 JSON 数据的结构和内容。

## Validator 接口

```go
type Validator interface {
    Validate(jsonStr string) error
}
```

接收 JSON 字符串，有效返回 nil，否则返回描述问题的错误。

## Schema 类型

`Schema` 是 JSON Schema 的结构体定义，支持类型安全的 Schema 定义。

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

使用示例：

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

## SchemaConfig 结构

`SchemaConfig` 用于构建 Schema 时的配置选项。

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

使用 `DefaultSchemaConfig()` 获取默认配置，通过 `NewSchemaWithConfig(cfg)` 创建 Schema：

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchemaWithConfig(cfg)
```

或使用 `DefaultSchema()` 获取预设的默认 Schema：

```go
schema := json.DefaultSchema()
```

## ValidationError 类型

Schema 验证错误。

```go
type ValidationError struct {
    Path       string `json:"path"`    // 错误路径
    Message    string `json:"message"` // 错误消息
}

func (ve *ValidationError) Error() string
```

## 自定义验证器

实现 `Validator` 接口创建自定义验证逻辑：

```go
type SizeValidator struct {
    MaxSize int64
}

func (v *SizeValidator) Validate(jsonStr string) error {
    // 检查 JSON 字符串大小
    if int64(len(jsonStr)) > v.MaxSize {
        return fmt.Errorf("JSON 超过最大大小: %d 字节", v.MaxSize)
    }
    return nil
}
```

### 配合 Processor

```go
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}} // 1MB
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## Config 中的验证相关字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `EnableValidation` | `bool` | 启用验证 |
| `CustomValidators` | `[]Validator` | 自定义验证器列表 |

### 使用自定义验证器

```go
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}}

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 相关

- [接口定义](./interfaces) - Validator 接口
- [Config](./config) - 验证相关配置字段
- [安全概述](../security/) - 安全最佳实践

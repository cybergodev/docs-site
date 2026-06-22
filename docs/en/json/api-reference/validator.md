---
title: "Validator - CyberGo JSON | Schema Validator"
description: "CyberGo JSON validator: Validator interface, Schema structure, ValidationError, SchemaConfig options, and a custom validator guide for JSON validation."
---

# Validator

Validator is used to validate the structure and content of JSON data.

## Validator Interface

```go
type Validator interface {
    Validate(jsonStr string) error
}
```

Accepts a JSON string, returns nil if valid, otherwise returns an error describing the problem.

## Schema Type

`Schema` is the struct definition for JSON Schema, supporting type-safe schema definitions.

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

Usage example:

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

## SchemaConfig Struct

`SchemaConfig` is used for configuration options when building a Schema.

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

Use `DefaultSchemaConfig()` to get the default configuration, then create a Schema with `NewSchemaWithConfig(cfg)`:

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchemaWithConfig(cfg)
```

Or use `DefaultSchema()` to get a preset default Schema:

```go
schema := json.DefaultSchema()
```

## ValidationError Type

Schema validation error.

```go
type ValidationError struct {
    Path       string // Error path
    Message    string // Error message
}

func (ve *ValidationError) Error() string
```

## Custom Validator

Implement the `Validator` interface to create custom validation logic:

```go
type SizeValidator struct {
    MaxSize int64
}

func (v *SizeValidator) Validate(jsonStr string) error {
    // Check JSON string size
    if int64(len(jsonStr)) > v.MaxSize {
        return fmt.Errorf("JSON exceeds maximum size: %d bytes", v.MaxSize)
    }
    return nil
}
```

### With Processor

```go
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}} // 1MB
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## Validation-Related Fields in Config

| Field | Type | Description |
|-------|------|-------------|
| `EnableValidation` | `bool` | Enable validation |
| `CustomValidators` | `[]Validator` | Custom validator list |

### Using Custom Validators

```go
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}}

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## See Also

- [Interfaces](./interfaces) - Validator interface
- [Config](./config) - Validation-related configuration fields
- [Security Overview](../security/) - Security best practices

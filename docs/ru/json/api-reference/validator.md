---
title: "Validator - CyberGo JSON | Валидатор схем"
description: "Полный справочник валидатора CyberGo JSON: включает определение интерфейса Validator, структуру Schema для валидации, тип ValidationError для ошибок валидации, параметры конфигурации SchemaConfig и руководство по реализации пользовательских валидаторов, предоставляющих полную возможность проверки структуры и содержимого данных JSON."
---

# Validator

Validator используется для проверки структуры и содержимого данных JSON.

## Интерфейс Validator

```go
type Validator interface {
    Validate(jsonStr string) error
}
```

Принимает строку JSON, возвращает nil при корректности, иначе возвращает ошибку с описанием проблемы.

## Тип Schema

`Schema` — структурное определение JSON Schema, поддерживающее типобезопасное определение схем.

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

Пример использования:

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

## Структура SchemaConfig

`SchemaConfig` используется для настройки параметров при построении Schema.

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

Используйте `DefaultSchemaConfig()` для получения конфигурации по умолчанию, создавайте Schema через `NewSchemaWithConfig(cfg)`:

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchemaWithConfig(cfg)
```

Или используйте `DefaultSchema()` для получения предустановленной Schema по умолчанию:

```go
schema := json.DefaultSchema()
```

## Тип ValidationError

Ошибка валидации схемы.

```go
type ValidationError struct {
    Path       string // Путь ошибки
    Message    string // Сообщение об ошибке
}

func (ve *ValidationError) Error() string
```

## Пользовательский валидатор

Реализуйте интерфейс `Validator` для создания пользовательской логики валидации:

```go
type SizeValidator struct {
    MaxSize int64
}

func (v *SizeValidator) Validate(jsonStr string) error {
    // Проверить размер строки JSON
    if int64(len(jsonStr)) > v.MaxSize {
        return fmt.Errorf("JSON превышает максимальный размер: %d байт", v.MaxSize)
    }
    return nil
}
```

### Использование с Processor

```go
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}} // 1МБ
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## Поля Config, связанные с валидацией

| Поле | Тип | Описание |
|------|------|------|
| `EnableValidation` | `bool` | Включить валидацию |
| `CustomValidators` | `[]Validator` | Список пользовательских валидаторов |

### Использование пользовательского валидатора

```go
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}}

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Связанные разделы

- [Определения интерфейсов](./interfaces) - Интерфейс Validator
- [Config](./config) - Поля конфигурации, связанные с валидацией
- [Обзор безопасности](../security/) - Рекомендации по безопасности

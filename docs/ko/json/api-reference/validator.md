---
title: "Validator - CyberGo JSON | Schema 검증기"
description: "CyberGo JSON 검증기 완전 참조: Validator 인터페이스 정의, Schema 검증 구조, ValidationError 검증 오류 타입, SchemaConfig 설정 옵션 및 커스텀 검증기 구현 가이드를 포함하여 완전한 JSON 데이터 구조와 내용 검증 기능을 제공합니다."
---

# Validator

Validator는 JSON 데이터의 구조와 내용을 검증하는 데 사용됩니다.

## Validator 인터페이스

```go
type Validator interface {
    Validate(jsonStr string) error
}
```

JSON 문자열을 받아 유효하면 nil을 반환하고, 그렇지 않으면 문제를 설명하는 오류를 반환합니다.

## Schema 타입

`Schema`는 JSON Schema의 구조체 정의로, 타입 안전한 Schema 정의를 지원합니다.

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

사용 예제:

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

## SchemaConfig 구조체

`SchemaConfig`는 Schema를 구성할 때의 설정 옵션입니다.

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

`DefaultSchemaConfig()`로 기본 설정을 가져오고, `NewSchemaWithConfig(cfg)`로 Schema를 생성합니다:

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchemaWithConfig(cfg)
```

또는 `DefaultSchema()`로 기본 Schema를 가져올 수 있습니다:

```go
schema := json.DefaultSchema()
```

## ValidationError 타입

Schema 검증 오류입니다.

```go
type ValidationError struct {
    Path       string // 오류 경로
    Message    string // 오류 메시지
}

func (ve *ValidationError) Error() string
```

## 커스텀 검증기

`Validator` 인터페이스를 구현하여 커스텀 검증 로직을 생성합니다:

```go
type SizeValidator struct {
    MaxSize int64
}

func (v *SizeValidator) Validate(jsonStr string) error {
    // JSON 문자열 크기 확인
    if int64(len(jsonStr)) > v.MaxSize {
        return fmt.Errorf("JSON이 최대 크기를 초과했습니다: %d 바이트", v.MaxSize)
    }
    return nil
}
```

### Processor와 함께 사용

```go
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}} // 1MB
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## Config의 검증 관련 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `EnableValidation` | `bool` | 검증 활성화 |
| `CustomValidators` | `[]Validator` | 커스텀 검증기 목록 |

### 커스텀 검증기 사용

```go
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}}

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 관련 문서

- [인터페이스 정의](./interfaces) - Validator 인터페이스
- [Config](./config) - 검증 관련 설정 필드
- [보안 개요](../security/) - 보안 모범 사례

---
title: "Processor 출력 메서드 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Processor 출력 메서드 레퍼런스: Encode 인코딩, EncodePretty 포맷팅, EncodeWithConfig 커스텀 설정, EncodeBatch/EncodeFields 배치 인코딩, Compact/Indent/HTMLEscape 포맷팅 작업을 포함하여 다양한 JSON 출력 요구를 충족합니다."
---

# 출력 메서드

Processor는 다양한 JSON 인코딩 출력 메서드를 제공합니다.

## 기본 출력

### Encode

시그니처: `func (p *Processor) Encode(value any, cfg ...Config) (string, error)`

임의의 값을 JSON 문자열로 인코딩합니다.

```go
result, err := p.Encode(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(result)
```

### EncodePretty

시그니처: `func (p *Processor) EncodePretty(value any, cfg ...Config) (string, error)`

임의의 값을 포맷팅된 JSON 문자열로 인코딩합니다.

```go
result, err := p.EncodePretty(user)
if err != nil {
    panic(err)
}
```

## 고급 인코딩

### EncodeWithConfig

시그니처: `func (p *Processor) EncodeWithConfig(value any, cfg ...Config) (string, error)`

지정된 설정으로 값을 JSON 문자열로 인코딩합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `value` | `any` | 예 | 인코딩할 값 |
| `cfg` | `Config` | 아니요 | 인코딩 설정 (선택) |

```go
// PrettyConfig 사용
result, err := p.EncodeWithConfig(data, json.PrettyConfig())

// SecurityConfig 사용
result, err := p.EncodeWithConfig(data, json.SecurityConfig())

// 커스텀 설정 사용
cfg := json.DefaultConfig()
cfg.Pretty = true
cfg.SortKeys = true
cfg.EscapeHTML = true
result, err := p.EncodeWithConfig(data, cfg)
```

### EncodeBatch

시그니처: `func (p *Processor) EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

키-값 쌍을 JSON 객체로 배치 인코딩합니다.

```go
result, err := p.EncodeBatch(map[string]any{
    "name": "CyberGo",
    "version": "1.0.0",
})
```

### EncodeFields

시그니처: `func (p *Processor) EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

지정된 필드만 인코딩합니다. 부분 직렬화에 자주 사용됩니다.

```go
type User struct {
    Name    string `json:"name"`
    Email   string `json:"email"`
    Private string `json:"private"`
}

user := User{Name: "CyberGo", Email: "test@example.com", Private: "secret"}
// name과 email 필드만 인코딩
result, err := p.EncodeFields(user, []string{"name", "email"})
```

### EncodeStream

시그니처: `func (p *Processor) EncodeStream(values any, cfg ...Config) (string, error)`

임의의 값을 JSON 문자열로 인코딩합니다. `EncodeWithConfig`의 Processor 메서드 형태와 동일합니다.

```go
values := []any{"item1", "item2", "item3"}
result, err := p.EncodeStream(values)
```

## 인코딩/디코딩

### Marshal

시그니처: `func (p *Processor) Marshal(value any, cfg ...Config) ([]byte, error)`

Go 값을 JSON 바이트 슬라이스로 인코딩합니다. `encoding/json.Marshal`과 100% 호환됩니다.

```go
data, err := p.Marshal(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"CyberGo"}
```

### MarshalIndent

시그니처: `func (p *Processor) MarshalIndent(value any, prefix, indent string, cfg ...Config) ([]byte, error)`

Go 값을 포맷팅된 JSON 바이트 슬라이스로 인코딩합니다. `encoding/json.MarshalIndent`와 100% 호환됩니다.

```go
data, err := p.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

### Unmarshal

시그니처: `func (p *Processor) Unmarshal(data []byte, value any, cfg ...Config) error`

JSON 바이트 슬라이스를 대상 변수로 파싱합니다. `encoding/json.Unmarshal`과 100% 호환됩니다.

```go
var user User
err := p.Unmarshal([]byte(`{"name":"Alice","age":30}`), &user)
if err != nil {
    panic(err)
}
```

## 포맷팅

### Prettify

시그니처: `func (p *Processor) Prettify(jsonStr string, cfg ...Config) (string, error)`

JSON 문자열을 들여쓰기 형식으로 포맷팅합니다.

```go
pretty, err := p.Prettify(`{"name":"Alice","age":30}`)
// 출력:
// {
//   "name": "Alice",
//   "age": 30
// }
```

### Print (비공개 전환)

:::warning API 변경 안내
`Print`, `PrintE`, `PrintPretty`, `PrintPrettyE`는 내부 메서드(소문자 이름)로 전환되어 공개 API로 내보내지 않습니다. 다음 대안을 사용하세요:

```go
// 컴팩트 출력
s, err := p.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// 포맷팅 출력
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```
:::

### ValidateSchema

시그니처: `func (p *Processor) ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

JSON 데이터가 지정된 Schema에 맞는지 검증합니다.

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
    },
}

errors, err := p.ValidateSchema(jsonStr, schema)
if err != nil {
    panic(err)
}
for _, ve := range errors {
    fmt.Printf("경로 %s: %s\n", ve.Path, ve.Message)
}
```

## 포맷팅 작업

### Compact

시그니처: `func (p *Processor) Compact(jsonStr string, cfg ...Config) (string, error)`

JSON 문자열을 압축하여 모든 공백 문자를 제거합니다.

```go
compact, err := p.Compact(`{"name": "CyberGo"}`)
// 출력: {"name":"CyberGo"}
```

### CompactBuffer

시그니처: `func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

JSON을 압축하여 Buffer에 씁니다.

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "test"}`))
```

### Indent

시그니처: `func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

JSON을 포맷팅하여 Buffer에 씁니다.

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

### HTMLEscape

시그니처: `func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

JSON을 HTML 이스케이프하여 Buffer에 씁니다.

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

## 관련 문서

- [Config](../config) - 설정 옵션
- [파싱 및 로드](./parse) - Parse/Load 메서드

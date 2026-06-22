---
title: "인코딩 디코딩 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 인코딩/디코딩 함수: Marshal/Unmarshal, Compact/Indent/HTMLEscape, Encode/EncodePretty/Prettify로 표준 라이브러리 호환 인코딩을 제공합니다."
---

# 인코딩 디코딩 함수

json 패키지가 제공하는 인코딩 디코딩 함수로, 직렬화, 역직렬화, 포맷 및 설정형 인코딩을 포함합니다.

## 직렬화 함수

### Marshal

시그니처: `func Marshal(value any) ([]byte, error)`

Go 값을 JSON 바이트 슬라이스로 직렬화합니다. `encoding/json.Marshal`과 100% 호환됩니다.

```go
data, err := json.Marshal(map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"test"}
```

:::tip
`Marshal`은 설정 매개변수를 받지 않습니다. 설정형 인코딩이 필요하면 [EncodeWithConfig](#encodewithconfig)를 사용하십시오.
:::

### Unmarshal

시그니처: `func Unmarshal(data []byte, value any) error`

JSON 바이트 슬라이스를 Go 값으로 역직렬화합니다. `encoding/json.Unmarshal`과 100% 호환됩니다.

```go
var result struct {
    Name string `json:"name"`
}
err := json.Unmarshal([]byte(`{"name":"test"}`), &result)
```

### MarshalIndent

시그니처: `func MarshalIndent(v any, prefix, indent string) ([]byte, error)`

들여쓰기가 있는 직렬화입니다. `encoding/json.MarshalIndent`와 100% 호환됩니다.

```go
data, err := json.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

:::tip
`MarshalIndent`는 설정 매개변수를 받지 않습니다. 설정형 인코딩이 필요하면 [EncodeWithConfig](#encodewithconfig)를 사용하십시오.
:::

## 포맷 함수

### Compact

시그니처: `func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error`

JSON을 압축하여 불필요한 공백 문자를 제거하고 결과를 `dst`에 씁니다. `encoding/json.Compact`와 호환됩니다.

```go
var buf bytes.Buffer
err := json.Compact(&buf, []byte(`{"name": "test"}`))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

### Indent

시그니처: `func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

JSON을 포맷하여 들여쓰기를 추가하고 결과를 `dst`에 씁니다. `encoding/json.Indent`와 호환됩니다.

```go
var buf bytes.Buffer
err := json.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(buf.String())
// {
//   "name": "test"
// }
```

### HTMLEscape

시그니처: `func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

JSON 내용을 HTML 이스케이프하여 `<`, `>`, `&` 등의 특수 문자(및 U+2028, U+2029)를 대응하는 유니코드 이스케이프 시퀀스로 교체하고 결과를 `dst`에 씁니다. 반환값이 없습니다.

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
fmt.Println(buf.String())
// {"html":"\u003cscript\u003ealert(1)\u003c/script\u003e"}
```

### Prettify

시그니처: `func Prettify(jsonStr string, cfg ...Config) (string, error)`

기본 포맷 인쇄 들여쓰기를 사용하여 JSON 문자열을 포맷하고, 포맷된 문자열을 반환합니다.

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    panic(err)
}
fmt.Println(pretty)
// {
//   "name": "Alice",
//   "age": 30
// }
```

## 설정형 인코딩 함수

### Encode

시그니처: `func Encode(value any, cfg ...Config) (string, error)`

Go 값을 JSON 문자열로 인코딩하며, 선택적 설정 매개변수를 지원합니다.

```go
result, err := json.Encode(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**설정과 함께 사용**

```go
result, err := json.Encode(user, json.SecurityConfig())
```

### EncodePretty

시그니처: `func EncodePretty(value any, cfg ...Config) (string, error)`

Go 값을 포맷된 JSON 문자열로 인코딩합니다 (들여쓰기 포함). 선택적 설정 매개변수를 지원합니다.

```go
result, err := json.EncodePretty(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**설정과 함께 사용**

```go
result, err := json.EncodePretty(user, json.PrettyConfig())
```

### EncodeWithConfig

시그니처: `func EncodeWithConfig(value any, cfg ...Config) (string, error)`

지정된 설정을 사용하여 Go 값을 JSON 문자열로 인코딩합니다. 인코딩 동작을 세밀하게 제어해야 하는 시나리오에 적합합니다.

```go
// 포맷 인쇄 설정 사용
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**보안 설정 사용**

```go
result, err := json.EncodeWithConfig(data, json.SecurityConfig())
```

## 배치 인코딩 함수

### EncodeBatch

시그니처: `func EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

키-값 쌍을 배치로 JSON 객체 문자열로 인코딩합니다.

```go
result, err := json.EncodeBatch(map[string]any{
    "name":  "Alice",
    "age":   30,
    "email": "alice@example.com",
})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"age":30,"email":"alice@example.com","name":"Alice"}
```

### EncodeFields

시그니처: `func EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

지정된 필드만 인코딩하여 필드 필터링 출력을 구현합니다.

```go
user := struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
}{
    Name: "Alice", Email: "a@b.com", Password: "secret",
}

// 공개 필드만 출력
result, err := json.EncodeFields(user, []string{"name", "email"})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"name":"Alice","email":"a@b.com"}
```

### EncodeStream

시그니처: `func EncodeStream(values any, cfg ...Config) (string, error)`

여러 값을 JSON 배열 스트림(array stream)으로 인코딩합니다. `values`는 일반적으로 슬라이스나 열거 가능한 컬렉션이며, `[v1,v2,...]` 형태의 JSON 배열 문자열을 출력합니다.

```go
values := []map[string]any{
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"},
}

result, err := json.EncodeStream(values)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

## Processor 포맷 메서드

`Processor` 타입은 추가 포맷 메서드를 제공합니다. `json.New()`로 Processor를 생성합니다 (`(*Processor, error)` 반환):

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
```

### Processor.CompactBuffer

시그니처: `func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

JSON 바이트를 압축하여 `dst` 버퍼에 씁니다. 패키지 레벨 `Compact` 함수가 이 메서드에 위임합니다.

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "Alice"}`))
// buf.String() => {"name":"Alice"}
```

### Processor.Indent

시그니처: `func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

들여쓰기 포맷의 JSON을 `dst` 버퍼에 씁니다. `encoding/json.Indent`와 호환됩니다.

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"Alice"}`), "", "  ")
```

### Processor.HTMLEscape

시그니처: `func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

HTML 이스케이프된 JSON을 `dst` 버퍼에 씁니다. 반환값이 없습니다. `encoding/json.HTMLEscape`와 호환됩니다.

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>"}`))
```

:::tip
전체 Processor 문서는 [Processor](../interfaces)를 참조하세요.
:::

## 설정 프리셋

다음 보조 함수는 미리 설정된 `Config` 값을 반환하며, `...Config`를 받는 모든 함수에 전달할 수 있습니다:

```go
// 기본 설정
cfg := json.DefaultConfig()

// 포맷 인쇄 설정
cfg = json.PrettyConfig()

// 보안 설정
cfg = json.SecurityConfig()
```

:::tip
전체 Config 필드 문서는 [설정](../config)을 참조하세요.
:::

## 관련 문서

- [조회 가져오기 함수](./get) - Get, GetString 등 조회 작업
- [수정 함수](./modify) - Set, Delete 등 수정 작업
- [파일 작업](./file-io) - LoadFromFile, SaveToFile 등 파일 작업
- [설정](../config) - Config 타입과 옵션
- [인터페이스](../interfaces) - Processor, Encoder, Decoder 타입

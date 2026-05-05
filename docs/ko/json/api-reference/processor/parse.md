---
title: Processor 파싱과 로딩 - CyberGo JSON | API 참조
description: "CyberGo JSON Processor 파싱과 검증 메서드 완전 참조: Valid 검증, Parse 변수로 파싱, ParseAny 임의 타입 반환, PreParse 미리 파싱 최적화, GetFromParsed 빠른 값 가져오기를 포함하며 AllowComments 주석과 StrictMode 엄격 모드 설정을 지원합니다."
---

# 파싱과 로딩 메서드

Processor는 JSON 파싱과 데이터 로딩 기능을 제공합니다.

## 검증 메서드

### Valid

시그니처: `func (p *Processor) Valid(jsonStr string, cfg ...Config) (bool, error)`

JSON 문자열이 유효한지 검증합니다.

```go
valid, err := p.Valid(data)
if valid && err == nil {
    // 유효한 JSON
}
```

### ValidBytes

시그니처: `func (p *Processor) ValidBytes(data []byte) bool`

바이트 슬라이스가 유효한 JSON인지 검증합니다.

```go
if p.ValidBytes([]byte(data)) {
    // 유효한 JSON
}
```

## 파싱 메서드

### Parse

시그니처: `func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

JSON 문자열을 대상 변수로 파싱합니다. 표준 모드와 숫자 보존 모드를 지원합니다.

```go
// map으로 파싱
var obj map[string]any
err := p.Parse(`{"name":"Alice"}`, &obj)

// 구조체로 파싱
type User struct { Name string }
var user User
err = p.Parse(`{"name":"Alice"}`, &user)

// 숫자 보존 모드 사용
cfg := json.DefaultConfig()
cfg.PreserveNumbers = true
var data any
err = p.Parse(`{"price":19.99}`, &data, cfg)
```

### ParseAny

시그니처: `func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

JSON 문자열을 `any` 타입으로 파싱합니다.

```go
data, err := p.ParseAny(`{"name": "test"}`)
if err != nil {
    panic(err)
}
```

### PreParse

시그니처: `func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)`

JSON 데이터를 미리 파싱하여 동일한 데이터에 대한 여러 조회 시 반복 파싱을 방지합니다.

```go
parsed, err := p.PreParse(jsonStr)
if err != nil {
    panic(err)
}

// 파싱된 데이터에 대해 여러 번 조회
name, _ := p.GetFromParsed(parsed, "user.name")
age, _ := p.GetFromParsed(parsed, "user.age")
```

### GetFromParsed

시그니처: `func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

미리 파싱된 데이터에서 값을 가져옵니다. `PreParse`와 함께 사용하여 여러 조회 성능을 향상시킵니다.

### SetFromParsed

시그니처: `func (p *Processor) SetFromParsed(parsed *ParsedJSON, path string, value any, cfg ...Config) (*ParsedJSON, error)`

미리 파싱된 데이터에 값을 설정하고 새로운 `ParsedJSON`을 반환합니다.

```go
parsed, _ := p.PreParse(jsonStr)
newParsed, err := p.SetFromParsed(parsed, "user.name", "Bob")
```

## 파일 로딩

### LoadFromFile

시그니처: `func (p *Processor) LoadFromFile(filePath string, cfg ...Config) (string, error)`

파일에서 JSON 데이터를 로드하고 원래 문자열을 반환합니다.

```go
data, err := p.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data) // 원래 JSON 문자열
```

### LoadFromFileAsData (비공개 전환)

::: warning API 변경 안내
`LoadFromFileAsData`는 내부 메서드(`loadFromFileAsData`)로 전환되어 공개 API로 내보내지지 않습니다. 대신 `LoadFromFile` + `Parse` 조합을 사용하십시오:

```go
jsonStr, err := p.LoadFromFile("data.json")
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
// data 타입은 map[string]any 또는 []any
if obj, ok := data.(map[string]any); ok {
    fmt.Println(obj["name"])
}
```
:::

## Reader 로딩

### LoadFromReader

시그니처: `func (p *Processor) LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

Reader에서 JSON 데이터를 로드하고 원래 문자열을 반환합니다.

```go
file, _ := os.Open("data.json")
defer file.Close()

data, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
```

### LoadFromReaderAsData (비공개 전환)

::: warning API 변경 안내
`LoadFromReaderAsData`는 내부 메서드(`loadFromReaderAsData`)로 전환되어 공개 API로 내보내지지 않습니다. 대신 `LoadFromReader` + `Parse` 조합을 사용하십시오:

```go
file, _ := os.Open("data.json")
defer file.Close()

jsonStr, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
```
:::

## 메서드 선택

| 시나리오 | 추천 메서드 |
|------|----------|
| 원래 문자열이 필요한 경우 | `LoadFromFile` / `LoadFromReader` |
| 파싱된 데이터가 필요한 경우 | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| 동일한 데이터에 여러 번 조회 | `PreParse` + `GetFromParsed` |
| 유효성만 검증 | `Valid` / `ValidBytes` |
| 대상 변수로 파싱 | `Parse` |
| 데이터를 파일에 저장 | `SaveToFile` / `MarshalToFile` |
| Writer에 쓰기 | `SaveToWriter` |
| 파일에서 읽고 디코딩 | `UnmarshalFromFile` |

## 파일 쓰기

### SaveToFile

시그니처: `func (p *Processor) SaveToFile(filePath string, data any, cfg ...Config) error`

데이터를 JSON 파일로 저장합니다. 상위 디렉토리를 자동으로 생성합니다.

```go
err := p.SaveToFile("data.json", map[string]any{"name": "CyberGo"})

// PrettyConfig로 포맷 출력 저장
err = p.SaveToFile("data.json", data, json.PrettyConfig())
```

### MarshalToFile

시그니처: `func (p *Processor) MarshalToFile(path string, data any, cfg ...Config) error`

데이터를 JSON으로 인코딩하고 파일에 씁니다. 상위 디렉토리를 자동으로 생성합니다.

```go
err := p.MarshalToFile("output.json", data)

// 포맷 저장
err = p.MarshalToFile("output.json", data, json.PrettyConfig())
```

### UnmarshalFromFile

시그니처: `func (p *Processor) UnmarshalFromFile(path string, v any, cfg ...Config) error`

파일에서 JSON을 읽고 대상 변수로 디코딩합니다.

```go
var config Config
err := p.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### SaveToWriter

시그니처: `func (p *Processor) SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

데이터를 JSON으로 인코딩하고 io.Writer에 씁니다.

```go
var buf bytes.Buffer
err := p.SaveToWriter(&buf, data, json.PrettyConfig())
```

## 관련 문서

- [출력 메서드](./output) - Encode/EncodePretty 메서드
- [경로 조회](./query) - Get 계열 메서드

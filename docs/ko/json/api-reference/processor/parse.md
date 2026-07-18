---
sidebar_label: "파싱 및 검증"
title: "Processor 파싱/검증 - CyberGo JSON | API"
description: "CyberGo JSON Processor 파싱 메서드: Valid 검증, Parse, ParseAny, PreParse 최적화, GetFromParsed로 설정 기반 파싱을 지원합니다."
sidebar_position: 6
---

# 파싱 및 검증 메서드

Processor는 JSON 파싱과 유효성 검증 기능을 제공합니다. 파일 읽기/쓰기 및 스트리밍 로드는 [파일 I/O](./file-io)를 참고하세요.

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

JSON 데이터를 사전 파싱하여, 이후 동일한 데이터에 대한 여러 쿼리 시 반복 파싱을 방지합니다.

```go
parsed, err := p.PreParse(jsonStr)
if err != nil {
    panic(err)
}

// 사전 파싱된 데이터에 여러 번 쿼리
name, _ := p.GetFromParsed(parsed, "user.name")
age, _ := p.GetFromParsed(parsed, "user.age")
```

### GetFromParsed

시그니처: `func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

사전 파싱된 데이터에서 값을 가져옵니다. 여러 쿼리 성능 향상을 위해 `PreParse`와 함께 사용합니다.

### SetFromParsed

시그니처: `func (p *Processor) SetFromParsed(parsed *ParsedJSON, path string, value any, cfg ...Config) (*ParsedJSON, error)`

사전 파싱된 데이터에 값을 설정하고, 새로운 `ParsedJSON`을 반환합니다.

```go
parsed, _ := p.PreParse(jsonStr)
newParsed, err := p.SetFromParsed(parsed, "user.name", "Bob")
```

## 메서드 선택

| 시나리오 | 추천 메서드 |
|------|----------|
| 유효성 검증만 필요 | `Valid` / `ValidBytes` |
| 대상 변수로 파싱 | `Parse` |
| 동일 데이터에 여러 번 쿼리 | `PreParse` + `GetFromParsed` |

## 관련 문서

- [파일 I/O](./file-io) - LoadFromFile/SaveToFile 파일 메서드
- [출력 메서드](./output) - Encode/EncodePretty 인코딩 메서드
- [경로 쿼리](./query) - Get 시리즈 메서드

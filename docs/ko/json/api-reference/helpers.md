---
title: "보조 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 보조 도구 함수 완전 레퍼런스: CompareJSON으로 두 JSON이 동등한지 비교 검증, ClearCache/GetStats 캐시 관리와 통계, 전역 프로세서 관리 및 보안 패턴 보조 함수를 포함하여 일상 개발에서 편리한 JSON 도구 함수 모음을 제공합니다."
---

# 보조 함수

json 패키지는 JSON 비교, 캐시 관리 및 유틸리티 처리를 위한 풍부한 보조 함수를 제공합니다.

## JSON 비교 함수

### CompareJSON

시그니처: `func CompareJSON(json1, json2 string) (bool, error)`

두 JSON 문자열이 같은지 비교합니다. 숫자 정밀도 차이와 키 순서 차이를 처리합니다.

```go
// 키 순서가 다르지만 내용이 같음
equal, _ := json.CompareJSON(`{"a":1,"b":2}`, `{"b":2,"a":1}`)
fmt.Println(equal) // true

// 숫자 정밀도가 다르지만 값이 같음
equal, _ := json.CompareJSON(`{"num":1}`, `{"num":1.0}`)
fmt.Println(equal) // true

// 내용이 다름
equal, _ := json.CompareJSON(`{"a":1}`, `{"a":2}`)
fmt.Println(equal) // false
```

---

## JSON 병합 함수

### MergeJSON

시그니처: `func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

두 JSON 객체를 병합합니다. Config로 병합 모드를 설정할 수 있습니다. 자세한 내용은 [수정 함수](./functions/modify#mergejson)를 참조하세요.

---

### MergeMany

시그니처: `func MergeMany(jsons []string, cfg ...Config) (string, error)`

여러 JSON 객체를 병합합니다. 자세한 내용은 [수정 함수](./functions/modify#mergemany)를 참조하세요.

---

## 캐시와 통계

### ClearCache (패키지 레벨 함수)

시그니처: `func ClearCache()`

전역 프로세서의 내부 캐시를 지웁니다.

```go
json.ClearCache()
```

---

### GetStats (패키지 레벨 함수)

시그니처: `func GetStats() Stats`

전역 프로세서의 통계 정보를 가져옵니다.

```go
stats := json.GetStats()
fmt.Printf("캐시 적중률: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("캐시 크기: %d\n", stats.CacheSize)
```

---

### GetHealthStatus (패키지 레벨 함수)

시그니처: `func GetHealthStatus() HealthStatus`

전역 프로세서의 상태를 가져옵니다.

```go
status := json.GetHealthStatus()
if status.Healthy {
    fmt.Println("프로세서가 정상입니다")
}
```

---

### Processor.ClearCache

시그니처: `func (p *Processor) ClearCache()`

프로세서의 내부 캐시를 지웁니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

p.ClearCache()
```

### Processor.GetStats

시그니처: `func (p *Processor) GetStats() Stats`

프로세서의 통계 정보를 가져옵니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

stats := p.GetStats()
fmt.Printf("캐시 적중률: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("캐시 크기: %d\n", stats.CacheSize)
```

### Processor.GetHealthStatus

시그니처: `func (p *Processor) GetHealthStatus() HealthStatus`

프로세서의 상태를 가져옵니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

status := p.GetHealthStatus()
if status.Healthy {
    fmt.Println("프로세서가 정상입니다")
}
```

### WarmupCache

시그니처: `func WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

캐시를 미리 웜업하여 후속 작업 성능을 향상시킵니다.

```go
data := `{"user": {"name": "Alice", "email": "alice@example.com"}, "items": [{"id": 1}]}`
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := json.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("%d개 경로 웜업 성공\n", result.Successful)
```

---

## 전역 프로세서 관리

전역 프로세서는 모든 패키지 레벨 함수(예: `Get`, `GetString` 등)에 사용됩니다.

### SetGlobalProcessor

시그니처: `func SetGlobalProcessor(processor *Processor)`

커스텀 전역 프로세서를 설정합니다.

```go
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}

json.SetGlobalProcessor(p)

// 이후 모든 패키지 레벨 함수가 이 프로세서를 사용합니다
val := json.GetString(data, "user.name")
```

---

### ShutdownGlobalProcessor

시그니처: `func ShutdownGlobalProcessor()`

전역 프로세서를 종료하고 리소스를 해제합니다.

```go
func main() {
    cfg := json.DefaultConfig()
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    json.SetGlobalProcessor(p)

    defer json.ShutdownGlobalProcessor()

    // 애플리케이션 로직...
}
```

---

## 출력 함수

:::warning API 변경 안내
`Print`, `PrintPretty`, `PrintE`, `PrintPrettyE`는 내부 함수(소문자 명명)로 전환되어 공개 API로 내보내지지 않습니다. 대신 [Encode](./functions/encode-decode#encode), [EncodePretty](./functions/encode-decode#encodepretty) 또는 [Prettify](./functions/encode-decode#prettify)와 함께 `fmt.Println`을 사용하세요. 자세한 내용은 [출력 함수](./print)를 참조하세요.
:::

---

## Buffer 호환 함수

:::tip 안내
다음 함수는 `encoding/json` 표준 라이브러리와 완전히 호환되며, `cfg` 매개변수를 통해 추가 설정을 지원합니다.
:::

### Compact

시그니처: `func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error`

JSON을 압축하여 Buffer에 씁니다. `encoding/json.Compact`과 100% 호환됩니다.

```go
var buf bytes.Buffer
err := json.Compact(&buf, []byte(`{"name": "test"}`))
```

### Indent

시그니처: `func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

JSON을 포맷하여 Buffer에 씁니다. `encoding/json.Indent`와 100% 호환됩니다.

```go
var buf bytes.Buffer
err := json.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

---

### HTMLEscape

시그니처: `func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

JSON을 HTML 이스케이프하여 Buffer에 씁니다. `encoding/json.HTMLEscape`와 100% 호환됩니다.

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

---

## 보안 패턴 함수

### Config.AddDangerousPattern

Config의 `AddDangerousPattern` 메서드 또는 `AdditionalDangerousPatterns` 필드를 통해 커스텀 위험 패턴을 등록합니다.

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "커스텀 악성 키워드",
    Level:   json.PatternLevelCritical,
})
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

Config 생성 후 `AdditionalDangerousPatterns` 필드를 설정할 수도 있습니다:

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "malicious_keyword", Name: "커스텀 악성 키워드", Level: json.PatternLevelCritical},
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

**DangerousPattern 구조체**

| 필드 | 타입 | 설명 |
|------|------|------|
| `Pattern` | `string` | 감지할 부분 문자열 |
| `Name` | `string` | 사람이 읽을 수 있는 위험 설명 |
| `Level` | `PatternLevel` | 심각도 수준 |

**PatternLevel 수준**

| 수준 | 설명 |
|------|------|
| `PatternLevelCritical` | 항상 작업 차단 |
| `PatternLevelWarning` | 엄격 모드에서 차단, 완화 모드에서 경고 기록 |
| `PatternLevelInfo` | 기록만 하고 차단하지 않음 |

---

## 오류 처리 함수

### SafeError

시그니처: `func SafeError(err error) string`

내부 상세 정보가 포함되지 않은 클라이언트 안전 오류 메시지를 반환합니다. API 응답에 적합합니다.

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // 안전한 오류 메시지 반환 (경로, 내부 상태 등 민감한 정보 미포함)
    fmt.Println(json.SafeError(err))
}
```

---

### RedactedPath

시그니처: `func RedactedPath(path string) string`

편집된 경로를 반환합니다. 안전한 로그 기록에 사용합니다. 경로의 민감한 부분을 숨깁니다.

```go
path := "users[0].ssn"
fmt.Println(json.RedactedPath(path)) // 안전한 경로 표현
```

---

## AccessResult 타입 변환 메서드

`AccessResult`은 `Processor.SafeGet()` 및 패키지 레벨 `SafeGet()`의 반환 타입으로, 타입 안전한 변환 메서드를 제공합니다.

### AccessResult.AsString

시그니처: `func (r AccessResult) AsString() (string, error)`

안전하게 문자열 타입으로 변환합니다. 값 자체가 문자열일 때만 성공합니다.

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    return
}
fmt.Println(name)
```

---

### AccessResult.AsStringConverted

시그니처: `func (r AccessResult) AsStringConverted() (string, error)`

임의의 값을 문자열로 변환합니다 (fmt.Sprintf 사용).

```go
result := json.SafeGet(data, "user.age")
ageStr, err := result.AsStringConverted()
// "30" (문자열 형식)
```

---

### AccessResult.AsInt

시그니처: `func (r AccessResult) AsInt() (int, error)`

안전하게 정수로 변환합니다. bool에서 int로의 변환은 지원하지 않습니다.

```go
result := json.SafeGet(data, "user.age")
age, err := result.AsInt()
```

---

### AccessResult.AsFloat64

시그니처: `func (r AccessResult) AsFloat64() (float64, error)`

안전하게 float64로 변환합니다. bool에서 float64로의 변환은 지원하지 않습니다.

```go
result := json.SafeGet(data, "item.price")
price, err := result.AsFloat64()
```

---

### AccessResult.AsBool

시그니처: `func (r AccessResult) AsBool() (bool, error)`

안전하게 불리언으로 변환합니다. bool과 string 타입만 지원합니다.

```go
result := json.SafeGet(data, "feature.enabled")
enabled, err := result.AsBool()
```

---

## 관련 문서

- [쿼리 가져오기 함수](./functions/get) - Get, GetString 등 쿼리 작업
- [수정 함수](./functions/modify) - Set, Delete 등 수정 작업
- [타입 정의](./types) - AccessResult 등 타입
- [설정 옵션](./config) - Config 설정 상세

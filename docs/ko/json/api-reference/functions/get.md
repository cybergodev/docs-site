---
title: "쿼리/가져오기 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 조회와 가져오기 함수 완전 레퍼런스: Get/GetString/GetInt/GetFloat/GetBool 등 타입 안전 가져오기, GetTyped[T] 제네릭 가져오기 및 Parse/ParseAny 파싱 함수를 포함하며, JSONPath 경로 표현식을 완전히 지원하고 기본값이 있는 제로 오류 가져오기 모드를 제공합니다."
---

# 조회와 가져오기 함수

json 패키지가 제공하는 조회와 가져오기 함수로, 경로 표현식, 타입 안전 가져오기 및 배치 작업을 지원합니다.

## 경로 쿼리 함수

### Get

시그니처: `func Get(jsonStr, path string, cfg ...Config) (any, error)`

경로로 임의 타입의 값을 가져옵니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `jsonStr` | `string` | 예 | JSON 문자열 |
| `path` | `string` | 예 | 경로 표현식 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

**예제**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    val, err := json.Get(`{"items":[{"name":"test"}]}`, "items[0].name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // 출력: test
}
```

### GetWithContext

시그니처: `func GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

컨텍스트가 있는 경로 가져오기입니다. 시간 초과 및 취소 작업을 지원합니다. `Get`의 컨텍스트 인식 버전입니다.

:::info 주의
Context는 작업 전후에 확인되며, 파싱/탐색 과정에서는 확인되지 않습니다. 대용량 JSON 문서의 경우 작업 중 취소에 응답하지 않을 수 있습니다.
:::

```go
package main

import (
    "context"
    "fmt"
    "time"
    "github.com/cybergodev/json"
)

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    val, err := json.GetWithContext(ctx, `{"user":{"name":"Alice"}}`, "user.name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // 출력: Alice
}
```

## 타입 안전 가져오기 함수

타입 안전 가져오기 함수는 `defaultValue` 가변 매개변수를 통해 제로값 대체를 제공합니다. 경로가 존재하지 않거나, 값이 null이거나, 타입 변환에 실패하면 `defaultValue`를 반환합니다 (제공되지 않으면 해당 타입의 제로값 반환).

### GetString

시그니처: `func GetString(jsonStr, path string, defaultValue ...string) string`

경로로 문자열 값을 가져옵니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo"}}`

    name := json.GetString(jsonStr, "user.name")
    fmt.Println(name) // 출력: CyberGo

    // 존재하지 않는 경로는 제로값 (빈 문자열) 또는 커스텀 기본값 반환
    nickname := json.GetString(jsonStr, "user.nickname", "알 수 없음")
    fmt.Println(nickname) // 출력: 알 수 없음
}
```

### GetInt

시그니처: `func GetInt(jsonStr, path string, defaultValue ...int) int`

경로로 정수 값을 가져옵니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"pagination": {"count": 42}, "timeout": 30}`

    count := json.GetInt(jsonStr, "pagination.count")
    fmt.Println(count) // 출력: 42

    timeout := json.GetInt(jsonStr, "timeout")
    fmt.Println(timeout) // 출력: 30

    // 존재하지 않는 경로는 커스텀 기본값 반환
    page := json.GetInt(jsonStr, "pagination.page", 1)
    fmt.Println(page) // 출력: 1
}
```

### GetFloat

시그니처: `func GetFloat(jsonStr, path string, defaultValue ...float64) float64`

경로로 부동소수점 값을 가져옵니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"item": {"price": 19.99}, "rate": 0.85}`

    price := json.GetFloat(jsonStr, "item.price")
    fmt.Println(price) // 출력: 19.99

    rate := json.GetFloat(jsonStr, "rate")
    fmt.Println(rate) // 출력: 0.85

    // 존재하지 않는 경로는 커스텀 기본값 반환
    discount := json.GetFloat(jsonStr, "item.discount", 0.0)
    fmt.Println(discount) // 출력: 0
}
```

### GetBool

시그니처: `func GetBool(jsonStr, path string, defaultValue ...bool) bool`

경로로 불리언 값을 가져옵니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"feature": {"enabled": true}, "debug": false}`

    enabled := json.GetBool(jsonStr, "feature.enabled")
    fmt.Println(enabled) // 출력: true

    debug := json.GetBool(jsonStr, "debug")
    fmt.Println(debug) // 출력: false

    // 존재하지 않는 경로는 커스텀 기본값 반환
    verbose := json.GetBool(jsonStr, "feature.verbose", false)
    fmt.Println(verbose) // 출력: false
}
```

### GetArray

시그니처: `func GetArray(jsonStr, path string, defaultValue ...[]any) []any`

경로로 배열을 가져옵니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"items": ["apple", "banana", "cherry"]}`

    items := json.GetArray(jsonStr, "items")
    for i, item := range items {
        fmt.Printf("[%d] %v\n", i, item)
    }

    // 존재하지 않는 경로는 커스텀 기본값 반환
    empty := json.GetArray(jsonStr, "tags", []any{"default"})
    fmt.Println(empty) // 출력: [default]
}
```

### GetObject

시그니처: `func GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

경로로 객체를 가져옵니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"profile": {"name": "CyberGo", "level": 5}}}`

    profile := json.GetObject(jsonStr, "user.profile")
    fmt.Println(profile) // map[level:5 name:CyberGo]

    // 존재하지 않는 경로는 커스텀 기본값 반환
    settings := json.GetObject(jsonStr, "user.settings", map[string]any{"theme": "dark"})
    fmt.Println(settings) // 출력: map[theme:dark]
}
```

## 제네릭 가져오기 함수

### GetTyped[T]

시그니처: `func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

제네릭 가져오기 함수로, 커스텀 타입을 지원합니다. 경로가 존재하지 않거나 타입 변환에 실패하면 `defaultValue`를 반환합니다 (제공되지 않으면 `T`의 제로값 반환).

**명명 규칙 설명**: `GetTyped[T]`는 `GetAs[T]`와 동일한 의미로, JSON 값을 가져와 지정된 타입 `T`로 변환함을 나타냅니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

    // 타입화된 구조체 가져오기
    user := json.GetTyped[User](jsonStr, "user")
    fmt.Printf("Name: %s, Age: %d\n", user.Name, user.Age)

    // 내장 타입 예제
    name := json.GetTyped[string](jsonStr, "user.name")
    fmt.Println(name) // 출력: CyberGo

    age := json.GetTyped[int](jsonStr, "user.age")
    fmt.Println(age) // 출력: 30

    // 존재하지 않는 경로는 커스텀 기본값 반환
    email := json.GetTyped[string](jsonStr, "user.email", "unknown@example.com")
    fmt.Println(email) // 출력: unknown@example.com
}
```

## 파싱 함수

### Parse

시그니처: `func Parse(jsonStr string, target any, cfg ...Config) error`

JSON 문자열을 `target` 포인터가 가리키는 객체로 파싱합니다. `target`은 반드시 포인터여야 합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `jsonStr` | `string` | 예 | JSON 문자열 |
| `target` | `any` | 예 | 대상 객체 포인터 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

**기본 파싱**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    var data map[string]any
    err := json.Parse(`{"name": "test"}`, &data)
    if err != nil {
        panic(err)
    }
    fmt.Println(data) // map[name:test]
}
```

**구조체로 파싱**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type Person struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

func main() {
    var person Person
    err := json.Parse(`{"name": "CyberGo", "age": 30}`, &person)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Name: %s, Age: %d\n", person.Name, person.Age)
}
```

**커스텀 설정 사용**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    var data map[string]any
    err := json.Parse(`{"name": "test"}`, &data, cfg)
    if err != nil {
        panic(err)
    }
    fmt.Println(data)
}
```

### ParseAny

시그니처: `func ParseAny(jsonStr string, cfg ...Config) (any, error)`

JSON 문자열을 파싱하고 루트 값을 `any` 타입으로 반환합니다. 대상 변수를 미리 선언할 필요가 없습니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    result, err := json.ParseAny(`{"name": "test"}`)
    if err != nil {
        panic(err)
    }
    fmt.Println(result) // map[name:test]
}
```

:::tip Parse vs ParseAny
- `Parse(jsonStr, &target)` — 대상 포인터로 파싱, 변수 미리 선언 필요
- `ParseAny(jsonStr)` — `any` 타입으로 직접 반환, 미리 선언 불필요
:::

### Processor.Parse

**시그니처**: `func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

Processor 인스턴스를 통해 JSON을 대상 포인터로 파싱합니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

var data map[string]any
err = p.Parse(`{"name": "test"}`, &data)
if err != nil {
    panic(err)
}
```

### Processor.ParseAny

**시그니처**: `func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

Processor 인스턴스를 통해 JSON을 파싱하고 `any` 타입으로 반환합니다. 패키지 레벨 `ParseAny`와 동일한 동작입니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

data, err := p.ParseAny(`{"name": "test"}`)
```

자세한 내용은 [Processor 파싱 메서드](../processor/parse.md#파싱-메서드)를 참조하세요.

## 검증 함수

### Valid

시그니처: `func Valid(data []byte) bool`

JSON 바이트 슬라이스가 유효한지 검증합니다. `encoding/json.Valid`과 100% 호환됩니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := []byte(`{"name": "test"}`)
    if json.Valid(data) {
        fmt.Println("유효한 JSON")
    }
}
```

### ValidWithConfig

시그니처: `func ValidWithConfig(jsonStr string, cfg ...Config) (bool, error)`

설정을 사용하여 JSON 문자열이 유효한지 검증하고, 가능한 오류 정보를 반환합니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    valid, err := json.ValidWithConfig(`{"name": "test"}`, cfg)
    if err != nil {
        panic(err)
    }
    if valid {
        fmt.Println("유효한 JSON")
    }
}
```

### ValidateSchema

시그니처: `func ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

JSON Schema를 사용하여 JSON 데이터를 검증합니다. 모든 검증 오류의 목록을 반환합니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    schema := &json.Schema{
        Type:     "object",
        Required: []string{"name", "email"},
        Properties: map[string]*json.Schema{
            "name":  {Type: "string", MinLength: 1},
            "email": {Type: "string", Format: "email"},
            "age":   {Type: "integer", Minimum: 0},
        },
    }

    errors, err := json.ValidateSchema(`{"name":"Alice","email":"alice@example.com","age":25}`, schema)
    if err != nil {
        panic(err)
    }
    for _, e := range errors {
        fmt.Printf("경로 %s: %s\n", e.Path, e.Message)
    }
}
```

:::tip 자세한 내용
완전한 Schema 타입 정의와 검증기 사용법은 [검증기](../validator)를 참조하세요.
:::

## 안전한 가져오기 함수

### SafeGet (패키지 레벨 함수)

시그니처: `func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

타입 안전한 가져오기 작업을 수행하고 `AccessResult`를 반환합니다. 타입 변환 메서드(`AsString`, `AsInt`, `AsFloat64`, `AsBool`)를 제공합니다.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

    result := json.SafeGet(jsonStr, "user.age")
    if result.Exists {
        age, _ := result.AsInt()
        fmt.Println(age) // 출력: 30
    }

    nameResult := json.SafeGet(jsonStr, "user.name")
    name, _ := nameResult.AsString()
    fmt.Println(name) // 출력: CyberGo
}
```

### SafeGet (Processor 메서드)

시그니처: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Processor 인스턴스를 통해 타입 안전한 가져오기 작업을 수행합니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

result := p.SafeGet(jsonStr, "user.age")
if result.Exists {
    age, _ := result.AsInt()
    fmt.Println(age) // 출력: 30
}
```

## Processor 확장 메서드

다음 메서드는 패키지 레벨 함수와 Processor 메서드로 모두 제공됩니다.

### GetMultiple (패키지 레벨 함수)

시그니처: `func GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

여러 경로의 값을 배치로 가져옵니다 (패키지 레벨 함수, Processor 생성 불필요).

```go
jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := json.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // 출력: CyberGo
```

### Processor.GetMultiple

시그니처: `func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

여러 경로의 값을 배치로 가져옵니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := p.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // 출력: CyberGo
```

### Processor.ProcessBatch

시그니처: `func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

여러 JSON 작업을 배치로 처리합니다.

**BatchOperation 필드**: `Type string`, `JSONStr string`, `Path string`, `Value any`, `ID string`

**BatchResult 필드**: `ID string`, `Result any`, `Error error`

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

operations := []json.BatchOperation{
    {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
    {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
}

results, err := p.ProcessBatch(operations)
if err != nil {
    panic(err)
}
for _, r := range results {
    if r.Error != nil {
        fmt.Printf("작업 %s 실패: %v\n", r.ID, r.Error)
    } else {
        fmt.Printf("작업 %s 결과: %v\n", r.ID, r.Result)
    }
}
```

## 관련 타입

### AccessResult

`SafeGet`이 사용하는 `AccessResult` 구조체 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `Value` | `any` | 가져온 값 |
| `Exists` | `bool` | 경로가 존재하는지 여부 |
| `Type` | `string` | 감지된 값 타입 |

**메서드**: `Ok()` · `Unwrap()` · `UnwrapOr()` · `AsString()` · `AsStringConverted()` · `AsInt()` · `AsFloat64()` · `AsBool()`

자세한 내용은 [AccessResult 타입](../types#accessresult-속성-접근-결과)을 참조하세요.

### Result[T]

`Result[T]` 제네릭 구조체 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `Value` | `T` | 가져온 값 |
| `Exists` | `bool` | 값을 찾았는지 여부 |
| `Error` | `error` | 오류 정보 |

## 관련 문서

- [수정 함수](./modify) - Set, Delete 등 수정 작업
- [인코딩 디코딩](./encode-decode) - Marshal, Unmarshal 등 직렬화 작업
- [보조 함수](../helpers) - CompareJSON, MergeJSON 등 유틸리티 함수
- [설정 옵션](../config) - Config 설정 자세히

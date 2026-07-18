---
sidebar_label: "조회 및 가져오기"
title: "조회 및 가져오기 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 조회 및 가져오기 함수: Get/GetString/GetInt 타입 안전 가져오기, GetTyped[T] 제네릭, GetMultiple 배치와 SafeGet 안전 접근, JSONPath 지원."
sidebar_position: 2
---

# 조회 및 가져오기 함수

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

- [파싱 및 검증 함수](./parse) - Parse, Valid, ValidateSchema 등 파싱/검증 작업
- [배치 작업 함수](./batch) - ProcessBatch 배치 처리
- [수정 함수](./modify) - Set, Delete 등 수정 작업
- [인코딩 출력](./output) - Marshal, Unmarshal 등 직렬화 작업
- [보조 함수](../helpers) - CompareJSON, MergeJSON 등 유틸리티 함수
- [설정 옵션](../config) - Config 설정 자세히

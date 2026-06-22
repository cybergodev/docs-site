---
title: "제네릭 작업 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 제네릭 API: GetTyped[T], Result[T], AccessResult로 Go 1.18+ 제네릭을 활용해 컴파일 타임 타입 안전성을 제공합니다."
---

# 제네릭 작업

json 라이브러리는 Go 1.18+ 제네릭 기능을 활용하여 컴파일 타임 타입 검사를 구현하는 제네릭 타입 안전 작업을 제공합니다.

## GetTyped

시그니처: `func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

JSON에서 지정된 타입의 값을 가져옵니다. 커스텀 타입을 지원합니다. `T`를 반환하며 error가 없습니다. 경로가 존재하지 않거나 타입 변환에 실패하면 제로값 또는 `defaultValue`로 지정된 기본값을 반환합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `jsonStr` | `string` | 예 | JSON 문자열 |
| `path` | `string` | 예 | JSON 경로 |
| `defaultValue` | `...T` | 아니요 | 선택적 기본값, 경로가 존재하지 않거나 타입 변환에 실패하면 반환 |

**반환값**

| 반환값 | 타입 | 설명 |
|--------|------|------|
| 유일한 반환값 | `T` | 가져온 값, 경로가 존재하지 않거나 타입 변환에 실패하면 제로값이나 기본값을 반환합니다 |

**지원하는 타입**

- 기본 타입: `string`, `int`, `int64`, `float64`, `bool`
- 슬라이스 타입: `[]any`
- 맵 타입: `map[string]any`
- 커스텀 구조체

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // 문자열 가져오기
    name := json.GetTyped[string](data, "user.name")
    fmt.Println(name) // 출력: Alice

    // 정수 가져오기
    age := json.GetTyped[int](data, "user.age")
    fmt.Println(age) // 출력: 30

    // 배열 가져오기
    arrData := `{"items": [1, 2, 3]}`
    items := json.GetTyped[[]any](arrData, "items")
    fmt.Println(items) // 출력: [1 2 3]

    // 기본값 사용
    email := json.GetTyped[string](data, "user.email", "unknown@example.com")
    fmt.Println(email) // 출력: unknown@example.com
}
```

---

## AccessResult

`AccessResult`은 동적 타입 접근 결과로, 동적 타입 처리를 위한 타입 변환 메서드를 제공합니다. `SafeGet()`으로 가져옵니다.

### 구조 정의

```go
type AccessResult struct {
    Value  any    // 결과 값
    Exists bool   // 경로가 존재하는지 여부
    Type   string // 런타임 타입 정보 (디버깅용)
}
```

### 메서드

#### Ok

시그니처: `func (r AccessResult) Ok() bool`

값이 존재하고 오류가 없는지 확인합니다.

```go
result := json.SafeGet(data, "user.name")
if result.Ok() {
    // 값이 존재하고 오류 없음
}
```

#### Unwrap

시그니처: `func (r AccessResult) Unwrap() any`

값을 가져옵니다. 존재하지 않으면 nil을 반환합니다.

```go
value := result.Unwrap()
```

#### UnwrapOr

시그니처: `func (r AccessResult) UnwrapOr(defaultValue any) any`

값 또는 기본값을 가져옵니다.

```go
value := result.UnwrapOr("default")
```

#### AsString

시그니처: `func (r AccessResult) AsString() (string, error)`

안전하게 문자열로 변환합니다. 값 자체가 string 타입일 때만 성공합니다.

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    // 타입 불일치 또는 경로가 존재하지 않음
}
```

#### AsInt

시그니처: `func (r AccessResult) AsInt() (int, error)`

안전하게 정수로 변환합니다. 모든 정수 타입과 float(정수값인 경우)을 지원합니다. **주의: bool은 int로 변환되지 않습니다.**

#### AsFloat64

시그니처: `func (r AccessResult) AsFloat64() (float64, error)`

안전하게 부동소수점으로 변환합니다. 모든 숫자 타입을 지원합니다. **주의: bool은 float64로 변환되지 않습니다.**

#### AsBool

시그니처: `func (r AccessResult) AsBool() (bool, error)`

안전하게 불리언으로 변환합니다. bool과 string 타입("true", "false", "1", "0" 등)을 지원합니다.

### 체인 타입 변환 메서드

`AccessResult`은 다음 타입 변환 메서드를 제공합니다:

| 메서드 | 반환 타입 | 설명 |
|------|----------|------|
| `AsString()` | `(string, error)` | 문자열로 변환 (엄격한 타입 검사) |
| `AsStringConverted()` | `(string, error)` | 포맷팅하여 문자열로 변환 |
| `AsInt()` | `(int, error)` | 정수로 변환 (bool은 변환 안 함) |
| `AsFloat64()` | `(float64, error)` | float64로 변환 (bool은 변환 안 함) |
| `AsBool()` | `(bool, error)` | 불리언으로 변환 |

### AsString vs AsStringConverted

| 메서드 | 동작 | 사용 시나리오 |
|------|------|----------|
| `AsString()` | 엄격한 타입 검사, string 타입만 성공 | 원래 타입을 확인하려는 경우 |
| `AsStringConverted()` | 모든 타입을 문자열로 포맷팅 | 문자열 표현이 필요한 경우 |

```go
// 시나리오: 숫자나 문자열일 수 있는 값 가져오기
result := json.SafeGet(data, "user.id")

// 엄격 모드 - 값이 string일 때만 성공
id, err := result.AsString()

// 느슨한 모드 - 숫자도 문자열로 변환
idStr, err := result.AsStringConverted()
```

---

## StreamLinesInto

시그니처: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

`io.Reader`에서 JSON을 한 줄씩 읽어, 각 줄을 타입 `T`로 파싱하고 콜백 함수를 호출합니다. JSONL 형식의 대용량 파일 처리에 적합합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `reader` | `io.Reader` | 예 | 데이터 소스 |
| `fn` | `func(lineNum int, data T) error` | 예 | 각 줄의 콜백 함수, 줄 번호와 파싱된 데이터를 받음 |
| `cfg` | `...Config` | 아니요 | 선택적 설정 |

**반환값**

| 반환값 | 타입 | 설명 |
|--------|------|------|
| 첫 번째 | `[]T` | 성공적으로 파싱된 모든 결과 |
| 두 번째 | `error` | 오류 정보 |

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    jsonl := `{"name":"Alice","age":30}
{"name":"Bob","age":25}
{"name":"Charlie","age":35}`

    type Person struct {
        Name string `json:"name"`
        Age  int    `json:"age"`
    }

    reader := strings.NewReader(jsonl)
    results, err := json.StreamLinesInto[Person](reader, func(lineNum int, data Person) error {
        fmt.Printf("%d번째 줄: %s, %d세\n", lineNum, data.Name, data.Age)
        return nil
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("총 %d개의 레코드를 처리했습니다\n", len(results))
}
```

---

## 사용 예제

### 설정 파싱

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type DatabaseConfig struct {
    Host     string `json:"host"`
    Port     int    `json:"port"`
    Database string `json:"database"`
    SSL      bool   `json:"ssl"`
}

func main() {
    config := `{
        "database": {
            "host": "localhost",
            "port": 5432,
            "database": "myapp",
            "ssl": true
        }
    }`

    // 설정을 구조체로 파싱
    dbConfig := json.GetTyped[DatabaseConfig](config, "database")

    fmt.Printf("Host: %s:%d\n", dbConfig.Host, dbConfig.Port)
}
```

### 다중 타입 처리

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "name": "Alice",
        "age": 30,
        "active": true,
        "score": 95.5,
        "tags": ["admin", "user"]
    }`

    // 다양한 타입의 제네릭 가져오기
    name := json.GetTyped[string](data, "name")
    age := json.GetTyped[int](data, "age")
    active := json.GetTyped[bool](data, "active")
    score := json.GetTyped[float64](data, "score")
    tags := json.GetTyped[[]any](data, "tags")

    fmt.Printf("Name: %s\n", name)
    fmt.Printf("Age: %d\n", age)
    fmt.Printf("Active: %v\n", active)
    fmt.Printf("Score: %.1f\n", score)
    fmt.Printf("Tags: %v\n", tags)
}
```

### 오류 처리

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    config := `{"timeout": 30}`

    timeout := json.GetTyped[int](config, "timeout")
    fmt.Printf("Timeout: %d\n", timeout) // 출력: 30

    // 경로가 존재하지 않으면 제로값 반환
    retries := json.GetTyped[int](config, "retries")
    fmt.Printf("Retries: %d\n", retries) // 출력: 0 (제로값)

    // 경로가 존재하지 않으면 기본값 사용
    retries = json.GetTyped[int](config, "retries", 3)
    fmt.Printf("Retries: %d\n", retries) // 출력: 3 (기본값)
}
```

---

## 성능 설명

제네릭 작업은 런타임에 리플렉션을 사용하여 타입 변환을 수행하므로, 타입 특정 getter(`GetString`, `GetInt` 등)보다 약간 느립니다. 성능에 민감한 시나리오에서는 타입 특정 함수를 사용하는 것이 좋습니다.

| 메서드 | 성능 | 권장 시나리오 |
|------|------|----------|
| `GetString`, `GetInt` 등 | 가장 빠름 | 성능 민감, 타입이 알려진 경우 |
| `GetTyped[T]` | 중간 | 커스텀 타입이 필요한 경우 |
| `SafeGet` + `AccessResult` | 중간 | 동적 타입 처리 |

---

## Result[T] 타입

`Result[T]`은 타입 안전한 제네릭 작업 결과로, 명확한 타입과 오류 처리가 필요한 시나리오에 사용됩니다.

### 구조 정의

```go
type Result[T any] struct {
    Value  T     // 결과 값
    Exists bool  // 경로를 찾았는지 여부
    Error  error // 오류 정보
}
```

### 메서드

| 메서드 | 반환 타입 | 설명 |
|------|----------|------|
| `Ok()` | `bool` | 결과 유효성 확인 (오류 없고 찾음) |
| `Unwrap()` | `T` | 반환값, 실패 시 제로값 반환 |
| `UnwrapOr(default T)` | `T` | 반환값 실패 시 기본값 반환 |

### 사용 예제

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // GetTyped는 T를 반환
    name := json.GetTyped[string](data, "user.name")
    fmt.Println("이름:", name)

    // 존재하지 않는 경로는 제로값 반환
    email := json.GetTyped[string](data, "user.email")
    fmt.Println("이메일:", email) // 출력: "" (제로값)

    // 기본값 사용
    email = json.GetTyped[string](data, "user.email", "none@example.com")
    fmt.Println("이메일:", email) // 출력: none@example.com
}
```

---

## Result[T]와 AccessResult 비교

| 특성 | Result[T] | AccessResult |
|------|-----------|---------------------|
| 타입 안전성 | 제네릭 T | any 타입 |
| 존재 여부 확인 | `Exists bool` | `Exists bool` |
| 오류 처리 | 내장 Error 필드 | 타입 변환 메서드가 error 반환 |
| 체인 호출 | 미지원 | 체인 타입 변환 지원 |
| 가져오기 방식 | `GetTyped[T]` | `SafeGet()` |
| 적합한 시나리오 | 알려진 타입 가져오기 | 동적 타입 처리 |

### 선택 권장 사항

- **알려진 타입**: `Result[T]`와 `GetTyped[T]` 사용
- **동적 타입**: `AccessResult`와 `SafeGet()` 사용
- **체인 변환이 필요한 경우**: `AccessResult` 사용
- **오류 처리가 필요한 경우**: `Result[T]`의 Error 필드 또는 `AccessResult`의 타입 변환 메서드 사용

---

## 관련 문서

- [패키지 함수](./functions) - 타입 특정 getter 함수
- [타입 정의](./types) - AccessResult 자세한 정의
- [설정](./config) - Config 설정 옵션

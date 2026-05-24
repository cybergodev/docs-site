---
title: "타입 정의 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 핵심 타입 정의 완전 레퍼런스: Result[T] 제네릭 결과, AccessResult 동적 접근 결과, BatchOperation, BatchResult, Schema 검증 모델, Stats, HealthStatus, IterableValue 및 인코딩 오류 타입을 포함하여 완전한 타입 시스템을 제공합니다."
---

# 타입 정의

json 패키지는 JSON 작업 결과를 처리하기 위한 다양한 타입 안전 타입을 제공합니다.

## Result[T] - 통합 결과 타입

`Result[T]`은 제네릭 작업 결과 타입으로, 타입 안전한 오류 처리와 값 접근을 제공합니다.

### 구조 정의

```go
type Result[T any] struct {
    Value  T     // 결과 값
    Exists bool  // 값을 찾았는지 여부
    Error  error // 오류 (있는 경우)
}
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Ok()` | `func (r Result[T]) Ok() bool` | 결과 유효성 확인 (오류 없고 찾음) |
| `Unwrap()` | `func (r Result[T]) Unwrap() T` | 반환값, 실패 시 제로값 반환 |
| `UnwrapOr()` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | 반환값 또는 기본값 |

### 사용 예제

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // GetTyped로 타입화된 값 가져오기
    name := json.GetTyped[string](data, "user.name")
    fmt.Printf("이름: %s\n", name)

    // defaultValue 매개변수로 기본값 제공
    nickname := json.GetTyped[string](data, "user.nickname", "미설정")
    fmt.Printf("닉네임: %s\n", nickname)

    age := json.GetTyped[int](data, "user.age", 0)
    fmt.Printf("나이: %d\n", age)
}
```

:::tip 명명 규칙
- **GetTyped[T]** - 지정된 타입의 값을 가져오고 `T`를 반환하며, `defaultValue` 매개변수 지원
- **Result[T]** - 내부 결과 타입, 세밀한 오류 처리가 필요한 시나리오에 사용
:::

---

## CompiledPath - 미리 컴파일된 경로

`CompiledPath`은 미리 컴파일된 JSON 경로 타입 별칭으로, 동일한 경로를 빈번하게 접근할 때 경로 문자열의 반복 파싱을 방지하여 성능을 향상시킵니다.

### 타입 정의

```go
type CompiledPath = internal.CompiledPath
```

### 사용 시나리오

동일한 경로에 대해 대량의 반복 작업이 필요한 경우 (예: 루프 내 배치 쿼리), 경로를 미리 컴파일하여 매번 호출할 때마다 경로 문자열을 반복 파싱하는 것을 방지할 수 있습니다.

### 컴파일 함수

#### Processor.CompilePath

시그니처: `func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

Processor를 통해 JSON 경로를 미리 컴파일하고, 이후 작업에서 재사용할 수 있는 `*CompiledPath` 인스턴스를 반환합니다.

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

compiled, err := processor.CompilePath("user.profile.name")
if err != nil {
    panic(err)
}
// 이후 작업에서 compiled를 반복 사용 가능
val, err := processor.GetCompiled(data, compiled)
```

:::tip 성능 팁
고빈도 반복 경로 접근의 경우, 미리 컴파일된 경로는 경로 파싱 오버헤드를 크게 줄일 수 있습니다. 배치 작업, 루프 쿼리 등의 시나리오에 적합합니다.
:::

---

## AccessResult - 속성 접근 결과

`AccessResult`은 안전한 속성 접근 결과로, 체인 타입 변환을 제공합니다.

### 구조 정의

```go
type AccessResult struct {
    Value  any    // 결과 값
    Exists bool   // 경로가 존재하는지 여부
    Type   string // 런타임 타입 정보 (디버깅용)
}
```

### 생성 메서드

#### Processor.SafeGet

시그니처: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

안전하게 속성을 가져오고, 체인 타입 변환을 위해 `AccessResult`를 반환합니다.

패키지 레벨 함수 `SafeGet`도 사용할 수 있습니다:

시그니처: `func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

result := processor.SafeGet(data, "user.age")

if !result.Exists {
    fmt.Println("경로가 존재하지 않습니다")
    return
}

// 타입 확인
fmt.Println("타입:", result.Type)
```

### 체인 타입 변환 메서드

| 메서드 | 반환 타입 | 설명 |
|------|----------|------|
| `Unwrap()` | `any` | 반환값, 존재하지 않으면 nil 반환 |
| `UnwrapOr(defaultValue)` | `any` | 반환값 또는 기본값 |
| `AsString()` | `(string, error)` | 문자열로 변환 (엄격한 타입 검사) |
| `AsStringConverted()` | `(string, error)` | 포맷팅하여 문자열로 변환 |
| `AsInt()` | `(int, error)` | 정수로 변환 (bool은 변환 안 함) |
| `AsFloat64()` | `(float64, error)` | float64로 변환 (bool은 변환 안 함) |
| `AsBool()` | `(bool, error)` | 불리언으로 변환 |
| `Ok()` | `bool` | 결과 유효성 확인 (경로가 존재하고 오류 없음) |

:::warning 주의
`AsInt64()`, `AsArray()`, `AsObject()` 메서드는 제거되었습니다. 이러한 타입을 가져오려면 `GetTyped[T]`를 사용하세요.
:::

```go
result := processor.SafeGet(data, "user.profile")

// 체인 호출
name, _ := result.AsString()
email, _ := result.AsString()
age, _ := result.AsInt()
price, _ := result.AsFloat64()
active, _ := result.AsBool()

// 배열이나 객체 타입이 필요한 경우 GetTyped 사용
arr := json.GetTyped[[]any](data, "items")
obj := json.GetTyped[map[string]any](data, "user.profile")
```

### 사용 예제

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    data := `{"user": {"name": "Alice", "age": 30, "active": true}}`

    // 안전하게 가져오고 변환
    result := processor.SafeGet(data, "user.age")

    // AccessResult 메서드 직접 사용
    age, err := result.AsInt()
    if err != nil {
        panic(err)
    }
    fmt.Printf("나이: %d\n", age)

    // 존재하지 않는 경로 가져오기
    missing := processor.SafeGet(data, "user.nickname")
    if !missing.Exists {
        fmt.Println("닉네임이 존재하지 않습니다")
    }
}
```

---

## Schema - JSON Schema 타입

`Schema`는 JSON 데이터의 구조 검증 규칙을 정의하는 데 사용되며, JSON Schema Draft 7의 하위 집합을 지원합니다.

### 구조 정의

```go
type Schema struct {
    Type                 string            `json:"type,omitempty"`
    Properties           map[string]*Schema `json:"properties,omitempty"`
    Items                *Schema           `json:"items,omitempty"`
    Required             []string          `json:"required,omitempty"`
    MinLength            int               `json:"minLength,omitempty"`
    MaxLength            int               `json:"maxLength,omitempty"`
    Minimum              float64           `json:"minimum,omitempty"`
    Maximum              float64           `json:"maximum,omitempty"`
    Pattern              string            `json:"pattern,omitempty"`
    Format               string            `json:"format,omitempty"`
    AdditionalProperties bool              `json:"additionalProperties,omitempty"`
    MinItems             int               `json:"minItems,omitempty"`
    MaxItems             int               `json:"maxItems,omitempty"`
    UniqueItems          bool              `json:"uniqueItems,omitempty"`
    Enum                 []any             `json:"enum,omitempty"`
    Const                any               `json:"const,omitempty"`
    MultipleOf           float64           `json:"multipleOf,omitempty"`
    ExclusiveMinimum     bool              `json:"exclusiveMinimum,omitempty"`
    ExclusiveMaximum     bool              `json:"exclusiveMaximum,omitempty"`
    Title                string            `json:"title,omitempty"`
    Description          string            `json:"description,omitempty"`
    Default              any               `json:"default,omitempty"`
    Examples             []any             `json:"examples,omitempty"`
}
```

### Schema 생성

#### 직접 생성

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
        "age":   {Type: "integer", Minimum: 0},
    },
}
```

#### NewSchemaWithConfig 사용

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchemaWithConfig(cfg)
```

#### DefaultSchema 사용

시그니처: `func DefaultSchema() *Schema`

기본 설정이 포함된 빈 Schema 인스턴스를 반환합니다.

```go
schema := json.DefaultSchema()
schema.Type = "object"
schema.Required = []string{"id"}
```

### SchemaConfig 구조체

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

### 사용 예제

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 구조체 리터럴로 Schema 정의
    schema := &json.Schema{
        Type:     "object",
        Required: []string{"name", "email"},
        Properties: map[string]*json.Schema{
            "name": {
                Type:      "string",
                MinLength: 1,
                MaxLength: 100,
            },
            "email": {
                Type:   "string",
                Format: "email",
            },
            "age": {
                Type:    "integer",
                Minimum: 0,
                Maximum: 150,
            },
        },
        AdditionalProperties: false,
    }

    // JSON 검증
    data := `{"name": "Alice", "email": "alice@example.com", "age": 30}`
    errors, err := json.ValidateSchema(data, schema)
    if err != nil {
        panic(err)
    }

    if len(errors) > 0 {
        for _, e := range errors {
            fmt.Printf("검증 오류 [%s]: %s\n", e.Path, e.Message)
        }
    } else {
        fmt.Println("검증 통과")
    }
}
```

---

## ValidationError

Schema 검증 오류 타입입니다.

### 구조 정의

```go
type ValidationError struct {
    Path    string // 오류가 발생한 경로
    Message string // 오류 메시지
}
```

### 메서드

#### Error

시그니처: `func (ve *ValidationError) Error() string`

error 인터페이스를 구현합니다.

```go
for _, e := range errors {
    fmt.Println(e.Error())
}
```

---

## BatchOperation

배치 작업 정의입니다.

### 구조 정의

```go
type BatchOperation struct {
    Type    string // 작업 타입: "get", "set", "delete", "validate"
    JSONStr string // JSON 데이터 문자열
    Path    string // 대상 경로
    Value   any    // Set 작업의 값
    ID      string // 작업 식별자
}
```

---

## BatchResult

배치 작업 결과입니다.

### 구조 정의

```go
type BatchResult struct {
    ID     string // 작업 식별자 (BatchOperation.ID에 해당)
    Result any    // 작업 결과
    Error  error  // 오류 (있는 경우)
}
```

---

## WarmupResult

캐시 웜업 결과입니다.

### 구조 정의

```go
type WarmupResult struct {
    TotalPaths  int      // 전체 경로 수
    Successful  int      // 웜업 성공 수
    Failed      int      // 실패 수
    SuccessRate float64  // 성공률
    FailedPaths []string // 실패한 경로 목록
}
```

---

## ParsedJSON

미리 파싱된 JSON 문서로, 여러 쿼리 작업에 재사용할 수 있습니다.

### 구조 정의

`ParsedJSON`의 내부 필드는 내보내지 않으며, 메서드를 통해 접근합니다.

```go
type ParsedJSON struct {
    // 내부 필드 (내보내지 않음)
    // Data() 메서드로 파싱된 데이터 가져오기
}
```

### Data 메서드

시그니처: `func (p *ParsedJSON) Data() any`

기저에 파싱된 데이터를 반환합니다.

### Release 메서드

시그니처: `func (p *ParsedJSON) Release()`

파싱된 데이터가 보유한 리소스를 해제합니다. `ParsedJSON`이 더 이상 필요하지 않을 때 호출하여, 기저 리소스가 가비지 컬렉션될 수 있도록 합니다.

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// JSON 사전 파싱
parsed, err := processor.PreParse(`{"user": {"name": "Alice", "age": 30}}`)
if err != nil {
    panic(err)
}

// 사전 파싱 결과에 여러 번 쿼리
name, _ := processor.GetFromParsed(parsed, "user.name")
age, _ := processor.GetFromParsed(parsed, "user.age")
```

### 사용 시나리오

| 시나리오 | 설명 |
|------|------|
| 고빈도 쿼리 | 동일 JSON을 여러 번 쿼리할 때 반복 파싱 방지 |
| 배치 경로 가져오기 | `GetMultiple`로 여러 경로를 한 번에 가져오기 |
| 성능 최적화 | 사전 파싱 후 쿼리 성능이 크게 향상 |

:::tip 성능 팁
동일한 JSON 문자열을 여러 번 쿼리해야 하는 시나리오에서는 `PreParse` 사전 파싱을 사용하면 반복 파싱 오버헤드를 방지하여 성능을 크게 향상시킬 수 있습니다.
:::

---

## Stats

프로세서 통계 정보입니다.

### 구조 정의

```go
type Stats struct {
    CacheSize        int64         // 현재 캐시 크기
    CacheMemory      int64         // 캐시 메모리 점유 (바이트)
    MaxCacheSize     int           // 최대 캐시 크기
    HitCount         int64         // 캐시 적중 수
    MissCount        int64         // 캐시 미적중 수
    HitRatio         float64       // 캐시 적중률
    CacheTTL         time.Duration // 캐시 만료 시간
    CacheEnabled     bool          // 캐시 활성화 여부
    IsClosed         bool          // 프로세서 닫힘 여부
    MemoryEfficiency float64       // 메모리 효율성
    OperationCount   int64         // 총 작업 수
    ErrorCount       int64         // 총 오류 수
}
```

---

## HealthStatus

상태 정보입니다.

### 구조 정의

```go
type HealthStatus struct {
    Timestamp time.Time              // 확인 타임스탬프
    Healthy   bool                   // 정상 여부
    Checks    map[string]CheckResult // 각 확인 항목 결과
}
```

### CheckResult 구조체

```go
type CheckResult struct {
    Healthy bool   // 해당 확인 항목이 정상인지 여부
    Message string // 확인 메시지
}
```

---

## IterableValue

반복 값 래퍼입니다.

### 메서드 개요

**기본 접근**

| 메서드 | 설명 |
|------|------|
| `Get(path)` | 경로로 값 가져오기 |
| `GetString(path)` | 문자열 가져오기 |
| `GetInt(path)` | 정수 가져오기 |
| `GetFloat64(path)` | 부동소수점 가져오기 |
| `GetBool(path)` | 불리언 가져오기 |
| `GetArray(path)` | 배열 가져오기 |
| `GetObject(path)` | 객체 가져오기 |

**기본값으로 가져오기**

| 메서드 | 설명 |
|------|------|
| `GetWithDefault(path, defaultValue)` | 값 가져오기, 존재하지 않으면 기본값 반환 |
| `GetStringWithDefault(path, defaultValue)` | 문자열 가져오기, 존재하지 않으면 기본값 반환 |
| `GetIntWithDefault(path, defaultValue)` | 정수 가져오기, 존재하지 않으면 기본값 반환 |
| `GetFloat64WithDefault(path, defaultValue)` | 부동소수점 가져오기, 존재하지 않으면 기본값 반환 |
| `GetBoolWithDefault(path, defaultValue)` | 불리언 가져오기, 존재하지 않으면 기본값 반환 |

**확인과 순회**

| 메서드 | 설명 |
|------|------|
| `Exists(path)` | 필드 존재 여부 확인 |
| `IsNull(path)` | 지정된 경로가 null인지 확인 |
| `IsNullData()` | 기저 값이 null인지 확인 |
| `IsEmpty(path)` | 지정된 경로가 비어있는지 확인 |
| `IsEmptyData()` | 기저 값이 비어있는지 확인 |
| `GetData()` | 기저 원시 데이터 가져오기 |
| `Break()` | 중단 신호 반환, 반복 중지 |
| `ForeachNested(path, fn)` | 중첩 구조 순회 |
| `Release()` | 리소스 해제 |

자세한 내용은 [반복자](./iterator) 문서를 참조하세요.

---

## 인코딩 오류 타입

json 패키지는 인코딩/디코딩 과정에서 발생하는 다음 오류 타입을 내보내며, 세밀한 오류 처리에 사용됩니다.

### SyntaxError - 문법 오류

JSON 문법 파싱 오류로, 입력 데이터가 올바른 JSON 형식이 아님을 나타냅니다.

#### 구조 정의

```go
type SyntaxError struct {
    Offset int64 // 오류 발생 위치 (바이트 오프셋)
    // 다른 비내보내기 필드 포함
}
```

#### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Error` | `func (e *SyntaxError) Error() string` | 오프셋 위치가 포함된 오류 설명 반환 |

```go
data := `{invalid json}`
_, err := json.ParseAny(data)
if syntaxErr, ok := err.(*json.SyntaxError); ok {
    fmt.Printf("문법 오류, 오프셋: %d\n", syntaxErr.Offset)
}
```

---

### UnmarshalTypeError - 역직렬화 타입 오류

JSON 값을 대상 Go 타입으로 변환할 수 없을 때 이 오류가 반환됩니다.

#### 구조 정의

```go
type UnmarshalTypeError struct {
    Value  string       // JSON 값의 설명 (예: "string", "number")
    Type   reflect.Type // 대상 Go 타입
    Offset int64        // 오류 발생 위치 (바이트 오프셋)
    Struct string       // 해당 필드를 포함하는 구조체 이름 (있는 경우)
    Field  string       // 필드 이름 (있는 경우)
    Err    error        // 내부 오류 (있는 경우)
}
```

#### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Error` | `func (e *UnmarshalTypeError) Error() string` | 타입 불일치 오류 설명 반환 |
| `Unwrap` | `func (e *UnmarshalTypeError) Unwrap() error` | 내부 오류 반환 |

```go
type User struct {
    Age int `json:"age"`
}
var user User
err := json.Unmarshal([]byte(`{"age": "not_a_number"}`), &user)
if typeErr, ok := err.(*json.UnmarshalTypeError); ok {
    fmt.Printf("타입 오류: JSON 값 %s을(를) %v(으)로 변환할 수 없습니다\n", typeErr.Value, typeErr.Type)
}
```

---

### UnsupportedTypeError - 지원하지 않는 타입 오류

Go에서 지원하지 않는 타입을 인코딩하려고 할 때 이 오류가 반환됩니다.

#### 구조 정의

```go
type UnsupportedTypeError struct {
    Type reflect.Type // 지원하지 않는 Go 타입
}
```

#### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Error` | `func (e *UnsupportedTypeError) Error() string` | 지원하지 않는 타입 설명 반환 |

```go
type Chan chan int
data := Chan(make(chan int))
_, err := json.Marshal(data)
if unsupportedErr, ok := err.(*json.UnsupportedTypeError); ok {
    fmt.Printf("지원하지 않는 타입: %v\n", unsupportedErr.Type)
}
```

---

### UnsupportedValueError - 지원하지 않는 값 오류

지원하지 않는 값을 인코딩하려고 할 때 이 오류가 반환됩니다 (예: NaN, Infinity).

#### 구조 정의

```go
type UnsupportedValueError struct {
    Value reflect.Value // 지원하지 않는 값
    Str   string        // 오류 설명
}
```

#### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Error` | `func (e *UnsupportedValueError) Error() string` | 지원하지 않는 값 설명 반환 |

```go
val := math.NaN()
_, err := json.Marshal(val)
if valErr, ok := err.(*json.UnsupportedValueError); ok {
    fmt.Printf("지원하지 않는 값: %s\n", valErr.Str)
}
```

---

### InvalidUnmarshalError - 유효하지 않은 역직렬화 대상 오류

`Unmarshal`의 대상 매개변수가 포인터나 nil이 아닐 때 이 오류가 반환됩니다.

#### 구조 정의

```go
type InvalidUnmarshalError struct {
    Type reflect.Type // 대상 매개변수의 타입
}
```

#### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Error` | `func (e *InvalidUnmarshalError) Error() string` | 유효하지 않은 대상 오류 설명 반환 |

```go
var target string // 포인터를 전달해야 함
err := json.Unmarshal([]byte(`"hello"`), target) // 오류: 포인터 미전달
if invalidErr, ok := err.(*json.InvalidUnmarshalError); ok {
    fmt.Printf("유효하지 않은 역직렬화 대상: %v\n", invalidErr.Type)
}
```

---

### MarshalerError - 인코더 오류

타입의 `MarshalJSON` 또는 `MarshalText` 메서드가 오류를 반환할 때 이 오류로 래핑됩니다.

#### 구조 정의

```go
type MarshalerError struct {
    Type reflect.Type // MarshalJSON 또는 MarshalText를 구현한 타입
    Err  error        // MarshalJSON 또는 MarshalText가 반환한 오류
    // 다른 비내보내기 필드 포함
}
```

#### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Error` | `func (e *MarshalerError) Error() string` | 인코더 오류 설명 반환 |
| `Unwrap` | `func (e *MarshalerError) Unwrap() error` | 내부 오류 반환 |

```go
type BadMarshaler struct{}

func (BadMarshaler) MarshalJSON() ([]byte, error) {
    return nil, errors.New("marshal failed")
}

_, err := json.Marshal(BadMarshaler{})
if marshalErr, ok := err.(*json.MarshalerError); ok {
    fmt.Printf("인코더 오류 (타입: %v): %v\n", marshalErr.Type, marshalErr.Err)
}
```

---

## Encoder - JSON 인코더

`Encoder`는 JSON 값을 출력 스트림에 씁니다. `encoding/json.Encoder`와 100% 호환됩니다.

### 생성

시그니처: `func NewEncoder(w io.Writer, cfg ...Config) *Encoder`

`w`에 쓰는 인코더를 생성합니다. 선택적 `Config` 매개변수로 커스텀 인코딩 동작을 지원합니다.

```go
file, _ := os.Create("output.json")
defer file.Close()

encoder := json.NewEncoder(file)
err := encoder.Encode(map[string]any{"name": "Alice"})
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Encode` | `func (enc *Encoder) Encode(v any) error` | Go 값을 JSON으로 인코딩하여 스트림에 씀 |
| `SetEscapeHTML` | `func (enc *Encoder) SetEscapeHTML(on bool)` | HTML 특수 문자 이스케이프 여부 설정 |
| `SetIndent` | `func (enc *Encoder) SetIndent(prefix, indent string)` | 들여쓰기 형식 설정 |

### 사용 예제

```go
package main

import (
    "bytes"
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    var buf bytes.Buffer
    encoder := json.NewEncoder(&buf)
    encoder.SetIndent("", "  ")
    encoder.SetEscapeHTML(true)

    err := encoder.Encode(map[string]any{
        "name":  "Alice",
        "email": "alice@example.com",
    })
    if err != nil {
        panic(err)
    }
    fmt.Println(buf.String())
}
```

---

## Decoder - JSON 디코더

`Decoder`는 입력 스트림에서 JSON 값을 읽고 디코딩합니다. `encoding/json.Decoder`와 100% 호환됩니다.

### 생성

시그니처: `func NewDecoder(r io.Reader, cfg ...Config) *Decoder`

`r`에서 읽는 디코더를 생성합니다. 선택적 `Config` 매개변수를 지원합니다.

```go
file, _ := os.Open("data.json")
defer file.Close()

decoder := json.NewDecoder(file)
for decoder.More() {
    var obj map[string]any
    if err := decoder.Decode(&obj); err != nil {
        break
    }
    fmt.Println(obj)
}
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Decode` | `func (dec *Decoder) Decode(v any) error` | 스트림에서 다음 JSON 값을 읽고 디코딩 |
| `UseNumber` | `func (dec *Decoder) UseNumber()` | 디코더가 숫자를 `float64` 대신 `Number`로 파싱 |
| `DisallowUnknownFields` | `func (dec *Decoder) DisallowUnknownFields()` | 디코딩 시 알 수 없는 필드를 만나면 오류 반환 |
| `Buffered` | `func (dec *Decoder) Buffered() io.Reader` | 디코더 버퍼에 남은 데이터의 Reader 반환 |
| `InputOffset` | `func (dec *Decoder) InputOffset() int64` | 현재 입력 위치의 오프셋 반환 |
| `More` | `func (dec *Decoder) More() bool` | 스트림에 더 많은 JSON 값이 있는지 확인 |
| `Token` | `func (dec *Decoder) Token() (Token, error)` | 다음 JSON 토큰 읽기 |

### 사용 예제

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    input := `{"name":"Alice","age":30}{"name":"Bob","age":25}`
    decoder := json.NewDecoder(strings.NewReader(input))

    for decoder.More() {
        var person map[string]any
        if err := decoder.Decode(&person); err != nil {
            break
        }
        fmt.Printf("이름: %s, 나이: %v\n", person["name"], person["age"])
    }
}
```

### 스트리밍 디코딩 예제

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    // JSON 스트림에서 여러 값 디코딩
    input := `[1,2,3][4,5,6]`
    decoder := json.NewDecoder(strings.NewReader(input))

    for decoder.More() {
        var arr []any
        if err := decoder.Decode(&arr); err != nil {
            panic(err)
        }
        fmt.Println(arr)
    }
}
```

### Token 읽기 예제

```go
decoder := json.NewDecoder(strings.NewReader(`{"name":"Alice"}`))
for {
    token, err := decoder.Token()
    if err != nil {
        break
    }
    switch v := token.(type) {
    case json.Delim:
        fmt.Printf("구분자: %s\n", string(v))
    case string:
        fmt.Printf("문자열: %s\n", v)
    case float64:
        fmt.Printf("숫자: %v\n", v)
    case bool:
        fmt.Printf("불리언: %v\n", v)
    case nil:
        fmt.Println("null")
    }
}
```

---

## Token - JSON 토큰

`Token`은 JSON 토큰 값으로, 다음 타입 중 하나를 저장합니다:

- `Delim`, 네 개의 JSON 구분자 `[ ] { }`를 나타냄
- `bool`, JSON 불리언 값을 나타냄
- `float64`, JSON 숫자를 나타냄
- `Number`, `UseNumber` 활성화 시 JSON 숫자를 나타냄
- `string`, JSON 문자열을 나타냄
- `nil`, JSON null을 나타냄

```go
type Token any
```

`Decoder.Token()`으로 가져옵니다.

---

## Number - JSON 숫자

`Number`는 JSON 숫자 문자열을 나타내며, `UseNumber` 모드가 활성화된 경우 Decoder에서 사용됩니다.

```go
type Number string
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `String` | `func (n Number) String() string` | 숫자의 문자열 표현 반환 |
| `Float64` | `func (n Number) Float64() (float64, error)` | float64로 변환 |
| `Int64` | `func (n Number) Int64() (int64, error)` | int64로 변환 |

```go
decoder := json.NewDecoder(strings.NewReader(`{"price": 19.99}`))
decoder.UseNumber()
var obj map[string]any
decoder.Decode(&obj)

if num, ok := obj["price"].(json.Number); ok {
    f, _ := num.Float64()
    fmt.Println(f) // 19.99
}
```

---

## Delim - JSON 구분자

`Delim`은 JSON 구분자 타입으로, `[`, `]`, `{`, `}` 네 문자에 해당합니다.

```go
type Delim rune
```

### 메서드

#### String

시그니처: `func (d Delim) String() string`

구분자의 문자열 표현을 반환합니다.

```go
token, _ := decoder.Token()
if delim, ok := token.(json.Delim); ok {
    fmt.Println(delim.String()) // "[" 또는 "{" 등
}
```

---

## 관련 문서

- [패키지 함수](./functions) - 패키지 레벨 함수 레퍼런스
- [Config](./config) - 설정 옵션
- [Processor](./processor/) - 프로세서 메서드
- [인터페이스 정의](./interfaces) - 확장 인터페이스

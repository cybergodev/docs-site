---
title: "Processor 경로 쿼리 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Processor 경로 쿼리 메서드 완전 레퍼런스: Get/GetString/GetInt 등 타입 안전 가져오기, GetMultiple 배치 쿼리, SafeGet 안전 가져오기 (AccessResult 반환), GetTyped[T] 제네릭 가져오기를 포함하며, JSONPath 표현식과 캐시 최적화를 지원합니다."
---

# 경로 쿼리 메서드

Processor는 다양한 타입 안전 경로 쿼리 메서드를 제공합니다.

## 기본 쿼리

### Get

시그니처: `func (p *Processor) Get(jsonStr, path string, cfg ...Config) (any, error)`

지정된 경로에서 임의 타입의 값을 가져옵니다.

```go
val, err := p.Get(data, "items[0]")
if err != nil {
    panic(err)
}
```

### GetString

시그니처: `func (p *Processor) GetString(jsonStr, path string, defaultValue ...string) string`

지정된 경로에서 문자열 값을 가져옵니다. 경로가 존재하지 않거나, 값이 null이거나, 타입 변환에 실패하면 빈 문자열 또는 `defaultValue`를 반환합니다.

```go
// 기본값 없이
name := p.GetString(data, "user.name")

// 기본값 제공
email := p.GetString(data, "user.email", "unknown@example.com")
```

### GetInt

시그니처: `func (p *Processor) GetInt(jsonStr, path string, defaultValue ...int) int`

지정된 경로에서 정수 값을 가져옵니다. 경로가 존재하지 않거나, 값이 null이거나, 타입 변환에 실패하면 0 또는 `defaultValue`를 반환합니다.

```go
count := p.GetInt(data, "count")
timeout := p.GetInt(data, "timeout", 30)
```

### GetFloat

시그니처: `func (p *Processor) GetFloat(jsonStr, path string, defaultValue ...float64) float64`

지정된 경로에서 부동소수점 값을 가져옵니다. 경로가 존재하지 않거나, 값이 null이거나, 타입 변환에 실패하면 0 또는 `defaultValue`를 반환합니다.

```go
price := p.GetFloat(data, "price")
rate := p.GetFloat(data, "rate", 0.5)
```

### GetBool

시그니처: `func (p *Processor) GetBool(jsonStr, path string, defaultValue ...bool) bool`

지정된 경로에서 불리언 값을 가져옵니다. 경로가 존재하지 않거나, 값이 null이거나, 타입 변환에 실패하면 false 또는 `defaultValue`를 반환합니다.

```go
enabled := p.GetBool(data, "enabled")
debug := p.GetBool(data, "debug", false)
```

### GetWithContext

시그니처: `func (p *Processor) GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

컨텍스트가 있는 경로 가져오기입니다. 시간 초과 및 취소 작업을 지원하며, `Get`의 컨텍스트 인식 버전입니다.

:::info 주의
Context는 작업 전후에 확인되며, 파싱/탐색 과정에서는 확인되지 않습니다. 대용량 JSON 문서의 경우 작업 중 취소에 응답하지 않을 수 있습니다.
:::

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

val, err := p.GetWithContext(ctx, data, "items[0].name")
if err != nil {
    panic(err)
}
fmt.Println(val)
```

## 안전한 쿼리

### SafeGet

시그니처: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

안전하게 값을 가져오며, AccessResult 구조체를 반환합니다. 타입 변환이 필요한 시나리오에 적합합니다.

```go
result := p.SafeGet(data, "user.age")
if result.Ok() {
    age, err := result.AsInt()
    if err != nil {
        // 타입 변환 실패
    }
    fmt.Println(age)
}

// 다른 타입으로도 가져오기 가능
name, err := result.AsString()
price, err := result.AsFloat64()
enabled, err := result.AsBool()
```

**AccessResult 메서드**:

| 메서드 | 설명 |
|------|------|
| `Ok() bool` | 값 존재 여부 확인 |
| `Unwrap() any` | 원시 값 가져오기 |
| `UnwrapOr(defaultValue any) any` | 값 또는 기본값 가져오기 |
| `AsString() (string, error)` | 안전하게 문자열로 변환 |
| `AsStringConverted() (string, error)` | 포맷팅하여 문자열로 변환 |
| `AsInt() (int, error)` | 안전하게 정수로 변환 |
| `AsFloat64() (float64, error)` | 안전하게 부동소수점으로 변환 |
| `AsBool() (bool, error)` | 안전하게 불리언으로 변환 |

## 컬렉션 가져오기

### GetArray

시그니처: `func (p *Processor) GetArray(jsonStr, path string, defaultValue ...[]any) []any`

지정된 경로에서 배열을 가져옵니다. 경로가 존재하지 않거나, 값이 null이거나, 타입 변환에 실패하면 nil 또는 `defaultValue`를 반환합니다.

```go
items := p.GetArray(data, "items")
tags := p.GetArray(data, "tags", []any{"default"})
```

### GetObject

시그니처: `func (p *Processor) GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

지정된 경로에서 객체를 가져옵니다. 경로가 존재하지 않거나, 값이 null이거나, 타입 변환에 실패하면 nil 또는 `defaultValue`를 반환합니다.

```go
profile := p.GetObject(data, "user.profile")
config := p.GetObject(data, "config", map[string]any{"timeout": 30})
```

## 제네릭 가져오기

:::tip 패키지 레벨 함수
`GetTyped[T]`는 패키지 레벨 함수이며 Processor 메서드가 아닙니다. 자세한 내용은 [제네릭 작업](../generics#gettyped)을 참조하세요.
:::

```go
// 패키지 레벨 GetTyped 사용
user := json.GetTyped[User](data, "user")

// 기본값 포함
user = json.GetTyped[User](data, "user", User{Name: "unknown"})
```

## 배치 쿼리

### GetMultiple

시그니처: `func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

여러 경로의 값을 한 번에 가져오며, 경로-값 매핑을 반환합니다.

```go
results, err := p.GetMultiple(data, []string{"user.name", "user.age", "user.email"})
if err != nil {
    panic(err)
}
fmt.Println(results["user.name"]) // Alice
fmt.Println(results["user.age"])  // 30
```

## 경로 컴파일

### CompilePath

시그니처: `func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

경로 표현식을 미리 컴파일하여 이후 빠른 반복 작업에 사용합니다.

```go
cp, err := p.CompilePath("users[0].name")
if err != nil {
    panic(err)
}
defer cp.Release()

// 컴파일된 경로로 여러 번 쿼리
value, err := p.GetCompiled(data1, cp)
value, err = p.GetCompiled(data2, cp)
```

### GetCompiled

시그니처: `func (p *Processor) GetCompiled(jsonStr string, cp *CompiledPath) (any, error)`

미리 컴파일된 경로를 사용하여 값을 가져옵니다. 여러 JSON 데이터에서 동일한 경로를 반복 쿼리하는 데 적합합니다.

```go
cp, _ := p.CompilePath("items[0].id")
defer cp.Release()

for _, jsonStr := range jsonStrings {
    id, err := p.GetCompiled(jsonStr, cp)
    if err != nil {
        continue
    }
    fmt.Println(id)
}
```

## 관련 문서

- [데이터 수정](./modify) - Set/Delete 메서드
- [배치 작업](./batch) - ProcessBatch 배치 처리
- [제네릭 작업](../generics) - GetTyped[T] 제네릭 가져오기

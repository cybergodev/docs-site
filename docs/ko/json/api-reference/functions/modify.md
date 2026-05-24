---
title: "수정 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 수정 함수 완전 참조: Set/SetMultiple 값 설정, Delete 키 삭제, MergeJSON/MergeMany JSON 병합을 포함하며, 자동 경로 생성, 원자적 작업 및 다양한 MergeMode 병합 전략을 지원하여 모든 JSON 데이터 수정 요구를 충족합니다."
---

# 수정 함수

json 패키지가 제공하는 JSON 수정 함수로, 경로 설정, 배치 업데이트 및 삭제 작업을 지원합니다.

## 설정 함수

### Set

시그니처: `func Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

지정된 경로에 값을 설정하고, 수정된 JSON 문자열을 반환합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `jsonStr` | `string` | 예 | JSON 문자열 |
| `path` | `string` | 예 | 경로 표현식 |
| `value` | `any` | 예 | 설정할 값 |
| `cfg` | `Config` | 아니오 | 선택적 설정 |

**예제**

```go
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
if err != nil {
    panic(err)
}
fmt.Println(result) // {"user":{"name":"Alice"}}
```

**경로가 존재하지 않을 때 자동 생성**

```go
// 중간 경로 자동 생성
result, err := json.Set(`{}`, "user.profile.name", "Bob")
// {"user":{"profile":{"name":"Bob"}}}
```

**다양한 타입 값 설정**

```go
data := `{}`

// 문자열 설정
json.Set(data, "user.name", "Alice")

// 숫자 설정
json.Set(data, "user.age", 30)

// 불리언 설정
json.Set(data, "user.active", true)

// null 설정
json.Set(data, "user.deleted", nil)

// 중첩 객체 설정
json.Set(data, "user.address", map[string]any{
    "city": "Seoul",
    "zip":  "04500",
})

// 배열 설정
json.Set(data, "user.tags", []string{"admin", "developer"})
```

### SetMultiple

시그니처: `func SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

여러 경로의 값을 배치로 설정합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `jsonStr` | `string` | 예 | JSON 문자열 |
| `updates` | `map[string]any` | 예 | 경로-값 매핑 |
| `cfg` | `Config` | 아니오 | 선택적 설정 |

**예제**

```go
updates := map[string]any{
    "user.name": "Bob",
    "user.age":  25,
    "user.email": "bob@example.com",
}
result, err := json.SetMultiple(data, updates)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**성능 이점**

여러 수정 작업의 경우 `SetMultiple`이 `Set`을 여러 번 호출하는 것보다 더 효율적입니다:

```go
// 권장: 한 번의 호출
updates := map[string]any{"a": 1, "b": 2, "c": 3}
result, err := json.SetMultiple(data, updates)

// 비권장: 여러 번의 호출
result, err := json.Set(data, "a", 1)
result, err = json.Set(result, "b", 2)
result, err = json.Set(result, "c", 3)
```

### SetCreate

시그니처: `func SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

값을 설정하고 존재하지 않는 중간 경로를 자동으로 생성합니다. `Config.CreatePaths = true`로 설정한 `Set`과 동일합니다.

```go
// 중간 경로가 존재하지 않을 때 자동 생성
result, err := json.SetCreate(`{}`, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

### SetMultipleCreate

시그니처: `func SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

여러 값을 배치로 설정하고 중간 경로를 자동으로 생성합니다.

```go
result, err := json.SetMultipleCreate(`{}`, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "Korea",
})
```

## 삭제 함수

### Delete

시그니처: `func Delete(jsonStr, path string, cfg ...Config) (string, error)`

지정된 경로의 값을 삭제합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `jsonStr` | `string` | 예 | JSON 문자열 |
| `path` | `string` | 예 | 경로 표현식 |
| `cfg` | `Config` | 아니오 | 선택적 설정 |

**예제**

```go
result, err := json.Delete(data, "user.temporary")
if err != nil {
    panic(err)
}
```

**객체 속성 삭제**

```go
// 단일 속성 삭제
result, err := json.Delete(`{"user":{"name":"Alice","temp":"value"}}`, "user.temp")
// {"user":{"name":"Alice"}}
```

**배열 요소 삭제**

```go
// 배열의 요소 삭제 (인덱스는 0부터 시작)
result, err := json.Delete(`{"items":["a","b","c"]}`, "items[1]")
// {"items":["a","c"]}
```

**경로가 존재하지 않는 경우**

```go
// 경로가 존재하지 않으면 원래 JSON과 오류 반환
result, err := json.Delete(`{"a":1}`, "nonexistent.path")
if err != nil {
    // err은 ErrPathNotFound를 래핑한 JsonsError를 포함
    fmt.Println("삭제 실패:", err)
}
// result는 여전히 원래 JSON: {"a":1}
```

### DeleteClean

시그니처: `func DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

지정된 경로를 삭제하고 생성된 빈 값과 빈 배열을 자동으로 정리합니다.

```go
// 원래 데이터: {"user": {"temp": "value", "name": "test"}}
result, err := json.DeleteClean(data, "user.temp")
// {"user":{"name":"test"}}

// 삭제 후 부모 객체가 비어 있으면 계속 정리
// {"user": {}} -> {}
```

## 병합 함수

### MergeJSON

시그니처: `func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

깊은 병합 전략을 사용하여 두 JSON 객체를 병합합니다. 중첩 객체의 경우 `Config.MergeMode`에서 지정한 모드에 따라 키를 재귀적으로 병합합니다. 원시 값과 배열의 경우 patch 값이 우선합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `json1` | `string` | 예 | 기본 JSON 문자열 |
| `json2` | `string` | 예 | 덮어쓰기 JSON 문자열 |
| `cfg` | `...Config` | 아니오 | 선택적 설정 (`MergeMode`로 병합 모드 설정) |

**병합 모드** (`Config.MergeMode`로 설정, 기본값은 `MergeUnion`):

| 모드 | 객체 동작 | 배열 동작 |
|------|----------|----------|
| `MergeUnion` | 모든 키를 병합하고 충돌 시 patch 값 사용 | 모든 요소를 병합하고 중복 제거 |
| `MergeIntersection` | 공통 키만 보존, 값은 patch에서 가져옴 | 공통 요소만 보존 |
| `MergeDifference` | base에만 존재하는 키만 보존 | base에만 존재하는 요소만 보존 |

```go
base := `{"a": 1, "b": 2, "nested": {"x": 10, "y": 20}}`
override := `{"b": 3, "c": 4, "nested": {"y": 30, "z": 40}}`

// 통합 병합 (기본값)
result, _ := json.MergeJSON(base, override)
// 결과: {"a":1,"b":3,"c":4,"nested":{"x":10,"y":30,"z":40}}

// 교집합 병합 - 공통 키만 보존
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, _ = json.MergeJSON(base, override, cfg)
// 결과: {"b":3,"nested":{"y":30}}

// 차집합 병합 - base에만 존재하는 키만 보존
cfg = json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, _ = json.MergeJSON(base, override, cfg)
// 결과: {"a":1,"nested":{"x":10}}
```

### MergeMany

시그니처: `func MergeMany(jsons []string, cfg ...Config) (string, error)`

여러 JSON 객체를 병합합니다. 최소 2개의 JSON 문자열이 필요합니다. `Config.MergeMode`로 병합 모드를 설정할 수 있습니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `jsons` | `[]string` | 예 | 병합할 JSON 문자열 슬라이스 (최소 2개) |
| `cfg` | `...Config` | 아니오 | 선택적 설정 (`MergeMode`로 병합 모드 설정) |

```go
config1 := `{"api": "v1", "timeout": 30, "retries": 1}`
config2 := `{"timeout": 60, "retries": 3}`
config3 := `{"retries": 5, "debug": true}`

// 기본 통합 병합
result, err := json.MergeMany([]string{config1, config2, config3})
// 결과: {"api":"v1","timeout":60,"retries":5,"debug":true}
```

## 배치 작업

### ProcessBatch

시그니처: `func ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

여러 JSON 작업을 배치로 처리합니다 (패키지 레벨 함수, Processor 생성 불필요).

```go
jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

operations := []json.BatchOperation{
    {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
    {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
}

results, err := json.ProcessBatch(operations)
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

### BatchOperation

배치 작업 설명 구조체입니다.

```go
type BatchOperation struct {
    Type    string  // 작업 유형: "get", "set", "delete", "validate"
    JSONStr string  // 대상 JSON 문자열
    Path    string  // 경로 표현식
    Value   any     // 작업 값 (set 작업에서 사용)
    ID      string  // 작업 식별자
}
```

### BatchResult

배치 작업 결과 구조체입니다.

```go
type BatchResult struct {
    ID     string  // 작업 식별자
    Result any     // 작업 결과
    Error  error   // 오류 정보
}
```

## Processor 메서드

Processor는 패키지 레벨 함수와 동일한 시그니처의 수정 메서드를 제공합니다:

```go
p, err := json.New()

result, err := p.Set(jsonStr, "user.name", "Alice")
result, err := p.Delete(jsonStr, "user.temp")
result, err := p.SetCreate(jsonStr, "user.email", "test@example.com")
```

## 관련 문서

- [조회 가져오기 함수](./get) - Get, GetString 등 조회 작업
- [인코딩 디코딩 함수](./encode-decode) - Marshal, Unmarshal 등 직렬화 작업
- [보조 함수](../helpers) - CompareJSON 등 도구 함수

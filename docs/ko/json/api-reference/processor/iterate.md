---
title: "Processor 반복 메서드 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Processor 반복 메서드: Foreach, ForeachWithPath, ForeachNested, IterableValue, IteratorControl로 배치 반복 실무를 지원합니다."
---

# 반복 메서드

Processor는 JSON 배열과 객체를 반복하는 다양한 메서드를 제공합니다.

## Foreach

시그니처: `func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue))`

JSON 배열 또는 객체를 반복합니다.

```go
p.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**배열 반복 시**: key는 인덱스(int)
**객체 반복 시**: key는 키 이름(string)

## ForeachWithPath

시그니처: `func (p *Processor) ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue)) error`

경로로 반복하며, 오류를 반환합니다.

```go
err := p.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

적합한 시나리오:
- 중첩 배열 반복
- 지정된 경로의 객체 반복

## ForeachNested

시그니처: `func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue))`

모든 중첩 레벨을 재귀적으로 반복합니다.

```go
p.ForeachNested(data, func(key any, item *json.IterableValue) {
    fmt.Printf("키: %v, 값: %v\n", key, item.GetData())
})
```

예제 데이터:

```json
{
  "user": {
    "name": "test",
    "profile": {
      "age": 25,
      "tags": ["a", "b"]
    }
  }
}
```

출력:

```text
키: user, 값: map[string]any{...}
키: name, 값: test
키: profile, 값: map[string]any{...}
키: age, 값: 25
키: tags, 값: []any{...}
...
```

## ForeachReturn

시그니처: `func (p *Processor) ForeachReturn(jsonStr string, fn func(key any, item *IterableValue)) (string, error)`

반복하고 원시 JSON을 반환합니다 (읽기 전용 작업).

```go
result, err := p.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // 읽기 전용 처리
})
```

반복 후 체인 작업을 계속해야 하는 시나리오에 적합합니다.

## ForeachWithError

시그니처: `func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

경로로 반복하며, 콜백이 오류 반환을 지원합니다.

```go
err := p.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // 반복 계속
})
```

## ForeachNestedWithError

시그니처: `func (p *Processor) ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

모든 중첩 레벨을 재귀적으로 반복하며, 콜백이 오류 반환을 지원합니다.

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("키: %v, 값: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

시그니처: `func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

경로로 반복하며 현재 경로 정보를 제공합니다. `IteratorControl`로 반복 흐름을 제어합니다.

```go
err := p.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("경로: %s, 키: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // 반복 중지
    }
    return json.IteratorNormal // 반복 계속
})
```

## ForeachWithPathAndControl

시그니처: `func (p *Processor) ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl) error`

경로로 원시 값을 반복하며, `IteratorControl`로 흐름을 제어합니다.

```go
err := p.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("키: %v, 값: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

반복 콜백의 `IterableValue`는 다음 기능을 제공합니다:

| 메서드 | 설명 |
|------|------|
| `GetData() any` | 현재 값 가져오기 |
| `Get(path string) any` | 경로로 값 가져오기 |
| `GetString(key string) string` | 문자열 값 가져오기 |
| `GetInt(key string) int` | 정수 값 가져오기 |
| `GetFloat64(key string) float64` | 부동소수점 값 가져오기 |
| `GetBool(key string) bool` | 불리언 값 가져오기 |
| `GetArray(key string) []any` | 배열 값 가져오기 |
| `GetObject(key string) map[string]any` | 객체 값 가져오기 |
| `GetWithDefault(key string, defaultValue any) any` | 값 가져오기 (기본값 포함) |
| `GetStringWithDefault(key string, defaultValue string) string` | 문자열 가져오기 (기본값 포함) |
| `GetIntWithDefault(key string, defaultValue int) int` | 정수 가져오기 (기본값 포함) |
| `GetFloat64WithDefault(key string, defaultValue float64) float64` | 부동소수점 가져오기 (기본값 포함) |
| `GetBoolWithDefault(key string, defaultValue bool) bool` | 불리언 가져오기 (기본값 포함) |
| `Exists(key string) bool` | 필드 존재 여부 확인 |
| `IsNull(key string) bool` | 필드가 null인지 확인 |
| `IsNullData() bool` | 현재 값이 null인지 확인 |
| `IsEmpty(key string) bool` | 필드가 비어있는지 확인 |
| `IsEmptyData() bool` | 현재 값이 비어있는지 확인 |
| `Break() error` | 반복 중단 오류 신호 반환 |
| `Release()` | 객체 풀로 리소스 해제 |
| `ForeachNested(path string, fn func(key any, item *IterableValue))` | 중첩 구조 재귀 반복 |

## 메서드 비교

| 메서드 | 경로 매개변수 | 재귀 | 반환값 | 오류 콜백 |
|------|:--------:|:----:|--------|:--------:|
| `Foreach` | 없음 | 아니요 | 없음 | 아니요 |
| `ForeachWithPath` | 있음 | 아니요 | error | 아니요 |
| `ForeachNested` | 없음 | 예 | 없음 | 아니요 |
| `ForeachReturn` | 없음 | 아니요 | (string, error) | 아니요 |
| `ForeachWithError` | 있음 | 아니요 | error | 예 |
| `ForeachNestedWithError` | 없음 | 예 | error | 예 |
| `ForeachWithPathAndIterator` | 있음 | 아니요 | error | IteratorControl |
| `ForeachWithPathAndControl` | 있음 | 아니요 | error | IteratorControl |

---

## 파일 반복 메서드

Processor는 파일에서 직접 반복하는 메서드를 제공하여, 대용량 JSON 파일 처리에 적합합니다.

### ForeachFile

시그니처: `func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

파일에서 JSON을 로드하고 반복합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `filePath` | `string` | JSON 파일 경로 |
| `fn` | `func(key any, item *IterableValue) error` | 반복 콜백 |

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // 반복 계속
})
```

---

### ForeachFileWithPath

시그니처: `func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

파일에서 JSON을 로드하고 경로로 반복합니다.

```go
// users 배열만 반복
err := p.ForeachFileWithPath("data.json", ".users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("사용자: %s\n", name)
    return nil
})
```

---

### ForeachFileChunked

시그니처: `func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

파일의 JSON 배열을 청크 단위로 반복하여, 대용량 데이터셋의 배치 처리에 적합합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `filePath` | `string` | JSON 파일 경로 |
| `chunkSize` | `int` | 배치당 처리 수량 (0 이하는 기본값 100) |
| `fn` | `func(chunk []*IterableValue) error` | 배치 처리 콜백 |

```go
// 배치당 100개의 레코드 처리
err := p.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    // 데이터베이스에 배치 삽입
    records := make([]Record, len(chunk))
    for i, item := range chunk {
        records[i] = Record{
            ID:   item.GetInt("id"),
            Name: item.GetString("name"),
        }
    }
    return db.BatchInsert(records)
})
```

:::tip 사용 시나리오
- 데이터베이스 배치 삽입
- 배치 API 호출
- 메모리 제약이 있는 대용량 파일 처리
:::

---

### ForeachFileNested

시그니처: `func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

파일에서 JSON을 로드하고 모든 중첩 구조를 재귀적으로 반복합니다.

```go
err := p.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    // 모든 레벨의 모든 키-값 쌍 순회
    fmt.Printf("경로: %v, 타입: %T\n", key, item.GetData())
    return nil
})
```

**예제 데이터**:

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "pool": {
      "min": 5,
      "max": 20
    }
  }
}
```

**출력**:

```text
경로: database, 타입: map[string]any
경로: host, 타입: string
경로: port, 타입: float64
경로: pool, 타입: map[string]any
경로: min, 타입: float64
경로: max, 타입: float64
```

---

## 파일 반복 메서드 비교

| 메서드 | 경로 매개변수 | 재귀 | 청크 | 적합한 시나리오 |
|------|:--------:|:----:|:----:|----------|
| `ForeachFile` | 없음 | 아니요 | 아니요 | 간단한 파일 순회 |
| `ForeachFileWithPath` | 있음 | 아니요 | 아니요 | 특정 위치 순회 |
| `ForeachFileChunked` | 없음 | 아니요 | **예** | 배치 처리, 메모리 제약 |
| `ForeachFileNested` | 없음 | **예** | 아니요 | 모든 노드 깊이 순회 |

---

## 반복 제어

### 반복 중단

콜백 함수에서 `item.Break()`를 반환하면 반복을 중단할 수 있습니다:

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        // 대상을 찾음, 반복 중지
        return item.Break()
    }
    return nil // 반복 계속
})
```

### 오류 처리

다른 오류를 반환하면 반복을 중단하고 해당 오류를 반환합니다:

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "error" {
        return fmt.Errorf("오류 레코드 발견: %v", key)
    }
    return nil
})
if err != nil {
    log.Printf("반복 중단: %v", err)
}
```

---

## 관련 문서

- [경로 쿼리](./query) - Get 시리즈 메서드
- [배치 작업](./batch) - ProcessBatch 배치 처리
- [파일 작업](../functions/file-io) - LoadFromFile/SaveToFile

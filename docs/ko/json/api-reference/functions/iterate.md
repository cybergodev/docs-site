---
sidebar_label: "반복 메서드"
title: "패키지 레벨 반복 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 패키지 레벨 반복 함수: Foreach, ForeachWithPath, ForeachNested 재귀, ForeachWithError 오류 처리와 IterableValue 데이터 접근, ForeachFile 파일 반복 포함."
sidebar_position: 10
---

# 패키지 레벨 반복 함수

Processor 인스턴스를 생성하지 않고 직접 호출할 수 있는 반복 함수입니다. [Processor 반복 메서드](../processor/iterate)와 일대일로 대응됩니다(이중 계층 설계).

## Foreach

시그니처: `func Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

JSON 배열 또는 객체를 순회합니다.

```go
json.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**배열 순회 시**: key는 인덱스(int)
**객체 순회 시**: key는 키 이름(string)

## ForeachWithPath

시그니처: `func ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue), cfg ...Config) error`

경로를 따라 순회하며, 오류를 반환합니다.

```go
err := json.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

적용 사례:
- 중첩 배열 순회
- 지정된 경로의 객체 순회

## ForeachNested

시그니처: `func ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

모든 중첩 수준을 재귀적으로 순회합니다.

```go
json.ForeachNested(data, func(key any, item *json.IterableValue) {
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

시그니처: `func ForeachReturn(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config) (string, error)`

JSON 데이터를 순회하며 콜백으로 각 요소에 접근하고, 다시 직렬화한 JSON 문자열을 반환합니다. 콜백은 `GetData()`를 통해 map/slice를 수정할 수 있으며, 수정 사항은 반환값에 반영됩니다.

```go
result, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // item.GetData()로 요소에 접근/수정 가능
})
```

순회 후 체인 작업을 이어가야 하는 시나리오에 적합합니다.

## ForeachWithError

시그니처: `func ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

경로를 따라 순회하며, 콜백이 오류를 반환할 수 있습니다.

```go
err := json.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // 반복 계속
})
```

## ForeachNestedWithError

시그니처: `func ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

모든 중첩 수준을 재귀적으로 순회하며, 콜백이 오류를 반환할 수 있습니다.

```go
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("키: %v, 값: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

시그니처: `func ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl, cfg ...Config) error`

경로를 따라 순회하며 현재 경로 정보를 제공합니다. `IteratorControl`로 반복 흐름을 제어합니다.

```go
err := json.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("경로: %s, 키: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // 반복 중단
    }
    return json.IteratorNormal // 반복 계속
})
```

## ForeachWithPathAndControl

시그니처: `func ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl, cfg ...Config) error`

경로를 따라 원시 값을 순회하며, `IteratorControl`로 흐름을 제어합니다.

```go
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("키: %v, 값: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

반복 콜백의 `IterableValue`는 편리한 값 접근 기능을 제공합니다. 전체 메서드 정의는 [반복기 타입](../iterator#iterablevalue-타입)을 참조하세요.

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
| `Exists(key string) bool` | 필드 존재 여부 확인 |
| `IsNull(key string) bool` / `IsNullData() bool` | null 여부 확인 |
| `IsEmpty(key string) bool` / `IsEmptyData() bool` | 빈 값 여부 확인 |
| `Break() error` | 반복 중단 오류 신호 반환 |
| `Release()` | 객체 풀로 리소스 반환 |

## 메서드 비교

| 메서드 | 경로 매개변수 | 재귀 | 반환값 | 오류 콜백 |
|------|:--------:|:----:|--------|:--------:|
| `Foreach` | 없음 | 아니오 | 없음 | 아니오 |
| `ForeachWithPath` | 있음 | 아니오 | error | 아니오 |
| `ForeachNested` | 없음 | 예 | 없음 | 아니오 |
| `ForeachReturn` | 없음 | 아니오 | (string, error) | 아니오 |
| `ForeachWithError` | 있음 | 아니오 | error | 예 |
| `ForeachNestedWithError` | 없음 | 예 | error | 예 |
| `ForeachWithPathAndIterator` | 있음 | 아니오 | error | IteratorControl |
| `ForeachWithPathAndControl` | 있음 | 아니오 | error | IteratorControl |

---

## 파일 반복 함수

패키지 레벨에서 파일로부터 직접 반복하는 함수를 제공합니다. 대용량 JSON 파일 처리에 적합하며, [Processor 파일 반복 메서드](../processor/iterate#파일-반복-메서드)와 대응됩니다.

### ForeachFile

시그니처: `func ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

파일에서 JSON을 로드하여 반복합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `filePath` | `string` | JSON 파일 경로 |
| `fn` | `func(key any, item *IterableValue) error` | 반복 콜백 |

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // 반복 계속
})
```

---

### ForeachFileWithPath

시그니처: `func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

파일에서 JSON을 로드하고 경로를 따라 반복합니다.

```go
// users 배열만 반복
err := json.ForeachFileWithPath("data.json", ".users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("사용자: %s\n", name)
    return nil
})
```

---

### ForeachFileChunked

시그니처: `func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

파일 내 JSON 배열을 청크 단위로 반복합니다. 대용량 데이터셋의 배치 처리에 적합합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `filePath` | `string` | JSON 파일 경로 |
| `chunkSize` | `int` | 배치당 처리 수량(≤0이면 기본값 100) |
| `fn` | `func(chunk []*IterableValue) error` | 배치 처리 콜백 |

```go
// 한 번에 100개 레코드씩 처리
err := json.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    // 데이터베이스 일괄 삽입
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

::: tip 사용 사례
- 데이터베이스 일괄 삽입
- 분할 API 호출
- 메모리 제약이 있는 대용량 파일 처리
:::

---

### ForeachFileNested

시그니처: `func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

파일에서 JSON을 로드하고 모든 중첩 구조를 재귀적으로 반복합니다.

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    // 모든 수준의 모든 키-값 쌍 순회
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

| 메서드 | 경로 매개변수 | 재귀 | 청크 | 적합한 사례 |
|------|:--------:|:----:|:----:|----------|
| `ForeachFile` | 없음 | 아니오 | 아니오 | 단순 파일 순회 |
| `ForeachFileWithPath` | 있음 | 아니오 | 아니오 | 특정 위치 순회 |
| `ForeachFileChunked` | 없음 | 아니오 | **예** | 배치 처리, 메모리 제약 |
| `ForeachFileNested` | 없음 | **예** | 아니오 | 모든 노드 깊이 순회 |

---

## 반복 제어

### IteratorControl 상수

`ForeachWithPathAndControl`와 `ForeachWithPathAndIterator`는 `IteratorControl`을 반환하여 반복 흐름을 제어합니다(상수 정의는 [반복기 타입](../iterator#iteratorcontrol-상수) 참조):

| 상수 | 설명 |
|------|------|
| `IteratorNormal` | 정상적으로 반복 계속 |
| `IteratorContinue` | 현재 항목 건너뛰고 반복 계속 |
| `IteratorBreak` | 반복 중단 |

### 반복 중단

오류 콜백에서 `item.Break()`를 반환하면 반복을 중단할 수 있습니다:

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        // 대상을 찾음, 반복 중단
        return item.Break()
    }
    return nil // 반복 계속
})
```

### 오류 처리

다른 오류를 반환하면 반복이 중단되고 해당 오류가 반환됩니다:

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
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

- [Processor 반복 메서드](../processor/iterate) - 대응되는 프로세서 메서드
- [반복기 타입](../iterator) - Iterator/IterableValue/Stream/Batch/Parallel 타입 정의
- [경로 조회](./query) - Get 계열 메서드
- [배치 작업](./batch) - ProcessBatch 배치 처리
- [파일 작업](./file-io) - LoadFromFile/SaveToFile
- [대용량 파일 처리 가이드](../../streaming/large-files) - 스트리밍 처리 사례 실무

---
sidebar_label: "반복기 타입"
title: "반복기 타입 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 반복기 타입: Iterator 순차 순회, IterableValue 데이터 접근, StreamIterator/StreamObjectIterator 스트림, BatchIterator 배치와 ParallelIterator 병렬 반복기 생성 및 메서드."
sidebar_position: 9
---

# 반복기 타입

json 패키지는 순차 순회, 스트림 처리, 배치 처리 및 병렬 처리 사례를 아우르는 다양한 반복기 타입을 제공합니다. 반복 **함수**(`Foreach`/`ForeachFile` 등)는 [패키지 레벨 반복 함수](./functions/iterate)와 [Processor 반복 메서드](./processor/iterate)를 참조하세요.

## IteratorControl 상수

`IteratorControl`은 반복 제어 플래그를 나타내며, `ForeachWithPathAndControl`와 `ForeachWithPathAndIterator`에서 반복 흐름을 제어하는 데 사용됩니다.

| 상수 | 설명 |
|------|------|
| `IteratorNormal` | 정상적으로 반복 계속(기본값) |
| `IteratorContinue` | 현재 항목 건너뛰고 반복 계속 |
| `IteratorBreak` | 반복 중단 |

**사용 시나리오**

| 시나리오 | 추천 반환값 | 설명 |
|------|------------|------|
| 정상적으로 요소 처리 | `IteratorNormal` | 다음 요소 계속 처리 |
| 무효한 데이터 필터링 | `IteratorContinue` | 현재 요소 건너뛰고 반복 계속 |
| 대상 찾은 후 종료 | `IteratorBreak` | 필요한 데이터를 찾은 후 즉시 중단 |
| 오류 발생 시 중단 | `IteratorBreak` | 심각한 오류 발생 시 반복 중단 |

---

## Iterator 타입

Iterator는 JSON 배열 또는 객체를 순회하는 저수준 반복기입니다.

### NewIterator

시그니처: `func NewIterator(data any, cfg ...Config) *Iterator`

반복기 인스턴스를 생성합니다.

```go
data := []any{"apple", "banana", "cherry"}
it := json.NewIterator(data)
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `HasNext` | `func (it *Iterator) HasNext() bool` | 더 많은 요소가 있는지 확인 |
| `Next` | `func (it *Iterator) Next() (any, bool)` | 다음 요소 가져오기 |
| `Reset` | `func (it *Iterator) Reset()` | 반복기 상태와 캐시를 지우고 재사용 준비 |
| `ResetWith` | `func (it *Iterator) ResetWith(data any)` | 상태를 지우고 새 데이터로 초기화 |

### Reset

반복기 상태를 지우고 캐시된 키를 해제합니다. 호출 후 `ResetWith`로 재초기화할 수 있습니다.

```go
it := json.NewIterator(data1)
for it.HasNext() {
    it.Next()
}

it.Reset() // 캐시 지우기
```

### ResetWith

반복기 상태를 지우고 새 데이터로 초기화하여 반복기를 재사용합니다.

```go
it := json.NewIterator(data1)
// ... data1 순회 ...

it.ResetWith(data2) // 반복기를 재사용하여 새 데이터 순회
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

---

## IterableValue 타입

IterableValue는 반복 과정의 현재 요소를 캡슐화하여 편리한 값 접근 메서드를 제공합니다. `Foreach` 계열 함수의 콜백이 `*IterableValue`를 받습니다.

### 메서드

#### GetData

시그니처: `func (iv *IterableValue) GetData() any`

기본 데이터를 반환합니다.

#### Get

시그니처: `func (iv *IterableValue) Get(path string) any`

경로로 값을 가져옵니다(점 표기법과 배열 인덱스 지원).

```go
val := iv.Get("user.address.city")
val = iv.Get("users[0].name")
```

#### GetString

시그니처: `func (iv *IterableValue) GetString(key string) string`

문자열 값을 가져옵니다.

```go
name := item.GetString("name")
```

#### GetInt

시그니처: `func (iv *IterableValue) GetInt(key string) int`

정수 값을 가져옵니다.

```go
age := item.GetInt("age")
```

#### GetFloat64

시그니처: `func (iv *IterableValue) GetFloat64(key string) float64`

부동소수점 값을 가져옵니다.

```go
price := item.GetFloat64("price")
```

#### GetBool

시그니처: `func (iv *IterableValue) GetBool(key string) bool`

불리언 값을 가져옵니다.

```go
enabled := item.GetBool("enabled")
```

#### GetArray

시그니처: `func (iv *IterableValue) GetArray(key string) []any`

배열 값을 가져옵니다.

```go
items := item.GetArray("items")
```

#### GetObject

시그니처: `func (iv *IterableValue) GetObject(key string) map[string]any`

객체 값을 가져옵니다.

```go
profile := item.GetObject("profile")
```

#### GetWithDefault

시그니처: `func (iv *IterableValue) GetWithDefault(key string, defaultValue any) any`

값을 가져오며, 키가 존재하지 않으면 기본값을 반환합니다.

```go
// 선택적 필드 가져오기, 누락 시 기본값 사용
timeout := item.GetWithDefault("timeout", 30)
mode := item.GetWithDefault("mode", "default")
```

#### GetStringWithDefault

시그니처: `func (iv *IterableValue) GetStringWithDefault(key string, defaultValue string) string`

문자열 값을 가져오며, 키가 존재하지 않으면 기본값을 반환합니다.

```go
name := item.GetStringWithDefault("name", "알 수 없음")
```

#### GetIntWithDefault

시그니처: `func (iv *IterableValue) GetIntWithDefault(key string, defaultValue int) int`

정수 값을 가져오며, 키가 존재하지 않으면 기본값을 반환합니다.

```go
age := item.GetIntWithDefault("age", 0)
port := item.GetIntWithDefault("port", 8080)
```

#### GetFloat64WithDefault

시그니처: `func (iv *IterableValue) GetFloat64WithDefault(key string, defaultValue float64) float64`

부동소수점 값을 가져오며, 키가 존재하지 않으면 기본값을 반환합니다.

```go
price := item.GetFloat64WithDefault("price", 0.0)
rate := item.GetFloat64WithDefault("rate", 1.0)
```

#### GetBoolWithDefault

시그니처: `func (iv *IterableValue) GetBoolWithDefault(key string, defaultValue bool) bool`

불리언 값을 가져오며, 키가 존재하지 않으면 기본값을 반환합니다.

```go
enabled := item.GetBoolWithDefault("enabled", false)
debug := item.GetBoolWithDefault("debug", true)
```

#### Exists

시그니처: `func (iv *IterableValue) Exists(key string) bool`

지정된 키가 존재하는지 확인합니다.

```go
if item.Exists("email") {
    email := item.GetString("email")
    fmt.Printf("이메일: %s\n", email)
}
```

#### ForeachNested

시그니처: `func (iv *IterableValue) ForeachNested(path string, fn func(key any, item *IterableValue))`

지정된 경로 아래의 중첩 구조를 재귀적으로 순회합니다.

#### IsNullData

시그니처: `func (iv *IterableValue) IsNullData() bool`

전체 값이 null인지 확인합니다.

```go
if item.IsNullData() {
    fmt.Println("값이 null입니다")
}
```

#### IsNull

시그니처: `func (iv *IterableValue) IsNull(key string) bool`

지정된 키의 값이 null인지 확인합니다.

```go
if item.IsNull("optional_field") {
    fmt.Println("선택적 필드가 null입니다")
}
```

#### IsEmptyData

시그니처: `func (iv *IterableValue) IsEmptyData() bool`

전체 값이 비어 있는지 확인합니다(nil, 빈 문자열, 빈 배열 또는 빈 객체).

```go
if item.IsEmptyData() {
    fmt.Println("값이 비어 있습니다")
}
```

#### IsEmpty

시그니처: `func (iv *IterableValue) IsEmpty(key string) bool`

지정된 키의 값이 비어 있는지 확인합니다.

```go
if item.IsEmpty("tags") {
    fmt.Println("태그 목록이 비어 있습니다")
}
```

#### Break

시그니처: `func (iv *IterableValue) Break() error`

반복 중단 신호를 반환합니다. 반복 콜백에서 호출하면 순회를 조기에 종료할 수 있습니다.

```go
// 주의: Break()는 콜백이 error를 반환하는 반복 함수(ForeachWithError,
// ForeachNestedWithError 등)에서만 적용됩니다. 일반 Foreach 콜백은 error를
// 반환하지 않으므로, 그 안에서 item.Break()를 호출해도 반복이 중지되지 않습니다.
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "stop" {
        // 대상을 찾은 후 반복 중단
        return item.Break()
    }
    // 계속 처리
    return nil
})
```

#### Release

시그니처: `func (iv *IterableValue) Release()`

IterableValue를 객체 풀에 반환하여 내부 데이터 참조를 해제합니다.

```go
json.Foreach(data, func(key any, item *json.IterableValue) {
    // 데이터 처리...
    fmt.Println(item.GetData())
    // 처리 완료 후 해제, GC 부담 감소
    item.Release()
})
```

---

## StreamIterator 타입

StreamIterator는 메모리 효율적인 스트림 반복을 제공하며, 대용량 JSON 배열에 적합합니다. 요소 단위로 처리하여 전체 배열을 메모리에 로드할 필요가 없습니다.

### NewStreamIterator

시그니처: `func NewStreamIterator(reader io.Reader, cfg ...Config) *StreamIterator`

스트림 반복기를 생성합니다. `Config.BufferSize`로 버퍼 크기를 설정합니다.

```go
file, _ := os.Open("large-array.json")
defer file.Close()

// 설정 없이 사용
it := json.NewStreamIterator(file)
for it.Next() {
    val := it.Value()
    fmt.Printf("인덱스 %d: %v\n", it.Index(), val)
}
if err := it.Err(); err != nil {
    panic(err)
}

// 설정과 함께 사용
cfg := json.DefaultConfig()
cfg.BufferSize = 64 * 1024 // 64KB 버퍼
it2 := json.NewStreamIterator(file, cfg)
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Next` | `func (si *StreamIterator) Next() bool` | 다음 요소로 이동 |
| `Value` | `func (si *StreamIterator) Value() any` | 현재 요소 반환 |
| `Index` | `func (si *StreamIterator) Index() int` | 현재 인덱스 반환 |
| `Err` | `func (si *StreamIterator) Err() error` | 반복 중 오류 반환 |

---

## StreamObjectIterator 타입

StreamObjectIterator는 메모리 효율적인 스트림 반복을 제공하며, 대용량 JSON 객체에 적합합니다.

### NewStreamObjectIterator

시그니처: `func NewStreamObjectIterator(reader io.Reader, cfg ...Config) *StreamObjectIterator`

스트림 객체 반복기를 생성합니다.

```go
file, _ := os.Open("large-object.json")
defer file.Close()

it := json.NewStreamObjectIterator(file)
for it.Next() {
    fmt.Printf("키: %s, 값: %v\n", it.Key(), it.Value())
}
if err := it.Err(); err != nil {
    panic(err)
}
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Next` | `func (soi *StreamObjectIterator) Next() bool` | 다음 키-값 쌍으로 이동 |
| `Key` | `func (soi *StreamObjectIterator) Key() string` | 현재 키 반환 |
| `Value` | `func (soi *StreamObjectIterator) Value() any` | 현재 값 반환 |
| `Err` | `func (soi *StreamObjectIterator) Err() error` | 반복 중 오류 반환 |

---

## BatchIterator 타입

BatchIterator는 대용량 배열을 효율적으로 배치 처리하는 데 사용되며, 단일 요소 처리 오버헤드를 줄입니다.

### NewBatchIterator

시그니처: `func NewBatchIterator(data []any, cfg ...Config) *BatchIterator`

배치 반복기를 생성합니다. `Config.MaxBatchSize`로 배치 크기를 설정합니다.

```go
data := make([]any, 10000)
// 데이터 채우기...

cfg := json.DefaultConfig()
cfg.MaxBatchSize = 100 // 배치당 100개 요소
it := json.NewBatchIterator(data, cfg)
for it.HasNext() {
    batch := it.NextBatch()
    // 배치 처리
    processBatch(batch)
    fmt.Printf("%d개 요소 처리, 남은 %d개\n", len(batch), it.Remaining())
}
```

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `NextBatch` | `func (it *BatchIterator) NextBatch() []any` | 다음 배치 요소 반환 |
| `HasNext` | `func (it *BatchIterator) HasNext() bool` | 더 많은 배치가 있는지 확인 |
| `Reset` | `func (it *BatchIterator) Reset()` | 반복기를 시작 위치로 재설정 |
| `TotalBatches` | `func (it *BatchIterator) TotalBatches() int` | 전체 배치 수 반환 |
| `CurrentIndex` | `func (it *BatchIterator) CurrentIndex() int` | 현재 위치 반환 |
| `Remaining` | `func (it *BatchIterator) Remaining() int` | 남은 요소 수 반환 |

---

## ParallelIterator 타입

ParallelIterator는 배열을 병렬로 처리하는 데 사용되며, 멀티코어 CPU를 활용하여 처리 속도를 높입니다.

### NewParallelIterator

시그니처: `func NewParallelIterator(data []any, cfg ...Config) *ParallelIterator`

병렬 반복기를 생성합니다. `Config.MaxConcurrency`로 작업 고루틴 수를 설정합니다.

```go
data := make([]any, 10000)
// 데이터 채우기...

cfg := json.DefaultConfig()
cfg.MaxConcurrency = 8 // 8개 작업 고루틴
it := json.NewParallelIterator(data, cfg)
err := it.ForEach(func(idx int, val any) error {
    // 각 요소를 병렬로 처리
    return processItem(idx, val)
})
if err != nil {
    panic(err)
}
```

### ForEach

시그니처: `func (it *ParallelIterator) ForEach(fn func(int, any) error) error`

각 요소를 병렬로 처리하며, 처음 만난 오류를 반환합니다.

```go
err := it.ForEach(func(idx int, val any) error {
    // 이 함수는 여러 고루틴에서 병렬로 실행됩니다
    return nil
})
```

### ForEachWithContext

시그니처: `func (it *ParallelIterator) ForEachWithContext(ctx context.Context, fn func(int, any) error) error`

컨텍스트가 있는 병렬 처리로, 작업 취소를 지원합니다.

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err := it.ForEachWithContext(ctx, func(idx int, val any) error {
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
        return processItem(idx, val)
    }
})
```

### ForEachBatch

시그니처: `func (it *ParallelIterator) ForEachBatch(batchSize int, fn func(int, []any) error) error`

병렬 배치 처리입니다.

```go
err := it.ForEachBatch(100, func(batchIdx int, batch []any) error {
    // 각 배치가 하나의 고루틴에서 처리됩니다
    return processBatch(batchIdx, batch)
})
```

### ForEachBatchWithContext

시그니처: `func (it *ParallelIterator) ForEachBatchWithContext(ctx context.Context, batchSize int, fn func(int, []any) error) error`

컨텍스트가 있는 병렬 배치 처리입니다.

### Map

시그니처: `func (it *ParallelIterator) Map(transform func(int, any) (any, error)) ([]any, error)`

각 요소를 병렬로 변환하여 새 슬라이스를 반환합니다.

```go
results, err := it.Map(func(idx int, val any) (any, error) {
    if num, ok := val.(float64); ok {
        return num * 2, nil
    }
    return nil, fmt.Errorf("unexpected type at index %d", idx)
})
```

### Filter

시그니처: `func (it *ParallelIterator) Filter(predicate func(int, any) bool) []any`

요소를 병렬로 필터링하여 조건을 만족하는 요소 슬라이스를 반환합니다.

```go
even := it.Filter(func(idx int, val any) bool {
    if num, ok := val.(float64); ok {
        return int(num)%2 == 0
    }
    return false
})
```

### Close

시그니처: `func (it *ParallelIterator) Close()`

ParallelIterator 리소스를 해제합니다.

```go
it := json.NewParallelIterator(data, cfg)
defer it.Close()
```

---

## 전체 예제

### 대용량 파일 스트림 처리

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Open("large-array.json")
    if err != nil {
        panic(err)
    }
    defer file.Close()

    it := json.NewStreamIterator(file)
    count := 0

    for it.Next() {
        val := it.Value()
        // 요소 단위 처리, 메모리 친화적
        count++
        if count%1000 == 0 {
            fmt.Printf("%d개 요소 처리 완료, 현재 값: %v\n", count, val)
        }
    }

    if err := it.Err(); err != nil {
        panic(err)
    }

    fmt.Printf("총 %d개 요소 처리 완료\n", count)
}
```

### 병렬 처리

```go
package main

import (
    "fmt"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    // JSON 배열 파싱
    data := `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`
    var arr []any
    json.Unmarshal([]byte(data), &arr)

    // 병렬 반복기 생성 (4개 작업 고루틴)
    cfg := json.DefaultConfig()
    cfg.MaxConcurrency = 4
    it := json.NewParallelIterator(arr, cfg)

    var sum int64

    err := it.ForEach(func(idx int, val any) error {
        if num, ok := val.(float64); ok {
            atomic.AddInt64(&sum, int64(num))
        }
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("합계: %d\n", sum) // 출력: 합계: 55
}
```

### 배치 처리

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 대용량 데이터셋 생성
    data := make([]any, 1000)
    for i := range data {
        data[i] = map[string]any{"id": i, "value": i * 10}
    }

    // 배치당 100개 요소
    cfg := json.DefaultConfig()
    cfg.MaxBatchSize = 100
    it := json.NewBatchIterator(data, cfg)
    batchNum := 0

    for it.HasNext() {
        batch := it.NextBatch()
        batchNum++

        // 배치 처리 (예: 데이터베이스 일괄 쓰기)
        fmt.Printf("배치 %d: %d개 요소 처리\n", batchNum, len(batch))
    }

    fmt.Printf("전체 배치 수: %d\n", it.TotalBatches())
}
```

### Iterator 재사용

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 첫 번째 순회
    it := json.NewIterator([]any{"a", "b", "c"})
    for it.HasNext() {
        val, _ := it.Next()
        fmt.Println(val)
    }

    // 동일 반복기를 재사용하여 새 데이터 순회, 재할당 방지
    it.ResetWith([]any{1, 2, 3, 4})
    for it.HasNext() {
        val, _ := it.Next()
        fmt.Println(val)
    }
}
```

---

## 성능 권장 사항

1. **Iterator 재사용** - `Reset`/`ResetWith`로 재할당을 피하고 여러 번 순회하는 사례에 적합
2. **대용량 데이터셋에 스트림 반복기 사용** - `StreamIterator`/`StreamObjectIterator`는 요소 단위 처리로 메모리 효율적
3. **배치 처리로 오버헤드 감소** - `BatchIterator`는 배치 단위 처리로 단일 요소 오버헤드를 줄임
4. **CPU 집약적 작업은 병렬 처리** - `ParallelIterator`로 멀티코어 가속 활용
5. **IterableValue 해제** - `Foreach` 콜백에서 처리 완료 후 `Release()`를 호출해 GC 부담 감소

---

## 관련 문서

- [패키지 레벨 반복 함수](./functions/iterate) - Foreach/ForeachFile 등 반복 함수
- [Processor 반복 메서드](./processor/iterate) - 대응되는 프로세서 반복 메서드
- [대용량 파일 처리](../streaming/large-files) - 대용량 파일 처리 가이드와 API 레퍼런스
- [NDJSON 처리기](../streaming/jsonl) - JSONL 처리

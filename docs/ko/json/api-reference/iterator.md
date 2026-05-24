---
title: "반복자 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 반복 순회 API 완전 레퍼런스: Foreach 기본 반복, ForeachWithPath 경로 반복, ForeachNested 재귀 반복, IterableValue 반복 가능 값 타입, IteratorControl 반복 제어 및 ParallelForeach 병렬 반복의 모범 사례를 포함합니다."
---

# 반복자

json 패키지는 풍부한 반복자 기능을 제공하여 다양한 순회 방식을 지원합니다: 패키지 레벨 함수, Processor 메서드, 스트림 반복, 배치 처리 및 병렬 처리.

## 패키지 레벨 반복 함수

Processor 인스턴스를 생성하지 않고 직접 호출할 수 있는 반복 함수입니다.

### Foreach

시그니처: `func Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

JSON 배열 또는 객체를 순회합니다.

```go
json.Foreach(`{"name": "Alice", "age": 30}`, func(key any, item *json.IterableValue) {
    fmt.Printf("키: %v, 값: %v\n", key, item.GetData())
})
// 출력:
// 키: name, 값: Alice
// 키: age, 값: 30
```

### ForeachWithPath

시그니처: `func ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue), cfg ...Config) error`

경로를 따라 순회하며, 오류를 반환합니다.

```go
err := json.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
if err != nil {
    panic(err)
}
```

### ForeachReturn

시그니처: `func ForeachReturn(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config) (string, error)`

순회하고 원래 JSON 문자열을 반환합니다 (읽기 전용 작업).

```go
result, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // 읽기 전용 처리
    fmt.Printf("처리: %v\n", item.GetData())
})
```

### ForeachNested

시그니처: `func ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

모든 중첩 수준을 재귀적으로 순회합니다.

```go
json.ForeachNested(data, func(key any, item *json.IterableValue) {
    fmt.Printf("타입: %T, 값: %v\n", item.GetData(), item.GetData())
})
```

### ForeachWithPathAndControl

시그니처: `func ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl, cfg ...Config) error`

제어 흐름이 있는 순회로, 반환값으로 반복 흐름을 제어할 수 있습니다.

```go
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    if value == nil {
        return json.IteratorBreak // 반복 중단
    }
    // 처리...
    return json.IteratorNormal // 계속 반복
})
```

**IteratorControl 상수**

| 상수 | 설명 |
|------|------|
| `IteratorNormal` | 정상적으로 계속 반복 |
| `IteratorContinue` | 현재 항목 건너뛰고 계속 반복 |
| `IteratorBreak` | 반복 중단 |

**사용 시나리오**

| 시나리오 | 추천 반환값 | 설명 |
|------|------------|------|
| 정상적으로 요소 처리 | `IteratorNormal` | 다음 요소 계속 처리 |
| 무효한 데이터 필터링 | `IteratorContinue` | 현재 요소 건너뛰고 반복 계속 |
| 대상 찾은 후 종료 | `IteratorBreak` | 필요한 데이터를 찾은 후 즉시 중단 |
| 오류 발생 시 중단 | `IteratorBreak` | 심각한 오류 발생 시 반복 중단 |

```go
// 시나리오 1: 무효한 데이터 필터링
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    if value == nil {
        return json.IteratorContinue // null 값 건너뛰기
    }
    process(value)
    return json.IteratorNormal
})

// 시나리오 2: 첫 번째로 조건을 만족하는 요소를 찾은 후 종료
var found any
err := json.ForeachWithPathAndControl(data, "users", func(key any, value any) json.IteratorControl {
    if obj, ok := value.(map[string]any); ok {
        if obj["admin"] == true {
            found = obj
            return json.IteratorBreak // 관리자를 찾은 후 중단
        }
    }
    return json.IteratorNormal
})

// 시나리오 3: 데이터 무결성 검증
var hasError bool
err := json.ForeachWithPathAndControl(data, "records", func(key any, value any) json.IteratorControl {
    if !validateRecord(value) {
        hasError = true
        return json.IteratorBreak // 데이터가 불완전하면 검증 중단
    }
    return json.IteratorNormal
})
```

### ForeachWithError

시그니처: `func ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

오류 처리가 있는 경로 순회입니다. 콜백 함수가 error를 반환하면 반복이 중단되고 해당 오류가 반환됩니다.

```go
err := json.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    val := item.GetData()
    if val == nil {
        return fmt.Errorf("항목 %v의 값이 null입니다", key)
    }
    return processItem(val)
})
if err != nil {
    log.Fatal(err)
}
```

### ForeachNestedWithError

시그니처: `func ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

모든 중첩 수준을 재귀적으로 순회하며 오류 처리를 지원합니다. 콜백 함수가 error를 반환하면 반복이 중단됩니다.

```go
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("키: %v, 값: %v\n", key, item.GetData())
    return nil
})
```

### ForeachWithPathAndIterator

시그니처: `func ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

경로 정보가 있는 반복으로, 콜백 함수가 현재 전체 경로를 받습니다. 순회 위치를 추적해야 하는 깊은 중첩 구조 처리에 적합합니다.

```go
err := json.ForeachWithPathAndIterator(data, "users", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("경로: %s, 키: %v\n", currentPath, key)
    return json.IteratorNormal
})
```

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

IterableValue는 반복 과정의 현재 요소를 캡슐화하여 편리한 값 접근 메서드를 제공합니다.

### 메서드

#### GetData

시그니처: `func (iv *IterableValue) GetData() any`

기본 데이터를 반환합니다.

#### Get

시그니처: `func (iv *IterableValue) Get(path string) any`

경로로 값을 가져옵니다 (점 표기법과 배열 인덱스 지원).

```go
val := iv.Get("user.address.city")
val := iv.Get("users[0].name")
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

전체 값이 비어 있는지 확인합니다 (nil, 빈 문자열, 빈 배열 또는 빈 객체).

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
json.Foreach(data, func(key any, item *json.IterableValue) {
    if item.GetString("status") == "stop" {
        // 대상을 찾은 후 반복 중단
        item.Break()
        return
    }
    // 계속 처리
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

## Processor 반복 메서드

Processor도 반복 메서드를 제공하여 프로세서를 재사용해야 하는 시나리오에 적합합니다.

### Foreach

시그니처: `func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue))`

JSON 배열 또는 객체를 반복합니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
p.Foreach(`{"name": "Alice", "age": 30}`, func(key any, item *json.IterableValue) {
    fmt.Printf("키: %v, 값: %v\n", key, item.GetData())
})
```

### ForeachWithPath

시그니처: `func (p *Processor) ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue)) error`

경로를 따라 반복하며, 오류를 반환합니다.

### ForeachNested

시그니처: `func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue))`

모든 중첩 수준을 재귀적으로 반복합니다.

### ForeachReturn

시그니처: `func (p *Processor) ForeachReturn(jsonStr string, fn func(key any, item *IterableValue)) (string, error)`

반복하고 원래 JSON을 반환합니다 (읽기 전용 작업).

### ForeachWithPathAndControl

시그니처: `func (p *Processor) ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl) error`

제어 흐름이 있는 경로 순회로, 반환값으로 반복 흐름을 제어할 수 있습니다.

### ForeachWithPathAndIterator

시그니처: `func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

경로 정보가 있는 반복으로, 콜백 함수가 현재 전체 경로를 받습니다. 순회 위치를 추적해야 하는 깊은 중첩 구조 처리에 적합합니다.

```go
p.ForeachWithPathAndIterator(data, "users", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("경로: %s, 키: %v\n", currentPath, key)
    return json.IteratorNormal
})
```

### ForeachWithError

시그니처: `func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

오류 처리가 있는 반복입니다. 콜백 함수가 error를 반환하면 반복이 중단되고 해당 오류가 반환됩니다.

```go
err := p.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    val := item.GetData()
    if val == nil {
        return fmt.Errorf("항목 %v의 값이 null입니다", key)
    }
    return processItem(val)
})
if err != nil {
    log.Fatal(err)
}
```

### ForeachNestedWithError

시그니처: `func (p *Processor) ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

모든 중첩 수준을 재귀적으로 반복하며 오류 처리를 지원합니다. 콜백 함수가 error를 반환하면 반복이 중단됩니다.

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("키: %v, 값: %v\n", key, item.GetData())
    return nil
})
```

---

## 전체 예제

### 배열 순회

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `[
        {"id": 1, "name": "Alice"},
        {"id": 2, "name": "Bob"},
        {"id": 3, "name": "Charlie"}
    ]`

    json.Foreach(data, func(key any, item *json.IterableValue) {
        id := item.GetInt("id")
        name := item.GetString("name")
        fmt.Printf("[%v] ID: %d, Name: %s\n", key, id, name)
    })
}
```

### 객체 순회

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "server1": {"host": "192.168.1.1", "port": 8080},
        "server2": {"host": "192.168.1.2", "port": 8081}
    }`

    json.Foreach(data, func(key any, item *json.IterableValue) {
        fmt.Printf("서버: %s\n", key)
        host := item.GetString("host")
        port := item.GetInt("port")
        fmt.Printf("  호스트: %s, 포트: %d\n", host, port)
    })
}
```

### 중첩 구조 재귀 순회

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "users": [
            {"name": "Alice", "profile": {"city": "Beijing"}},
            {"name": "Bob", "profile": {"city": "Shanghai"}}
        ]
    }`

    json.ForeachNested(data, func(key any, item *json.IterableValue) {
        // 문자열 값만 처리
        if str, ok := item.GetData().(string); ok {
            fmt.Printf("값: %s\n", str)
        }
    })
}
```

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
            fmt.Printf("%d개 요소 처리 완료\n", count)
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

---

## 성능 권장 사항

1. **반복 중 시간이 많이 걸리는 작업 피하기** - 반복은 동기식이므로 시간이 많이 걸리는 작업은 전체 반복을 차단합니다
2. **ForeachWithPath로 정확히 위치 지정** - 불필요한 데이터 순회 피하기
3. **대용량 데이터셋에 스트림 처리 사용** - ForeachFile 또는 NDJSONProcessor 사용
4. **배치 처리로 오버헤드 감소** - ForeachFileChunked로 배치 작업 수행
5. **CPU 집약적 작업에 병렬 처리 사용** - ForeachFileChunked 또는 ParallelIterator로 멀티코어 활용

---

## 관련 문서

- [Processor](./processor/) - 프로세서 메서드
- [대용량 파일 처리](./large-file) - 스트림 프로세서
- [NDJSON 처리기](./jsonl) - JSONL 처리
- [대용량 파일 처리 가이드](../large-files) - 대용량 파일 처리 가이드

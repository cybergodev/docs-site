---
title: "JSONL 프로세서 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON JSONL 프로세서 레퍼런스: StreamJSONL 스트리밍 처리, JSONLWriter 쓰기, StreamLinesInto[T] 제네릭 스트림, ParseJSONL 파싱, ToJSONL 변환 및 설정 옵션을 포함하며, JSON Lines 형식 읽기/쓰기 작업을 지원합니다."
---

# JSONL 프로세서

JSONL(JSON Lines) 또는 NDJSON(Newline Delimited JSON)은 줄당 하나의 JSON 객체 형식입니다. 이 라이브러리는 `Processor` 메서드와 패키지 레벨 함수를 통해 완전한 JSONL 처리 기능을 제공합니다.

## 형식 사양

```json
{"id":1,"name":"Alice"}
{"id":2,"name":"Bob"}
{"id":3,"name":"Charlie"}
```

- 각 줄은 유효한 JSON 값입니다
- 줄은 `\n`으로 구분됩니다
- 마지막 줄은 줄바꿈이 있거나 없을 수 있습니다

---

## Processor JSONL 메서드

JSONL 처리 기능은 `Processor`의 메서드를 통해 제공됩니다.

### StreamJSONL

시그니처: `func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

JSONL 데이터를 스트리밍 처리하며, 각 줄마다 `IterableValue`를 반환합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `reader` | `io.Reader` | 데이터 소스 |
| `fn` | `func(lineNum int, item *IterableValue) error` | 처리 콜백 |

**콜백 반환값**

| 반환값 | 설명 |
|--------|------|
| `nil` | 다음 줄로 계속 처리 |
| `item.Break()` | 반복 중지, 오류 반환 안 함 |
| 기타 `error` | 반복 중지하고 오류 반환 |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err = p.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("%d번째 줄: name=%s, age=%d\n", lineNum, name, age)
    return nil // 계속 처리
    // return item.Break() // 반복 중지
})
```

### StreamJSONLParallel

시그니처: `func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

JSONL 데이터를 병렬 처리합니다. 작업 풀 패턴을 사용합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `reader` | `io.Reader` | 데이터 소스 |
| `workers` | `int` | 작업 고루틴 수 (0 이하는 기본값 4) |
| `fn` | `func(lineNum int, item *IterableValue) error` | 처리 콜백 |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    // CPU 집약적 처리
    return processItem(item)
})
```

:::tip 성능 팁
CPU 집약적 작업(데이터 변환, 계산 등)에는 병렬 처리를 사용하면 성능이 크게 향상됩니다. I/O 집약적 작업에는 단일 스레드 처리를 권장합니다.
:::

### StreamJSONLParallelWithContext

시그니처: `func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

컨텍스트가 있는 JSONL 병렬 처리입니다. 시간 초과 및 취소 작업을 지원합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `ctx` | `context.Context` | 컨텍스트, 취소 및 시간 초과에 사용 |
| `reader` | `io.Reader` | 데이터 소스 |
| `workers` | `int` | 작업 고루틴 수 (0 이하는 기본값 4) |
| `fn` | `func(lineNum int, item *IterableValue) error` | 처리 콜백 |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err = p.StreamJSONLParallelWithContext(ctx, file, 8, func(lineNum int, item *json.IterableValue) error {
    // 취소가 지원되는 병렬 처리
    return processItem(item)
})
```

### StreamJSONLChunked

시그니처: `func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

JSONL 데이터를 배치로 처리합니다. 지정된 수의 요소를 한 번에 처리합니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 배치당 1000건
err = p.StreamJSONLChunked(file, 1000, func(chunk []*json.IterableValue) error {
    // 데이터베이스에 배치 쓰기
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

### StreamJSONLFile

시그니처: `func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

JSONL 파일을 직접 처리합니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("%d번째 줄: %v\n", lineNum, item.GetData())
    return nil
})
```

---

## 고급 JSONL 작업

### MapJSONL

시그니처: `func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error)) ([]any, error)`

JSONL 데이터를 새로운 형식으로 매핑합니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

result, err := p.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return map[string]any{
        "name": item.GetString("name"),
        "age":  item.GetInt("age"),
    }, nil
})
```

### ReduceJSONL

시그니처: `func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any) (any, error)`

JSONL 데이터를 단일 결과로 집계합니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 나이 총합 계산
totalAge, err := p.ReduceJSONL(file, 0, func(acc any, item *json.IterableValue) any {
    return acc.(int) + item.GetInt("age")
})
```

### FilterJSONL

시그니처: `func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

JSONL 데이터를 필터링하여 조건을 만족하는 요소를 반환합니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 성인 필터링
adults, err := p.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetInt("age") >= 18
})
```

### CollectJSONL

시그니처: `func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

모든 JSONL 요소를 슬라이스에 수집합니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

items, err := p.CollectJSONL(file)
for _, item := range items {
    fmt.Println(item.GetString("name"))
}
```

### FirstJSONL

시그니처: `func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool) (*IterableValue, bool, error)`

조건을 만족하는 첫 번째 요소를 반환합니다.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

user, found, err := p.FirstJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("name") == "Alice"
})
if found {
    fmt.Println("찾음:", user.GetString("name"))
}
```

### ForeachJSONL

시그니처: `func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

JSONL 데이터를 반복합니다 (StreamJSONL의 별칭).

---

## JSONL 설정

JSONL 설정은 `Config` 구조체에 통합되어 있습니다:

```go
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024    // 버퍼 크기 (기본값 64KB)
cfg.JSONLMaxLineSize = 2 * 1024 * 1024  // 최대 줄 크기 (기본값 1MB)
cfg.JSONLSkipEmpty = true           // 빈 줄 건너뛰기 (기본값 true)
cfg.JSONLSkipComments = true        // 주석 줄 건너뛰기 (기본값 false)
cfg.JSONLContinueOnErr = true       // 파싱 오류 시 계속 (기본값 false)
cfg.JSONLWorkers = 8                // 병렬 작업 수 (기본값 4)
cfg.JSONLChunkSize = 500            // 청크 크기 (기본값 1000)
cfg.JSONLMaxMemory = 200 * 1024 * 1024 // 최대 메모리 (기본값 100MB)

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

---

## JSONLWriter

JSONLWriter는 데이터를 JSON Lines 형식으로 쓰는 데 사용됩니다.

### NewJSONLWriter

시그니처: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

JSONL 쓰기를 생성합니다. 선택적 설정 매개변수를 지원합니다.

```go
file, _ := os.Create("output.jsonl")
defer file.Close()

// 기본 설정 사용
writer := json.NewJSONLWriter(file)

// 커스텀 설정 사용
cfg := json.DefaultConfig()
cfg.EscapeHTML = true
writer = json.NewJSONLWriter(file, cfg)
```

### Write

시그니처: `func (w *JSONLWriter) Write(data any) error`

단일 JSON 값을 한 줄로 씁니다.

```go
err := writer.Write(map[string]any{
    "id":   1,
    "name": "Alice",
})
```

### WriteAll

시그니처: `func (w *JSONLWriter) WriteAll(data []any) error`

여러 JSON 값을 각각 한 줄로 씁니다.

```go
items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
    map[string]any{"id": 3, "name": "Charlie"},
}

err := writer.WriteAll(items)
```

### WriteRaw

시그니처: `func (w *JSONLWriter) WriteRaw(line []byte) error`

원시 JSON 줄을 씁니다 (JSON 인코딩하지 않음).

```go
err := writer.WriteRaw([]byte(`{"id":1,"name":"raw"}`))
```

### Err

시그니처: `func (w *JSONLWriter) Err() error`

쓰기 과정에서 발생한 오류를 반환합니다.

```go
if err := writer.Err(); err != nil {
    fmt.Printf("쓰기 오류: %v\n", err)
}
```

### Stats

시그니처: `func (w *JSONLWriter) Stats() JSONLStats`

쓰기 통계 정보를 가져옵니다.

```go
stats := writer.Stats()
fmt.Printf("%d줄, %d바이트 쓰기 완료\n", stats.LinesProcessed, stats.BytesWritten)
```

**JSONLStats 구조체**:

```go
type JSONLStats struct {
    LinesProcessed int64 // 처리된 줄 수
    BytesWritten   int64 // 쓰여진 바이트 수
}
```

---

## NDJSONProcessor

`map[string]any` 타입에 특화된 NDJSON 파일 프로세서입니다.

### NewNDJSONProcessor

시그니처: `func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

NDJSON 프로세서를 생성합니다. 선택적 설정 매개변수를 지원합니다.

```go
// 기본 설정 사용
np := json.NewNDJSONProcessor()

// 커스텀 설정 사용
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024
np = json.NewNDJSONProcessor(cfg)
```

### ProcessFile

시그니처: `func (np *NDJSONProcessor) ProcessFile(filename string, fn func(lineNum int, obj map[string]any) error) error`

NDJSON 파일을 처리합니다.

```go
err := np.ProcessFile("data.ndjson", func(lineNum int, obj map[string]any) error {
    fmt.Printf("[%d] ID: %v\n", lineNum, obj["id"])
    return nil
})
```

### ProcessReader

시그니처: `func (np *NDJSONProcessor) ProcessReader(reader io.Reader, fn func(lineNum int, obj map[string]any) error) error`

Reader에서 NDJSON을 처리합니다.

```go
err := np.ProcessReader(file, func(lineNum int, obj map[string]any) error {
    return nil
})
```

---

## 패키지 레벨 함수

:::warning 주의
`StreamJSONLFile`은 Processor 메서드이며 패키지 레벨 함수가 아닙니다. 사용하기 전에 Processor 인스턴스를 생성해야 합니다:

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("%d번째 줄: %v\n", lineNum, item.GetData())
    return nil
})
```

자세한 내용은 [Processor JSONL 메서드](./processor/jsonl#streamjsonlfile)를 참조하세요.
:::

### StreamLinesInto[T]

시그니처: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

JSONL을 스트리밍으로 읽고 줄 단위로 처리합니다.

```go
type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

// 기본 설정 사용
entries, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("처리 중: %s\n", user.Name)
    return nil
})

// 커스텀 설정 사용
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true
entries, err = json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
}, cfg)
```

### ParseJSONL

시그니처: `func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

JSONL 바이트 슬라이스를 파싱합니다.

```go
jsonl := `{"name":"Alice"}
{"name":"Bob"}`
results, err := json.ParseJSONL([]byte(jsonl))
```

### ToJSONL

시그니처: `func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

JSONL 바이트 슬라이스로 변환합니다.

```go
items := []any{
    map[string]any{"id": 1},
    map[string]any{"id": 2},
}
jsonl, err := json.ToJSONL(items)
```

### ToJSONLString

시그니처: `func ToJSONLString(data []any, cfg ...Config) (string, error)`

JSONL 문자열로 변환합니다.

```go
jsonlStr, err := json.ToJSONLString(items)
```

---

## 전체 예제

### 대용량 JSONL 파일 읽기

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

type LogEntry struct {
    Time    string `json:"time"`
    Level   string `json:"level"`
    Message string `json:"message"`
}

func main() {
    file, _ := os.Open("logs.jsonl")
    defer file.Close()

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    count := 0
    err = p.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
        count++
        if item.GetString("level") == "error" {
            fmt.Printf("오류: %s\n", item.GetString("message"))
        }
        return nil
    })

    if err != nil {
        fmt.Printf("오류: %v\n", err)
    }

    fmt.Printf("총 %d줄 처리 완료\n", count)
}
```

### JSONL 파일 쓰기

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, _ := os.Create("output.jsonl")
    defer file.Close()

    writer := json.NewJSONLWriter(file)

    for i := 0; i < 10; i++ {
        writer.Write(map[string]any{
            "id":    i,
            "value": fmt.Sprintf("item-%d", i),
        })
    }

    stats := writer.Stats()
    fmt.Printf("%d바이트 쓰기 완료\n", stats.BytesWritten)
}
```

### 대용량 파일 병렬 처리

```go
package main

import (
    "os"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    file, _ := os.Open("large.jsonl")
    defer file.Close()

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    var count int64
    err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
        atomic.AddInt64(&count, 1)
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("병렬 처리 %d줄 완료\n", count)
}
```

---

## 관련 문서

- [대용량 파일 처리 API](./large-file) - ForeachFile 시리즈 메서드
- [대용량 파일 처리 가이드](../large-files) - 대용량 파일 처리 가이드
- [반복자](./iterator) - 반복 순회 API

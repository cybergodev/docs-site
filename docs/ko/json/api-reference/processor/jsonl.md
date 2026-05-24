---
title: "Processor JSONL 메서드 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Processor JSONL 메서드: StreamJSONL/StreamJSONLParallel/StreamJSONLChunked 스트림 처리, ForeachJSONL 반복, MapJSONL 매핑, ReduceJSONL 리덕션, FilterJSONL 필터링, CollectJSONL 수집, FirstJSONL 검색을 지원합니다."
---

# Processor JSONL 메서드

Processor는 JSONL(JSON Lines) 스트림 처리 기능을 완벽하게 제공하며, 행 단위 처리, 병렬 처리, 배치 처리 및 함수형 작업을 지원합니다.

## 스트림 읽기 메서드

### StreamJSONL

시그니처: `func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

JSONL 데이터를 스트림으로 처리하여 행 단위로 읽고 콜백 함수를 호출합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `reader` | `io.Reader` | JSONL 데이터 소스 |
| `fn` | `func(lineNum int, item *IterableValue) error` | 처리 함수, 오류 반환 시 처리 중단 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

err := processor.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
    level := item.GetString("level")
    msg := item.GetString("message")
    fmt.Printf("[%d] %s: %s\n", lineNum, level, msg)
    return nil
})
```

---

### StreamJSONLParallel

시그니처: `func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

JSONL 데이터를 병렬로 처리하며, 여러 워커 고루틴을 사용하여 처리 속도를 높입니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `reader` | `io.Reader` | JSONL 데이터 소스 |
| `workers` | `int` | 워커 고루틴 수 (0 이하 시 기본값 4) |
| `fn` | `func(lineNum int, item *IterableValue) error` | 처리 함수 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("large.jsonl")
defer file.Close()

var count int64
err := processor.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    atomic.AddInt64(&count, 1)
    // CPU 집약적 처리...
    return nil
})
fmt.Printf("%d행 처리 완료\n", count)
```

:::tip 성능 팁
- CPU 집약적 작업에 적합합니다 (데이터 변환, 계산 등)
- I/O 집약적 작업은 단일 스레드 `StreamJSONL`을 권장합니다
- 워커 수는 CPU 코어 수로 설정하는 것을 권장합니다
:::

### StreamJSONLParallelWithContext

시그니처: `func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

컨텍스트가 포함된 병렬 JSONL 처리로, 취소 및 타임아웃 제어를 지원합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `ctx` | `context.Context` | 취소 또는 타임아웃에 사용되는 컨텍스트 |
| `reader` | `io.Reader` | JSONL 데이터 소스 |
| `workers` | `int` | 워커 고루틴 수 (0 이하 시 기본값 4) |
| `fn` | `func(lineNum int, item *IterableValue) error` | 처리 함수 |

```go
processor, _ := json.New()
defer processor.Close()

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err := processor.StreamJSONLParallelWithContext(ctx, reader, 8, func(lineNum int, item *json.IterableValue) error {
    return nil
})
if err != nil {
    log.Fatal(err)
}
```

---

### StreamJSONLChunked

시그니처: `func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

JSONL 데이터를 청크 단위로 처리하여, 매번 한 묶음의 요소를 처리합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `reader` | `io.Reader` | JSONL 데이터 소스 |
| `chunkSize` | `int` | 배치당 요소 수 |
| `fn` | `func(chunk []*IterableValue) error` | 배치 처리 함수 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err := processor.StreamJSONLChunked(file, 100, func(chunk []*json.IterableValue) error {
    // 데이터베이스 배치 삽입
    records := make([]Record, len(chunk))
    for i, item := range chunk {
        records[i] = Record{
            ID:    item.GetInt("id"),
            Name:  item.GetString("name"),
        }
    }
    return db.BatchInsert(records)
})
```

---

### StreamJSONLFile

시그니처: `func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

파일에서 직접 JSONL 데이터를 스트림으로 처리합니다.

```go
processor, _ := json.New()
defer processor.Close()

err := processor.StreamJSONLFile("logs.jsonl", func(lineNum int, item *json.IterableValue) error {
    if item.GetString("level") == "error" {
        logErrors(item)
    }
    return nil
})
```

---

## 함수형 작업 메서드

### ForeachJSONL

시그니처: `func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

JSONL 데이터를 반복하는 별칭 메서드로, `StreamJSONL`과 동일한 동작을 합니다.

```go
err := processor.ForeachJSONL(file, func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("행 %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

### MapJSONL

시그니처: `func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error)) ([]any, error)`

JSONL 데이터를 새 형식으로 매핑하고 변환된 슬라이스를 반환합니다.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// 모든 사용자 이름 추출
names, err := processor.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return item.GetString("name"), nil
})
// names: []any{"Alice", "Bob", "Charlie"}
```

---

### ReduceJSONL

시그니처: `func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any) (any, error)`

JSONL 데이터를 단일 값으로 리덕션합니다.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("sales.jsonl")
defer file.Close()

// 총 매출 계산
total, err := processor.ReduceJSONL(file, 0.0, func(acc any, item *json.IterableValue) any {
    price := item.GetFloat64("price")
    return acc.(float64) + price
})
fmt.Printf("총 매출: %.2f\n", total.(float64))
```

---

### FilterJSONL

시그니처: `func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

JSONL 데이터를 필터링하여 조건을 만족하는 요소를 반환합니다.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

// 오류 로그 필터링
errors, err := processor.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("level") == "error"
})
fmt.Printf("%d개의 오류 로그 발견\n", len(errors))
```

---

### CollectJSONL

시그니처: `func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

모든 JSONL 데이터를 슬라이스로 수집합니다.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

items, err := processor.CollectJSONL(file)
if err != nil {
    panic(err)
}
fmt.Printf("%d개 레코드 수집 완료\n", len(items))
```

:::warning 메모리 주의
이 메서드는 모든 데이터를 메모리에 로드하므로 초대용량 파일에는 적합하지 않습니다. 대용량 파일은 `StreamJSONL`로 행 단위 처리하는 것을 권장합니다.
:::

---

### FirstJSONL

시그니처: `func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool) (*IterableValue, bool, error)`

조건을 만족하는 첫 번째 요소를 찾습니다.

**반환값**

| 타입 | 설명 |
|------|------|
| `*IterableValue` | 찾은 요소 (존재하는 경우) |
| `bool` | 찾았는지 여부 |
| `error` | 오류 정보 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// 첫 번째 관리자 찾기
admin, found, err := processor.FirstJSONL(file, func(item *json.IterableValue) bool {
    return item.GetBool("is_admin")
})
if err != nil {
    panic(err)
}
if found {
    fmt.Printf("관리자: %s\n", admin.GetString("name"))
}
```

---

## 설정 옵션

JSONL 처리 동작은 `Config`의 다음 필드로 설정할 수 있습니다:

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `JSONLBufferSize` | `int` | 65536 (64KB) | 읽기 버퍼 크기 |
| `JSONLMaxLineSize` | `int` | 1048576 (1MB) | 단일 행 최대 바이트 수 |
| `JSONLSkipEmpty` | `bool` | `true` | 빈 행 건너뛰기 |
| `JSONLSkipComments` | `bool` | `false` | `#` 또는 `//` 주석 건너뛰기 |
| `JSONLContinueOnErr` | `bool` | `false` | 파싱 오류 시 계속 진행 |
| `JSONLWorkers` | `int` | 4 | 병렬 처리 워커 고루틴 수 |
| `JSONLChunkSize` | `int` | 1000 | 청크 처리 배치 크기 |
| `JSONLMaxMemory` | `int64` | 104857600 (100MB) | 최대 메모리 사용량 |

```go
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true     // 주석 행 건너뛰기
cfg.JSONLContinueOnErr = true    // 파싱 오류 시 계속 진행
cfg.JSONLWorkers = 8             // 8개 병렬 워커

processor, _ := json.New(cfg)
defer processor.Close()
```

---

## 완전 예제

### 로그 분석

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    processor, _ := json.New()
    defer processor.Close()

    file, _ := os.Open("app.log.jsonl")
    defer file.Close()

    var errorCount, warningCount int

    err := processor.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
        level := item.GetString("level")
        switch level {
        case "error":
            errorCount++
            fmt.Printf("[ERROR] %s\n", item.GetString("message"))
        case "warning":
            warningCount++
        }
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("통계: %d 오류, %d 경고\n", errorCount, warningCount)
}
```

### 병렬 데이터 처리

```go
package main

import (
    "os"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    cfg.JSONLWorkers = 16 // 16개 병렬 워커

    processor, _ := json.New(cfg)
    defer processor.Close()

    file, _ := os.Open("large_data.jsonl")
    defer file.Close()

    var processed int64

    err := processor.StreamJSONLParallel(file, 16, func(lineNum int, item *json.IterableValue) error {
        // CPU 집약적 처리
        processItem(item)
        atomic.AddInt64(&processed, 1)
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("병렬로 %d개 레코드 처리 완료\n", processed)
}
```

---

## 관련 문서

- [JSONL 프로세서](../jsonl) - 패키지 레벨 JSONL 함수
- [대용량 파일 처리](../../large-files) - 대용량 파일 처리 가이드
- [반복자](../iterator) - IterableValue 타입 상세

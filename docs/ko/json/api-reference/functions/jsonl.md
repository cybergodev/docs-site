---
sidebar_label: "JSONL"
title: "JSONL 처리 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON JSONL 함수: ParseJSONL/ToJSONL/ToJSONLString 변환, StreamLinesInto[T] 스트리밍, NewJSONLWriter, Config JSONL* 설정으로 JSON Lines를 지원합니다."
sidebar_position: 8
---

# JSONL 처리 함수

json 패키지가 제공하는 JSONL(JSON Lines) 처리 함수로, 줄바꿈으로 구분된 JSON 데이터의 파싱, 스트리밍 읽기, 변환 및 쓰기를 지원합니다.

## JSONL 처리 함수

JSONL(JSON Lines)은 줄바꿈으로 구분된 JSON 형식으로, 각 줄이 독립적인 JSON 객체입니다.

### ParseJSONL

시그니처: `func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

JSONL(줄바꿈 구분 JSON) 데이터를 파싱합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `data` | `[]byte` | 예 | JSONL 바이트 데이터 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonl := `{"name":"Alice"}
{"name":"Bob"}
{"name":"Charlie"}`
    results, err := json.ParseJSONL([]byte(jsonl))
    if err != nil {
        panic(err)
    }
    for i, r := range results {
        fmt.Printf("[%d] %v\n", i, r)
    }
}
```

### StreamLinesInto

시그니처: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

io.Reader에서 JSONL 데이터를 스트리밍으로 읽고 콜백 함수로 각 줄을 처리합니다. 권장되는 제네릭 JSONL 처리 방식입니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `reader` | `io.Reader` | 예 | 데이터 소스 |
| `fn` | `func(lineNum int, data T) error` | 예 | 처리 콜백 (줄 번호와 데이터를 받음) |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

**반환값**

| 타입 | 설명 |
|------|------|
| `[]T` | 처리된 모든 결과 슬라이스 |
| `error` | 오류 정보 |

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

type User struct {
    Name string `json:"name"`
}

func main() {
    src := `{"name":"Alice"}
{"name":"Bob"}`

    // 기본 사용법
    results, err := json.StreamLinesInto[User](strings.NewReader(src), func(lineNum int, user User) error {
        fmt.Printf("%d번째 줄: 사용자 %s\n", lineNum, user.Name)
        return nil // error를 반환하면 처리 중단
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("총 %d개의 레코드를 처리했습니다\n", len(results))
}
```

### ToJSONL

시그니처: `func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

데이터 슬라이스를 JSONL 형식으로 변환합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `data` | `[]any` | 예 | 데이터 슬라이스 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    items := []any{
        map[string]any{"name": "Alice"},
        map[string]any{"name": "Bob"},
    }
    jsonl, err := json.ToJSONL(items)
    if err != nil {
        panic(err)
    }
    fmt.Println(string(jsonl))
    // {"name":"Alice"}
    // {"name":"Bob"}
}
```

### ToJSONLString

시그니처: `func ToJSONLString(data []any, cfg ...Config) (string, error)`

데이터 슬라이스를 JSONL 문자열로 변환합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `data` | `[]any` | 예 | 데이터 슬라이스 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    items := []any{
        map[string]any{"name": "Alice"},
        map[string]any{"name": "Bob"},
    }
    jsonlStr, err := json.ToJSONLString(items)
    if err != nil {
        panic(err)
    }
    fmt.Println(jsonlStr)
}
```

## JSONL 설정

:::warning 경고
JSONLConfig 독립 구조체와 `DefaultJSONLConfig()` 함수는 제거되었습니다. JSONL 설정은 `Config`의 `JSONL*` 필드로 통합되었습니다.
:::

### Config를 통해 JSONL 설정

```go
cfg := json.DefaultConfig()

// JSONL 설정
cfg.JSONLBufferSize    = 64 * 1024    // 읽기 버퍼 크기 (기본값: 64KB)
cfg.JSONLMaxLineSize   = 1024 * 1024  // 줄당 최대 크기 (기본값: 1MB)
cfg.JSONLSkipEmpty     = true         // 빈 줄 건너뛰기 (기본값: true)
cfg.JSONLSkipComments  = false        // 주석 줄 건너뛰기 (기본값: false)
cfg.JSONLContinueOnErr = false        // 오류 시 계속 (기본값: false)
cfg.JSONLWorkers       = 4            // 병렬 작업 고루틴 수 (기본값: 4)
cfg.JSONLChunkSize     = 1000         // 배치당 처리 줄 수 (기본값: 1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // 최대 메모리 (기본값: 100MB)

processor, err := json.New(cfg)
```

자세한 내용은 [Config 설정](../config#config-구조체)을 참조하세요

## JSONL 쓰기

### NewJSONLWriter

시그니처: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

JSONL 쓰기를 생성합니다.

```go
package main

import (
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Create("output.jsonl")
    if err != nil {
        panic(err)
    }
    defer file.Close()
    jw := json.NewJSONLWriter(file)
    jw.Write(map[string]any{"id": 1, "name": "Alice"})
    jw.Write(map[string]any{"id": 2, "name": "Bob"})
}
```

**JSONLWriter 메서드**

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Write` | `(data any) error` | 한 줄 쓰기 |
| `WriteAll` | `(data []any) error` | 여러 줄 쓰기 |
| `WriteRaw` | `(line []byte) error` | 원시 바이트 줄 쓰기 |
| `Err` | `() error` | 누적된 오류 반환 |
| `Stats` | `() JSONLStats` | 쓰기 통계 반환 |

```go
jw := json.NewJSONLWriter(file)

items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
}
if err := jw.WriteAll(items); err != nil {
    log.Fatal(err)
}

if err := jw.Err(); err != nil {
    log.Fatal(err)
}
```

## 관련 문서

- [파일 작업 함수](./file-io) - LoadFromFile, SaveToFile 등 파일 작업
- [Processor JSONL 메서드](../processor/jsonl) - Processor 수준 JSONL 메서드 자세히
- [스트리밍 처리](../../streaming/large-files) - 스트리밍 프로세서 자세히

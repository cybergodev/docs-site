---
title: "파일 작업 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 파일 작업 함수 완전 레퍼런스: LoadFromReader 스트림 읽기, ParseJSONL/ToJSONL JSONL 처리, StreamLinesInto[T] 제네릭 스트림 처리, NewJSONLWriter 쓰기 및 JSONL 설정 자세히 설명, 대용량 파일 스트리밍 처리 시나리오를 지원합니다."
---

# 파일 작업 함수

json 패키지가 제공하는 파일 작업 및 JSONL 처리 함수입니다.

## 파일 읽기 함수

### LoadFromFile

시그니처: `func LoadFromFile(filePath string, cfg ...Config) (string, error)`

파일에서 JSON 데이터를 로드합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `filePath` | `string` | 예 | 파일 경로 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

```go
data, err := json.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data)
```

### SaveToFile

시그니처: `func SaveToFile(filePath string, data any, cfg ...Config) error`

JSON 데이터를 파일에 저장합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `filePath` | `string` | 예 | 파일 경로 |
| `data` | `any` | 예 | 저장할 데이터 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

```go
err := json.SaveToFile("output.json", map[string]any{
    "name": "Alice",
    "age":  30,
})
if err != nil {
    panic(err)
}
```

### MarshalToFile

시그니처: `func MarshalToFile(filePath string, data any, cfg ...Config) error`

데이터를 직렬화하고 파일에 씁니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `filePath` | `string` | 예 | 파일 경로 |
| `data` | `any` | 예 | 직렬화할 데이터 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

```go
err := json.MarshalToFile("data.json", myStruct)
```

### UnmarshalFromFile

시그니처: `func UnmarshalFromFile(filePath string, v any, cfg ...Config) error`

파일에서 읽고 역직렬화합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `filePath` | `string` | 예 | 파일 경로 |
| `v` | `any` | 예 | 대상 객체 포인터 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

```go
var config MyConfig
err := json.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### LoadFromReader

시그니처: `func LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

io.Reader에서 JSON 데이터를 로드합니다. 네트워크 연결, HTTP 요청 본문 등 스트리밍 데이터 소스에서 JSON을 읽는 데 적합합니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `reader` | `io.Reader` | 예 | 데이터 소스 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

```go
// HTTP 응답 본문에서 읽기
resp, _ := http.Get("https://api.example.com/data")
defer resp.Body.Close()
data, err := json.LoadFromReader(resp.Body)

// 문자열에서 읽기
data, err := json.LoadFromReader(strings.NewReader(`{"name":"test"}`))
```

### SaveToWriter

시그니처: `func SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

JSON 데이터를 io.Writer에 씁니다.

**매개변수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `writer` | `io.Writer` | 예 | 출력 대상 |
| `data` | `any` | 예 | 쓸 데이터 |
| `cfg` | `Config` | 아니요 | 선택적 설정 |

```go
var buf bytes.Buffer
err := json.SaveToWriter(&buf, map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
```

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
type User struct {
    Name string `json:"name"`
}

file, _ := os.Open("users.jsonl")
defer file.Close()

// 기본 사용법
results, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("%d번째 줄: 사용자 %s\n", lineNum, user.Name)
    return nil // error를 반환하면 처리 중단
})
if err != nil {
    panic(err)
}
fmt.Printf("총 %d개의 레코드를 처리했습니다\n", len(results))
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
jsonlStr, err := json.ToJSONLString(items)
```

## JSONL 설정

:::warning 경고
`JSONLConfig` 독립 구조체와 `DefaultJSONLConfig()` 함수는 제거되었습니다. JSONL 설정은 `Config`의 `JSONL*` 필드로 통합되었습니다.
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
file, _ := os.Create("output.jsonl")
defer file.Close()
jw := json.NewJSONLWriter(file)
jw.Write(map[string]any{"id": 1, "name": "Alice"})
jw.Write(map[string]any{"id": 2, "name": "Bob"})
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

- [인코딩 디코딩 함수](./encode-decode) - Marshal, Unmarshal 등 직렬화 작업
- [스트리밍 처리](../../large-files) - 스트리밍 프로세서 자세히
- [Processor JSONL 메서드](../processor/jsonl) - Processor 수준 JSONL 메서드 자세히

---
sidebar_label: "파일 I/O"
title: "파일 작업 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 파일 작업 함수: LoadFromFile/SaveToFile 읽기/쓰기, LoadFromReader/SaveToWriter 스트리밍, MarshalToFile/UnmarshalFromFile 직렬화를 지원합니다."
sidebar_position: 9
---

# 파일 작업 함수

json 패키지가 제공하는 파일 작업 함수로, 파일 읽기/쓰기 및 스트리밍 I/O를 지원합니다.

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

데이터를 직렬화하여 파일에 씁니다.

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

파일에서 데이터를 읽고 역직렬화합니다.

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
data, err = json.LoadFromReader(strings.NewReader(`{"name":"test"}`))
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

## 관련 문서

- [JSONL 처리 함수](./jsonl) - ParseJSONL, StreamLinesInto 등 줄바꿈 구분 JSON 처리
- [인코딩 출력 함수](./output) - Marshal, Unmarshal 등 직렬화 작업
- [스트리밍 처리](../../streaming/large-files) - 스트리밍 프로세서 자세히

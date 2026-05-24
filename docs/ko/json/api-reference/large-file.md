---
title: "대용량 파일 처리 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 대용량 파일 처리 API 레퍼런스: ForeachFile 스트리밍 처리, ForeachFileChunked 배치, ForeachFileWithPath 경로 처리, ForeachFileNested 중첩 반복 및 메모리 제어 설정의 모범 사례를 포함합니다."
---

# 대용량 파일 처리


## 설정 옵션

대용량 파일 처리 설정은 `Config` 구조체에 통합되어 있습니다:

```go
type Config struct {
    // ... 기타 설정 ...

    // 대용량 파일 처리 설정
    ChunkSize       int64 // 청크 크기 (기본값 1MB)
    MaxMemory       int64 // 최대 메모리 사용량 (기본값 100MB)
    BufferSize      int   // 읽기 버퍼 크기 (기본값 64KB)
    SamplingEnabled bool  // 샘플링 활성화 여부 (기본값 true)
    SampleSize      int   // 샘플 수 (기본값 1000)
}
```

### 커스텀 설정

```go
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB 청크
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB 메모리 제한
cfg.BufferSize = 128 * 1024        // 128KB 버퍼

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

---

## ForeachFile

시그니처: `func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

대용량 파일의 JSON 배열 요소를 하나씩 반복합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `filePath` | `string` | JSON 파일 경로 |
| `fn` | `func(key any, item *IterableValue) error` | 처리 콜백 |

**콜백 반환값**

| 반환값 | 설명 |
|--------|------|
| `nil` | 다음 항목으로 계속 처리 |
| `item.Break()` | 반복 중지, 오류 반환 안 함 |
| 기타 `error` | 반복 중지하고 오류 반환 |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

count := 0
err = p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    count++

    // IterableValue 편리한 접근 필드 사용
    id := item.GetInt("id")
    name := item.GetString("name")

    if count%10000 == 0 {
        log.Printf("%d개의 레코드를 처리했습니다", count)
    }
    return nil
})
```

**반복 중단 예제**

```go
err := p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // 대상을 찾음, 반복 중지
        return item.Break() // 중지하지만 오류는 아님
    }
    return nil // 반복 계속
})
```

---

## ForeachFileChunked

시그니처: `func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

대용량 파일을 배치로 처리합니다. 지정된 수의 요소를 한 번에 처리합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `filePath` | `string` | JSON 파일 경로 |
| `chunkSize` | `int` | 배치당 요소 수 |
| `fn` | `func(chunk []*IterableValue) error` | 배치 처리 콜백 |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 매번 1000개의 레코드 처리
err = p.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    // 데이터베이스에 배치 쓰기
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... 데이터 처리
    }
    return nil
})
```

---

## ForeachFileWithPath

시그니처: `func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

파일에서 지정된 경로의 JSON 배열 또는 객체를 처리합니다.

**매개변수**

| 이름 | 타입 | 설명 |
|------|------|------|
| `filePath` | `string` | JSON 파일 경로 |
| `path` | `string` | JSON 경로 표현식 |
| `fn` | `func(key any, item *IterableValue) error` | 처리 콜백 |

```go
// 파일에서 users 배열의 각 요소 처리
err := p.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    fmt.Printf("Name: %s\n", item.GetString("name"))
    return nil
})
```

---

## ForeachFileNested

시그니처: `func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

파일의 모든 중첩 JSON 구조를 재귀적으로 순회합니다.

```go
// 모든 중첩 요소 재귀 순회
err := p.ForeachFileNested("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

---

## IterableValue 편리한 메서드

`ForeachFile*` 시리즈 메서드는 `IterableValue` 인터페이스를 제공하여 편리한 데이터 접근을 지원합니다:

| 메서드 | 설명 | 예제 |
|------|------|------|
| `GetInt(path)` | 정수 가져오기 | `item.GetInt("id")` |
| `GetString(path)` | 문자열 가져오기 | `item.GetString("name")` |
| `GetFloat64(path)` | 부동소수점 가져오기 | `item.GetFloat64("score")` |
| `GetBool(path)` | 불리언 가져오기 | `item.GetBool("active")` |
| `GetArray(path)` | 배열 가져오기 | `item.GetArray("tags")` |
| `GetObject(path)` | 객체 가져오기 | `item.GetObject("profile")` |
| `Exists(path)` | 필드 존재 여부 확인 | `item.Exists("email")` |
| `IsNull(path)` | null 여부 확인 | `item.IsNull("deleted_at")` |
| `GetData()` | 원시 데이터 가져오기 | `item.GetData()` |
| `Break()` | 중단 신호 반환 | `return item.Break()` |

**경로 탐색 지원**

```go
city := item.GetString("profile.address.city")      // 중첩 객체
firstTag := item.GetString("tags[0]")               // 배열 인덱스
lastTag := item.GetString("tags[-1]")               // 음수 인덱스 (마지막)
nested := item.GetString("data.items[0].name")      // 복잡한 경로
```

---

## 전체 예제

### 초대용량 로그 파일 처리

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // 프로세서 생성
    cfg := json.DefaultConfig()
    cfg.ChunkSize = 10 * 1024 * 1024 // 10MB 청크
    cfg.MaxMemory = 500 * 1024 * 1024 // 500MB 메모리 제한

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 오류 로그 통계
    errorCount := 0
    err = p.ForeachFile("logs.json", func(key any, item *json.IterableValue) error {
        level := item.GetString("level")
        if level == "error" {
            message := item.GetString("message")
            fmt.Printf("오류: %s\n", message)
            errorCount++
        }
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("총 %d개의 오류를 발견했습니다\n", errorCount)
}
```

### 데이터베이스 배치 가져오기

```go
package main

import (
    "log"
    "github.com/cybergodev/json"
)

func main() {
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 배치당 500건씩 데이터베이스에 쓰기
    err = p.ForeachFileChunked("users.json", 500, func(chunk []*json.IterableValue) error {
        // 배치 삽입
        for _, item := range chunk {
            user := User{
                ID:    item.GetInt("id"),
                Name:  item.GetString("name"),
                Email: item.GetString("email"),
            }
            // db.Create(&user)
            _ = user
        }
        log.Printf("%d개의 레코드를 배치 삽입했습니다", len(chunk))
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
}
```

---

## 패키지 레벨 파일 반복 함수

Processor 메서드 외에도, 다음 함수는 Processor 인스턴스를 생성하지 않고 직접 호출할 수 있습니다. 내부적으로 전역 프로세서를 사용합니다.

### ForeachFile (패키지 레벨 함수)

시그니처: `func ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

파일에서 JSON을 로드하고 반복합니다.

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil
})
```

### ForeachFileWithPath (패키지 레벨 함수)

시그니처: `func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

파일에서 JSON을 로드하고 경로로 반복합니다.

```go
err := json.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("사용자: %s\n", name)
    return nil
})
```

### ForeachFileChunked (패키지 레벨 함수)

시그니처: `func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

파일의 JSON 배열을 청크 단위로 반복합니다.

```go
err := json.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

### ForeachFileNested (패키지 레벨 함수)

시그니처: `func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

파일에서 JSON을 로드하고 모든 중첩 구조를 재귀적으로 반복합니다.

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("경로: %v, 타입: %T\n", key, item.GetData())
    return nil
})
```

---

## 관련 문서

- [대용량 파일 처리 가이드](../large-files) - 완전한 사용 가이드
- [NDJSON 프로세서](./jsonl) - JSONL/NDJSON 처리
- [JSONLWriter](./jsonl#jsonlwriter) - JSONL 쓰기

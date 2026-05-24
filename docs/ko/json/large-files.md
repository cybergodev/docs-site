---
title: "대용량 파일 처리 - CyberGo JSON | 가이드"
description: "CyberGo JSON 대용량 파일 처리 완전 가이드: ForeachFile 구조화된 반복, ForeachFileChunked 배치 처리, 메모리 제어 설정, 버퍼 크기 최적화, JSONL 배치 처리 및 NDJSONProcessor 진정한 스트림 처리를 자세히 소개하며, 로그 분석, 데이터 내보내기 및 ETL 시나리오에 적합합니다."
---

# 대용량 파일 처리

대형 JSON 파일(예: 로그, 설정, 데이터 내보내기)을 메모리에 직접 로드하면 메모리 부족이 발생할 수 있습니다. json 라이브러리는 다양한 효율적인 처리 방법을 제공합니다.

:::warning 경고
`ForeachFile` 및 `ForeachFileChunked`는 반복 전에 전체 파일을 메모리에 로드합니다. "청크" 동작은 메모리 내 데이터의 반복 방식에만 영향을 미치며, 파일 읽기 방식에는 영향을 주지 않습니다. 메모리를 진정으로 제어해야 하는 초대용량 파일 처리의 경우 `NDJSONProcessor`를 JSONL 형식과 함께 사용하거나 `StreamIterator`를 사용하세요.
:::

## 대체 방안

| 방안 | 적용 시나리오 | 메모리 사용량 |
|------|----------|----------|
| **Processor.ForeachFile** | 구조화된 반복 처리 | 전체 파일 로드, 항목별 반복 |
| **Processor.ForeachFileChunked** | 배치 청크 반복 처리 | 전체 파일 로드, 청크별 반복 |
| **NDJSONProcessor** | JSONL 파일 행 단위 처리 | 메모리 제어 가능, 진정한 스트림 처리 |

## 통합 API: Processor

### 설정 옵션

대용량 파일 처리 설정은 `Config`에 통합되어 있습니다:

```go
type Config struct {
    // ... 기타 설정 ...

    // 대용량 파일 처리 설정
    ChunkSize       int64 // 청크 크기 (기본 1MB)
    MaxMemory       int64 // 최대 메모리 사용량 (기본 100MB)
    BufferSize      int   // 읽기 버퍼 크기 (기본 64KB)
    SamplingEnabled bool  // 샘플링 활성화 여부 (기본 true)
    SampleSize      int   // 샘플링 수량 (기본 1000)
}
```

### 기본 사용

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // Processor 생성 (기본 설정 사용)
    processor, err := json.New()
    if err != nil {
        log.Fatal(err)
    }
    defer processor.Close()

    // 방법 1: 항목별 처리 (권장)
    count := 0
    err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
        count++

        // IterableValue 편의 메서드로 필드 접근
        id := item.GetInt("id")
        name := item.GetString("name")
        email := item.GetString("email")

        // 경로로 중첩 속성 접근 지원
        city := item.GetString("profile.city")
        interests := item.GetArray("profile.interests")

        if count%10000 == 0 {
            log.Printf("%d건 레코드 처리 완료", count)
        }
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
    log.Printf("처리 완료, 총 %d건 레코드", count)
}
```

### 배치 처리

```go
// 방법 2: 배치 처리 (데이터베이스 배치 쓰기에 적합)
err := processor.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    log.Printf("배치 처리: %d건 레코드", len(chunk))

    // 데이터베이스에 배치 쓰기
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... 데이터 처리
    }
    return nil
})
```

### 중단 제어 포함

```go
// 방법 3: 중단 제어 포함 (특정 데이터를 찾은 후 중지)
// item.Break() 반환으로 반복 중지, nil 반환으로 반복 계속
err := processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // 대상 찾음, 반복 중지
        fmt.Printf("대상 발견: ID=%d, Name=%s\n", id, item.GetString("name"))
        return item.Break() // 반복 중지 (중단 신호 반환)
    }

    return nil // 반복 계속
})
```

### 객체 파일 처리

```go
// 방법 4: JSON 객체 파일 처리 (키-값 쌍 구조)
// 파일 형식: {"user1": {...}, "user2": {...}, ...}
err := processor.ForeachFile("config-map.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %s, Name: %s\n", key, item.GetString("name"))
    return nil
})
```

### 커스텀 설정

```go
// 대용량 파일 처리 설정 커스텀
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB 청크
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB 메모리 제한
cfg.BufferSize = 128 * 1024        // 128KB 버퍼

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## IterableValue 편의 메서드

`ForeachFile*` 시리즈 메서드는 `IterableValue` 인터페이스를 제공하여 편리한 데이터 접근을 지원합니다:

| 메서드 | 설명 | 예제 |
|------|------|------|
| `Get(path)` | 값 가져오기 | `item.Get("field")` |
| `GetString(path)` | 문자열 가져오기 | `item.GetString("name")` |
| `GetInt(path)` | 정수 가져오기 | `item.GetInt("id")` |
| `GetFloat64(path)` | 실수 가져오기 | `item.GetFloat64("score")` |
| `GetBool(path)` | 불리언 가져오기 | `item.GetBool("active")` |
| `GetArray(path)` | 배열 가져오기 | `item.GetArray("tags")` |
| `GetObject(path)` | 객체 가져오기 | `item.GetObject("profile")` |
| `Exists(path)` | 필드 존재 여부 확인 | `item.Exists("email")` |
| `IsNull(path)` | null 여부 확인 | `item.IsNull("deleted_at")` |
| `IsEmpty(path)` | 비어 있는지 확인 | `item.IsEmpty("notes")` |
| `Break()` | 중단 신호 반환 | `return item.Break()` |

**경로 탐색 지원**

```go
city := item.GetString("profile.address.city")      // 중첩 객체
firstTag := item.GetString("tags[0]")               // 배열 인덱스
lastTag := item.GetString("tags[-1]")               // 음수 인덱스 (마지막)
nested := item.GetString("data.items[0].name")      // 복잡한 경로
```

## 스트림 처리 설정

`Config`를 통해 스트림 처리 매개변수를 설정합니다:

```go
cfg := json.DefaultConfig()

// 대용량 파일 처리 설정
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB 청크
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB 메모리 제한
cfg.BufferSize = 128 * 1024        // 128KB 버퍼

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### StreamLinesInto 제네릭 함수 사용

```go
type User struct {
    Name string `json:"name"`
}

file, _ := os.Open("users.jsonl")
defer file.Close()

_, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("처리: %s\n", user.Name)
    return nil
})
```

### 병렬 처리

병렬 처리가 가능한 작업의 경우 멀티 goroutine을 사용할 수 있습니다:

```go
package main

import (
    "fmt"
    "sync"
    "github.com/cybergodev/json"
)

func main() {
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // worker pool 사용
    workers := 4
    items := make(chan any, 100)
    var wg sync.WaitGroup

    // workers 시작
    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for item := range items {
                // item 처리
                processItem(item)
            }
        }(i)
    }

    // 스트림 읽기 및 분배
    processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
        items <- item.Get("")
        return nil
    })

    close(items)
    wg.Wait()
}
```

## 성능 최적화 제안

### 메모리 제어

```go
// 가용 메모리에 따라 설정
cfg := json.DefaultConfig()
cfg.MaxMemory = 500 * 1024 * 1024 // 500MB
cfg.ChunkSize = 10 * 1024 * 1024  // 10MB

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 모범 사례
1. **파일 크기 예측**: 처리 전 파일 크기를 확인하여 적절한 전략 선택
2. **메모리 제한 설정**: `MaxMemory`를 사용하여 OOM 방지
3. **배치 커밋**: 일정 수량 누적 후 데이터베이스에 배치 쓰기
4. **오류 처리**: `JSONLContinueOnErr` 구현 또는 실패 항목 기록
5. **진행 상황 모니터링**: 정기적으로 처리 진행 상황 출력

## 선택 가이드

| 파일 크기 | 추천 방안 | 예제 |
|---------|---------|------|
| < 10MB | 직접 로드 | `json.ParseAny` + `Get` |
| 10-100MB | Processor.ForeachFile | 항목별 처리 |
| 100MB-1GB | Processor.ForeachFileChunked | 청크 반복 처리 |
| > 1GB | NDJSONProcessor / JSONL 형식 | 진정한 스트림 처리, 메모리 제어 가능 |

## 다음 단계

- [API 문서](./api-reference/) — 완전한 API 참조하세요

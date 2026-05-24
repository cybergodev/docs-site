---
title: "성능 최적화 - CyberGo JSON | 고성능 가이드"
description: "CyberGo JSON 성능 최적화 가이드: 캐시 전략 EnableCache/CacheTTL, 병렬 처리 ParallelThreshold, PreParse 사전 파싱 최적화, WarmupCache 예열 및 객체 풀 재사용을 자세히 설명하여 고빈도 JSON 처리 성능을 향상시킵니다."
---

# 성능 최적화

JSON 처리 성능을 최적화하는 전략과 팁입니다.

## 프로세서 재사용

### Processor 인스턴스 재사용

```go
// ✅ 패키지 레벨 함수는 전역 Processor를 자동으로 재사용
for _, item := range dataList {
    val := json.GetString(item, "name")
}

// ✅ 또는 인스턴스를 명시적으로 재사용 (커스텀 설정에 적합)
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
for _, item := range dataList {
    val := processor.GetString(item, "name")
}
```

## 메모리 최적화

### 할당 감소

```go
// ✅ Marshal은 바이트 슬라이스 반환
bytes, _ := json.Marshal(data)

// ✅ Encode는 문자열 반환
s, _ := json.Encode(data)
```

### 버퍼 미리 할당

```go
// 대량의 데이터 처리 시 미리 할당
buf := make([]byte, 0, 1024*1024)
```

## 파일 처리

### 대용량 파일은 구조화된 반복 사용

```go
// ❌ 한 번에 전체 로드
data, _ := os.ReadFile("large.json")
parsed, _ := json.ParseAny(string(data))

// ✅ 구조화된 반복 (주의: 여전히 전체 파일을 메모리에 로드함)
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
processor.ForeachFile("large.json", func(key any, item *json.IterableValue) error {
    processItem(item)
    return nil
})
```

### NDJSON 처리

```go
// StreamLinesInto로 스트리밍 처리
file, _ := os.Open("data.jsonl")
defer file.Close()
entries, err := json.StreamLinesInto[LogEntry](file, func(lineNum int, entry LogEntry) error {
    // 각 JSON 줄 처리
    return nil
})
```

## 동시성 처리

### 배열 병렬 처리

```go
items := json.GetArray(data, "items")

var wg sync.WaitGroup
sem := make(chan struct{}, runtime.NumCPU())

for _, item := range items {
    wg.Add(1)
    go func(item any) {
        defer wg.Done()
        sem <- struct{}{}
        defer func() { <-sem }()

        processItem(item)
    }(item)
}
wg.Wait()
```

### Worker Pool 사용

```go
pool := workerpool.New(10)

items := json.GetArray(data, "items")
for _, item := range items {
    item := item
    pool.Submit(func() {
        processItem(item)
    })
}

pool.StopWait()
```

## 설정 최적화

### 시나리오에 따라 설정 조정

```go
// 소량 데이터: 느슨한 설정
smallCfg := json.DefaultConfig()
smallCfg.MaxNestingDepthSecurity = 200 // 최대 허용값 (검증 범위 10-200)

// 신뢰할 수 없는 입력: 보안 설정
safeCfg := json.SecurityConfig()
safeCfg.MaxJSONSize = 1024 * 1024
```

### 불필요한 기능 비활성화

```go
// Hook이 필요 없으면 설정하지 않음
cfg := json.DefaultConfig() // 최소 설정
```

## 캐시 전략

### 파싱 결과 캐시

```go
var cache sync.Map

func getOrParse(key string, data []byte) (any, error) {
    if val, ok := cache.Load(key); ok {
        return val, nil
    }

    result, err := json.ParseAny(string(data))
    if err != nil {
        return nil, err
    }

    cache.Store(key, result)
    return result, nil
}
```

### 경로 쿼리 캐시

```go
// 자주 사용하는 경로 미리 컴파일 (Processor 사용)
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
path1, _ := p.CompilePath("user.name")
path2, _ := p.CompilePath("user.email")
path3, _ := p.CompilePath("items[*].id")
```

## 벤치마크

### 성능 테스트 예제

```go
func BenchmarkParse(b *testing.B) {
    data := []byte(`{"name": "test", "items": [1, 2, 3]}`)

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = json.ParseAny(string(data))
    }
}

func BenchmarkGetString(b *testing.B) {
    data := `{"user": {"name": "CyberGo", "email": "test@example.com"}}`

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        json.GetString(data, "user.name")
    }
}
```

### 메모리 분석

```go
func TestMemoryUsage(t *testing.T) {
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    before := m.Alloc

    // 작업 실행
    data := generateLargeJSON()
    _, _ = json.ParseAny(data)

    runtime.ReadMemStats(&m)
    after := m.Alloc

    fmt.Printf("메모리 사용량: %d bytes\n", after-before)
}
```

## 성능 비교

| 작업 | 소량 데이터 (<1KB) | 중간 데이터 (1MB) | 대량 데이터 (>10MB) |
|------|---------------|----------------|----------------|
| `Parse` | 권장 | 권장 | 비권장 |
| `ForeachFile` | 불필요 | 선택 | 권장 |

## 관련 문서

- [대용량 파일 처리 API](../api-reference/large-file)
- [오류 처리](./error-handling)
- [대용량 파일 처리](../large-files)

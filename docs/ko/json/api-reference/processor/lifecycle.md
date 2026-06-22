---
title: "Processor 수명 주기 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON Processor 수명 주기: New 생성, Close 해제, IsClosed 확인, GetStats 통계, GetHealthStatus 모니터링으로 동시 안전 종료를 보장합니다."
---

# 수명 주기와 통계

Processor는 완전한 수명 주기 관리, 캐시 제어 및 상태 모니터링 기능을 제공합니다.

## 수명 주기

### Close

시그니처: `func (p *Processor) Close() error`

프로세서를 닫고 리소스를 해제합니다. Processor 사용을 마친 후 이 메서드를 호출해야 합니다.

```go
processor, _ := json.New(json.DefaultConfig())
defer processor.Close()
```

### IsClosed

시그니처: `func (p *Processor) IsClosed() bool`

프로세서가 닫혔는지 확인합니다.

```go
if processor.IsClosed() {
    // 프로세서가 닫혀 있어 더 이상 사용할 수 없음
}
```

## 캐시 관리

### ClearCache

시그니처: `func (p *Processor) ClearCache()`

프로세서의 내부 캐시를 지웁니다.

```go
processor.ClearCache()
```

적합한 시나리오:
- 데이터 소스가 변경된 경우
- 메모리 사용량이 너무 높은 경우
- 강제 새로고침이 필요한 경우

### WarmupCache

시그니처: `func (p *Processor) WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

캐시를 예열하여 이후 작업 성능을 향상시킵니다.

```go
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := processor.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("%d개의 경로를 성공적으로 예열했습니다\n", result.Successful)
```

**WarmupResult 구조체**:

```go
type WarmupResult struct {
    TotalPaths  int      `json:"total_paths"`            // 전체 경로 수
    Successful  int      `json:"successful"`             // 성공적으로 예열된 경로 수
    Failed      int      `json:"failed"`                 // 실패한 경로 수
    SuccessRate float64  `json:"success_rate"`           // 성공률 (퍼센트)
    FailedPaths []string `json:"failed_paths,omitempty"` // 실패한 경로 목록
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `TotalPaths` | `int` | 전체 경로 수 |
| `Successful` | `int` | 성공적으로 예열된 경로 수 |
| `Failed` | `int` | 실패한 경로 수 |
| `SuccessRate` | `float64` | 성공률 (0-100) |
| `FailedPaths` | `[]string` | 실패한 경로 목록 |

## 통계 정보

### GetStats

시그니처: `func (p *Processor) GetStats() Stats`

프로세서의 통계 정보를 가져옵니다.

```go
stats := processor.GetStats()
fmt.Printf("캐시 적중률: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("캐시 크기: %d\n", stats.CacheSize)
```

**Stats 구조체**:

```go
type Stats struct {
    CacheSize        int64         `json:"cache_size"`        // 캐시 항목 수
    CacheMemory      int64         `json:"cache_memory"`      // 캐시 메모리 사용량 (바이트)
    MaxCacheSize     int           `json:"max_cache_size"`    // 최대 캐시 크기
    HitCount         int64         `json:"hit_count"`         // 캐시 적중 횟수
    MissCount        int64         `json:"miss_count"`        // 캐시 미적중 횟수
    HitRatio         float64       `json:"hit_ratio"`         // 캐시 적중률
    CacheTTL         time.Duration `json:"cache_ttl"`         // 캐시 TTL
    CacheEnabled     bool          `json:"cache_enabled"`     // 캐시 활성화 여부
    IsClosed         bool          `json:"is_closed"`         // 프로세서 닫힘 여부
    MemoryEfficiency float64       `json:"memory_efficiency"` // 메모리 효율성
    OperationCount   int64         `json:"operation_count"`   // 총 작업 수
    ErrorCount       int64         `json:"error_count"`       // 총 오류 수
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `CacheSize` | `int64` | 현재 캐시 항목 수 |
| `CacheMemory` | `int64` | 캐시 메모리 사용량 (바이트) |
| `MaxCacheSize` | `int` | 최대 캐시 크기 제한 |
| `HitCount` | `int64` | 캐시 적중 횟수 |
| `MissCount` | `int64` | 캐시 미적중 횟수 |
| `HitRatio` | `float64` | 캐시 적중률 (0-1) |
| `CacheTTL` | `time.Duration` | 캐시 만료 시간 |
| `CacheEnabled` | `bool` | 캐시 활성화 여부 |
| `IsClosed` | `bool` | 프로세서 닫힘 여부 |
| `MemoryEfficiency` | `float64` | 메모리 효율성 |
| `OperationCount` | `int64` | 총 작업 횟수 |
| `ErrorCount` | `int64` | 총 오류 횟수 |

## 상태 확인

### GetHealthStatus

시그니처: `func (p *Processor) GetHealthStatus() HealthStatus`

프로세서의 상태를 가져옵니다.

```go
status := processor.GetHealthStatus()
if status.Healthy {
    fmt.Println("프로세서 정상")
} else {
    for name, check := range status.Checks {
        if !check.Healthy {
            fmt.Printf("확인 %s 실패: %s\n", name, check.Message)
        }
    }
}
```

**HealthStatus 구조체**:

```go
type HealthStatus struct {
    Timestamp time.Time              `json:"timestamp"` // 확인 시간
    Healthy   bool                   `json:"healthy"`   // 전체 상태
    Checks    map[string]CheckResult `json:"checks"`    // 각 항목 확인 결과
}

type CheckResult struct {
    Healthy bool   `json:"healthy"` // 정상 여부
    Message string `json:"message"` // 상태 메시지
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `Timestamp` | `time.Time` | 확인 시간 |
| `Healthy` | `bool` | 전체 정상 여부 |
| `Checks` | `map[string]CheckResult` | 각 항목 확인 상세 |

## 확장 훅

### AddHook

시그니처: `func (p *Processor) AddHook(hook Hook)`

프로세서에 작업 훅을 추가합니다.

```go
processor.AddHook(&LoggingHook{})
processor.AddHook(json.TimingHook(&MetricsRecorder{}))
```

훅은 매 작업 전후에 호출되며, 다음에 사용할 수 있습니다:
- 로그 기록
- 성능 모니터링
- 지표 수집
- 감사 추적

### SetLogger

시그니처: `func (p *Processor) SetLogger(logger *slog.Logger)`

프로세서의 로그 기록기를 설정합니다. 디버깅 및 런타임 진단에 사용됩니다.

```go
processor, _ := json.New()
defer processor.Close()

processor.SetLogger(slog.Default().With("component", "json-processor"))
```

### GetConfig

시그니처: `func (p *Processor) GetConfig() Config`

프로세서의 현재 설정 사본을 가져옵니다. 반환된 설정은 안전하게 수정할 수 있으며 프로세서에 영향을 주지 않습니다.

```go
processor, _ := json.New()
defer processor.Close()

cfg := processor.GetConfig()
fmt.Printf("캐시 활성화: %v\n", cfg.EnableCache)
fmt.Printf("최대 JSON 크기: %d\n", cfg.MaxJSONSize)
```

## 사용 권장 사항

### 리소스 관리

```go
processor, _ := json.New()
defer processor.Close()  // 리소스 해제 보장

// processor 사용...
```

### 성능 최적화

```go
// 자주 사용하는 경로 예열
processor.WarmupCache(data, []string{
    "user.name",
    "user.email",
    "items[*].id",
})

// 정기적으로 통계 확인
stats := processor.GetStats()
if stats.HitRatio < 0.5 {
    // 적중률이 낮음, 캐시 설정 조정 고려
}
```

### 모니터링 통합

```go
// 정기 상태 확인
go func() {
    ticker := time.NewTicker(30 * time.Second)
    for range ticker.C {
        status := processor.GetHealthStatus()
        if !status.Healthy {
            log.Printf("Processor unhealthy: %+v", status.Checks)
        }
    }
}()
```

## 관련 문서

- [Config](../config) - 설정 옵션 (캐시 크기, TTL 등)
- [Hook 훅 시스템](../hooks) - 훅 자세한 사용 가이드
- [인터페이스 정의](../interfaces) - Hook 인터페이스

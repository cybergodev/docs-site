---
sidebar_label: "보안 필터"
title: "보안 필터 - CyberGo DD | 민감 데이터 필터링"
description: "CyberGo DD 민감 데이터 필터링의 완전한 API 문서입니다. SensitiveDataFilter 필터 규칙 구성, SecurityConfig 보안 정책 옵션과 사전 설정 보안 구성 방안을 포함하여 비밀번호, API 키, Token, 전화번호, 주민등록번호 등 민감 정보를 자동으로 감지하고 마스킹하여 로그 유출 위험을 효과적으로 방지합니다."
sidebar_position: 2
---

# 보안 필터

DD는 민감 데이터 필터링 기능을 내장하여 로그 내 비밀번호, 키, Token 등 민감 정보를 자동으로 감지하고 마스킹합니다.

## SensitiveDataFilter

정규식 기반의 민감 데이터 필터로, 동적 패턴과 캐싱을 지원합니다.

### 생성

| 함수 | 시그니처 | 설명 |
|------|------|------|
| `NewSensitiveDataFilter` | `() *SensitiveDataFilter` | 완전 패턴 집합 |
| `NewEmptySensitiveDataFilter` | `() *SensitiveDataFilter` | 빈 필터 |
| `NewCustomSensitiveDataFilter` | `(patterns ...string) (*SensitiveDataFilter, error)` | 커스텀 패턴 |

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `AddPattern` | `(pattern string) error` | 정규식 패턴 추가 |
| `AddPatterns` | `(patterns ...string) error` | 일괄 패턴 추가 |
| `ClearPatterns` | `()` | 모든 패턴 제거 |
| `PatternCount` | `() int` | 패턴 수 |
| `Enable` | `()` | 필터 활성화 |
| `Disable` | `()` | 필터 비활성화 |
| `IsEnabled` | `() bool` | 활성화 여부 |
| `Filter` | `(input string) string` | 문자열 필터 |
| `FilterFieldValue` | `(key string, value any) any` | 단일 필드값 필터 |
| `FilterValueRecursive` | `(key string, value any) any` | 중첩 구조 재귀 필터 |
| `GetFilterStats` | `() FilterStats` | 필터 통계 가져오기 |
| `ActiveGoroutineCount` | `() int32` | 활성 필터 goroutine 수 |
| `WaitForGoroutines` | `(timeout time.Duration) bool` | 필터 goroutine 완료 대기 |
| `Close` | `() bool` | 필터 닫기 및 캐시 해제 |

### 커스텀 패턴

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,     // 비밀번호
    `(?i)api[_-]?key\s*[:=]\s*\S+`,  // API Key
    `\b\d{16,19}\b`,                  // 신용카드 번호
)
```

## SecurityConfig

보안 구성 구조체로, 필터 동작과 보안 레벨을 제어합니다.

```go
type SecurityConfig struct {
    MaxMessageSize  int                       // 메시지 크기 상한(바이트, 0은 제한 없음, 사전 설정 구성 기본값 5MB)
    MaxWriters      int                       // 최대 Writer 수(사전 설정 구성 기본값 100)
    SensitiveFilter *SensitiveDataFilter      // 민감 데이터 필터
    RateLimitConfig *internal.RateLimitConfig // 속도 제한 구성(내부 타입, nil이면 제한 비활성화; 사전 설정 구성은 이 필드를 채우지 않음)
}
```

:::info 정보 RateLimitConfig에 대하여
`RateLimitConfig`는 로그 속도 제한을 제어하여 로그 홍수(DoS)를 방지하고 고부하 상황에서 시스템 안정성을 유지하는 데 사용됩니다. 이 필드는 내부 타입(`*internal.RateLimitConfig`)으로 직접 생성할 수 없습니다. 모든 사전 설정 구성(`DefaultSecurityConfig`, `DefaultSecureConfig`, `SecurityConfigForLevel` 등)은 이 필드를 **채우지 않으며**, 즉 기본적으로 속도 제한이 활성화되지 않습니다. 명시적으로 설정한 경우에만 Logger가 이에 따라 속도 제한기를 초기화합니다. 속도 제한을 끄려면 `nil`로 설정하면 됩니다.
:::

### FilterStats

필터 통계 데이터 구조, 모니터링과 가시성에 사용됩니다.

```go
type FilterStats struct {
    ActiveGoroutines  int32         // 현재 활성 필터 goroutine 수
    PatternCount      int32         // 등록된 민감 데이터 패턴 수
    SemaphoreCapacity int           // 최대 동시 필터 작업 수
    MaxInputLength    int           // 입력 길이 절단 임계값
    Enabled           bool          // 필터 활성화 여부
    TotalFiltered     int64         // 총 필터 작업 수
    TotalRedactions   int64         // 총 마스킹 횟수
    TotalTimeouts     int64         // 총 타임아웃 횟수
    AverageLatency    time.Duration // 평균 필터 지연
    CacheHits         int64         // 캐시 적중 횟수
    CacheMiss         int64         // 캐시 미스 횟수
}
```

### SecurityLevel

보안 레벨 열거, `SecurityConfigForLevel`로 사전 설정 구성을 빠르게 가져오는 데 사용됩니다.

```go
type SecurityLevel int
```

`String()` 메서드를 구현하여 읽기 쉬운 레벨 이름을 반환합니다.

| 상수 | 설명 |
|------|------|
| `SecurityLevelDevelopment` | 개발 환경(민감 필터 없음, 속도 제한 없음) |
| `SecurityLevelBasic` | 기본 필터(비밀번호, 토큰, API Key, 신용카드, SSN, 전화번호, SWIFT/CVV 등 약 40종의 일반적인 민감 데이터) |
| `SecurityLevelStandard` | 표준 필터(프로덕션 권장) |
| `SecurityLevelStrict` | 엄격한 필터(PII/금융 데이터 환경) |
| `SecurityLevelParanoid` | 극한 필터(고위험 환경) |

### 사전 설정 구성

| 함수 | 설명 | 적용 시나리오 |
|------|------|----------|
| `DefaultSecurityConfig()` | 기본 민감 데이터 필터 | 프로덕션 환경(권장) |
| `DefaultSecureConfig()` | 완전 민감 데이터 필터 | 고보안 요구 |
| `HealthcareConfig()` | HIPAA 규정 준수 | 의료 산업 |
| `FinancialConfig()` | PCI-DSS 규정 준수 | 금융 산업 |
| `GovernmentConfig()` | 정부 표준 | 공공 부문 |

### 레벨별 구성

```go
func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig
```

| 레벨 | 상수 | 설명 |
|------|------|------|
| Development | `SecurityLevelDevelopment` | 개발 환경, 가장 느슨함 |
| Basic | `SecurityLevelBasic` | 기본 필터 |
| Standard | `SecurityLevelStandard` | 표준 필터 |
| Strict | `SecurityLevelStrict` | 엄격한 필터 |
| Paranoid | `SecurityLevelParanoid` | 극한 필터 |

### Clone

```go
func (c *SecurityConfig) Clone() *SecurityConfig
```

보안 구성의 딥 카피를 생성합니다.

## 사용 방식

### Config로 구성

```go
// DefaultConfig에는 DefaultSecurityConfig()가 내장되어 있어, 보통 명시적 할당 불필요
cfg := dd.DefaultConfig()
logger, _ := dd.New(cfg)

// 더 높은 보안 레벨 구성으로 교체해야 한다면 명시적으로 덮어쓰기
// cfg.Security = dd.DefaultSecureConfig()
```

### 런타임 수정

```go
// 보안 구성 업데이트
logger.SetSecurityConfig(dd.DefaultSecureConfig())

// 현재 구성 읽기
sec := logger.GetSecurityConfig()
```

### 중첩 구조 필터

```go
filter := dd.NewSensitiveDataFilter()

// 문자열 필터
filtered := filter.Filter("password=s3cr3t")
// → "password=[REDACTED]"

// 중첩 구조(자동 재귀, 순환 참조 감지 지원)
data := map[string]any{
    "user": map[string]any{
        "name":     "admin",
        "password": "s3cr3t",
        "token":    "eyJhbGciOi...",
    },
}
filteredData := filter.FilterValueRecursive("data", data)
```

### 필터 통계 모니터링

```go
filter := dd.NewSensitiveDataFilter()
// ... 필터 사용 ...
stats := filter.GetFilterStats()
fmt.Printf("총 필터: %d, 마스킹: %d, 평균 지연: %v\n",
    stats.TotalFiltered, stats.TotalRedactions, stats.AverageLatency)
```

## 다음 단계

- [설정](../core/config) -- SecurityConfig 구성
- [Logger](../core/logger) -- SetSecurityConfig 메서드
- [감사 로그](./audit) -- 보안 이벤트 감사

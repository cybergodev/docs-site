---
title: "보안 필터 - CyberGo DD | 민감 데이터 필터링"
description: "CyberGo DD 민감 데이터 필터링 전체 API 문서. SensitiveDataFilter 필터링 규칙 설정, SecurityConfig 보안 정책 옵션 및 사전 설정 보안 설정 방안을 포함하여, 로그의 비밀번호, API 키, Token, 휴대전화 번호 및 신분증 번호 등 민감 정보를 자동으로 감지하고 마스킹하여 로그 유출 위험을 효과적으로 방지합니다."
---

# 보안 필터

DD는 내장된 민감 데이터 필터링 기능으로 로그의 비밀번호, 키, Token 등 민감 정보를 자동으로 감지하고 마스킹할 수 있습니다.

## SensitiveDataFilter

정규식 기반 민감 데이터 필터로, 동적 패턴과 캐시를 지원합니다.

### 생성

| 함수 | 서명 | 설명 |
|------|------|------|
| `NewSensitiveDataFilter` | `() *SensitiveDataFilter` | 전체 패턴 세트 |
| `NewEmptySensitiveDataFilter` | `() *SensitiveDataFilter` | 빈 필터 |
| `NewCustomSensitiveDataFilter` | `(patterns ...string) (*SensitiveDataFilter, error)` | 커스텀 패턴 |

### 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `AddPattern` | `(pattern string) error` | 정규식 패턴 추가 |
| `AddPatterns` | `(patterns ...string) error` | 패턴 일괄 추가 |
| `ClearPatterns` | `()` | 모든 패턴 제거 |
| `PatternCount` | `() int` | 패턴 수 |
| `Enable` | `()` | 필터링 활성화 |
| `Disable` | `()` | 필터링 비활성화 |
| `IsEnabled` | `() bool` | 활성화 여부 |
| `Filter` | `(input string) string` | 문자열 필터링 |
| `FilterFieldValue` | `(key string, value any) any` | 단일 필드 값 필터링 |
| `FilterValueRecursive` | `(key string, value any) any` | 중첩 구조 재귀 필터링 |
| `GetFilterStats` | `() FilterStats` | 필터링 통계 가져오기 |
| `ActiveGoroutineCount` | `() int32` | 활성 필터링 고루틴 수 |
| `WaitForGoroutines` | `(timeout time.Duration) bool` | 필터링 고루틴 완료 대기 |
| `Close` | `() bool` | 필터 종료 및 캐시 해제 |

### 커스텀 패턴

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,     // 비밀번호
    `(?i)api[_-]?key\s*[:=]\s*\S+`,  // API Key
    `\b\d{16,19}\b`,                  // 신용카드 번호
)
```

## SecurityConfig

보안 설정 구조체로, 필터링 동작과 보안 레벨을 제어합니다.

```go
type SecurityConfig struct {
    MaxMessageSize  int                  // 메시지 크기 상한 (바이트, 0은 제한 없음, 사전 설정 기본값 5MB)
    MaxWriters      int                  // 최대 Writer 수 (사전 설정 기본값 100)
    SensitiveFilter *SensitiveDataFilter // 민감 데이터 필터
}
```

### FilterStats

필터링 통계 데이터 구조로, 모니터링과 관측 가능성에 사용됩니다.

```go
type FilterStats struct {
    ActiveGoroutines  int32         // 현재 활성 필터링 고루틴 수
    PatternCount      int32         // 등록된 민감 데이터 패턴 수
    SemaphoreCapacity int           // 최대 동시 필터링 작업 수
    MaxInputLength    int           // 입력 길이 잘라내기 임계값
    Enabled           bool          // 필터링 활성화 여부
    TotalFiltered     int64         // 총 필터링 작업 수
    TotalRedactions   int64         // 총 마스킹 횟수
    TotalTimeouts     int64         // 총 타임아웃 횟수
    AverageLatency    time.Duration // 평균 필터링 지연
    CacheHits         int64         // 캐시 히트 횟수
    CacheMiss         int64         // 캐시 미스 횟수
}
```

### SecurityLevel

보안 레벨 열거형으로, `SecurityConfigForLevel`을 통해 사전 설정을 빠르게 가져오는 데 사용됩니다.

```go
type SecurityLevel int
```

`String()` 메서드를 구현하여 읽을 수 있는 레벨 이름을 반환합니다.

| 상수 | 설명 |
|------|------|
| `SecurityLevelDevelopment` | 개발 환경 (필터링 없음, 속도 제한 없음, 감사 없음) |
| `SecurityLevelBasic` | 기본 필터링 (비밀번호, API Key, 신용카드) |
| `SecurityLevelStandard` | 표준 필터링 (프로덕션 환경 권장) |
| `SecurityLevelStrict` | 엄격한 필터링 (PII/금융 데이터 환경) |
| `SecurityLevelParanoid` | 극도의 필터링 (고위험 환경) |

### 사전 설정

| 함수 | 설명 | 적용 시나리오 |
|------|------|----------|
| `DefaultSecurityConfig()` | 기본 민감 데이터 필터링 | 프로덕션 환경 (권장) |
| `DefaultSecureConfig()` | 전체 민감 데이터 필터링 | 높은 보안 요구 |
| `HealthcareConfig()` | HIPAA 준수 | 의료 산업 |
| `FinancialConfig()` | PCI-DSS 준수 | 금융 산업 |
| `GovernmentConfig()` | 정부 표준 | 공공 부문 |

### 레벨별 설정

```go
func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig
```

| 레벨 | 상수 | 설명 |
|------|------|------|
| Development | `SecurityLevelDevelopment` | 개발 환경, 가장 느슨함 |
| Basic | `SecurityLevelBasic` | 기본 필터링 |
| Standard | `SecurityLevelStandard` | 표준 필터링 |
| Strict | `SecurityLevelStrict` | 엄격한 필터링 |
| Paranoid | `SecurityLevelParanoid` | 극도의 필터링 |

### Clone

```go
func (c *SecurityConfig) Clone() *SecurityConfig
```

보안 설정의 깊은 복사를 생성합니다.

## 사용 방법

### Config를 통해 설정

```go
cfg := dd.DefaultConfig()
cfg.Security = dd.DefaultSecurityConfig()
logger, _ := dd.New(cfg)
```

### 런타임 수정

```go
// 보안 설정 업데이트
logger.SetSecurityConfig(dd.DefaultSecureConfig())

// 현재 설정 읽기
sec := logger.GetSecurityConfig()
```

### 중첩 구조 필터링

```go
filter := dd.NewSensitiveDataFilter()

// 문자열 필터링
filtered := filter.Filter("password=s3cr3t")
// → "password=[REDACTED]"

// 중첩 구조 (자동 재귀, 순환 참조 감지 지원)
data := map[string]any{
    "user": map[string]any{
        "name":     "admin",
        "password": "s3cr3t",
        "token":    "eyJhbGciOi...",
    },
}
filtered := filter.FilterValueRecursive("data", data)
```

### 필터링 통계 모니터링

```go
filter := dd.NewSensitiveDataFilter()
// ... 필터링 사용 ...
stats := filter.GetFilterStats()
fmt.Printf("총 필터링: %d, 마스킹: %d, 평균 지연: %v\n",
    stats.TotalFiltered, stats.TotalRedactions, stats.AverageLatency)
```

## 다음 단계

- [설정](./config) -- SecurityConfig 설정
- [Logger](./logger) -- SetSecurityConfig 메서드
- [감사 로그](./audit) -- 보안 이벤트 감사

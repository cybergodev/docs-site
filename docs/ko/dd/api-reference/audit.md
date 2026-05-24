---
title: "감사 로그 - CyberGo DD | AuditLogger"
description: "CyberGo DD 감사 로그 전체 API 문서. AuditLogger 비동기 감사 이벤트 레코더, AuditConfig 설정 옵션 (출력 대상, 형식, 서명) 및 감사 항목 구조화된 포맷팅을 포함하여, 보안 관련 이벤트 추적 기록을 지원하며 엔터프라이즈급 준수 감사 및 데이터 보안 감독의 다양한 요구를 충족합니다."
---

# 감사 로그

DD는 비동기 감사 로그 기능을 제공하여 보안 관련 이벤트를 기록하고, 무결성 서명과 체인 검증을 지원합니다.

## AuditLogger

비동기 보안 감사 이벤트 레코더.

### 생성

```go
func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)
```

```go
// 기본 설정 사용
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())

// 커스텀 설정
cfg := dd.DefaultAuditConfig()
cfg.JSONFormat = true
cfg.MinimumSeverity = dd.AuditSeverityWarning
auditLogger, _ := dd.NewAuditLogger(cfg)
```

### 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `Log` | `(event AuditEvent)` | 감사 이벤트 기록 (비동기) |
| `LogSensitiveDataRedaction` | `(pattern, field, message string)` | 민감 데이터 마스킹 이벤트 |
| `LogRateLimitExceeded` | `(message string, metadata map[string]any)` | 속도 제한 이벤트 |
| `LogSecurityViolation` | `(violationType, message string, metadata map[string]any)` | 보안 위반 이벤트 |
| `LogReDoSAttempt` | `(pattern, message string)` | ReDoS 공격 이벤트 |
| `LogIntegrityViolation` | `(message string, metadata map[string]any)` | 무결성 위반 이벤트 |
| `LogPathTraversalAttempt` | `(path, message string)` | 경로 순회 이벤트 |
| `Stats` | `() AuditStats` | 감사 통계 |
| `Close` | `() error` | 종료 및 남은 이벤트 새로고침 |

### 사용 예시

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

// 민감 데이터 마스킹 기록
audit.LogSensitiveDataRedaction("password", "login_form", "비밀번호 필드 평문 감지")

// 속도 제한 기록
audit.LogRateLimitExceeded("API 요청 한도 초과", map[string]any{
    "client_ip": "192.168.1.100",
    "limit":     100,
    "current":   150,
})

// 보안 위반 기록
audit.LogSecurityViolation("sql_injection", "SQL 주입 시도", map[string]any{
    "input": "' OR 1=1 --",
})
```

## AuditConfig

감사 로그 설정.

```go
type AuditConfig struct {
    Enabled          bool             // 감사 활성화 여부 (기본값 true)
    Output           *os.File         // 출력 파일 (기본값 os.Stderr)
    BufferSize       int              // 버퍼 크기 (기본값 1000)
    IncludeTimestamp  bool            // 타임스탬프 포함 여부 (기본값 true)
    JSONFormat       bool             // JSON 형식 출력 (기본값 true)
    MinimumSeverity  AuditSeverity    // 최소 기록 심각도 (기본값 AuditSeverityInfo)
    IntegritySigner  *IntegritySigner // 무결성 서명기
}
```

### 기본 설정

```go
func DefaultAuditConfig() AuditConfig
```

기본 감사 설정을 반환하며, 감사 로그는 기본적으로 활성화됩니다.

### 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `Validate` | `() error` | 설정 유효성 검증 |
| `Clone` | `() AuditConfig` | 설정 복사 |

## AuditEvent

감사 이벤트 구조체.

```go
type AuditEvent struct {
    Type     AuditEventType    `json:"type"`
    Timestamp time.Time        `json:"timestamp"`
    Message  string            `json:"message"`
    Pattern  string            `json:"pattern,omitempty"`
    Field    string            `json:"field,omitempty"`
    Metadata map[string]any    `json:"metadata,omitempty"`
    Severity AuditSeverity     `json:"severity"`
}
```

### AuditStats

감사 통계 데이터 구조.

```go
type AuditStats struct {
    TotalEvents int64                      // 총 이벤트 수
    Dropped     int64                      // 버려진 이벤트 수
    ByType      map[AuditEventType]int64   // 타입별 통계
    BufferSize  int                        // 버퍼 크기
    BufferUsage int                        // 버퍼 사용량
}
```

### AuditVerificationResult

감사 검증 결과.

```go
type AuditVerificationResult struct {
    Valid    bool         // 검증 통과 여부
    Event    *AuditEvent  // 파싱된 이벤트
    RawEvent string       // 원본 이벤트 문자열
    Error    error        // 검증 오류
}
```

## 감사 이벤트 타입

| 상수 | String() | 설명 |
|------|----------|------|
| `AuditEventSensitiveDataRedacted` | `"SENSITIVE_DATA_REDACTED"` | 민감 데이터 마스킹 완료 |
| `AuditEventRateLimitExceeded` | `"RATE_LIMIT_EXCEEDED"` | 속도 제한 초과 |
| `AuditEventReDoSAttempt` | `"REDOS_ATTEMPT"` | ReDoS 공격 시도 |
| `AuditEventSecurityViolation` | `"SECURITY_VIOLATION"` | 보안 위반 |
| `AuditEventIntegrityViolation` | `"INTEGRITY_VIOLATION"` | 무결성 위반 |
| `AuditEventInputSanitized` | `"INPUT_SANITIZED"` | 입력 정제 완료 |
| `AuditEventPathTraversalAttempt` | `"PATH_TRAVERSAL_ATTEMPT"` | 경로 순회 시도 |
| `AuditEventLog4ShellAttempt` | `"LOG4SHELL_ATTEMPT"` | Log4Shell 공격 시도 |
| `AuditEventNullByteInjection` | `"NULL_BYTE_INJECTION"` | Null 바이트 주입 |
| `AuditEventOverlongEncoding` | `"OVERLONG_ENCODING"` | 오버롱 인코딩 공격 |
| `AuditEventHomographAttack` | `"HOMOGRAPH_ATTACK"` | 동형문자 공격 |

## 감사 심각도

| 상수 | String() | 설명 |
|------|----------|------|
| `AuditSeverityInfo` | `"INFO"` | 정보 |
| `AuditSeverityWarning` | `"WARNING"` | 경고 |
| `AuditSeverityError` | `"ERROR"` | 오류 |
| `AuditSeverityCritical` | `"CRITICAL"` | 심각 |

### MarshalJSON

```go
func (s AuditSeverity) MarshalJSON() ([]byte, error)
```

`AuditSeverity`는 `json.Marshaler` 인터페이스를 구현하여, JSON 직렬화 시 정수 대신 문자열을 출력합니다:

```go
event := dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Severity: dd.AuditSeverityCritical,
}
data, _ := json.Marshal(event)
// Severity는 3이 아닌 "CRITICAL"로 직렬화됨
```

## 감사 항목 검증

```go
func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult
```

감사 로그 항목의 무결성을 검증합니다.

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
result := dd.VerifyAuditEvent(logEntry, signer)
if result != nil && result.Valid {
    fmt.Println("감사 항목 검증 통과")
}
```

## 다음 단계

- [무결성 서명](./integrity) -- IntegritySigner 상세 가이드
- [보안 필터](./security) -- 민감 데이터 필터링
- [훅 시스템](./hooks) -- OnError 훅

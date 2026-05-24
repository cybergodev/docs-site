---
title: "무결성 서명 - CyberGo DD | IntegritySigner"
description: "CyberGo DD 무결성 서명 전체 API 문서. HMAC-SHA256 알고리즘 서명과 일련번호 증분 추적 메커니즘을 지원하여 각 로그 항목이 변조되지 않았음을 보장하며, IntegritySigner 서명기와 Verify 검증기를 제공하여 보안 감사와 로그 변조 방지 등 다양한 준수 요구 사항을 충족합니다."
---

# 무결성 서명

DD는 HMAC 기반 로그 무결성 서명 메커니즘을 제공하여 로그 항목이 변조되지 않았음을 검증할 수 있습니다.

## IntegritySigner

로그 항목 서명기로, HMAC 서명과 체인 검증을 지원합니다.

### 생성

```go
func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)
```

```go
// 안전한 생성 (프로덕션에 권장)
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// 커스텀 설정
cfg := dd.IntegrityConfig{
    SecretKey:      []byte("my-secret-key-that-is-at-least-32b!"),
    HashAlgorithm:  dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,
    IncludeSequence:  true,
}
signer, err = dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}
```

### 서명 메서드

#### Sign

```go
func (s *IntegritySigner) Sign(message string) string
```

로그 메시지에 대한 HMAC 서명을 생성합니다. 스레드 안전하며 동시 호출이 가능합니다.

```go
sig := signer.Sign("사용자 로그인 admin 192.168.1.1")
// → "[SIG:1713456789000000000:1:base64signature...]"
```

#### SignFields

```go
func (s *IntegritySigner) SignFields(message string, fields []Field) string
```

필드가 포함된 메시지에 서명하며, 서명에는 메시지와 모든 필드 값이 포함됩니다. 스레드 안전하며 동시 호출이 가능합니다.

```go
sig := signer.SignFields("사용자 로그인", []dd.Field{
    dd.String("user", "admin"),
    dd.String("ip", "192.168.1.1"),
})
```

### 검증 메서드

#### Verify

```go
func (s *IntegritySigner) Verify(entry string) (*LogIntegrity, error)
```

로그 항목의 무결성을 검증합니다. 스레드 안전하며 동시 호출이 가능합니다.

```go
integrity, err := signer.Verify(signedEntry)
if err != nil {
    // 검증 오류 (예: signer가 nil)
}
if !integrity.Valid {
    // 서명이 유효하지 않음: 서명 불일치 또는 형식 오류
}
if integrity.Sequence != expectedSeq {
    // 일련번호가 연속적이지 않음: 일부 항목이 삭제되었을 수 있음
}
```

### 기타 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `GetSequence` | `() uint64` | 현재 일련번호 |
| `ResetSequence` | `()` | 일련번호 초기화 |
| `Stats` | `() IntegrityStats` | 서명 통계 |

## IntegrityConfig

서명 설정.

```go
type IntegrityConfig struct {
    SecretKey       []byte         // HMAC 키
    HashAlgorithm   HashAlgorithm  // 해시 알고리즘
    IncludeTimestamp bool           // 서명에 타임스탬프 포함
    IncludeSequence  bool           // 서명에 일련번호 포함
    SignaturePrefix  string        // 서명 접두사
}
```

### 안전한 생성

```go
func DefaultIntegrityConfigSafe() (IntegrityConfig, error)
```

기본 설정을 안전하게 생성합니다 (키 자동 생성). 프로덕션에 권장됩니다.

### 메서드

| 메서드 | 서명 | 설명 |
|------|------|------|
| `Validate` | `() error` | 설정 유효성 검증 |
| `Clone` | `() IntegrityConfig` | 설정 복사 |
| `MarshalJSON` | `() ([]byte, error)` | JSON 직렬화 (키는 직렬화에 참여하지 않고 길이만 출력) |

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}
```

## LogIntegrity

로그 무결성 검증 결과.

```go
type LogIntegrity struct {
    Valid     bool       // 서명이 유효한지 여부
    Timestamp time.Time  // 서명 타임스탬프
    Sequence  uint64     // 일련번호
    Message   string     // 원본 메시지
}
```

## IntegrityStats

서명 통계 데이터.

```go
type IntegrityStats struct {
    Sequence         uint64 // 현재 일련번호
    Algorithm        string // 알고리즘 이름
    IncludeTimestamp bool   // 타임스탬프 포함 여부
    IncludeSequence  bool   // 일련번호 포함 여부
}
```

## HashAlgorithm

| 상수 | 설명 |
|------|------|
| `HashAlgorithmSHA256` | SHA-256 알고리즘 |

`String()` 메서드를 구현하여 알고리즘 이름을 반환합니다.

## 전체 예시

### 로그 서명 흐름

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// 로그 서명
message := "사용자 로그인"
signature := signer.Sign(message)

// 서명이 포함된 로그 항목 저장
logEntry := message + signature

// 로그 검증
result, err := signer.Verify(logEntry)
if err != nil {
    fmt.Println("무결성 검증 실패:", err)
} else if result.Valid {
    fmt.Printf("검증 통과 - 일련번호: %d\n", result.Sequence)
}
```

### 감사 통합

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

auditCfg := dd.DefaultAuditConfig()
auditCfg.IntegritySigner = signer
audit, _ := dd.NewAuditLogger(auditCfg)
defer audit.Close()

// 감사 로그 자동 서명
audit.Log(dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Message:  "SQL 주입 시도",
    Severity: dd.AuditSeverityCritical,
    Metadata: map[string]any{"input": "' OR 1=1"},
})

// 감사 로그 검증
stats := signer.Stats()
fmt.Printf("알고리즘: %s, 일련번호: %d\n", stats.Algorithm, stats.Sequence)
```

## 다음 단계

- [감사 로그](./audit) -- AuditLogger 상세 가이드
- [보안 필터](./security) -- 민감 데이터 필터링
- [상수와 오류](./constants) -- 오류 코드

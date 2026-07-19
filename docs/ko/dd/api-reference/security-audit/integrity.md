---
sidebar_label: "무결성 서명"
title: "무결성 서명 - CyberGo DD | IntegritySigner"
description: "CyberGo DD 무결성 서명의 완전한 API 문서입니다. HMAC-SHA256 알고리즘 서명과 단조 증가 시퀀스 번호 추적 메커니즘을 지원하여 매 로그 항목이 변조되지 않았음을 보장합니다. IntegritySigner 서명자와 Verify 검증자를 제공하여 보안 감사와 로그 변조 방지의 다양한 규정 준수 요구를 충족합니다."
sidebar_position: 4
---

# 무결성 서명

DD는 HMAC 기반의 로그 무결성 서명 메커니즘을 제공하여 로그 항목이 변조되지 않았음을 검증할 수 있습니다.

## IntegritySigner

로그 항목 서명자로, HMAC 서명과 단조 시퀀스 번호 추적을 지원합니다(사후에 항목 유실/재생을 감지하는 데 사용되며, 호출자가 직접 시퀀스 번호를 비교해야 함).

### 생성

```go
func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)
```

전달된 `IntegrityConfig`로 서명자를 생성합니다. `DefaultIntegrityConfigSafe()`로 암호학적으로 안전한 랜덤 키를 생성할 수 있습니다.

오류를 반환하는 경우: `SecretKey`가 32바이트 미만이거나 `HashAlgorithm`이 지원되지 않는 경우.

:::warning 경고 키 보안
`NewIntegritySigner`는 전달된 `SecretKey`를 **복사**하고 원본 `cfg.SecretKey`를 즉시 제로화(키 재료가 두 곳의 메모리에 남지 않도록 방지)합니다. 호출자는 여전히 원본 키를 로그나 직렬화에 노출하지 않도록 주의해야 합니다.
:::

```go
// 안전 생성(프로덕션 권장)
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// 커스텀 구성
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

로그 메시지에 대해 HMAC 서명을 생성합니다. 스레드 안전하며 동시 호출 가능.

```go
sig := signer.Sign("사용자 로그인 admin 192.168.1.1")
// → "[SIG:1713456789000000000:1:base64signature...]"
```

#### SignFields

```go
func (s *IntegritySigner) SignFields(message string, fields []Field) string
```

필드가 포함된 메시지에 대해 서명을 생성하며, 서명은 메시지와 모든 필드값을 포함합니다. 스레드 안전하며 동시 호출 가능.

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

로그 항목의 무결성을 검증합니다. 스레드 안전하며 동시 호출 가능.

```go
integrity, err := signer.Verify(signedEntry)
if err != nil {
    // 검증 오류(예: signer가 nil)
}
if !integrity.Valid {
    // 서명 무효: 서명 불일치 또는 형식 오류
}
if integrity.Sequence != expectedSeq {
    // 시퀀스 번호 불연속: 항목이 삭제되었을 수 있음
}
```

### 기타 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `GetSequence` | `() uint64` | 현재 시퀀스 번호 |
| `ResetSequence` | `()` | 시퀀스 번호 리셋 |
| `Stats` | `() IntegrityStats` | 서명 통계 |

## IntegrityConfig

서명 구성.

```go
type IntegrityConfig struct {
    SecretKey        []byte        // HMAC 키(SHA-256은 ≥ 32바이트 요구; 안전하게 보관하고 정기적으로 로테이션)
    HashAlgorithm    HashAlgorithm // 해시 알고리즘(기본 SHA256)
    IncludeTimestamp bool          // 서명에 타임스탬프 포함
    IncludeSequence  bool          // 서명에 단조 증가 시퀀스 번호 포함(Verify 결과가 해당 시퀀스 번호를 가져오며, 호출자가 재생/재정렬 감지를 위해 직접 추적해야 함)
    SignaturePrefix  string        // 서명 접두사(기본 "[SIG:"; 비어 있을 때 NewIntegritySigner가 기본값으로 채움)
}
```

### 안전 생성

```go
func DefaultIntegrityConfigSafe() (IntegrityConfig, error)
```

기본 구성을 안전하게 생성(자동으로 키 생성). 프로덕션 사용 권장.

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Validate` | `() error` | 구성 유효성 검증(`SecretKey`는 ≥ 32바이트, `HashAlgorithm`은 지원되는 알고리즘이어야 함) |
| `Clone` | `() IntegrityConfig` | 딥 카피 구성(`SecretKey`는 새 슬라이스로 복사) |
| `MarshalJSON` | `() ([]byte, error)` | JSON 직렬화(키 자체는 직렬화에 **참여하지 않고**, `secretKeyLength`만 출력) |

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
    Valid     bool       // 서명 유효 여부
    Timestamp time.Time  // 서명 타임스탬프
    Sequence  uint64     // 시퀀스 번호
    Message   string     // 원본 메시지
}
```

## IntegrityStats

서명 통계 데이터.

```go
type IntegrityStats struct {
    Sequence         uint64 // 현재 시퀀스 번호
    Algorithm        string // 알고리즘 이름
    IncludeTimestamp bool   // 타임스탬프 포함 여부
    IncludeSequence  bool   // 시퀀스 번호 포함 여부
}
```

## HashAlgorithm

| 상수 | 설명 |
|------|------|
| `HashAlgorithmSHA256` | SHA-256 알고리즘 |

`String()` 메서드를 구현하여 알고리즘 이름을 반환합니다.

## 전체 예

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

// 서명된 로그 항목 저장
logEntry := message + signature

// 로그 검증
result, err := signer.Verify(logEntry)
if err != nil {
    fmt.Println("무결성 검증 실패:", err)
} else if result.Valid {
    fmt.Printf("검증 통과 - 시퀀스 번호: %d\n", result.Sequence)
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
    Message:  "SQL 인젝션 시도",
    Severity: dd.AuditSeverityCritical,
    Metadata: map[string]any{"input": "' OR 1=1"},
})

// 감사 로그 검증
stats := signer.Stats()
fmt.Printf("알고리즘: %s, 시퀀스 번호: %d\n", stats.Algorithm, stats.Sequence)
```

## 다음 단계

- [감사 로그](./audit) -- AuditLogger 상세
- [보안 필터](./security) -- 민감 데이터 필터
- [상수와 오류](../dev-tools/constants) -- 오류 코드

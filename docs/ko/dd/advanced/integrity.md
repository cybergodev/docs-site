---
title: "HMAC 서명 실전 - CyberGo DD | 로그 무결성 보호"
description: "CyberGo DD HMAC-SHA256 로그 무결성 서명 실전 가이드. IntegritySigner 생성과 초기화 설정, 서명과 검증 전체 흐름, 타임스탬프와 일련번호 증분 메커니즘, 변조 방지 검출 전략, 감사 로그 시스템과의 통합 방안 및 프로덕션 환경 배포 모범 사례를 다루어 로그 체인의 무결성과 추적 가능성을 보장합니다."
---

# HMAC 서명 실전

DD의 `IntegritySigner`는 HMAC-SHA256을 사용하여 로그 항목에 서명하여 로그가 저장 및 전송 중에 변조되지 않도록 보장합니다.

## 핵심 개념

```text
서명 흐름:
  원본 로그 → HMAC-SHA256(키 + 타임스탬프 + 일련번호) → 서명된 로그

검증 흐름:
  서명된 로그 → 서명 추출 → HMAC 재계산 → 서명 비교 → 무결성 판단
```

## 서명기 생성

### 안전한 키 설정

```go
// 방법 1: 안전한 키 자동 생성 (권장)
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
// cfg.SecretKey에 32바이트 랜덤 키가 채워짐

signer, _ := dd.NewIntegritySigner(cfg)
```

### 커스텀 설정

```go
cfg := dd.IntegrityConfig{
    SecretKey:       []byte("your-32-byte-minimum-secret-key!!"),  // 최소 32바이트
    HashAlgorithm:   dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,    // 서명에 타임스탬프 포함
    IncludeSequence:  true,    // 서명에 일련번호 포함
    SignaturePrefix:  "[SIG:",  // 서명 접두사
}
```

:::danger 키 관리
- 키는 최소 32바이트여야 함
- 소스 코드에 키를 하드코딩하지 말고, 환경 변수나 키 관리 서비스 사용
- 정기적으로 키 교체
- 키가 유출된 경우 즉시 교체하고 모든 로그 재검증
:::

## 서명 흐름

```go
// 서명기 생성
signer, _ := dd.NewIntegritySigner(cfg)

// 단일 로그 서명
logEntry := `{"level":"info","message":"사용자 로그인","user":"admin"}`
signature := signer.Sign(logEntry)
signedEntry := logEntry + signature

fmt.Println(signedEntry)
// 출력: {"level":"info","message":"사용자 로그인","user":"admin"}[SIG:1713456789000000000:1:base64sig...]
```

### 서명 통계

```go
stats := signer.Stats()
fmt.Printf("현재 일련번호: %d\n", stats.Sequence)
fmt.Printf("알고리즘: %s\n", stats.Algorithm)
fmt.Printf("타임스탬프 포함: %v\n", stats.IncludeTimestamp)
fmt.Printf("일련번호 포함: %v\n", stats.IncludeSequence)
```

## 검증 흐름

### 단일 로그 검증

```go
result, err := signer.Verify(signedEntry)
if err != nil {
    fmt.Printf("검증 실패: %v\n", err)
    return
}

if result.Valid {
    fmt.Printf("로그 무결성 확인 - 시간: %s, 일련번호: %d\n",
        result.Timestamp, result.Sequence)
    fmt.Printf("메시지: %s\n", result.Message)
} else {
    fmt.Printf("로그가 변조되었을 수 있음\n")
}
```

### 로그 파일 일괄 검증

```go
func VerifyLogFile(path string, signer *dd.IntegritySigner) (valid, invalid int, err error) {
    file, err := os.Open(path)
    if err != nil {
        return 0, 0, err
    }
    defer file.Close()

    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
        result, err := signer.Verify(scanner.Text())
        if err != nil || !result.Valid {
            invalid++
        } else {
            valid++
        }
    }

    return valid, invalid, scanner.Err()
}
```

### 감사 이벤트 검증

```go
result := dd.VerifyAuditEvent(auditLogLine, signer)
if result.Valid && result.Event != nil {
    fmt.Printf("감사 이벤트: %s\n", result.Event.Message)
} else {
    fmt.Printf("검증 실패: %s\n", result.Error)
}
```

## 감사 로그와 통합

```go
// 전체 서명 + 감사 솔루션
func NewSignedAuditSystem() (*dd.AuditLogger, *dd.IntegritySigner, error) {
    // 서명기
    cfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(cfg)

    // 감사 파일
    auditFile, _ := os.OpenFile(
        "logs/audit-signed.json",
        os.O_CREATE|os.O_WRONLY|os.O_APPEND,
        0600,
    )

    // 감사 Logger (서명 포함)
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        IncludeTimestamp: true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityWarning,
        IntegritySigner:  signer,
    })

    return auditLogger, signer, nil
}
```

## 타임스탬프와 일련번호

서명기는 서명에 타임스탬프와 일련번호를 내장하는 것을 지원합니다:

```go
cfg := dd.IntegrityConfig{
    SecretKey:       secretKey,
    IncludeTimestamp: true,    // 서명에 타임스탬프 포함
    IncludeSequence:  true,    // 서명에 증가하는 일련번호 포함
}

// 활성화 후 Verify 결과에 추가 정보 포함
result, _ := signer.Verify(signedEntry)
result.Timestamp  // 서명 시 타임스탬프
result.Sequence   // 서명 시 일련번호
```

:::tip 일련번호 감지
일련번호를 활성화하면 로그가 삭제되거나 재배치되었는지 감지할 수 있습니다. 일련번호가 연속적이지 않으면 로그가 변조되었을 수 있습니다.
:::

## 프로덕션 모범 사례

### 키 관리

```go
// 환경 변수에서 키 읽기
func loadSecretKey() ([]byte, error) {
    key := os.Getenv("DD_INTEGRITY_SECRET")
    if len(key) < 32 {
        return nil, fmt.Errorf("secret key must be at least 32 bytes")
    }
    return []byte(key), nil
}
```

### 정기 검증

```go
// 매시간 감사 로그 무결성 검증
func startIntegrityChecker(signer *dd.IntegritySigner, logPath string) {
    ticker := time.NewTicker(time.Hour)
    go func() {
        for range ticker.C {
            valid, invalid, err := VerifyLogFile(logPath, signer)
            if err != nil {
                dd.Errorf("무결성 검사 실패: %v", err)
                continue
            }
            dd.InfoWith("무결성 검사 완료",
                dd.Int("valid", valid),
                dd.Int("invalid", invalid),
            )
            if invalid > 0 {
                dd.Error("로그 변조 감지")
            }
        }
    }()
}
```

## 다음 단계

- [감사 로그](../guides/audit-logging) -- 보안 감사 통합
- [업계 준수 설정](../security/compliance) -- HIPAA/PCI-DSS 서명 요구 사항
- [API 레퍼런스 - Integrity](../api-reference/integrity) -- IntegritySigner 전체 API

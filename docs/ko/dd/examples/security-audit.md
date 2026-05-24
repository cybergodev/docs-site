---
title: "보안과 감사 실전 - CyberGo DD | 보안 로그 예제"
description: "CyberGo DD 보안 필터링과 감사 로그의 전체 실전 예제 모음. 민감 데이터 필터링 규칙 설정, HMAC 무결성 서명과 검증, 감사 이벤트 기록과 일괄 검증, 업계 준수 설정 방안 (HIPAA/PCI-DSS) 및 프로덕션 환경 보안 로그 아키텍처 설계와 배포 모범 사례와 주의 사항을 다룹니다."
---

# 보안과 감사 실전

이 예제에서는 DD의 보안 필터링, 감사 로그, 무결성 서명을 설정하여 프로덕션급 보안 로그 솔루션을 구축하는 방법을 보여줍니다.

## 민감 데이터 필터링

### 기본 필터링

```go
package main

import (
    "github.com/cybergodev/dd"
)

func main() {
    logger, _ := dd.New(dd.Config{
        Security: dd.DefaultSecurityConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // 비밀번호 자동 마스킹
    logger.InfoWith("사용자 로그인",
        dd.String("username", "alice"),
        dd.String("password", "s3cr3t123"),    // → password=[REDACTED]
    )

    // API Key 자동 마스킹
    logger.InfoWith("API 호출",
        dd.String("endpoint", "/api/data"),
        dd.String("api_key", "sk-abc123xyz"),   // → api_key=[REDACTED]
    )
}
```

### 업계 준수 설정

```go
// HIPAA 의료 준수
medicalLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/medical.json")},
})

medicalLogger.InfoWith("환자 진료",
    dd.String("password", "s3cr3t123"),        // → [REDACTED] (키 이름이 민감함)
    dd.String("diagnosis", "일반 검진"),         // 정상 출력
)

// PCI-DSS 금융 준수
paymentLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/payment.json")},
})

paymentLogger.InfoWith("결제 처리",
    dd.String("card_number", "4111111111111111"),  // → [REDACTED]
    dd.String("amount", "99.99"),                  // 정상 출력
)
```

## 감사 로그

### 전체 감사 시스템

```go
package main

import (
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // 감사 로그 파일
    auditFile, _ := os.Create("logs/audit.json")
    defer auditFile.Close()

    // HMAC 서명기 (변조 방지)
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // 감사 Logger
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // 비즈니스 Logger
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // 일반 비즈니스 작업
    logger.InfoWith("거래 처리",
        dd.String("transaction_id", "TXN-001"),
        dd.String("amount", "1500.00"),
        dd.String("card_number", "4111111111111111"),  // → [REDACTED]
    )
}
```

## 무결성 검증

### 서명과 검증 흐름

```go
package main

import (
    "fmt"

    "github.com/cybergodev/dd"
)

func main() {
    // 서명기 생성
    signer, err := dd.NewIntegritySigner(dd.IntegrityConfig{
        SecretKey:       []byte("your-32-byte-secret-key-here-1234"),
        IncludeTimestamp: true,
        IncludeSequence:  true,
    })
    if err != nil {
        panic(err)
    }

    // 로그 항목 서명
    logEntry := `{"level":"info","message":"중요 작업","user":"admin"}`
    signature := signer.Sign(logEntry)
    signedEntry := logEntry + signature

    // 로그 무결성 검증
    result, err := signer.Verify(signedEntry)
    if err != nil {
        fmt.Printf("검증 오류: %v\n", err)
    } else if result.Valid {
        fmt.Printf("검증 통과 - 타임스탬프: %s, 일련번호: %d\n",
            result.Timestamp, result.Sequence)
    } else {
        fmt.Printf("검증 실패: 로그가 변조되었을 수 있음\n")
    }
}
```

### 감사 로그 일괄 검증

```go
func VerifyAuditLog(path string, signer *dd.IntegritySigner) error {
    file, err := os.Open(path)
    if err != nil {
        return err
    }
    defer file.Close()

    scanner := bufio.NewScanner(file)
    lineNum := 0
    for scanner.Scan() {
        lineNum++
        result := dd.VerifyAuditEvent(scanner.Text(), signer)
        if result == nil || !result.Valid {
            errMsg := "unknown error"
            if result != nil && result.Error != nil {
                errMsg = result.Error.Error()
            }
            return fmt.Errorf("line %d: integrity check failed - %s",
                lineNum, errMsg)
        }
    }
    return nil
}
```

## 프로덕션 환경 보안 설정

```go
func NewSecureLogger() (*dd.Logger, *dd.AuditLogger, error) {
    // 감사 서명기
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // 감사 Logger
    auditFile, _ := os.OpenFile("logs/audit.json", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       2000,
        MinimumSeverity:  dd.AuditSeverityWarning,
        IntegritySigner:  signer,
    })

    // 비즈니스 Logger
    fwCfg := dd.DefaultFileWriterConfig()
    fwCfg.MaxSizeMB = 50
    fwCfg.Compress = true
    fw, _ := dd.NewFileWriter("logs/app.json", fwCfg)

    logger, _ := dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.CustomOutput(fw)},
    })

    return logger, auditLogger, nil
}
```

## 다음 단계

- [API 레퍼런스 - Security](../api-reference/security) -- 보안 필터링 전체 API
- [API 레퍼런스 - Audit](../api-reference/audit) -- 감사 로그 전체 API
- [API 레퍼런스 - Integrity](../api-reference/integrity) -- 무결성 서명 API
- [프로덕션 체크리스트](../security/production-checklist) -- 출시 보안 체크리스트

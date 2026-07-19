---
sidebar_label: "보안과 감사 실전"
title: "보안과 감사 실전 - CyberGo DD | 보안 로그 예제"
description: "CyberGo DD 보안 필터와 감사 로그의 완전한 실전 예제 모음입니다. 민감 데이터 필터 규칙 구성, HMAC 무결성 서명과 검증, 감사 이벤트 기록과 일괄 검증, 산업 규정 준수 구성 방안(HIPAA/PCI-DSS), 프로덕션 환경 보안 로그 아키텍처 설계와 배포의 모범 사례 권장 및 주의사항을 다룹니다."
sidebar_position: 3
---

# 보안과 감사 실전

이 예제는 DD의 보안 필터, 감사 로그, 무결성 서명을 구성하여 프로덕션급 보안 로그 방안을 구축하는 방법을 보여줍니다.

## 민감 데이터 필터

### 기본 필터

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

    // API Key 자동 마스킹(주의: endpoint도 민감 키 이름에 해당하여 마스킹됨)
    logger.InfoWith("API 호출",
        dd.String("endpoint", "/api/data"),      // → endpoint=[REDACTED]("endpoint"도 민감 키 이름)
        dd.String("api_key", "sk-abc123xyz"),   // → api_key=[REDACTED]
    )
}
```

### 산업 규정 준수 구성

```go
// HIPAA 의료 규정 준수
medicalLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/medical.json")},
})

medicalLogger.InfoWith("환자 진료",
    dd.String("password", "s3cr3t123"),        // → [REDACTED](키 이름 민감)
    dd.String("diagnosis", "정기 검진"),       // 정상 출력
)

// PCI-DSS 금융 규정 준수
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

### 완전한 감사 시스템

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

    // HMAC 서명자(변조 방지)
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
        // 주의: 여기에 Audit을 구성하지 않았으므로, 비즈니스 logger의 마스킹/보안 이벤트가 위 auditLogger에 자동으로 들어가지 않습니다.
        // 보안 이벤트를 감사로 자동 들어가게 하려면 여기에 Audit 필드를 구성해야 합니다(예: 위 auditLogger에 해당하는
        // AuditConfig를 Audit: &auditCfg로 전달), 또는 auditLogger.LogX(...)를 명시적으로 호출해 이벤트를 기록합니다.
    })
    defer logger.Close()

    // 정상 비즈니스 작업(마스킹은 Security가 처리하지만 감사 로그에 자동으로 기록되지는 않음)
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
    // 서명자 생성
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
        fmt.Printf("검증 통과 - 타임스탬프: %s, 시퀀스 번호: %d\n",
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

## 프로덕션 환경 보안 구성

```go
func NewSecureLogger() (*dd.Logger, *dd.AuditLogger, error) {
    // 감사 서명자
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

- [API 레퍼런스 - Security](../api-reference/security-audit/security) -- 보안 필터의 완전한 API
- [API 레퍼런스 - Audit](../api-reference/security-audit/audit) -- 감사 로그의 완전한 API
- [API 레퍼런스 - Integrity](../api-reference/security-audit/integrity) -- 무결성 서명 API
- [프로덕션 체크리스트](../security/production-checklist) -- 출시 보안 검사

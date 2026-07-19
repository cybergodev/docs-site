---
sidebar_label: "감사 로그"
title: "감사 로그 - CyberGo DD | 보안 감사 실전 가이드"
description: "CyberGo DD 감사 로그 실전 가이드입니다. AuditLogger 비동기 이벤트 기록 메커니즘, 11종의 내장 감사 이벤트 타입, 심각도 레벨 필터링과 등급별 분류, HMAC 무결성 서명 통합 방안, 감사 통계와 실시간 모니터링, 로그 검증과 변조 방지 전략을 다루어 개발자가 규정 준수 요구를 충족하는 기업급 보안 감사 시스템을 구축할 수 있도록 돕습니다."
sidebar_position: 5
---

# 감사 로그

감사 로그는 비즈니스 로그와 독립적으로 보안 관련 이벤트(예: 민감 데이터 마스킹, ReDoS 공격 시도 등)를 전담하여 기록하며, 규정 준수 감사와 보안 분석에 적합합니다.

## 개요

```text
비즈니스 로그(Logger)          감사 로그(AuditLogger)
    │                           │
    ├─ Info/Debug/Warn...       ├─ SensitiveDataRedacted
    ├─ 구조화 필드              ├─ RateLimitExceeded
    └─ 파일/콘솔 출력           ├─ ReDoSAttempt
                                ├─ SecurityViolation
                                └─ IntegrityViolation
```

감사 로그는 버퍼 채널을 통해 비동기로 기록되어 비즈니스 흐름을 차단하지 않습니다.

## AuditLogger 생성

### 기본 사용

```go
auditLogger, err := dd.NewAuditLogger(dd.DefaultAuditConfig())
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()

// AuditLogger는 독립 생성(본 예)또는 Config.Audit로 Logger와 자동 통합 가능
// 여기서는 독립 사용법 시연: 별도 logger를 만들고 Config.Audit 미설정
logger, err := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
    Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### 커스텀 구성

```go
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           os.Stderr,               // 출력 대상 (*os.File)
    BufferSize:       2000,                    // 버퍼 채널 크기
    IncludeTimestamp: true,                    // 타임스탬프 포함
    JSONFormat:       true,                    // JSON 형식
    MinimumSeverity:  dd.AuditSeverityWarning, // 최소 심각도 레벨
})
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()
```

## 감사 이벤트 타입

AuditLogger는 11가지 보안 이벤트를 기록합니다.

| 이벤트 타입 | 설명 | 기본 심각도 레벨 |
|----------|------|-------------|
| `AuditEventSensitiveDataRedacted` | 민감 데이터 마스킹됨 | Info |
| `AuditEventRateLimitExceeded` | 속도 제한 트리거 | Warning |
| `AuditEventReDoSAttempt` | ReDoS 공격 시도 | Critical |
| `AuditEventSecurityViolation` | 보안 위반 | Error |
| `AuditEventIntegrityViolation` | 로그 무결성 훼손 | Critical |
| `AuditEventInputSanitized` | 입력 정제됨 | <Badge type="info" text="호출자 지정" /> |
| `AuditEventPathTraversalAttempt` | 경로 순회 시도 | Critical |
| `AuditEventLog4ShellAttempt` | Log4Shell 공격 시도 | <Badge type="info" text="호출자 지정" /> |
| `AuditEventNullByteInjection` | null 바이트 주입 시도 | <Badge type="info" text="호출자 지정" /> |
| `AuditEventOverlongEncoding` | Overlong 인코딩 공격 | <Badge type="info" text="호출자 지정" /> |
| `AuditEventHomographAttack` | 동형자 공격 | <Badge type="info" text="호출자 지정" /> |

## HMAC 서명과 통합

감사 로그와 무결성 서명을 결합하면 로그 변조를 방지할 수 있습니다.

```go
// 서명자 생성
integrityCfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(integrityCfg)
if err != nil {
    log.Fatal(err)
}

// 서명이 포함된 감사 Logger 생성
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    BufferSize:       1000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer, // HMAC 서명
})
```

## 감사 통계

```go
stats := auditLogger.Stats()
fmt.Printf("총 이벤트 수: %d\n", stats.TotalEvents)
fmt.Printf("버려진 이벤트: %d\n", stats.Dropped)
fmt.Printf("버퍼 사용률: %.1f%%\n",
    float64(stats.BufferUsage)/float64(stats.BufferSize)*100)

// 타입별 통계
for eventType, count := range stats.ByType {
    fmt.Printf("  %s: %d\n", eventType, count)
}
```

:::tip 팁 모니터링 권장
`Dropped` 카운트를 정기적으로 확인하세요. 버려진 이벤트 수가 증가하면 버퍼가 부족하다는 뜻이므로 `BufferSize`를 늘리거나 소비 속도를 높여야 합니다.
:::

## 로그 검증

감사 로그 항목의 무결성을 검증합니다.

```go
// 단일 감사 로그 검증
result := dd.VerifyAuditEvent(logLine, signer)
if result.Valid {
    fmt.Printf("검증됨: %s\n", result.RawEvent)
    if result.Event != nil {
        fmt.Printf("  타입: %s, 메시지: %s\n", result.Event.Type, result.Event.Message)
    }
} else {
    fmt.Printf("검증 실패: %s\n", result.Error)
}
```

## 심각도 레벨 필터

감사 이벤트는 심각도 레벨로 필터링되며, `MinimumSeverity`보다 낮은 이벤트는 무시됩니다.

```go
// Warning 이상만 기록
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    MinimumSeverity: dd.AuditSeverityWarning,
})
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()
```

| 레벨 | 수치 | 적용 시나리오 |
|------|------|----------|
| `AuditSeverityInfo` | 0 | 모든 이벤트 기록(개발/디버그) |
| `AuditSeverityWarning` | 1 | 프로덕션 환경 권장 |
| `AuditSeverityError` | 2 | 고보안 요구 |
| `AuditSeverityCritical` | 3 | 심각한 이벤트만 기록 |

## 전체 예

```go
package main

import (
    "log"
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // 감사 파일 생성
    auditFile, err := os.Create("logs/audit.json")
    if err != nil {
        log.Fatal(err)
    }
    defer auditFile.Close()

    // 서명자 생성
    integrityCfg, err := dd.DefaultIntegrityConfigSafe()
    if err != nil {
        log.Fatal(err)
    }
    signer, err := dd.NewIntegritySigner(integrityCfg)
    if err != nil {
        log.Fatal(err)
    }

    // 감사 Logger 생성
    auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    if err != nil {
        log.Fatal(err)
    }
    defer auditLogger.Close()

    // 비즈니스 Logger 생성(보안 필터 포함)
    logger, err := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    // 정상 비즈니스 로그(민감 데이터 자동 마스킹)
    logger.InfoWith("사용자 작업",
        dd.String("username", "alice"),
        dd.String("password", "secret123"), // → [REDACTED]
    )

    // 참고: 본 예에서는 Logger에 Config.Audit를 설정하지 않았으므로, 마스킹 등 보안 이벤트가 자동으로 감사에 들어가지 않습니다.
    // 비즈니스 logger의 보안 이벤트를 AuditLogger로 자동 전달하려면 해당 logger의
    // Config.Audit에서 구성해야 합니다(활성화하면 마스킹, 속도 제한 등 이벤트가 자동으로 감사 스트림에 들어감).
}
```

:::info 정보 자동 통합 vs 독립 사용
AuditLogger는 **독립 생성**(`dd.NewAuditLogger`, 본 절 예시의 사용법)도 가능하고, **`Config.Audit`로 Logger와 자동 통합**도 가능합니다. 후자는 `Config.Audit`(타입 `AuditConfig`)의 `Enabled` 필드가 true일 때 민감 데이터 마스킹 이벤트, 속도 제한 이벤트 등을 AuditLogger로 자동 전달하며, 수동으로 훅을 연결할 필요가 없습니다.
:::

## 다음 단계

- [HMAC 서명 실전](../advanced/integrity) -- 무결성 서명 상세
- [산업 규정 준수 구성](../security/compliance) -- HIPAA/PCI-DSS 감사 요구
- [API 레퍼런스 - Audit](../api-reference/security-audit/audit) -- AuditLogger 완전한 API
- [API 레퍼런스 - Integrity](../api-reference/security-audit/integrity) -- IntegritySigner API

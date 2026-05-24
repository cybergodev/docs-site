---
title: "감사 로그 - CyberGo DD | 보안 감사 실전 가이드"
description: "CyberGo DD 감사 로그 실전 가이드. AuditLogger 비동기 이벤트 기록 메커니즘, 11가지 내장 감사 이벤트 타입, 심각도 등급 필터링과 분류, HMAC 무결성 서명 통합 방안, 감사 통계와 실시간 모니터링, 로그 검증과 변조 방지 전략을 다루어 개발자가 준수 요구 사항을 충족하는 엔터프라이즈급 보안 감사 시스템을 구축할 수 있도록 돕습니다."
---

# 감사 로그

감사 로그는 비즈니스 로그와 독립적으로 보안 관련 이벤트(예: 민감 데이터 마스킹, ReDoS 공격 시도 등)를 전문적으로 기록하며, 준수 감사와 보안 분석에 적합합니다.

## 개요

```text
비즈니스 로그 (Logger)          감사 로그 (AuditLogger)
    │                           │
    ├─ Info/Debug/Warn...       ├─ SensitiveDataRedacted
    ├─ 구조화된 필드             ├─ RateLimitExceeded
    └─ 파일/콘솔 출력            ├─ ReDoSAttempt
                                ├─ SecurityViolation
                                └─ IntegrityViolation
```

감사 로그는 버퍼 채널을 통해 비동기적으로 기록되어 비즈니스 흐름을 차단하지 않습니다.

## AuditLogger 생성

### 기본 사용법

```go
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer auditLogger.Close()

// 참고: AuditLogger와 Logger는 독립 컴포넌트입니다
// 둘은 자동으로 통합되지 않으며, 훅이나 다른 메커니즘을 통해 수동으로 연결해야 합니다
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
    Targets: []dd.OutputTarget{dd.ConsoleOutput()},
})
```

### 커스텀 설정

```go
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           os.Stderr,           // 출력 대상 (*os.File)
    BufferSize:       2000,                // 버퍼 채널 크기
    IncludeTimestamp: true,                // 타임스탬프 포함
    JSONFormat:       true,                // JSON 형식
    MinimumSeverity:  dd.AuditSeverityWarning, // 최소 심각도 등급
})
```

## 감사 이벤트 타입

AuditLogger는 11가지 보안 이벤트를 기록합니다:

| 이벤트 타입 | 설명 | 기본 심각도 |
|----------|------|-------------|
| `SensitiveDataRedacted` | 민감 데이터가 마스킹됨 | Info |
| `RateLimitExceeded` | 속도 제한 트리거 | Warning |
| `ReDoSAttempt` | ReDoS 공격 시도 | Critical |
| `SecurityViolation` | 보안 위반 | Error |
| `IntegrityViolation` | 로그 무결성 손상 | Critical |
| `InputSanitized` | 입력이 정제됨 | Info |
| `PathTraversalAttempt` | 경로 순회 시도 | Critical |
| `Log4ShellAttempt` | Log4Shell 공격 시도 | <Badge type="info" text="호출자가 지정" /> |
| `NullByteInjection` | 널 바이트 주입 시도 | <Badge type="info" text="호출자가 지정" /> |
| `OverlongEncoding` | 오버롱 인코딩 공격 | <Badge type="info" text="호출자가 지정" /> |
| `HomographAttack` | 동형문자 공격 | <Badge type="info" text="호출자가 지정" /> |

## HMAC 서명 통합

감사 로그와 무결성 서명을 결합하여 로그 변조를 방지할 수 있습니다:

```go
// 서명기 생성
integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(integrityCfg)

// 서명이 포함된 감사 Logger 생성
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    BufferSize:       1000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer,    // HMAC 서명
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

:::tip 모니터링 조언
`Dropped` 카운트를 정기적으로 확인하세요. 버려진 이벤트 수가 증가하면 버퍼가 부족하다는 뜻이므로 `BufferSize`를 늘리거나 소비 속도를 높여야 합니다.
:::

## 로그 검증

감사 로그 항목의 무결성 검증:

```go
// 단일 감사 로그 검증
result := dd.VerifyAuditEvent(logLine, signer)
if result.Valid {
    fmt.Printf("검증 완료: %s\n", result.RawEvent)
    if result.Event != nil {
        fmt.Printf("  타입: %s, 메시지: %s\n", result.Event.Type, result.Event.Message)
    }
} else {
    fmt.Printf("검증 실패: %s\n", result.Error)
}
```

## 심각도 등급 필터링

감사 이벤트는 심각도 등급으로 필터링되며, `MinimumSeverity` 미만의 이벤트는 무시됩니다:

```go
// Warning 이상만 기록
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    MinimumSeverity: dd.AuditSeverityWarning,
})
```

| 등급 | 수치 | 적용 시나리오 |
|------|------|----------|
| `AuditSeverityInfo` | 0 | 모든 이벤트 기록 (개발/디버그) |
| `AuditSeverityWarning` | 1 | 프로덕션 환경 권장 |
| `AuditSeverityError` | 2 | 높은 보안 요구 |
| `AuditSeverityCritical` | 3 | 심각한 이벤트만 기록 |

## 전체 예시

```go
package main

import (
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // 감사 파일 생성
    auditFile, _ := os.Create("logs/audit.json")
    defer auditFile.Close()

    // 서명기 생성
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // 감사 Logger 생성
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // 비즈니스 Logger 생성 (보안 필터링 포함)
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // 일반 비즈니스 로그 (민감 데이터 자동 마스킹)
    logger.InfoWith("사용자 작업",
        dd.String("username", "alice"),
        dd.String("password", "secret123"), // → [REDACTED]
    )

    // 참고: AuditLogger와 Logger는 독립 컴포넌트입니다
    // 훅을 통해 Logger의 보안 이벤트를 AuditLogger로 전달해야 합니다
}
```

## 다음 단계

- [HMAC 서명 실전](../advanced/integrity) -- 무결성 서명 상세 가이드
- [업계 준수 설정](../security/compliance) -- HIPAA/PCI-DSS 감사 요구 사항
- [API 레퍼런스 - Audit](../api-reference/audit) -- AuditLogger 전체 API
- [API 레퍼런스 - Integrity](../api-reference/integrity) -- IntegritySigner API

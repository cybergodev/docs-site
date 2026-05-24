---
title: "보안 개요 - CyberGo DD | 로그 보안"
description: "CyberGo DD 로그 라이브러리 보안 기능에 대한 포괄적인 개요. 민감 데이터 자동 감지와 마스킹 필터링 메커니즘, 파일 경로 보안 검증과 보호 전략, 비동기 감사 이벤트 기록과 체인 추적 능력, HMAC 무결성 서명 변조 방지 기술 및 준수 설정 모범 사례 가이드를 포함하여, 데이터 필터링부터 감사 추적까지 로그 시스템의 전면적인 보안 운영을 보장합니다."
---

# 보안 개요

DD 로그 라이브러리는 다계층 보안 보호 메커니즘을 내장하여, 데이터 필터링부터 감사 추적까지 로그 보안을 전면적으로 보장합니다.

## 보안 계층

| 계층 | 메커니즘 | 설명 |
|------|------|------|
| 데이터 계층 | 민감 데이터 필터링 | 비밀번호, 키 등 자동 마스킹 |
| 경로 계층 | 경로 보안 검증 | 경로 순회, 심볼릭 링크 공격 방지 |
| 패턴 계층 | ReDoS 방지 | 위험한 정규식 패턴 감지 |
| 감사 계층 | 감사 로그 | 모든 보안 이벤트 기록 |
| 무결성 계층 | HMAC 서명 | 로그 변조 불가능 보장 |

## 민감 데이터 필터링

DD는 민감 데이터 자동 감지 및 마스킹을 내장합니다:

```go
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})

// password 필드 자동 마스킹
logger.InfoWith("로그인",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // 출력: [REDACTED]
)
```

지원하는 커스텀 패턴:

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,
    `(?i)api[_-]?key\s*[:=]\s*\S+`,
    `\b\d{16,19}\b`,  // 신용카드 번호
)
```

자세한 내용은 [보안 필터 API](../api-reference/security)를 참조하세요.

## 경로 보안

FileWriter는 다계층 경로 보안 검증을 내장합니다:

| 보호 | 설명 |
|------|------|
| 경로 순회 | `../` 등 경로 순회 거부 |
| Null 바이트 | null 바이트 주입 거부 |
| 오버롱 인코딩 | UTF-8 오버롱 인코딩 감지 |
| 심볼릭 링크 | 심볼릭 링크 비활성화 설정 가능 |
| 하드링크 | 하드링크 비활성화 설정 가능 |
| 경로 길이 | 경로 최대 길이 제한 |

```go
// 경로 순회 공격 자동 거부
fw, err := dd.NewFileWriter("../../../etc/passwd", dd.DefaultFileWriterConfig())
// err: PATH_TRAVERSAL
```

## 준수 설정

DD는 업계 준수 사전 설정을 제공합니다:

| 사전 설정 | 준수 표준 | 적용 산업 |
|------|----------|----------|
| `HealthcareConfig()` | HIPAA | 의료 |
| `FinancialConfig()` | PCI-DSS | 금융 |
| `GovernmentConfig()` | 정부 표준 | 공공 부문 |

```go
// HIPAA 준수
logger, _ := dd.New(dd.Config{
    Security: dd.HealthcareConfig(),
})
```

## 감사 로그

모든 보안 이벤트는 감사 로그를 통해 추적할 수 있습니다:

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

audit.LogSecurityViolation("sql_injection", "SQL 주입", map[string]any{
    "input": "' OR 1=1 --",
})
```

자세한 내용은 [감사 로그 API](../api-reference/audit)를 참조하세요.

## 로그 무결성

HMAC 서명을 통해 로그 변조를 방지합니다:

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
signature := signer.Sign(logMessage)
// 검증 시: signer.Verify(signedEntry)
```

자세한 내용은 [무결성 서명 API](../api-reference/integrity)를 참조하세요.

## 다음 단계

- [프로덕션 체크리스트](./production-checklist) -- 출시 전 보안 체크리스트
- [보안 필터 API](../api-reference/security) -- SensitiveDataFilter 상세 가이드
- [감사 로그 API](../api-reference/audit) -- AuditLogger 상세 가이드

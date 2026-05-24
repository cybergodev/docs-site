---
title: "민감 데이터 필터링 - CyberGo DD | 자동 마스킹 설정 가이드"
description: "CyberGo DD 민감 데이터 필터링 설정 가이드. 내장 필터링 패턴 (비밀번호, API Key, 신용카드, SSN, JWT 등), 커스텀 정규식 패턴, 5단계 보안 등급, 업계 준수 사전 설정 (HIPAA, PCI-DSS, 정부 표준) 및 필터링 통계와 모니터링을 다루어 개발자가 준수 규정을 충족하는 로그 마스킹 솔루션을 구축할 수 있도록 돕습니다."
---

# 민감 데이터 필터링

DD는 내장된 민감 데이터 자동 필터링으로 로그 기록 전에 비밀번호, API Key, 신용카드 번호 등 민감 정보를 `[REDACTED]`로 교체하여 민감 데이터가 로그에 유출되는 것을 방지합니다.

## 빠른 활성화

```go
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})

// password 필드 자동 마스킹
logger.InfoWith("사용자 로그인",
    dd.String("username", "alice"),
    dd.String("password", "s3cr3t123"),    // 출력: password=[REDACTED]
)
```

## 내장 필터링 패턴

`DefaultSecurityConfig()`는 기본 필터링을 활성화하여 다음 민감 정보를 포함합니다:

| 범주 | 매칭 대상 |
|------|----------|
| 비밀번호 | `password`, `passwd`, `pwd` 등 필드 |
| API Key | `api_key`, `apikey`, `access_token` 등 |
| 신용카드 | Visa, MasterCard 등 카드 번호 형식 |
| SSN | 미국 사회보장번호 형식 |
| 전화번호 | 글로벌 전화번호 형식 (국제 형식 포함) |

`DefaultSecureConfig()`는 기본 위에 다음을 추가합니다:

| 범주 | 매칭 대상 |
|------|----------|
| 이메일 | email 주소 형식 |
| IP 주소 | IPv4/IPv6 주소 |
| JWT Token | `eyJ`로 시작하는 JWT 형식 |
| 연결 문자열 | 데이터베이스 연결 문자열의 비밀번호 |

## 커스텀 필터링 패턴

### 커스텀 패턴 추가

```go
filter := dd.NewEmptySensitiveDataFilter()

// 커스텀 정규식 패턴 추가 (내장 ReDoS 방지)
_ = filter.AddPattern(`(?i)credit_card\s*[:=]\s*\d+`)
_ = filter.AddPattern(`(?i)phone\s*[:=]\s*\d{11}`)

logger, _ := dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: filter,
    },
})
```

### 처음부터 커스텀 필터 생성

```go
filter, err := dd.NewCustomSensitiveDataFilter(
    `(?i)secret_key\s*[:=]\s*\S+`,
    `(?i)private_token\s*[:=]\s*\S+`,
)
if err != nil {
    log.Fatal(err) // 정규식 보안 검증 실패
}
```

:::warning ReDoS 방지
`NewCustomSensitiveDataFilter`는 내장 ReDoS 검증을 수행합니다. 정규식에 치명적인 백트래킹 위험이 있으면 오류를 반환합니다. 논탐욕 매칭과 앵커 패턴을 사용하여 이 문제를 피하세요.
:::

## 보안 등급

DD는 5가지 보안 등급을 제공하며, 각 등급에 해당하는 사전 설정이 있습니다:

```go
// 등급별 설정 가져오기
cfg := dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
```

| 등급 | 설명 | 적용 시나리오 |
|------|------|----------|
| `Development` | 가장 느슨함 | 로컬 개발 |
| `Basic` | 기본 필터링 | 테스트 환경 |
| `Standard` | 표준 필터링 | 일반 프로덕션 환경 |
| `Strict` | 엄격한 필터링 | 높은 보안 요구 |
| `Paranoid` | 가장 엄격함 | 금융/의료 등 민감 산업 |

## 업계 준수 사전 설정

DD는 3가지 업계 준수 설정을 제공합니다:

### HIPAA (의료 산업)

```go
cfg := dd.HealthcareConfig()
```

추가 필터링: ICD-10 코드, 병력 번호 (MRN), 건강보험 청구 번호 (HICN), 환자 식별 번호.

### PCI-DSS (금융 결제)

```go
cfg := dd.FinancialConfig()
```

추가 필터링: SWIFT 코드, IBAN 계좌, CVV/CVC, 은행 라우팅 번호.

### 정부 표준

```go
cfg := dd.GovernmentConfig()
```

추가 필터링: 여권 번호, 운전면허 번호, 세금 ID, SSN 변형.

### 전체 예시

```go
// 의료 시스템: HIPAA 준수 설정 사용
logger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/hipaa-audit.json"),
    },
})

// 민감 정보가 포함된 로그 메시지 자동 마스킹
logger.Info("환자 기록 mrn=MRN-123456 diagnosis=J18.9 업데이트됨")
// 메시지의 MRN과 ICD-10 코드는 매칭 패턴에 의해 마스킹됨

// 구조화된 필드는 키 이름 민감도에 따라 필터링
logger.InfoWith("사용자 로그인",
    dd.String("password", "s3cr3t123"),    // → [REDACTED] (키 이름이 민감함)
    dd.String("department", "내과"),         // 정상 출력
)
```

## 필터링 통계

필터의 실행 상태 모니터링:

```go
filter := dd.NewSensitiveDataFilter()
stats := filter.GetFilterStats()
fmt.Printf("활성 goroutines: %d\n", stats.ActiveGoroutines)
fmt.Printf("필터링 패턴 수: %d\n", stats.PatternCount)
fmt.Printf("총 마스킹 횟수: %d\n", stats.TotalRedactions)
fmt.Printf("타임아웃 횟수: %d\n", stats.TotalTimeouts)
```

## 필터링 비활성화

```go
// Development 보안 등급 사용 (민감 데이터 필터링 없음)
logger, _ := dd.New(dd.Config{
    Security: dd.SecurityConfigForLevel(dd.SecurityLevelDevelopment),
})

// 또는 SensitiveFilter를 수동으로 nil로 설정
logger, _ := dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: nil,
    },
})
```

:::warning 기본 필터링 활성화
`DefaultConfig()`는 기본적으로 기본 민감 데이터 필터링 (`DefaultSecurityConfig()`)이 활성화되어 있습니다. `Security` 필드를 설정하지 않아도 기본 보안 설정이 사용됩니다. 필터링을 비활성화하려면 `SensitiveFilter`를 명시적으로 `nil`로 설정해야 합니다.
:::

## 다음 단계

- [감사 로그](./audit-logging) -- 보안 이벤트 감사
- [업계 준수 설정](../security/compliance) -- HIPAA/PCI-DSS 상세 가이드
- [API 레퍼런스 - Security](../api-reference/security) -- 보안 API 전체 문서
- [프로덕션 체크리스트](../security/production-checklist) -- 출시 전 체크리스트

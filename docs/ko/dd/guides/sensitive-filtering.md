---
sidebar_label: "민감 데이터 필터링"
title: "민감 데이터 필터링 - CyberGo DD | 자동 마스킹 구성 가이드"
description: "CyberGo DD 민감 데이터 필터링 구성 가이드입니다. 내장 필터 패턴(비밀번호, API Key, 신용카드, SSN, JWT 등), 사용자 정의 정규식 패턴, 5단계 보안 레벨, 산업 규정 준수 사전 설정(HIPAA, PCI-DSS, 정부 표준)과 필터 통계 및 모니터링을 다루어 개발자가 규정을 준수하는 로그 마스킹 방안을 구축할 수 있도록 돕습니다."
sidebar_position: 4
---

# 민감 데이터 필터링

DD는 민감 데이터 자동 필터링을 내장하여 로그 쓰기 전에 비밀번호, API Key, 신용카드 번호 등 민감 정보를 `[REDACTED]`로 교체해 민감 데이터가 로그로 유출되는 것을 방지합니다.

## 빠른 활성화

```go
logger, err := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

// password 필드 자동 마스킹
logger.InfoWith("사용자 로그인",
    dd.String("username", "alice"),
    dd.String("password", "s3cr3t123"),    // 출력: password=[REDACTED]
)
```

## 내장 필터 패턴

`DefaultSecurityConfig()`는 기본 필터를 활성화하여 다음 민감 정보를 다룹니다.

| 카테고리 | 매칭 대상 |
|------|----------|
| 비밀번호 | `password`, `passwd`, `pwd` 등 필드 |
| API Key | `api_key`, `apikey`, `access_token` 등 |
| 신용카드 | Visa, MasterCard 등 카드 번호 형식 |
| SSN | 미국 사회보장번호 형식 |
| 전화번호 | 글로벌 전화번호 형식(국제 형식 포함) |

`DefaultSecureConfig()`는 **완전 패턴 집합**을 사용합니다(기본 패턴 모두 포함, 아래 일반 카테고리 추가).

| 카테고리 | 매칭 대상 |
|------|----------|
| 이메일 | 이메일 주소 형식 |
| IP 주소 | IPv4/IPv6 주소 |
| JWT Token | `eyJ`로 시작하는 JWT 형식 |
| 연결 문자열 | 데이터베이스 연결 문자열 내 비밀번호 |

:::info 정보 패턴 범위
위 표는 일반적인 카테고리 예시일 뿐입니다. `DefaultSecurityConfig()`는 실제로 약 36개의 패턴을 내장하고 있으며, 산업 사전 설정(예: `HealthcareConfig()`)은 71개에 달하고 AWS 키, Stripe/GitHub/Slack 토큰, IBAN, 다국 세금 번호, Log4Shell 등도 다룹니다. 완전한 패턴 집합은 소스 코드 `internal/patterns.go`를 참조하세요.
:::

## 커스텀 필터 패턴

### 커스텀 패턴 추가

```go
filter := dd.NewEmptySensitiveDataFilter()

// 커스텀 정규식 패턴 추가(내장 ReDoS 보호)
_ = filter.AddPattern(`(?i)credit_card\s*[:=]\s*\d+`)
_ = filter.AddPattern(`(?i)phone\s*[:=]\s*\d{11}`)

logger, err := dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: filter,
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### 빈 필터에서 커스텀 필터 생성

```go
filter, err := dd.NewCustomSensitiveDataFilter(
    `(?i)secret_key\s*[:=]\s*\S+`,
    `(?i)private_token\s*[:=]\s*\S+`,
)
if err != nil {
    log.Fatal(err) // 정규식 보안 검증 실패
}
```

:::warning 경고 ReDoS 보호
`NewCustomSensitiveDataFilter`는 ReDoS 검증을 내장합니다. 정규식에 치명적 백트래킹 위험이 있으면 오류를 반환합니다. 비탐욕 매칭과 앵커 모드를 사용해 이 문제를 피하세요.
:::

## 보안 레벨

DD는 다섯 가지 보안 레벨을 제공하며, 각 레벨에는 대응하는 사전 설정 구성이 있습니다.

```go
// 레벨별 구성 가져오기
cfg := dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
```

| 레벨 | 설명 | 적용 시나리오 |
|------|------|----------|
| `SecurityLevelDevelopment` | 가장 느슨함 | 로컬 개발 |
| `SecurityLevelBasic` | 기본 필터 | 테스트 환경 |
| `SecurityLevelStandard` | 표준 필터 | 일반 프로덕션 환경 |
| `SecurityLevelStrict` | 엄격한 필터 | 고보안 요구 |
| `SecurityLevelParanoid` | 가장 엄격함 | 금융/의료 등 민감 산업 |

## 산업 규정 준수 사전 설정

DD는 세 가지 산업 규정 준수 구성을 제공합니다.

### HIPAA(의료 산업)

```go
cfg := dd.HealthcareConfig()
```

추가 필터: ICD-10 코드, 병력 번호(MRN), 건강 보험 청구 번호(HICN), 환자 식별 번호.

### PCI-DSS(금융 결제)

```go
cfg := dd.FinancialConfig()
```

추가 필터: SWIFT 코드, IBAN 계정 번호, CVV/CVC, 은행 라우팅 번호.

### 정부 표준

```go
cfg := dd.GovernmentConfig()
```

추가 필터: 여권 번호, 운전면허 번호, 세금 ID, SSN 변형.

### 전체 예

```go
// 의료 시스템: HIPAA 규정 준수 구성 사용
logger, err := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/hipaa-audit.json"),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

// 민감 정보 포함 로그 메시지 자동 마스킹
logger.Info("환자 기록 mrn=MRN123456 diagnosis=J18.9 업데이트됨")
// 메시지의 MRN과 ICD-10 코드 매칭 패턴이 마스킹됨

// 구조화 필드는 키 이름 민감도에 따라 필터링
logger.InfoWith("사용자 로그인",
    dd.String("password", "s3cr3t123"),    // → [REDACTED](키 이름 민감)
    dd.String("department", "내과"),        // 정상 출력
)
```

## 필터 통계

필터의 실행 상태를 모니터링합니다.

```go
filter := dd.NewSensitiveDataFilter()
stats := filter.GetFilterStats()
fmt.Printf("활성 goroutines: %d\n", stats.ActiveGoroutines)
fmt.Printf("필터 패턴 수: %d\n", stats.PatternCount)
fmt.Printf("총 마스킹 횟수: %d\n", stats.TotalRedactions)
fmt.Printf("타임아웃 횟수: %d\n", stats.TotalTimeouts)
```

## 필터 비활성화

```go
// Development 보안 레벨 사용(민감 데이터 필터 없음)
logger, err := dd.New(dd.Config{
    Security: dd.SecurityConfigForLevel(dd.SecurityLevelDevelopment),
})
if err != nil {
    log.Fatal(err)
}

// 또는 수동으로 빈 SensitiveFilter 설정
logger, err = dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: nil,
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

:::warning 경고 기본적으로 필터 활성화
`DefaultConfig()`는 기본적으로 기본 민감 데이터 필터(`DefaultSecurityConfig()`)가 활성화됩니다. `Security` 필드를 설정하지 않아도 기본 보안 구성이 사용됩니다. 필터를 비활성화하려면 `SensitiveFilter`를 명시적으로 `nil`로 설정해야 합니다.
:::

## 다음 단계

- [감사 로그](./audit-logging) -- 보안 이벤트 감사
- [산업 규정 준수 구성](../security/compliance) -- HIPAA/PCI-DSS 상세
- [API 레퍼런스 - Security](../api-reference/security-audit/security) -- 보안 API의 완전한 문서
- [프로덕션 체크리스트](../security/production-checklist) -- 출시 전 검사

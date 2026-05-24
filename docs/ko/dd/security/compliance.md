---
title: "업계 준수 설정 - CyberGo DD | HIPAA PCI-DSS 정부 표준"
description: "CyberGo DD 업계 준수 로그 설정 특집. HIPAA 의료 산업 준수, PCI-DSS 금융 결제 준수 및 정부 보안 표준의 민감 데이터 필터링 규칙 설정, 감사 로그 요구 사항, 로그 보존과 순환 전략 및 전체 준수 설정 예시를 상세히 설명하여 개발자가 엄격한 준수 요구 사항 하에서 안전하고 신뢰할 수 있는 로그 시스템을 구축할 수 있도록 돕습니다."
---

# 업계 준수 설정

DD는 의료, 금융, 정부 분야의 민감 데이터 보호 요구 사항을 충족하는 3가지 업계 준수 사전 설정을 제공합니다.

## HIPAA 의료 준수

### 적용 시나리오

- 전자 건강 기록 (EHR) 시스템
- 병원 정보 관리 시스템
- 원격 진료 플랫폼
- 의료 데이터 연구 플랫폼

### 필터링 규칙

`HealthcareConfig()`는 기본 보안 규칙 위에 다음을 추가로 필터링합니다:

| 데이터 타입 | 패턴 | 예시 |
|----------|------|------|
| ICD-10 코드 | 로그 메시지의 진단 코드 형식 | `diagnosis=J18.9` |
| 병력 번호 (MRN) | 로그 메시지의 의료 기록 번호 | `mrn=MRN-123456` |
| 건강보험 청구 번호 (HICN) | 로그 메시지의 HICN 번호 | `hicn=123456789A` |
| 환자 식별 번호 | 로그 메시지의 환자 식별자 | `patient_id=PAT-123456` |

### 설정 예시

```go
func NewHIPAACompliantLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.HealthcareConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/hipaa-audit.json"),
        },
    })
}
```

### 감사 요구 사항

```go
// HIPAA 요구 사항: 보안 이벤트 감사 + 무결성 보호
integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(integrityCfg)

auditFile, _ := os.OpenFile("logs/hipaa-audit.json", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    IncludeTimestamp: true,
    BufferSize:       2000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer,
})
```

## PCI-DSS 금융 준수

### 적용 시나리오

- 온라인 결제 시스템
- 신용카드 처리 서비스
- 은행 핵심 시스템
- 전자상거래 거래 플랫폼

### 필터링 규칙

`FinancialConfig()`는 기본 보안 규칙 위에 다음을 추가로 필터링합니다:

| 데이터 타입 | 패턴 | 예시 |
|----------|------|------|
| SWIFT 코드 | 로그 메시지의 국제 은행 코드 | `swift=BOFAUS3N` |
| IBAN 계좌 | 로그 메시지의 국제 은행 계좌 | `iban=DE89370400440532013000` |
| CVV/CVC | 로그 메시지의 카드 확인 코드 | `cvv=123` |
| 은행 라우팅 번호 | 로그 메시지의 ABA 라우팅 번호 | `routing_number=021000021` |
| 은행 계좌 번호 | 로그 메시지의 은행 계좌 번호 | `account_number=12345678` |

### 설정 예시

```go
func NewPCICompliantLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.FinancialConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/pci-audit.json"),
        },
    })
}
```

### 로그 보존 전략

```go
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 100    // 단일 파일 100MB
fwCfg.MaxAge = 365 * 24 * time.Hour // 1년 보존 (PCI-DSS 요구 사항)
fwCfg.MaxBackups = 50    // 충분한 백업 보존
fwCfg.Compress = true    // 오래된 파일 압축으로 공간 절약

fw, _ := dd.NewFileWriter("logs/pci-audit.json", fwCfg)
logger, _ := dd.New(dd.Config{
    Level:    dd.LevelInfo,
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.CustomOutput(fw)},
})
```

## 정부 표준

### 적용 시나리오

- 정무 정보 시스템
- 공공 서비스 플랫폼
- 사회보장 관리 시스템
- 세금 처리 시스템

### 필터링 규칙

`GovernmentConfig()`는 기본 보안 규칙 위에 다음을 추가로 필터링합니다:

| 데이터 타입 | 패턴 | 예시 |
|----------|------|------|
| 여권 번호 | 로그 메시지의 여권 번호 | `passport_number=E12345678` |
| 운전면허 번호 | 로그 메시지의 운전면허 번호 | `dl_number=D123456789` |
| 미국 연방 세금 번호 (EIN) | 로그 메시지의 EIN 형식 | `12-3456789` |
| 영국 국민보험 번호 | 로그 메시지의 NINo 형식 | `AB123456C` |
| 캐나다 사회보장 번호 | 로그 메시지의 SIN 형식 | `123 456 789` |
| 사건 번호 | 로그 메시지의 사건 번호 | `case_number=CR-2024-00123` |

### 설정 예시

```go
func NewGovernmentLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.GovernmentConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/gov-audit.json"),
        },
    })
}
```

## 준수 비교

| 차원 | HIPAA | PCI-DSS | Government |
|------|-------|---------|------------|
| 추가 필터링 패턴 수 | +4 | +5 | +6 |
| 로그 보존 | 6년 | 1년 | 규정에 따름 |
| 무결성 서명 | 권장 | 필수 | 필수 |
| 감사 로그 | 필수 | 필수 | 필수 |
| 암호화 전송 | 필수 | 필수 | 권장 |

## 커스텀 준수 설정

사전 설정이 요구 사항을 완전히 충족하지 못할 때, 조합하여 커스터마이즈할 수 있습니다:

```go
// 커스텀 패턴 추가
filter, _ := dd.NewCustomSensitiveDataFilter(
    // 커스텀 의료 시스템 고유 패턴
    `(?i)insurance_id\s*[:=]\s*\S+`,
    `(?i)prescription\s*[:=]\s*\S+`,
)

logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Security: &dd.SecurityConfig{
        SensitiveFilter: filter,
    },
    Targets: []dd.OutputTarget{dd.FileOutput("logs/custom.json")},
})
```

## 다음 단계

- [민감 데이터 필터링](../guides/sensitive-filtering) -- 필터링 기능 상세 가이드
- [감사 로그](../guides/audit-logging) -- 보안 감사 통합
- [프로덕션 체크리스트](./production-checklist) -- 출시 전 체크리스트
- [API 레퍼런스 - Security](../api-reference/security) -- 보안 API 문서

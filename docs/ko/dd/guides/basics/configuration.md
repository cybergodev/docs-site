---
sidebar_label: "Configuration"
title: "Configuration - CyberGo DD | Config 구조체와 프리셋"
description: "CyberGo DD configuration 가이드: DefaultConfig, DevelopmentConfig, JSONConfig, ProductionConfig 4 가지 프리셋, 전체 Config 구조체 Field 참조, 다중 출력 대상 설정, JSON 형식 커스터마이징, Clone 깊은 복사 사용법."
sidebar_position: 2
---

# Configuration

DD는 IDE 자동완성을 지원하는 구조체 기반 configuration(`Config`)을 사용합니다 — 빌더 체인이나 옵션 함수가 필요 없습니다. 이 가이드는 모든 configuration Field와 일반적인 조합을 다룹니다.

> **API 참조**: 전체 Field 목록은 [Config](../../api-reference/core/config)를 참조하십시오.

## 네 가지 프리셋

| 프리셋 | 레벨 | 형식 | 보안 필터 | 일반적 용도 |
|--------|-------|--------|:---------------:|-------------|
| `DefaultConfig()` | Info | Text | ✅ 기본 | 프로덕션 기본값 |
| `DevelopmentConfig()` | Debug | Text (단축 시간) | ✅ 기본 | 로컬 개발 |
| `JSONConfig()` | Debug | JSON (RFC3339) | ✅ 기본 | 로그 수집 시스템 |
| `ProductionConfig()` | Info | JSON (RFC3339) | ✅ 기본 | 프로덕션 (JSON 출력) |

:::warning 경고 보안 필터가 기본적으로 활성화됨
네 가지 프리셋 모두 기본 민감 데이터 필터링 (비밀번호, API 키, 신용카드 등) 을 **활성화**합니다. 개발 모드에서도 우발적인 민감 데이터 유출을 조기에 발견하기 위해 켜져 있습니다. 비활성화하려면 `Security: &dd.SecurityConfig{}`를 명시적으로 설정하거나 `SecurityLevelDevelopment`를 사용하십시오.
:::

## Config Field 개요

```go
type Config struct {
    // ─── 기본 ───
    Level         LogLevel     // 로그 레벨 (LevelDebug ~ LevelFatal)
    Format        LogFormat    // 출력 형식 (FormatText / FormatJSON)
    TimeFormat    string       // 시간 형식 (기본값 ISO 8601)
    IncludeTime   bool         // 타임스탬프 포함
    IncludeLevel  bool         // 로그 레벨 포함

    // ─── Caller 정보 ───
    DynamicCaller bool         // 동적 caller 감지 (file:line)
    FullPath      bool         // 전체 파일 경로 사용 (기본값: 파일명만)

    // ─── 출력 대상 ───
    Targets       []OutputTarget // 출력 대상 (ConsoleOutput/FileOutput/CustomOutput)

    // ─── 형식 커스터마이징 ───
    JSON          *JSONOptions // JSON 형식 옵션 (Field 이름, 들여쓰기 등)

    // ─── 보안 ───
    Security      *SecurityConfig       // 보안 Config (필터링, 속도 제한)
    FieldValidation *FieldValidationConfig // Field 키 이름 검증

    // ─── 라이프사이클 ───
    FatalHandler      FatalHandler      // 커스텀 Fatal 핸들러
    WriteErrorHandler WriteErrorHandler // 쓰기 에러 콜백
    LevelResolver     LevelResolver     // 동적 레벨 해석 (항목마다 참조, nil 이면 비활성)

    // ─── 확장 ───
    ContextExtractors []ContextExtractor // 컨텍스트 Field 추출기
    Hooks             *HookRegistry      // 라이프사이클 Hook
    Sampling          *SamplingConfig    // 로그 샘플링

    // ─── 감사 ───
    Audit             *AuditConfig       // 보안 감사 로깅
}
```

## 출력 대상 Configuration

`ConsoleOutput()`, `FileOutput()`, `CustomOutput()`을 사용하여 출력 대상을 구성하십시오:

```go
package main

import (
    "log"
    "os"
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    cfg := dd.DefaultConfig()
    cfg.Targets = []dd.OutputTarget{
        dd.ConsoleOutput(),                          // 콘솔
        dd.FileOutput("logs/app.log"),               // 파일 (기본값 100MB/10 백업/30일)
        dd.CustomOutput(os.Stderr),                  // 커스텀 Writer
    }

    // 커스텀 파일 로테이션 매개변수
    fileTarget := dd.FileOutput("logs/app.log")
    fileTarget.MaxSizeMB = 50              // 50MB 에서 로테이션
    fileTarget.MaxBackups = 5              // 5 개 백업 유지
    fileTarget.MaxAge = 7 * 24 * time.Hour // 7 일 보관 (MaxAge 는 time.Duration, 단위 필수)

    logger, err := dd.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()
}
```

:::tip 팁 제로 값 Config 함정
`dd.Config{Targets: ...}`를 직접 사용하면 타임스탬프, 레벨, caller 정보가 누락됩니다. 항상 `dd.DefaultConfig()`에서 시작하여 Field를 수정하십시오.
:::

## JSON 형식 커스터마이징

```go
cfg := dd.JSONConfig()

// 커스텀 JSON Field 이름
cfg.JSON = &dd.JSONOptions{
    PrettyPrint: true,
    Indent:      "  ",
    FieldNames: &dd.JSONFieldNames{
        Timestamp: "@timestamp",
        Level:     "severity",
        Message:   "msg",
        Caller:    "source",
        Fields:    "ctx",
    },
}
```

## 보안 Configuration

```go
cfg := dd.DefaultConfig()

// 옵션 A: 보안 레벨로 (권장)
cfg.Security = dd.SecurityConfigForLevel(dd.SecurityLevelStandard)

// 옵션 B: 산업 프리셋
cfg.Security = dd.HealthcareConfig()   // HIPAA
cfg.Security = dd.FinancialConfig()    // PCI-DSS
cfg.Security = dd.GovernmentConfig()   // 정부

// 옵션 C: 커스텀
cfg.Security = &dd.SecurityConfig{
    MaxMessageSize: 1024 * 1024, // 1MB
    SensitiveFilter: dd.NewSensitiveDataFilter(),
}
```

[민감 데이터 필터링](../security/sensitive-filtering)과 [보안 개요](../security/)를 참조하십시오.

## Field Validation

```go
cfg := dd.DefaultConfig()
cfg.FieldValidation = dd.StrictSnakeCaseConfig()
// 모든 Field 키는 snake_case 여야 하며, 그렇지 않으면 stderr 로 진단 출력 (해당 Field 는 여전히 기록되며, 로그 메서드는 에러를 반환하지 않음)
```

[Field Validation](../security/field-validation)을 참조하십시오.

## 로그 샘플링

```go
cfg := dd.DefaultConfig()
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,            // 처음 100개 항목은 항상 로깅
    Thereafter: 10,             // 이후 10개마다 1개 로깅
    Tick:       time.Second,    // 매초 카운터 리셋
}
```

[로그 샘플링](../operations/sampling)을 참조하십시오.

## Hook 및 감사

```go
// Hook
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    AfterLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        // 메트릭 시스템으로 전송
        return nil
    }},
})
cfg.Hooks = registry

// 감사
cfg.Audit = &dd.AuditConfig{
    Enabled:     true,
    Output:      auditFile,
    JSONFormat:  true,
    MinimumSeverity: dd.AuditSeverityWarning,
}
```

[Hook 시스템](../operations/hooks)과 [감사 로깅](../security/audit-logging)을 참조하십시오.

## Clone: Configuration 깊은 복사

`Clone()`은 configuration 복사본을 생성하며, 동일한 기반에서 다른 config를 파생할 때 유용합니다:

```go
base := dd.DefaultConfig()
base.Format = dd.FormatJSON

// 파생 1: 프로덕션 config
prodCfg := base.Clone()
prodCfg.Level = dd.LevelInfo
prodCfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/prod.log")}

// 파생 2: Debug config
debugCfg := base.Clone()
debugCfg.Level = dd.LevelDebug
debugCfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// base는 영향을 받지 않음
```

:::tip 팁 Clone 복사 깊이
깊은 복사: JSON, Security, Hooks, Sampling, Audit, Targets 슬라이스. 얕은 복사: FatalHandler, WriteErrorHandler, FieldValidation (함수/포인터 공유). ContextExtractors 슬라이스는 복사되지만 추출기 인스턴스는 공유됩니다.
:::

## 다음 단계

- [핵심 개념](./core-concepts) -- Logger 계층 및 처리 파이프라인
- [구조화된 로깅](./structured-logging) -- Field 생성자 및 체이닝
- [API 참조 - Config](../../api-reference/core/config) -- 전체 Field 문서

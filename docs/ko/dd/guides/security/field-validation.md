---
sidebar_label: "Field Validation"
title: "Field Validation - CyberGo DD | 키 이름 규칙 및 보안 검사"
description: "CyberGo DD field validation 가이드: snake_case, camelCase, PascalCase, kebab-case 이름 규칙 검사, 세 가지 검증 모드(꺼짐/경고/엄격), 내장 Log4Shell 주입 보호 및 동형이의어 감지."
sidebar_position: 3
---

# Field Validation

DD의 field validation 서브시스템은 로그 쓰기 전에 구조화된 Field의 **키 이름**을 검증하여 이름 규칙을 강제하고 보안 보호를 제공합니다. 이는 일관되지 않은 키로 인한 로그 파싱 어려움을 방지하고, Field 키를 통해 주입된 악성 콘텐츠를 차단합니다.

## 검증 모드

| 모드 | 상수 | 동작 |
|------|----------|----------|
| 끄기 (기본값) | `FieldValidationNone` | 검증 안 함; 모든 키 허용 |
| 경고 | `FieldValidationWarn` | 규칙에 맞지 않는 키가 stderr 경고 출력; 로그는 여전히 기록됨 |
| 엄격 | `FieldValidationStrict` | 규칙에 맞지 않는 키가 stderr 에러 출력; 로그는 여전히 기록됨 |

:::warning 경고 로깅 메서드는 에러를 반환하지 않습니다
로깅 메서드(`InfoWith` 등)는 에러를 반환하지 않으므로, 검증 실패는 stderr로만 보고될 수 있습니다. 엄격 모드는 **로그가 기록되는 것을 방지하지 않지만** stderr에 에러를 명확히 보고합니다.
:::

## 이름 규칙

| 규칙 | 상수 | 예시 |
|------------|----------|----------|
| 모두 (기본값) | `NamingConventionAny` | 스타일 검사 없음 |
| snake_case | `NamingConventionSnakeCase` | `user_id`, `created_at` |
| camelCase | `NamingConventionCamelCase` | `userId`, `createdAt` |
| PascalCase | `NamingConventionPascalCase` | `UserId`, `CreatedAt` |
| kebab-case | `NamingConventionKebabCase` | `user-id`, `created-at` |

## 빠른 시작

### 옵션 A: 프리셋 Config

```go
package main

import (
    "log"

    "github.com/cybergodev/dd"
)

func main() {
    cfg := dd.DefaultConfig()
    cfg.FieldValidation = dd.StrictSnakeCaseConfig()
    // 다음과 동일:
    // &dd.FieldValidationConfig{
    //     Mode:                     dd.FieldValidationStrict,
    //     Convention:               dd.NamingConventionSnakeCase,
    //     AllowCommonAbbreviations: true,
    //     EnableSecurityValidation: true,
    // }

    logger, err := dd.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    logger.InfoWith("user action",
        dd.String("user_id", "123"),    // ✅ 유효한 snake_case
        dd.String("userName", "alice"), // ⚠️ 유효하지 않음, stderr 에러
    )
}
```

### 옵션 B: 커스텀 Config

```go
cfg := dd.DefaultConfig()
cfg.FieldValidation = &dd.FieldValidationConfig{
    Mode:                     dd.FieldValidationWarn,
    Convention:               dd.NamingConventionCamelCase,
    AllowCommonAbbreviations: true,
    EnableSecurityValidation: true,
}
```

### 옵션 C: 런타임 토글

```go
// 엄격한 snake_case 활성화
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// 검증 비활성화
logger.SetFieldValidation(nil)

// 현재 config 조회
fv := logger.GetFieldValidation()
```

## 일반 약어 예외

`AllowCommonAbbreviations: true`(프리셋 기본값)를 사용하면, 다음 약어는 이름 규칙과 엄격하게 일치하지 않더라도 허용됩니다:

| 약어 | 설명 |
|--------------|-------------|
| `id`, `url`, `uri`, `ip` | 기본 식별자 |
| `http`, `https`, `api` | 프로토콜 및 인터페이스 |
| `json`, `xml`, `html`, `sql` | 데이터 형식 |
| `tcp`, `udp`, `ssl`, `tls` | 네트워크 프로토콜 |
| `jwt`, `oauth` | 인증 |
| `*_id`, `*_url`, `*_api` 등 | 접미사 조합 (예: `user_id`) |

## 보안 검증

`EnableSecurityValidation: true`(프리셋 기본값)는 이름 규칙 검증 전에 다음 보안 검사를 실행합니다:

| 검사 | 차단 콘텐츠 | 설명 |
|-------|---------------------|-------------|
| Log4Shell 감지 | `${jndi:ldap://...}` | 로그 키를 통한 JNDI 주입 방지 |
| 동형이의어 감지 | 키릴 문자 `а`가 라틴 `a`를 대체 | 시각적 스푸핑 공격 방지 |
| 과장된 UTF-8 인코딩 | 비최단 형식 인코딩 | 보안 필터 우회 방지 |

:::danger 위험 제로 값 함정
`EnableSecurityValidation`을 설정하지 않고 `&dd.FieldValidationConfig{Mode: dd.FieldValidationStrict}`를 사용하면 `false`(제로 값)가 되어 보안 검사를 **자동으로 건너뜁니다**. 항상 `DefaultFieldValidationConfig()` 또는 이 Field를 `true`로 설정하는 프리셋 함수(`StrictSnakeCaseConfig()` 등)를 사용하십시오.
:::

## 다중 규칙 프로젝트

프로젝트에 Go 백엔드(snake_case)와 JavaScript 프론트엔드(camelCase) 로깅이 모두 있는 경우, 다른 규칙을 가진 다른 Logger를 사용하십시오:

```go
// 백엔드 Logger: snake_case
backendCfg := dd.DefaultConfig()
backendCfg.FieldValidation = dd.StrictSnakeCaseConfig()
backendLogger, _ := dd.New(backendCfg)

// 프론트엔드 로그 수집 Logger: camelCase
frontendCfg := dd.DefaultConfig()
frontendCfg.FieldValidation = dd.StrictCamelCaseConfig()
frontendLogger, _ := dd.New(frontendCfg)
```

## 검증 규칙

각 이름 규칙에 대한 구체적인 규칙:

| 규칙 | 규칙 |
|------------|-------|
| snake_case | 소문자 + 숫자 + 밑줄; **첫 글자는 소문자**여야 함 (숫자나 `_` 불가); `_`로 끝나지 않음; 연속된 `__` 없음 |
| camelCase | 문자 + 숫자; 첫 글자는 소문자 |
| PascalCase | 문자 + 숫자; 첫 글자는 대문자 |
| kebab-case | 소문자 + 숫자 + 하이픈; **첫 글자는 소문자**여야 함 (숫자나 `-` 불가); `-`로 끝나지 않음; 연속된 `--` 없음 |

## 다음 단계

- [구조화된 로깅](../basics/structured-logging) -- Field 생성자 및 체이닝
- [Configuration](../basics/configuration) -- 전체 Config Field 참조
- [보안 개요](../security/) -- 전체 보안 기능 개요

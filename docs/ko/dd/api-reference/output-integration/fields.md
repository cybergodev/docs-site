---
sidebar_label: "구조화 필드"
title: "구조화 필드 - CyberGo DD | Field 생성자와 검증"
description: "CyberGo DD 구조화 필드 API입니다. 20종의 타입 안전 필드 생성자(String/Int/Float/Bool/Time/Duration/Err 등), Field 타입과 필드 키 검증(명명 규칙과 Log4Shell 보안 검사)을 지원하며, 커스텀 검증 모드와 사전 설정 구성을 제공합니다."
sidebar_position: 3
---

# 구조화 필드

DD는 20종의 타입 안전 필드 생성자, 통일된 `Field` 타입, 선택적 필드 키 검증 메커니즘을 제공하여 구조화 로그 출력에 사용합니다.

## Field 타입

`Field`는 구조화 로그 필드 타입으로, `internal.Field`의 **타입 별칭**으로 외부에 노출됩니다.

```go
type Field = internal.Field

// 실제 구조(internal/fields.go)
type Field struct {
    Key   string  // 필드 키
    Value any     // 필드 값(임의 타입)
}
```

모든 필드 생성자는 `Field` 값을 반환하며, 포맷터(`internal.FormatFields`)가 `Key=Value` 형식으로 출력합니다. 기본 타입(string / 수치 / bool / `time.Duration` / `time.Time` / nil)은 빠른 경로를 사용하고, 슬라이스, 배열, map, struct 등 '복잡한 타입'은 JSON 직렬화로 폴백(`internal.IsComplexValue` 판정)하며, 그 외 타입(`fmt.Stringer` 또는 `error` 인터페이스를 구현한 값 등)은 `fmt.Fprint`를 사용합니다.

## 기본 필드

| 생성자 | 시그니처 | 설명 |
|--------|------|------|
| `Any` | `(key string, value any) Field` | 임의 타입 |
| `String` | `(key, value string) Field` | 문자열 |
| `Bool` | `(key string, value bool) Field` | 불리언 |
| `Err` | `(err error) Field` | 오류(key 고정 `"error"`; `err == nil`이면 Value가 `nil`, 그렇지 않으면 `err.Error()`) |
| `ErrWithKey` | `(key string, err error) Field` | 커스텀 key의 오류(`Err`과 동일, `err == nil`이면 Value가 `nil`) |
| `ErrWithStack` | `(err error) Field` | 호출 스택을 포함한 오류(key가 `"error"`, `err == nil`이면 Value가 `nil`; 스택 프레임은 runtime/과 dd 패키지 내부 프레임을 필터링, 캡처 시 약간의 오버헤드 있음) |

## 수치 필드

| 생성자 | 타입 | 예 |
|--------|------|------|
| `Int` | `int` | `dd.Int("count", 42)` |
| `Int8` | `int8` | `dd.Int8("flags", 1)` |
| `Int16` | `int16` | `dd.Int16("port", 8080)` |
| `Int32` | `int32` | `dd.Int32("code", 200)` |
| `Int64` | `int64` | `dd.Int64("id", 123456789)` |
| `Uint` | `uint` | `dd.Uint("size", 1024)` |
| `Uint8` | `uint8` | `dd.Uint8("level", 3)` |
| `Uint16` | `uint16` | `dd.Uint16("year", 2026)` |
| `Uint32` | `uint32` | `dd.Uint32("seq", 1000)` |
| `Uint64` | `uint64` | `dd.Uint64("hash", 0xABCD)` |
| `Float32` | `float32` | `dd.Float32("rate", 0.95)` |
| `Float64` | `float64` | `dd.Float64("elapsed", 1.234)` |

## 시간 필드

| 생성자 | 시그니처 | 설명 |
|--------|------|------|
| `Time` | `(key string, value time.Time) Field` | 타임스탬프(RFC3339 형식으로 포맷팅) |
| `Duration` | `(key string, value time.Duration) Field` | 기간(`Duration.String()` 호출) |

## 오류 필드

<!-- check-code: skip -->
```go
// 표준 오류 필드(key는 "error"로 고정, nil error → Value가 nil)
dd.Err(err)

// 커스텀 key
dd.ErrWithKey("db_error", err)

// 스택 정보 포함(스택 프레임은 runtime/과 dd 자체 프레임 필터링)
dd.ErrWithStack(err)
```

## 사용 방식

### InfoWith와 조합

<!-- check-code: skip -->
```go
dd.InfoWith("사용자 로그인",
    dd.String("username", "admin"),
    dd.Time("login_at", time.Now()),
    dd.Bool("mfa", true),
    dd.String("ip", "192.168.1.1"),
)
```

### WithFields와 체인 호출

<!-- check-code: skip -->
```go
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("pid", os.Getpid()),
)
entry.Info("서비스 시작")
```

### Entry에 추가

<!-- check-code: skip -->
```go
base := logger.WithFields(dd.String("req_id", id))
base.InfoWith("응답",
    dd.Int("status", 200),
    dd.Duration("elapsed", took),
    dd.Err(err),
)
```

## 필드 검증

DD는 필드 키 검증 메커니즘을 제공하여 명명 규칙 검사와 보안 검증(Log4Shell 주입, 동형자 공격, overlong UTF-8)을 지원합니다. 검증 구성 `FieldValidationConfig`는 [`Config.FieldValidation`](../core/config)에 연결해 생성 시 적용하거나, 런타임에 [`Logger.SetFieldValidation`](../core/logger)으로 동적 교체할 수 있습니다. 매 `*With` 호출 시 각 필드의 Key에 대해 `ValidateFieldKey`가 호출되며, Strict 모드에서 실패 시 로그 형식으로 오류가 보고됩니다(로그 메서드 자체는 error를 반환하지 않음).

### FieldValidationMode

검증 모드, 검증 실패 시 처리 방식을 결정합니다.

```go
type FieldValidationMode int

const (
    FieldValidationNone   FieldValidationMode = iota // 검증 비활성화(기본, 모든 검사를 단락)
    FieldValidationWarn                              // 명명 불일치 시 warning 로그 기록
    FieldValidationStrict                            // 명명 불일치 시 error 로그 기록
)
```

`FieldValidationMode`의 `String()` 메서드는 `"none"` / `"warn"` / `"strict"`을 반환(알 수 없는 값은 `"unknown"` 반환)합니다.

### FieldNamingConvention

명명 규칙.

```go
type FieldNamingConvention int

const (
    NamingConventionAny         FieldNamingConvention = iota // 임의의 유효한 키 수락(기본)
    NamingConventionSnakeCase                                // snake_case: user_id
    NamingConventionCamelCase                                // camelCase: userId
    NamingConventionPascalCase                               // PascalCase: UserId
    NamingConventionKebabCase                                // kebab-case: user-id
)
```

`FieldNamingConvention`의 `String()` 메서드는 `"any"` / `"snake_case"` / `"camelCase"` / `"PascalCase"` / `"kebab-case"`를 반환(알 수 없는 값은 `"unknown"` 반환)합니다.

### FieldValidationConfig

필드 검증 구성.

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode    // 검증 모드
    Convention               FieldNamingConvention  // 명명 규칙
    AllowCommonAbbreviations bool                   // 일반 약어 허용(ID, URL, HTTP, JSON 등)
    EnableSecurityValidation bool                   // 보안 검증 활성화(Log4Shell / 동형자 / overlong UTF-8)
}
```

:::warning 경고 제로값 함정
리터럴 `FieldValidationConfig{}`는 `EnableSecurityValidation=false`가 되어 **보안 검증을 조용히 끕니다** - [`DefaultFieldValidationConfig`](#사전-설정-구성) 생성자를 우선 사용하세요(이 항목을 `true`로 설정). 또한 `Mode == FieldValidationNone`이면 보안 검증 이전에 단락되어, `EnableSecurityValidation`을 켜도 실행되지 않습니다.
:::

### 사전 설정 구성

```go
// 기본 구성: 명명 검증 비활성화, 보안 검증 활성화
func DefaultFieldValidationConfig() *FieldValidationConfig

// 엄격한 snake_case
func StrictSnakeCaseConfig() *FieldValidationConfig

// 엄격한 camelCase
func StrictCamelCaseConfig() *FieldValidationConfig
```

세 가지 사전 설정 모두 `AllowCommonAbbreviations=true`, `EnableSecurityValidation=true`이며, 뒤의 두 가지는 `Mode=FieldValidationStrict`입니다.

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

필드 키가 구성에 일치하는지 검증합니다. 실패 시 원인을 설명하는 error를 반환하며, 통과 시 `nil`을 반환합니다. 리시버가 `nil`이거나 `Mode == FieldValidationNone`이면 직접 `nil`을 반환합니다. 검증 순서:

1. 빈 키 → `"field key cannot be empty"` 반환
2. `EnableSecurityValidation` 활성화 시 `internal.ValidateFieldKeyStrict` 실행(Log4Shell / 동형자 / overlong UTF-8)
3. `Convention == NamingConventionAny` → 명명 검사 건너뜀
4. `AllowCommonAbbreviations` 활성화이고 키가 일반 약어 표(`id`/`url`/`http`/`json`/`jwt` 등, 또는 `_id`/`_url`/`_uri`/`_ip`/`_api`로 끝남)에 해당 → 통과
5. 규칙별 검증: snake_case / camelCase / PascalCase / kebab-case

```go
package main

import (
    "fmt"

    "github.com/cybergodev/dd"
)

func main() {
    // 엄격한 snake_case 사전 설정
    cfg := dd.StrictSnakeCaseConfig()

    if err := cfg.ValidateFieldKey("user_id"); err != nil {
        fmt.Println("user_id:", err)
    } else {
        fmt.Println("user_id OK")
        // 출력: user_id OK
    }

    if err := cfg.ValidateFieldKey("userId"); err != nil {
        fmt.Println("userId:", err)
        // 출력: userId: field key "userId" does not match snake_case convention
    }

    // 일반 약어 면제: URL은 snake_case가 아니지만 약어 표에 해당하므로 통과
    if err := cfg.ValidateFieldKey("URL"); err != nil {
        fmt.Println("URL:", err)
    } else {
        fmt.Println("URL OK (약어 면제)")
        // 출력: URL OK (약어 면제)
    }

    // 기본 구성은 Mode=None이며 명명을 검증하지 않음
    defaultCfg := dd.DefaultFieldValidationConfig()
    if err := defaultCfg.ValidateFieldKey("anyKey"); err != nil {
        fmt.Println("anyKey:", err)
    } else {
        fmt.Println("anyKey OK (Mode=None)")
        // 출력: anyKey OK (Mode=None)
    }
}
```

## 다음 단계

- [Logger](../core/logger) -- `WithFields` / `InfoWith` / `SetFieldValidation`
- [LoggerEntry](../core/entry) -- 사전 설정 필드 체인 호출
- [컨텍스트 통합](./context) -- `ContextExtractor`로 필드 추출
- [설정](../core/config) -- `Config.FieldValidation`

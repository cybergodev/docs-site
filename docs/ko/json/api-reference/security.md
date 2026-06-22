---
title: "보안 모드 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 보안 API: 보안 설정, AddDangerousPattern 위험 패턴, 입력 검증으로 JSON 인젝션, 깊은 중첩, 자원 고갈 위협을 방어합니다."
---

# 보안 모드

보안 모드는 위험 패턴 감지 기능을 제공하여 JSON 인젝션 공격, 프로토타입 오염 및 기타 보안 위협을 방지합니다.

## DangerousPattern 구조체

DangerousPattern은 보안 위험 패턴을 나타냅니다. 구조체 타입입니다.

```go
type DangerousPattern struct {
    Pattern string       // 입력에서 감지할 부분 문자열
    Name    string       // 패턴의 설명 이름
    Level   PatternLevel // 해당 패턴의 심각도 수준을 결정
}
```

### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `Pattern` | `string` | 입력에서 감지할 부분 문자열 |
| `Name` | `string` | 패턴의 설명 이름 |
| `Level` | `PatternLevel` | 해당 패턴의 심각도 수준을 결정 |

---

## PatternLevel 타입

PatternLevel은 위험 패턴의 심각도 수준을 나타냅니다.

```go
type PatternLevel int
```

### 상수

```go
const (
    // PatternLevelCritical은 항상 작업을 차단합니다
    // 즉각적인 보안 위험을 구성하는 패턴에 사용 (예: 프로토타입 오염)
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning은 엄격 모드에서 차단, 완화 모드에서 경고 기록
    // 악의적인 의도를 나타낼 수 있지만 정당한 용도가 있는 패턴에 사용
    PatternLevelWarning

    // PatternLevelInfo는 기록만 하고 차단하지 않음
    // 감사/추적 목적으로 사용하며 작업을 중단하지 않음
    PatternLevelInfo
)
```

### String 메서드

```go
func (pl PatternLevel) String() string
```

PatternLevel의 문자열 표현을 반환합니다.

---

## 내장 위험 패턴

### 기본 패턴

:::warning 내부 API
내장 패턴 목록은 내부 함수로 관리되며, 공개 API로 내보내지 않습니다. Config의 `AdditionalDangerousPatterns` 필드를 통해 커스텀 패턴을 관리할 수 있습니다.
:::

다음은 내장 위험 패턴 목록으로, 모두 Critical 수준입니다:

| 패턴 | 이름 | 카테고리 |
|------|------|------|
| `__proto__` | prototype pollution | 프로토타입 오염 |
| `constructor[` | constructor access | 생성자 접근 |
| `prototype.` | prototype manipulation | 프로토타입 조작 |
| `<script` | script tag injection | HTML 인젝션 |
| `<iframe` | iframe injection | HTML 인젝션 |
| `<object` | object injection | HTML 인젝션 |
| `<embed` | embed injection | HTML 인젝션 |
| `<svg` | svg injection | HTML 인젝션 |
| `javascript:` | javascript protocol | 프로토콜 인젝션 |
| `vbscript:` | vbscript protocol | 프로토콜 인젝션 |
| `eval(` | dynamic code execution | 코드 실행 |
| `setTimeout(` | timer manipulation | 코드 실행 |
| `setInterval(` | interval manipulation | 코드 실행 |
| `require(` | code injection | 코드 실행 |
| `new function(` | dynamic function creation | 코드 실행 |
| `document.cookie` | cookie access | DOM 접근 |
| `window.location` | redirect manipulation | DOM 접근 |
| `innerhtml` | DOM manipulation | DOM 접근 |
| `onerror`, `onload`, `onclick`, `onmouseover`, `onfocus` | event handler injection | 이벤트 핸들러 |
| `fromcharcode(` | character encoding bypass | 인코딩 우회 |
| `atob(` | base64 decoding | 인코딩 우회 |
| `expression(` | CSS expression injection | CSS 인젝션 |
| `__defineGetter__` | getter definition | 프로토타입 오염 |
| `__defineSetter__` | setter definition | 프로토타입 오염 |

### 핵심 패턴

:::warning 내부 API
`GetCriticalPatterns`는 내부 함수로 전환되어 공개 API로 내보내지지 않습니다. 핵심 패턴(`__proto__`, `constructor[`, `prototype.`)은 항상 강제 검사되며 비활성화할 수 없습니다.
:::

다음 핵심 패턴은 JSON 크기에 관계없이 항상 전체 스캔합니다:

| 패턴 | 설명 |
|------|------|
| `__proto__` | prototype pollution |
| `constructor[` | constructor access |
| `prototype.` | prototype manipulation |

---

## 패턴 등록 메서드

위험 패턴은 전역 등록 함수가 아닌 `Config` 구조체를 통해 설정합니다.

### Config.AddDangerousPattern

시그니처: `func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

설정에 커스텀 위험 패턴을 추가합니다.

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "커스텀 위험 패턴",
    Level:   json.PatternLevelCritical,
})

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Config.AdditionalDangerousPatterns

`Config.AdditionalDangerousPatterns` 필드를 직접 설정할 수도 있습니다:

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "eval(", Name: "eval-call", Level: json.PatternLevelCritical},
    {Pattern: "exec(", Name: "exec-call", Level: json.PatternLevelWarning},
}
```

---

## Config 설정 메서드

### AddDangerousPattern

설정에 보안 패턴을 추가합니다.

```go
func (c *Config) AddDangerousPattern(pattern DangerousPattern)
```

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "custom_dangerous_string",
    Name:    "커스텀 위험 문자열",
    Level:   json.PatternLevelWarning,
})
```

### 설정 필드

```go
type Config struct {
    // ... 다른 필드 ...

    // AdditionalDangerousPatterns는 기본 패턴 외에 추가할 보안 패턴
    AdditionalDangerousPatterns []DangerousPattern

    // DisableDefaultPatterns는 내장 경고 수준 보안 패턴을 비활성화
    // true로 설정하면 AdditionalDangerousPatterns만 사용
    // 참고: 핵심 패턴(__proto__, constructor[, prototype.)은 항상 강제 실행되며 비활성화할 수 없음
    DisableDefaultPatterns bool
}
```

---

## 전역 패턴 등록

`Config`를 통해 인스턴스 수준 패턴을 설정하는 것 외에도, 패키지 레벨 함수를 통해 전역 패턴 등록을 관리할 수 있습니다. 전역 등록의 패턴은 모든 Processor 인스턴스에 적용됩니다.

### RegisterDangerousPattern

시그니처: `func RegisterDangerousPattern(pattern DangerousPattern)`

전역 등록에 커스텀 위험 패턴을 추가합니다. 등록된 패턴은 모든 Processor 인스턴스에 적용됩니다.

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "커스텀 위험 패턴",
    Level:   json.PatternLevelCritical,
})
```

### UnregisterDangerousPattern

시그니처: `func UnregisterDangerousPattern(pattern string)`

전역 등록에서 지정된 패턴을 제거합니다.

```go
json.UnregisterDangerousPattern("malicious_keyword")
```

### ListDangerousPatterns

시그니처: `func ListDangerousPatterns() []DangerousPattern`

전역 등록의 모든 커스텀 패턴을 반환합니다.

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("패턴: %s, 이름: %s, 수준: %s\n", p.Pattern, p.Name, p.Level)
}
```

:::tip 전역 패턴 vs Config 패턴
- **전역 패턴**(`RegisterDangerousPattern`): 모든 Processor 인스턴스가 공유, 애플리케이션 수준 보안 정책에 적합
- **Config 패턴**(`Config.AddDangerousPattern`): 해당 Config를 사용하는 Processor에만 영향, 인스턴스 수준 커스텀에 적합
:::

---

## 전체 예제

### 커스텀 보안 정책

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 방법 1: 설정 필드를 통해
    cfg := json.DefaultConfig()
    cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
        {Pattern: "company_secret", Name: "회사 민감 정보", Level: json.PatternLevelCritical},
    }

    // 방법 2: 설정 메서드를 통해
    cfg.AddDangerousPattern(json.DangerousPattern{
        Pattern: "internal_api",
        Name:    "내부 API 참조",
        Level:   json.PatternLevelWarning,
    })

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 위험 패턴 감지 테스트
    _, err = p.Get(`{"data": "company_secret_info"}`, "data")
    if err != nil {
        fmt.Println("위험 패턴 감지:", err)
    }

    // 등록된 패턴 확인
    fmt.Printf("커스텀 패턴 수: %d\n", len(cfg.AdditionalDangerousPatterns))
}
```

### 기본 패턴 비활성화

```go
cfg := json.DefaultConfig()

// 내장 경고 수준 패턴 비활성화, 커스텀 패턴만 사용
// 참고: 핵심 패턴(__proto__, constructor[, prototype.)은 항상 강제 실행됨
cfg.DisableDefaultPatterns = true

// 커스텀 패턴 추가
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "xss_payload",
    Name:    "XSS 공격 페이로드",
    Level:   json.PatternLevelCritical,
})

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

### 수준별 패턴 처리

```go
// 다양한 수준의 패턴 등록
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "suspicious_but_allowed",
    Name:    "의심스럽지만 허용됨",
    Level:   json.PatternLevelInfo, // 기록만 하고 차단하지 않음
})

// 등록된 커스텀 패턴 확인
for _, p := range cfg.AdditionalDangerousPatterns {
    fmt.Printf("패턴: %s, 이름: %s, 수준: %s\n", p.Pattern, p.Name, p.Level)
}
```

---

## 보안 스캔 전략

### 작은 JSON (< 4KB)

항상 전체 보안 스캔을 수행합니다.

### 중간 크기 JSON (>= 4KB)

32KB 슬라이딩 윈도우 스캔을 사용하여 경계를 가로지르는 패턴을 놓치지 않습니다.

### 대용량 JSON

- 핵심 패턴은 항상 전체 스캔
- 다른 패턴은 샘플링 전략 사용
- 의심스러운 문자 밀도 확인

---

## 관련 문서

- [Config](./config) - 설정 옵션
- [Validator](./validator) - 검증기
- [Hook 훅 시스템](./hooks) - 작업 인터셉트

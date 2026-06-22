---
title: "보안 개요 - CyberGo JSON | 보안 모범 사례"
description: "CyberGo JSON 보안 모범 사례: 입력 검증, MaxNestingDepthSecurity/MaxMemory 제한, 경로 순회 및 JSON 인젝션 방어, 민감 데이터 필터링, 감사 로그로 프로덕션 보안을 보장합니다."
---

# 보안 개요

JSON 데이터 처리 시 보안 고려 사항과 모범 사례입니다.

## 일반적인 보안 위험

### 1. 리소스 고갈 공격

악의적으로 구성된 JSON은 메모리 고갈이나 CPU 과부하를 유발할 수 있습니다.

**방어 조치:**

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50                       // 중첩 깊이 제한
cfg.MaxJSONSize = 10 * 1024 * 1024             // JSON 크기 제한 (10MB)
cfg.MaxSecurityValidationSize = 100 * 1024 * 1024 // 보안 검증 제한을 100MB로 증가 (기본값 10MB)
```

### 2. 경로 순회 공격

악의적인 경로가 의도하지 않은 데이터에 접근할 수 있습니다.

**방어 조치:**

```go
// 사용자 입력 경로 검증
func safePath(path string) bool {
    // 특수 문자 금지
    if strings.ContainsAny(path, `<>:"|\`) {
        return false
    }
    return true
}
```

### 3. JSON 인젝션

악의적인 데이터가 JSON 구조를 파괴할 수 있습니다.

**방어 조치:**

```go
// 항상 라이브러리 함수로 직렬화, 문자열 결합 금지
data := map[string]any{
    "user": userInput, // 라이브러리가 자동으로 이스케이프
}
bytes, _ := json.Marshal(data)
```

### 4. 민감 데이터 유출

로그나 오류 정보가 민감 데이터를 노출할 수 있습니다.

**방어 조치:**

```go
// 커스텀 Hook으로 민감 필드 필터링
type FilterFieldsHook struct {
    fields map[string]bool
}

func (h *FilterFieldsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *FilterFieldsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&FilterFieldsHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "secret":   true,
}})
```

## 보안 설정 권장 사항

### 위험 패턴 관리

라이브러리는 기본 위험 패턴 감지가 내장되어 있으며, 커스텀 패턴의 등록, 해제 및 조회도 지원합니다.

#### RegisterDangerousPattern

시그니처: `func RegisterDangerousPattern(pattern DangerousPattern)`

전역 위험 패턴을 등록합니다. 등록된 패턴은 기본 보안 설정을 사용하는 모든 작업에 적용됩니다.

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

#### UnregisterDangerousPattern

시그니처: `func UnregisterDangerousPattern(pattern string)`

패턴 문자열로 전역 위험 패턴을 해제합니다. 매개변수 `pattern`은 해제할 위험 패턴의 부분 문자열입니다 (`DangerousPattern.Pattern` 필드에 해당).

```go
json.UnregisterDangerousPattern("eval(")
```

#### ListDangerousPatterns

시그니처: `func ListDangerousPatterns() []DangerousPattern`

등록된 모든 위험 패턴(기본 패턴과 커스텀 패턴 포함)을 나열합니다.

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("패턴: %s, 이름: %s, 수준: %s\n", p.Pattern, p.Name, p.Level)
}
```

#### 위험 패턴 수준

| 상수 | 타입 | 값 | 설명 |
|------|------|-----|------|
| `PatternLevelCritical` | `int` | `0` | 심각 수준, 매칭 시 작업 거부 |
| `PatternLevelWarning` | `int` | `1` | 경고 수준, 엄격 모드에서 작업 거부 |
| `PatternLevelInfo` | `int` | `2` | 정보 수준, 로그만 기록 |

::: tip
`PatternLevel`의 `String()` 메서드는 해당 문자열 표현(`"critical"`, `"warning"`, `"info"`)을 반환하여 로그 출력에 편리합니다.
:::

#### 기본 패턴 비활성화

`Config.DisableDefaultPatterns`로 내장된 기본 경고 수준 패턴을 비활성화할 수 있습니다:

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true // 기본 경고 수준 패턴 비활성화
```

:::warning 주의
`DisableDefaultPatterns`는 기본 경고 수준(`PatternLevelWarning`) 패턴만 비활성화합니다. 심각 수준(`PatternLevelCritical`)의 기본 패턴은 영향을 받지 않습니다.
:::

### 프로덕션 환경 설정

```go
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()
    cfg.AddHook(&AuditHook{logger: prodLogger})
    return cfg
}
```

### 개발 환경 설정

```go
func DevelopmentConfig() json.Config {
    cfg := json.DefaultConfig()
    cfg.MaxNestingDepthSecurity = 100
    cfg.AddHook(json.LoggingHook(devLogger))
    return cfg
}
```

## 입력 검증

### 커스텀 검증기

`Validator` 인터페이스(`Validate(jsonStr string) error`)를 구현하여 입력 검증을 수행합니다:

```go
// 커스텀 검증기 구현
type EmailValidator struct{}

func (v *EmailValidator) Validate(jsonStr string) error {
    // JSON 문자열 내용 검증
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return err
    }
    email, ok := data["email"].(string)
    if !ok {
        return nil
    }
    if !strings.Contains(email, "@") {
        return errors.New("invalid email format")
    }
    return nil
}

// 커스텀 검증기 사용
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&EmailValidator{}}
```

### Schema 검증

Schema는 구조체 타입으로, JSON 구조를 검증하는 데 사용할 수 있습니다:

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"id", "name", "email"},
    Properties: map[string]*json.Schema{
        "id":    {Type: "string", Pattern: `^[a-zA-Z0-9]+$`},
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
        "age":   {Type: "number", Minimum: 0, Maximum: 150},
    },
}
```

## 오류 처리

### 안전한 오류 메시지

```go
val, err := json.Get(data, path)
if err != nil {
    // 내부 오류 세부 정보를 노출하지 않음
    return errors.New("데이터 형식이 올바르지 않습니다")
}
```

## 감사 로그

### 핵심 작업 기록

`Hook` 인터페이스(`Before`는 `error` 반환, `After`는 `(HookContext, any, error)`를 받아 `(any, error)` 반환)를 사용하여 감사 로그를 기록합니다:

```go
type AuditHook struct {
    logger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    h.logger.Info("JSON 작업 시작", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("JSON 작업 완료", "op", ctx.Operation)
    return result, err
}
```

## 관련 문서

- [프로덕션 체크리스트](./production-checklist)
- [Config 설정](../api-reference/config)
- [Validator](../api-reference/validator)

---
title: "Hook 훅 시스템 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 훅 시스템 레퍼런스: Hook 인터페이스, LoggingHook 로그, TimingHook 타이밍, ValidationHook 검증, ErrorHook 오류 처리 및 커스텀 훅을 자세히 설명하며 JSON 작업 전후에 커스텀 로직을 삽입할 수 있습니다."
---

# Hook 훅 시스템

Hook은 JSON 작업 전후에 커스텀 로직을 삽입하여 로그 기록, 성능 모니터링, 검증 등의 기능을 구현할 수 있습니다.

## Hook 인터페이스

```go
type Hook interface {
    Before(ctx HookContext) error
    After(ctx HookContext, result any, err error) (any, error)
}
```

### 메서드 설명

| 메서드 | 설명 |
|------|------|
| `Before(ctx HookContext) error` | 작업 전에 호출, 오류를 반환하면 작업 중단 |
| `After(ctx HookContext, result any, err error) (any, error)` | 작업 후에 호출, 결과 수정 또는 오류 반환 가능 |

---

## HookContext 구조체

HookContext는 작업의 컨텍스트 정보를 제공합니다.

```go
type HookContext struct {
    Operation string      // 작업 타입: "get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string      // 입력 JSON 문자열 (marshal 시 비어있을 수 있음)
    Path      string      // 대상 경로 (marshal/unmarshal 시 비어있을 수 있음)
    Value     any         // set 작업의 값
    Config    *Config     // 활성 설정
    StartTime time.Time   // 작업 시작 시간
}
```

### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `Operation` | `string` | 작업 타입, 값: `get`, `set`, `delete`, `marshal`, `unmarshal` |
| `JSONStr` | `string` | 입력 JSON 문자열 |
| `Path` | `string` | 대상 경로 표현식 |
| `Value` | `any` | set 작업의 값 |
| `Config` | `*Config` | 현재 사용 중인 설정 |
| `StartTime` | `time.Time` | 작업 시작 시간 |

---

## HookFunc 어댑터

HookFunc은 구조체 어댑터로, 함수를 Hook으로 사용할 수 있게 합니다. Before 또는 After 중 하나만 필요한 시나리오에 적합합니다.

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

### 예제

```go
// After만 필요한 경우
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// Before만 필요한 경우
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

---

## 편리한 Hook 팩토리 함수

### LoggingHook

로그 기록 Hook을 생성합니다.

```go
func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook
```

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### TimingHook

작업 소요 시간을 기록하는 Hook을 생성합니다.

```go
func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook
```

```go
p.AddHook(json.TimingHook(myMetricsRecorder))
```

### ValidationHook

작업 전에 입력을 검증하는 Hook을 생성합니다.

```go
func ValidationHook(validator func(jsonStr, path string) error) Hook
```

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON too large")
    }
    return nil
}))
```

### ErrorHook

오류를 가로채서 처리하는 Hook을 생성합니다.

```go
func ErrorHook(handler func(ctx HookContext, err error) error) Hook
```

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // 원래 오류 또는 변환된 오류 반환
}))
```

---

## 커스텀 Hook 구현

### 전체 예제

```go
package main

import (
    "fmt"
    "log/slog"
    "time"
    "github.com/cybergodev/json"
)

// 로그 Hook
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("operation starting", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("operation completed",
        "op", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err)
    return result, err
}

func main() {
    cfg := json.DefaultConfig()
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 커스텀 Hook 추가
    p.AddHook(&LoggingHook{logger: slog.Default()})

    // 프로세서 사용...
    val, err := p.Get(`{"name": "test"}`, "name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val)
}
```

### HookFunc로 간소화

```go
// 완료 시간만 기록하면 되는 경우
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        fmt.Printf("%s took %v\n", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})
```

---

## 훅 설정

### Config로 추가

```go
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{
    json.LoggingHook(slog.Default()),
    json.TimingHook(myRecorder),
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### Processor로 추가

```go
p, err := json.New()
if err != nil {
    panic(err)
}
p.AddHook(json.LoggingHook(slog.Default()))
p.AddHook(json.TimingHook(myRecorder))
```

---

## 실행 순서

### Before 훅

- **추가 순서대로** 실행
- 어떤 Hook이든 오류를 반환하면 작업 중단

### After 훅

- **추가 역순으로** 실행
- 각 Hook은 모두 실행됨 (앞서 오류가 반환되어도)

```go
// 추가 순서: A, B, C
p.AddHook(hookA)
p.AddHook(hookB)
p.AddHook(hookC)

// 실행 순서:
// Before: A.Before → B.Before → C.Before
// After:  C.After → B.After → A.After
```

---

## 모범 사례

### 1. 로그 기록

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### 2. 성능 모니터링

```go
type MetricsRecorder struct{}

func (m *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.Histogram("json_operation_duration", duration, "op", op)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

### 3. 입력 검증

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 10*1024*1024 { // 10MB
        return errors.New("JSON payload too large")
    }
    return nil
}))
```

### 4. 오류 추적

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    if err != nil {
        sentry.WithTags(map[string]string{
            "operation": ctx.Operation,
            "path":      ctx.Path,
        }).CaptureException(err)
    }
    return err
}))
```

### 5. 감사 로그

```go
type AuditHook struct {
    auditLogger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if ctx.Operation == "set" || ctx.Operation == "delete" {
        h.auditLogger.Info("data modification",
            "operation", ctx.Operation,
            "path", ctx.Path,
            "success", err == nil)
    }
    return result, err
}
```

---

## 관련 문서

- [인터페이스 정의](./interfaces) - 확장 인터페이스
- [Validator](./validator) - 검증기
- [Config](./config) - 설정 옵션

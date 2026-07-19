---
sidebar_label: "인터페이스 정의"
title: "인터페이스 정의 - CyberGo DD | Logger 인터페이스 계층"
description: "CyberGo DD 로그 라이브러리 인터페이스 계층 정의의 완전한 문서입니다. CoreLogger 기본 로그 인터페이스, LevelLogger 레벨 로그 인터페이스, ConfigurableLogger 구성 가능 로그 인터페이스, LogProvider 로그 제공자 인터페이스를 포함하여 단순에서 복잡까지 다층 로그 추상화 요구를 지원하며, 사용자 정의 구현과 의존성 주입에 용이합니다."
sidebar_position: 5
---

# 인터페이스 정의

DD는 계층화된 로그 인터페이스를 정의하여 다양한 수준의 추상화 요구를 지원합니다.

## 인터페이스 계층

```text
CoreLogger                  기본 로그 메서드
├── LevelLogger             + 레벨 관리
└── ConfigurableLogger      + 구성/라이프사이클/Writer/Hook
    └── LogProvider         + 전체 기능
```

## CoreLogger

가장 기본적인 로그 인터페이스로, 로그 출력 메서드만 포함합니다.

```go
type CoreLogger interface {
    // 기본 로그
    Debug(args ...any)
    Info(args ...any)
    Warn(args ...any)
    Error(args ...any)
    Fatal(args ...any)

    // 포맷팅 로그
    Debugf(format string, args ...any)
    Infof(format string, args ...any)
    Warnf(format string, args ...any)
    Errorf(format string, args ...any)
    Fatalf(format string, args ...any)

    // 구조화 로그
    DebugWith(msg string, fields ...Field)
    InfoWith(msg string, fields ...Field)
    WarnWith(msg string, fields ...Field)
    ErrorWith(msg string, fields ...Field)
    FatalWith(msg string, fields ...Field)

    // 필드 체인
    WithFields(fields ...Field) *LoggerEntry
    WithField(key string, value any) *LoggerEntry
}
```

## LevelLogger

`CoreLogger`를 확장하여 레벨 관리 기능을 추가합니다.

```go
type LevelLogger interface {
    CoreLogger

    GetLevel() LogLevel
    SetLevel(level LogLevel) error
    IsLevelEnabled(level LogLevel) bool
    IsDebugEnabled() bool
    IsInfoEnabled() bool
    IsWarnEnabled() bool
    IsErrorEnabled() bool
    IsFatalEnabled() bool
}
```

## ConfigurableLogger

`CoreLogger`를 확장하여 구성, 라이프사이클, Writer, 컨텍스트 추출기, 훅, 샘플링 관리를 추가합니다.

```go
type ConfigurableLogger interface {
    CoreLogger

    // 레벨 관리
    GetLevel() LogLevel
    SetLevel(level LogLevel) error

    // 출력 대상
    AddWriter(writer io.Writer) error
    RemoveWriter(writer io.Writer) error
    WriterCount() int

    // 라이프사이클
    Flush() error
    Close() error
    IsClosed() bool

    // 구성
    SetSecurityConfig(config *SecurityConfig)
    GetSecurityConfig() *SecurityConfig
    SetWriteErrorHandler(handler WriteErrorHandler)

    // 컨텍스트 추출기
    AddContextExtractor(extractor ContextExtractor) error
    SetContextExtractors(extractors ...ContextExtractor) error
    GetContextExtractors() []ContextExtractor

    // 훅
    AddHook(event HookEvent, hook Hook) error
    SetHooks(registry *HookRegistry) error
    GetHooks() *HookRegistry

    // 샘플링
    SetSampling(config *SamplingConfig)
    GetSampling() *SamplingConfig
}
```

## LogProvider

전체 로그 인터페이스로 모든 기능을 조합합니다. `Logger` 타입이 이 인터페이스를 구현합니다.

```go
type LogProvider interface {
    // 레벨 관리
    GetLevel() LogLevel
    SetLevel(level LogLevel) error
    IsLevelEnabled(level LogLevel) bool
    IsDebugEnabled() bool
    IsInfoEnabled() bool
    IsWarnEnabled() bool
    IsErrorEnabled() bool
    IsFatalEnabled() bool

    // 범용 로그
    Log(level LogLevel, args ...any)
    Logf(level LogLevel, format string, args ...any)
    LogWith(level LogLevel, msg string, fields ...Field)

    // 편의 로그 - Debug
    Debug(args ...any)
    Debugf(format string, args ...any)
    DebugWith(msg string, fields ...Field)

    // 편의 로그 - Info
    Info(args ...any)
    Infof(format string, args ...any)
    InfoWith(msg string, fields ...Field)

    // 편의 로그 - Warn
    Warn(args ...any)
    Warnf(format string, args ...any)
    WarnWith(msg string, fields ...Field)

    // 편의 로그 - Error
    Error(args ...any)
    Errorf(format string, args ...any)
    ErrorWith(msg string, fields ...Field)

    // 편의 로그 - Fatal
    Fatal(args ...any)
    Fatalf(format string, args ...any)
    FatalWith(msg string, fields ...Field)

    // 필드 체인
    WithFields(fields ...Field) *LoggerEntry
    WithField(key string, value any) *LoggerEntry

    // 출력 대상
    AddWriter(writer io.Writer) error
    RemoveWriter(writer io.Writer) error
    WriterCount() int

    // 라이프사이클
    Flush() error
    Close() error
    IsClosed() bool

    // 구성
    SetSecurityConfig(config *SecurityConfig)
    GetSecurityConfig() *SecurityConfig
    SetWriteErrorHandler(handler WriteErrorHandler)

    // 컨텍스트 추출기
    AddContextExtractor(extractor ContextExtractor) error
    SetContextExtractors(extractors ...ContextExtractor) error
    GetContextExtractors() []ContextExtractor

    // 훅
    AddHook(event HookEvent, hook Hook) error
    SetHooks(registry *HookRegistry) error
    GetHooks() *HookRegistry

    // 샘플링
    SetSampling(config *SamplingConfig)
    GetSampling() *SamplingConfig

    // 디버그 출력
    Print(args ...any)
    Println(args ...any)
    Printf(format string, args ...any)
    Text(data ...any)
    Textf(format string, args ...any)
    JSON(data ...any)
    JSONF(format string, args ...any)

    // goroutine 관리
    ActiveFilterGoroutines() int32
    WaitForFilterGoroutines(timeout time.Duration) bool
}
```

:::tip 팁 Logger 추가 메서드
구체 타입 `Logger`는 `LogProvider` 인터페이스를 구현하며, 인터페이스에 포함되지 않은 다음 메서드도 제공합니다.

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Shutdown` | `(ctx context.Context) error` | 타임아웃이 있는 우아한 종료 |
| `SetLevelResolver` | `(resolver LevelResolver)` | 동적 레벨 리졸버 |
| `GetLevelResolver` | `() LevelResolver` | 레벨 리졸버 가져오기 |
| `SetFieldValidation` | `(config *FieldValidationConfig)` | 필드 검증 구성 |
| `GetFieldValidation` | `() *FieldValidationConfig` | 필드 검증 구성 가져오기 |

이 메서드들은 [Logger](./logger) 페이지에 자세히 문서화되어 있습니다.
:::

## Flusher

Writer flush 인터페이스. 이 인터페이스를 구현한 Writer는 `Logger.Flush()` 시 호출됩니다.

```go
type Flusher interface {
    Flush() error
}
```

`BufferedWriter`가 이 인터페이스를 구현합니다.

## 함수 타입

| 타입 | 시그니처 | 설명 |
|------|------|------|
| `FatalHandler` | `func()` | Fatal 레벨의 커스텀 처리 함수 |
| `WriteErrorHandler` | `func(writer io.Writer, err error)` | 쓰기 오류 콜백 |
| `LevelResolver` | `func(ctx context.Context) LogLevel` | 동적 레벨 리졸버 |
| `ContextExtractor` | `func(ctx context.Context) []Field` | 컨텍스트 필드 추출 |
| `Hook` | `func(ctx context.Context, hookCtx *HookContext) error` | 훅 함수 |
| `HookErrorHandler` | `func(event HookEvent, hookCtx *HookContext, err error)` | 훅 오류 처리 |

## 사용 시나리오

### 의존성 주입

```go
type Service struct {
    logger dd.CoreLogger  // 기본 인터페이스에만 의존
}

func NewService(logger dd.CoreLogger) *Service {
    return &Service{logger: logger}
}

// *Logger 또는 *LoggerEntry 전달 가능
svc := NewService(logger)
svc.logger.Info("서비스 시작")
```

### 인터페이스 적응

```go
// CoreLogger를 구현하는 모든 타입 수용
func process(logger dd.CoreLogger) {
    logger.InfoWith("처리 시작", dd.String("item", "data"))
}
```

## 다음 단계

- [Logger](./logger) -- LogProvider를 구현하는 구체 타입
- [LoggerEntry](./entry) -- CoreLogger를 구현하는 Entry 타입
- [패키지 함수](./functions) -- 전역 함수

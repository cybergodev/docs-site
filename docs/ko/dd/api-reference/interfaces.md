---
title: "인터페이스 정의 - CyberGo DD | Logger 인터페이스 계층"
description: "CyberGo DD 로그 라이브러리 인터페이스 계층 정의 전체 문서. CoreLogger 기본 로그 인터페이스, LevelLogger 레벨 로그 인터페이스, ConfigurableLogger 설정 가능 로그 인터페이스 및 LogProvider 로그 제공자 인터페이스를 포함하여, 간단한 것부터 복잡한 것까지 다계층 로그 추상화 요구를 지원하며 커스텀 구현과 의존성 주입에 편리합니다."
---

# 인터페이스 정의

DD는 계층화된 로그 인터페이스를 정의하여 다양한 수준의 추상화 요구를 지원합니다.

## 인터페이스 계층

```text
CoreLogger                  기본 로그 메서드
├── LevelLogger             + 레벨 관리
└── ConfigurableLogger      + 설정/라이프사이클/Writer/Hook
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

    // 구조화된 로그
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

`CoreLogger`를 확장하여 설정, 라이프사이클, Writer, 컨텍스트 추출기, 훅, 샘플링 관리를 추가합니다.

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

    // 설정
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

전체 로그 인터페이스로, 모든 기능을 조합합니다. `Logger` 타입이 이 인터페이스를 구현합니다.

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

    // 설정
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

    // 고루틴 관리
    ActiveFilterGoroutines() int32
    WaitForFilterGoroutines(timeout time.Duration) bool
}
```

:::tip Logger 추가 메서드
구체 타입 `Logger`는 `LogProvider` 인터페이스를 구현하며, 인터페이스에 포함되지 않은 다음 메서드도 제공합니다:

| 메서드 | 서명 | 설명 |
|------|------|------|
| `Shutdown` | `(ctx context.Context) error` | 타임아웃이 있는 정상 종료 |
| `SetLevelResolver` | `(resolver LevelResolver)` | 동적 레벨 리졸버 |
| `GetLevelResolver` | `() LevelResolver` | 레벨 리졸버 가져오기 |
| `SetFieldValidation` | `(config *FieldValidationConfig)` | 필드 검증 설정 |
| `GetFieldValidation` | `() *FieldValidationConfig` | 필드 검증 설정 가져오기 |

이 메서드들은 [Logger](./logger) 페이지에 자세한 문서가 있습니다.
:::

## Flusher

Writer 새로고침 인터페이스. 이 인터페이스를 구현한 Writer는 `Logger.Flush()` 시 호출됩니다.

```go
type Flusher interface {
    Flush() error
}
```

`BufferedWriter`가 이 인터페이스를 구현합니다.

## 함수 타입

| 타입 | 서명 | 설명 |
|------|------|------|
| `FatalHandler` | `func()` | Fatal 레벨의 커스텀 처리 함수 |
| `WriteErrorHandler` | `func(writer io.Writer, err error)` | 쓰기 오류 콜백 |
| `LevelResolver` | `func(ctx context.Context) LogLevel` | 동적 레벨 리졸브 |
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
// CoreLogger를 구현한 모든 타입 허용
func process(logger dd.CoreLogger) {
    logger.InfoWith("처리 시작", dd.String("item", "data"))
}
```

## 다음 단계

- [Logger](./logger) -- LogProvider를 구현한 구체 타입
- [LoggerEntry](./entry) -- CoreLogger를 구현한 Entry 타입
- [패키지 함수](./functions) -- 전역 함수

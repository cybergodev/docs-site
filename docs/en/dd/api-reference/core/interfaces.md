---
sidebar_label: "Interfaces"
title: "Interfaces - CyberGo DD | Logger Interface Hierarchy"
description: "Complete documentation of CyberGo DD's hierarchical logger interfaces, including the CoreLogger base interface, the LevelLogger leveled-logging interface, the ConfigurableLogger configurable-logger interface, and the LogProvider provider interface. Supports multi-level logging abstractions from simple to complex for custom implementations and dependency injection."
sidebar_position: 5
---

# Interfaces

DD defines a hierarchical set of logger interfaces supporting different levels of abstraction.

## Interface Hierarchy

```text
CoreLogger                  Basic logging methods
├── LevelLogger             + Level management
└── ConfigurableLogger      + Config / lifecycle / Writer / Hook
    └── LogProvider         + All features
```

## CoreLogger

The most basic logger interface, containing only log output methods.

```go
type CoreLogger interface {
    // Basic logs
    Debug(args ...any)
    Info(args ...any)
    Warn(args ...any)
    Error(args ...any)
    Fatal(args ...any)

    // Formatted logs
    Debugf(format string, args ...any)
    Infof(format string, args ...any)
    Warnf(format string, args ...any)
    Errorf(format string, args ...any)
    Fatalf(format string, args ...any)

    // Structured logs
    DebugWith(msg string, fields ...Field)
    InfoWith(msg string, fields ...Field)
    WarnWith(msg string, fields ...Field)
    ErrorWith(msg string, fields ...Field)
    FatalWith(msg string, fields ...Field)

    // Field chaining
    WithFields(fields ...Field) *LoggerEntry
    WithField(key string, value any) *LoggerEntry
}
```

## LevelLogger

Extends `CoreLogger` with level-management capabilities.

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

Extends `CoreLogger` with configuration, lifecycle, Writer, context-extractor, hook, and sampling management.

```go
type ConfigurableLogger interface {
    CoreLogger

    // Level management
    GetLevel() LogLevel
    SetLevel(level LogLevel) error

    // Output targets
    AddWriter(writer io.Writer) error
    RemoveWriter(writer io.Writer) error
    WriterCount() int

    // Lifecycle
    Flush() error
    Close() error
    IsClosed() bool

    // Configuration
    SetSecurityConfig(config *SecurityConfig)
    GetSecurityConfig() *SecurityConfig
    SetWriteErrorHandler(handler WriteErrorHandler)

    // Context extractors
    AddContextExtractor(extractor ContextExtractor) error
    SetContextExtractors(extractors ...ContextExtractor) error
    GetContextExtractors() []ContextExtractor

    // Hooks
    AddHook(event HookEvent, hook Hook) error
    SetHooks(registry *HookRegistry) error
    GetHooks() *HookRegistry

    // Sampling
    SetSampling(config *SamplingConfig)
    GetSampling() *SamplingConfig
}
```

## LogProvider

The complete logger interface, combining all capabilities. The `Logger` type implements this interface.

```go
type LogProvider interface {
    // Level management
    GetLevel() LogLevel
    SetLevel(level LogLevel) error
    IsLevelEnabled(level LogLevel) bool
    IsDebugEnabled() bool
    IsInfoEnabled() bool
    IsWarnEnabled() bool
    IsErrorEnabled() bool
    IsFatalEnabled() bool

    // Generic logging
    Log(level LogLevel, args ...any)
    Logf(level LogLevel, format string, args ...any)
    LogWith(level LogLevel, msg string, fields ...Field)

    // Convenience logs - Debug
    Debug(args ...any)
    Debugf(format string, args ...any)
    DebugWith(msg string, fields ...Field)

    // Convenience logs - Info
    Info(args ...any)
    Infof(format string, args ...any)
    InfoWith(msg string, fields ...Field)

    // Convenience logs - Warn
    Warn(args ...any)
    Warnf(format string, args ...any)
    WarnWith(msg string, fields ...Field)

    // Convenience logs - Error
    Error(args ...any)
    Errorf(format string, args ...any)
    ErrorWith(msg string, fields ...Field)

    // Convenience logs - Fatal
    Fatal(args ...any)
    Fatalf(format string, args ...any)
    FatalWith(msg string, fields ...Field)

    // Field chaining
    WithFields(fields ...Field) *LoggerEntry
    WithField(key string, value any) *LoggerEntry

    // Output targets
    AddWriter(writer io.Writer) error
    RemoveWriter(writer io.Writer) error
    WriterCount() int

    // Lifecycle
    Flush() error
    Close() error
    IsClosed() bool

    // Configuration
    SetSecurityConfig(config *SecurityConfig)
    GetSecurityConfig() *SecurityConfig
    SetWriteErrorHandler(handler WriteErrorHandler)

    // Context extractors
    AddContextExtractor(extractor ContextExtractor) error
    SetContextExtractors(extractors ...ContextExtractor) error
    GetContextExtractors() []ContextExtractor

    // Hooks
    AddHook(event HookEvent, hook Hook) error
    SetHooks(registry *HookRegistry) error
    GetHooks() *HookRegistry

    // Sampling
    SetSampling(config *SamplingConfig)
    GetSampling() *SamplingConfig

    // Debug output
    Print(args ...any)
    Println(args ...any)
    Printf(format string, args ...any)
    Text(data ...any)
    Textf(format string, args ...any)
    JSON(data ...any)
    JSONF(format string, args ...any)

    // Goroutine management
    ActiveFilterGoroutines() int32
    WaitForFilterGoroutines(timeout time.Duration) bool
}
```

:::tip Additional Logger methods
The concrete `Logger` type implements the `LogProvider` interface and also provides the following methods that are not part of the interface:

| Method | Signature | Description |
|--------|-----------|-------------|
| `Shutdown` | `(ctx context.Context) error` | Graceful shutdown with timeout |
| `SetLevelResolver` | `(resolver LevelResolver)` | Dynamic level resolver |
| `GetLevelResolver` | `() LevelResolver` | Get the level resolver |
| `SetFieldValidation` | `(config *FieldValidationConfig)` | Field validation config |
| `GetFieldValidation` | `() *FieldValidationConfig` | Get field validation config |

These methods are documented on the [Logger](./logger) page.
:::

## Flusher

Writer flush interface. Writers implementing this interface are invoked during `Logger.Flush()`.

```go
type Flusher interface {
    Flush() error
}
```

`BufferedWriter` implements this interface.

## Function Types

| Type | Signature | Description |
|------|-----------|-------------|
| `FatalHandler` | `func()` | Custom handler for Fatal level |
| `WriteErrorHandler` | `func(writer io.Writer, err error)` | Write-error callback |
| `LevelResolver` | `func(ctx context.Context) LogLevel` | Dynamic level resolution |
| `ContextExtractor` | `func(ctx context.Context) []Field` | Context field extraction |
| `Hook` | `func(ctx context.Context, hookCtx *HookContext) error` | Hook function |
| `HookErrorHandler` | `func(event HookEvent, hookCtx *HookContext, err error)` | Hook error handling |

## Use Cases

### Dependency Injection

```go
type Service struct {
    logger dd.CoreLogger  // Depend only on the basic interface
}

func NewService(logger dd.CoreLogger) *Service {
    return &Service{logger: logger}
}

// Can pass in *Logger or *LoggerEntry
svc := NewService(logger)
svc.logger.Info("service started")
```

### Interface Adaptation

```go
// Accept any type implementing CoreLogger
func process(logger dd.CoreLogger) {
    logger.InfoWith("processing started", dd.String("item", "data"))
}
```

## Next Steps

- [Logger](./logger) -- The concrete type implementing LogProvider
- [LoggerEntry](./entry) -- The Entry type implementing CoreLogger
- [Package Functions](./functions) -- Global functions

---
title: "Package Functions - CyberGo DD | Global Helpers"
description: "CyberGo DD package functions API: New logger creation, Default/SetDefault global management, config presets, and constructors callable via dd. prefix."
---

# Package Functions

DD provides a rich set of package-level functions that can be called directly via the `dd.` prefix. These functions all execute through the global logger (`Default()`).

## Logger Creation

### New

```go
func New(cfg ...Config) (*Logger, error)
```

Creates a new Logger instance. Uses default settings when no config is provided.

```go
// Default config
logger, _ := dd.New()

// Custom config
logger, _ := dd.New(dd.DefaultConfig())

// Note: Only 0 or 1 config is accepted; passing multiple will return an error
// logger, _ := dd.New(cfg1, cfg2)  // Error!
```

## Global Logger

### Get and Set

| Function | Signature | Description |
|----------|-----------|-------------|
| `Default` | `func Default() *Logger` | Get the global logger (lazy initialization) |
| `SetDefault` | `func SetDefault(logger *Logger)` | Set the global logger |
| `InitDefault` | `func InitDefault(cfg ...Config) error` | Initialize the global logger with config |
| `DefaultWithErr` | `func DefaultWithErr() (*Logger, error)` | Get the global logger and initialization error |
| `DefaultInitError` | `func DefaultInitError() error` | Get the initialization error |

### Initializing the Global Logger

```go
// Method 1: Auto-initialization (created on first call)
dd.Default().Info("Global logger auto-created")

// Method 2: Explicit initialization
err := dd.InitDefault(dd.JSONConfig())
if err != nil {
    log.Fatal(err)
}
dd.Default().Info("Global logger with JSON config")

// Method 3: Replace the global logger
custom, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
})
dd.SetDefault(custom)

// Method 4: Check initialization error
logger, err := dd.DefaultWithErr()
if err != nil {
    log.Printf("Global logger initialization failed: %v", err)
}
```

## Configuration Presets

| Function | Signature | Description |
|----------|-----------|-------------|
| `DefaultConfig` | `func DefaultConfig() Config` | Default config (Info level, text format) |
| `DevelopmentConfig` | `func DevelopmentConfig() Config` | Development config (Debug level) |
| `JSONConfig` | `func JSONConfig() Config` | JSON output config |

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
logger, _ := dd.New(cfg)
```

## Output Target Constructors

| Function | Signature | Description |
|----------|-----------|-------------|
| `ConsoleOutput` | `func ConsoleOutput() OutputTarget` | Console output |
| `FileOutput` | `func FileOutput(path string) OutputTarget` | File output (supports rotation) |
| `CustomOutput` | `func CustomOutput(w io.Writer) OutputTarget` | Custom Writer output |

```go
cfg := dd.DefaultConfig()
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
    dd.CustomOutput(customWriter),
}
logger, _ := dd.New(cfg)
```

## Basic Logging (Package Level)

The following functions output logs through the global logger:

| Function | Signature | Description |
|----------|-----------|-------------|
| `Debug` | `func Debug(args ...any)` | Debug level log |
| `Info` | `func Info(args ...any)` | Info level log |
| `Warn` | `func Warn(args ...any)` | Warn level log |
| `Error` | `func Error(args ...any)` | Error level log |
| `Fatal` | `func Fatal(args ...any)` | Fatal level log (default calls os.Exit(1), customizable via FatalHandler) |

```go
dd.Info("Application started")
dd.Errorf("User %s login failed", username)
dd.Warn("Disk space running low")
```

## Formatted Logging (Package Level)

| Function | Signature | Description |
|----------|-----------|-------------|
| `Debugf` | `func Debugf(format string, args ...any)` | Debug level formatted log |
| `Infof` | `func Infof(format string, args ...any)` | Info level formatted log |
| `Warnf` | `func Warnf(format string, args ...any)` | Warn level formatted log |
| `Errorf` | `func Errorf(format string, args ...any)` | Error level formatted log |
| `Fatalf` | `func Fatalf(format string, args ...any)` | Fatal level formatted log (default calls os.Exit(1), customizable via FatalHandler) |

## Generic Level Logging (Package Level)

| Function | Signature | Description |
|----------|-----------|-------------|
| `Log` | `func Log(level LogLevel, args ...any)` | Log at specified level |
| `Logf` | `func Logf(level LogLevel, format string, args ...any)` | Formatted log at specified level |
| `LogWith` | `func LogWith(level LogLevel, msg string, fields ...Field)` | Structured log at specified level |

```go
dd.Log(dd.LevelDebug, "debug info")
dd.Logf(dd.LevelWarn, "warning: %s", reason)
dd.LogWith(dd.LevelError, "request failed",
    dd.String("path", "/api/users"),
    dd.Int("status", 500),
)
```

## Structured Logging (Package Level)

The following functions output structured logs through the global logger:

| Function | Signature | Description |
|----------|-----------|-------------|
| `DebugWith` | `func DebugWith(msg string, fields ...Field)` | Debug level structured log |
| `InfoWith` | `func InfoWith(msg string, fields ...Field)` | Info level structured log |
| `WarnWith` | `func WarnWith(msg string, fields ...Field)` | Warn level structured log |
| `ErrorWith` | `func ErrorWith(msg string, fields ...Field)` | Error level structured log |
| `FatalWith` | `func FatalWith(msg string, fields ...Field)` | Fatal level structured log |

```go
dd.InfoWith("Request completed",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)

dd.ErrorWith("Database error",
    dd.Err(err),
    dd.String("query", sql),
)
```

## Level Management (Package Level)

| Function | Signature | Description |
|----------|-----------|-------------|
| `SetLevel` | `func SetLevel(level LogLevel) error` | Set global log level |
| `GetLevel` | `func GetLevel() LogLevel` | Get global log level |
| `IsLevelEnabled` | `func IsLevelEnabled(level LogLevel) bool` | Check if specified level is enabled |
| `IsDebugEnabled` | `func IsDebugEnabled() bool` | Check if Debug level is enabled |
| `IsInfoEnabled` | `func IsInfoEnabled() bool` | Check if Info level is enabled |
| `IsWarnEnabled` | `func IsWarnEnabled() bool` | Check if Warn level is enabled |
| `IsErrorEnabled` | `func IsErrorEnabled() bool` | Check if Error level is enabled |
| `IsFatalEnabled` | `func IsFatalEnabled() bool` | Check if Fatal level is enabled |

```go
// Dynamically adjust log level
dd.SetLevel(dd.LevelDebug)

// Conditional logging (avoid unnecessary computation)
if dd.IsDebugEnabled() {
    dd.Debug(computeExpensiveDebugInfo())
}
```

## Field Chaining (Package Level)

| Function | Signature | Description |
|----------|-----------|-------------|
| `WithFields` | `func WithFields(fields ...Field) *LoggerEntry` | Create Entry with preset fields |
| `WithField` | `func WithField(key string, value any) *LoggerEntry` | Create Entry with single preset field |

```go
dd.WithFields(dd.String("service", "api"), dd.String("version", "1.0")).
    Info("Request processed")

dd.WithField("request_id", "abc123").Info("Processing request")
```

## Lifecycle (Package Level)

| Function | Signature | Description |
|----------|-----------|-------------|
| `Flush` | `func Flush() error` | Flush global log buffer |

## Writer Management (Package Level)

| Function | Signature | Description |
|----------|-----------|-------------|
| `AddWriter` | `func AddWriter(writer io.Writer) error` | Add output writer |
| `RemoveWriter` | `func RemoveWriter(writer io.Writer) error` | Remove output writer |
| `WriterCount` | `func WriterCount() int` | Get writer count |

## Sampling Control (Package Level)

| Function | Signature | Description |
|----------|-----------|-------------|
| `SetSampling` | `func SetSampling(config *SamplingConfig)` | Set sampling config |
| `GetSampling` | `func GetSampling() *SamplingConfig` | Get sampling config |

## Writer Constructors

| Function | Signature | Description |
|----------|-----------|-------------|
| `NewFileWriter` | `func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)` | Create file writer |
| `DefaultFileWriterConfig` | `func DefaultFileWriterConfig() FileWriterConfig` | Default file writer config |
| `NewBufferedWriter` | `func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)` | Create buffered writer |
| `DefaultBufferedWriterConfig` | `func DefaultBufferedWriterConfig() BufferedWriterConfig` | Default buffered writer config |
| `NewMultiWriter` | `func NewMultiWriter(writers ...io.Writer) *MultiWriter` | Create multi-output writer |

## Security Config Constructors

| Function | Signature | Description |
|----------|-----------|-------------|
| `DefaultSecurityConfig` | `func DefaultSecurityConfig() *SecurityConfig` | Default security config (basic filtering) |
| `DefaultSecureConfig` | `func DefaultSecureConfig() *SecurityConfig` | Complete security config |
| `HealthcareConfig` | `func HealthcareConfig() *SecurityConfig` | HIPAA compliance config |
| `FinancialConfig` | `func FinancialConfig() *SecurityConfig` | PCI-DSS compliance config |
| `GovernmentConfig` | `func GovernmentConfig() *SecurityConfig` | Government standard config |
| `SecurityConfigForLevel` | `func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig` | Get security config by level |

## Sensitive Data Filter Constructors

| Function | Signature | Description |
|----------|-----------|-------------|
| `NewSensitiveDataFilter` | `func NewSensitiveDataFilter() *SensitiveDataFilter` | Full pattern set filter |
| `NewEmptySensitiveDataFilter` | `func NewEmptySensitiveDataFilter() *SensitiveDataFilter` | Empty filter |
| `NewCustomSensitiveDataFilter` | `func NewCustomSensitiveDataFilter(patterns ...string) (*SensitiveDataFilter, error)` | Custom pattern filter |

## Hook Constructors

| Function | Signature | Description |
|----------|-----------|-------------|
| `NewHookRegistry` | `func NewHookRegistry() *HookRegistry` | Create hook registry |
| `NewHooksFromConfig` | `func NewHooksFromConfig(cfg HooksConfig) *HookRegistry` | Create hook registry from config |

## Audit Log Constructors

| Function | Signature | Description |
|----------|-----------|-------------|
| `NewAuditLogger` | `func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)` | Create audit logger |
| `DefaultAuditConfig` | `func DefaultAuditConfig() AuditConfig` | Default audit config |
| `VerifyAuditEvent` | `func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult` | Verify audit event integrity |

## Integrity Signing Constructors

| Function | Signature | Description |
|----------|-----------|-------------|
| `NewIntegritySigner` | `func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)` | Create integrity signer |
| `DefaultIntegrityConfigSafe` | `func DefaultIntegrityConfigSafe() (IntegrityConfig, error)` | Safe random key config |

## Testing Helper Constructors

| Function | Signature | Description |
|----------|-----------|-------------|
| `NewLoggerRecorder` | `func NewLoggerRecorder() *LoggerRecorder` | Create log recorder (for testing) |

## Context Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `WithTraceID` | `func WithTraceID(ctx context.Context, traceID string) context.Context` | Set Trace ID |
| `WithSpanID` | `func WithSpanID(ctx context.Context, spanID string) context.Context` | Set Span ID |
| `WithRequestID` | `func WithRequestID(ctx context.Context, requestID string) context.Context` | Set Request ID |
| `GetTraceID` | `func GetTraceID(ctx context.Context) string` | Get Trace ID |
| `GetSpanID` | `func GetSpanID(ctx context.Context) string` | Get Span ID |
| `GetRequestID` | `func GetRequestID(ctx context.Context) string` | Get Request ID |

## JSON Configuration

| Function | Signature | Description |
|----------|-----------|-------------|
| `DefaultJSONOptions` | `func DefaultJSONOptions() *JSONOptions` | Default JSON output options |

## Field Constructors

Used to create structured log fields (`Field`), combined with `*With` methods or `WithFields`.

| Function | Signature | Description |
|----------|-----------|-------------|
| `Any` | `func Any(key string, value any) Field` | Any type field |
| `String` | `func String(key, value string) Field` | String field |
| `Bool` | `func Bool(key string, value bool) Field` | Boolean field |
| `Int` | `func Int(key string, value int) Field` | int field |
| `Int8` | `func Int8(key string, value int8) Field` | int8 field |
| `Int16` | `func Int16(key string, value int16) Field` | int16 field |
| `Int32` | `func Int32(key string, value int32) Field` | int32 field |
| `Int64` | `func Int64(key string, value int64) Field` | int64 field |
| `Uint` | `func Uint(key string, value uint) Field` | uint field |
| `Uint8` | `func Uint8(key string, value uint8) Field` | uint8 field |
| `Uint16` | `func Uint16(key string, value uint16) Field` | uint16 field |
| `Uint32` | `func Uint32(key string, value uint32) Field` | uint32 field |
| `Uint64` | `func Uint64(key string, value uint64) Field` | uint64 field |
| `Float32` | `func Float32(key string, value float32) Field` | float32 field |
| `Float64` | `func Float64(key string, value float64) Field` | float64 field |
| `Duration` | `func Duration(key string, value time.Duration) Field` | Duration field |
| `Time` | `func Time(key string, value time.Time) Field` | Time field |
| `Err` | `func Err(err error) Field` | Error field (key is "error") |
| `ErrWithKey` | `func ErrWithKey(key string, err error) Field` | Error field with custom key |
| `ErrWithStack` | `func ErrWithStack(err error) Field` | Error field with stack trace |

```go
dd.InfoWith("Request completed",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
    dd.Err(err),
)
```

:::tip Performance Tip
Prefer type-specific constructors (e.g., `Int`, `String`) over `Any` for better performance.
:::

## Field Validation Config

| Function | Signature | Description |
|----------|-----------|-------------|
| `DefaultFieldValidationConfig` | `func DefaultFieldValidationConfig() *FieldValidationConfig` | Default field validation (no validation) |
| `StrictSnakeCaseConfig` | `func StrictSnakeCaseConfig() *FieldValidationConfig` | Strict snake_case validation |
| `StrictCamelCaseConfig` | `func StrictCamelCaseConfig() *FieldValidationConfig` | Strict camelCase validation |

## Debug Output Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `Print` | `func Print(args ...any)` | Output to global logger's Writer (LevelInfo, security filtered) |
| `Println` | `func Println(args ...any)` | Same as Print (underlying Log() already adds newline, security filtered) |
| `Printf` | `func Printf(format string, args ...any)` | Formatted output (LevelInfo, security filtered) |
| `JSON` | `func JSON(data ...any)` | Compact JSON format output to stdout (with caller info, no security filtering) |
| `JSONF` | `func JSONF(format string, args ...any)` | Formatted string as compact JSON output to stdout (with caller info, no security filtering) |
| `Text` | `func Text(data ...any)` | Pretty-printed format output to stdout (no security filtering) |
| `Textf` | `func Textf(format string, args ...any)` | Formatted text output to stdout (no security filtering) |
| `Exit` | `func Exit(data ...any)` | Text output with caller info then exit (exit code 0), complex types auto pretty-printed, no security filtering |
| `Exitf` | `func Exitf(format string, args ...any)` | Formatted output with caller info then exit (exit code 0, no security filtering) |

:::warning Debug Function Security Note
`Print`/`Println`/`Printf` are security filtered, but `JSON`/`JSONF`/`Text`/`Textf`/`Exit`/`Exitf` output raw data directly and **do not go through security filtering**.
:::

## Next Steps

- [Logger](./logger) -- Logger instance methods in detail
- [LoggerEntry](./entry) -- Log Entry with preset fields
- [Configuration](./config) -- Config struct
- [Debug Output](./debug-visual) -- Debug visualization functions

---
sidebar_label: "Config"
title: "Config - CyberGo DD | Config In Depth"
description: "Complete API documentation for the CyberGo DD Config struct, including the DefaultConfig/DevelopmentConfig/JSONConfig preset factories, OutputTarget output-target configuration, field-validation rules, sampling control, formatter options, and the Validate method, providing flexible and type-safe logger behavior customization."
sidebar_position: 4
---

# Config

DD configures logger behavior via the `Config` struct, and provides several preset configuration factory functions.

## Preset Config Factories

```go
// Default config: INFO level, text format
cfg := dd.DefaultConfig()
```

```go
// Development config: DEBUG level, dynamic caller detection
cfgDev := dd.DevelopmentConfig()
```

```go
// JSON config: JSON output
cfgJSON := dd.JSONConfig()
```

| Factory | Return type | Level | Format | Use case |
|---------|-------------|-------|--------|----------|
| `DefaultConfig()` | `Config` | Info | Text | Production |
| `DevelopmentConfig()` | `Config` | Debug | Text | Development |
| `JSONConfig()` | `Config` | Debug | JSON | Log collection |

:::tip Security filtering is enabled by default
All preset configs (`DefaultConfig`, `DevelopmentConfig`, `JSONConfig`) enable security filtering by default and automatically redact sensitive data such as passwords, API keys, and credit card numbers.
:::

## Config Struct

```go
type Config struct {
    // Log level
    Level          LogLevel         // Log level (default LevelInfo)
    Format         LogFormat        // Output format (FormatText / FormatJSON)

    // Time configuration
    TimeFormat     string           // Time format (default ISO 8601)
    IncludeTime    bool             // Include time (default true)
    IncludeLevel   bool             // Include level (default true)

    // Caller info
    DynamicCaller  bool             // Dynamic caller detection (default true)
    FullPath       bool             // Show full path (default false)

    // Output targets
    Targets        []OutputTarget   // Output target list

    // JSON configuration
    JSON           *JSONOptions     // JSON output options

    // Security configuration
    Security       *SecurityConfig  // Security config

    // Field validation
    FieldValidation *FieldValidationConfig

    // Lifecycle handlers
    FatalHandler      FatalHandler       // Custom Fatal-level handler
    WriteErrorHandler WriteErrorHandler  // Write-error callback

    // Extensibility
    ContextExtractors []ContextExtractor // Context extractor list
    Hooks             *HookRegistry      // Hook registry
    Sampling          *SamplingConfig    // Sampling config

    // Audit configuration
    Audit             *AuditConfig       // Audit logging config (security event recording)
}
```

:::tip Audit field
When `Audit` is set, sensitive-data redaction, rate-limit, and violation events are recorded as audit events via the [AuditLogger](../security-audit/audit). See [Audit Logging](../security-audit/audit).
:::

### Clone

```go
func (c *Config) Clone() Config
```

Creates a copy of the configuration that can be safely modified without affecting the original. Returns the zero value `Config{}` for a nil receiver.

Copy strategy (consistent with the source `Clone` comments):

- **Deep copy**: `Targets` (slice), `JSON` (including `JSONFieldNames`), `Security`, `Hooks`, `Sampling`, `Audit`
- **Shallow copy**: `FatalHandler`, `WriteErrorHandler`, `FieldValidation` (functions/pointers are shared)
- **Mixed**: the `ContextExtractors` slice is copied, but the extractor instances themselves are shared

```go
base := dd.DefaultConfig()
custom := base.Clone()
custom.Level = dd.LevelDebug
```

### Validate

```go
func (c Config) Validate() error
```

Validates the configuration and returns the first error encountered. `dd.New(cfg)` calls this method internally; you can also call it manually before passing to `New` to surface issues early.

Validation checks:

- `Level` must fall within `[LevelDebug, LevelFatal]`
- `Format` must be `FormatText` or `FormatJSON`
- When `IncludeTime=true` and `TimeFormat` is non-empty, validates the Go time reference layout (e.g. `time.RFC3339`)
- Total `Targets` count must not exceed 100 (otherwise returns `ErrMaxWritersExceeded`)
- Each `Targets` element: `OutputCustom` must have a non-nil `Writer`, `OutputFile` must have a non-empty `Path`

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
if err := cfg.Validate(); err != nil {
    log.Fatal(err)
}
```

## Output Targets

### OutputType

Enumeration of output target types.

```go
type OutputType int
```

| Constant | Value | Description |
|----------|-------|-------------|
| `OutputConsole` | `0` | Console output (stdout) |
| `OutputFile` | `1` | File output |
| `OutputCustom` | `2` | Custom Writer |

### OutputTarget

Output target configuration, describing a single output destination.

```go
type OutputTarget struct {
    Type       OutputType     // Output type
    Path       string         // File path (effective for OutputFile)
    MaxSizeMB  int            // File size cap in MB (effective for OutputFile)
    MaxBackups int            // Number of backups to keep (effective for OutputFile)
    MaxAge     time.Duration  // How long to keep old files (effective for OutputFile)
    Compress   bool           // Whether to gzip-compress (effective for OutputFile)
    Writer     io.Writer      // Custom Writer (effective for OutputCustom)
}
```

### Output Target Constructors

```go
func ConsoleOutput() OutputTarget
func FileOutput(path string) OutputTarget
func CustomOutput(w io.Writer) OutputTarget
```

:::tip FileOutput default rotation parameters
The `OutputTarget` returned by `FileOutput` is pre-filled with default rotation values: `MaxSizeMB=100`, `MaxBackups=10`, `MaxAge=30 * 24 * time.Hour` (30 days), `Compress=false`. To customize, modify the corresponding fields on the returned value:

```go
target := dd.FileOutput("logs/app.log")
target.MaxSizeMB = 50               // Rotate at 50 MB
target.MaxBackups = 5               // Keep 5 backups
target.MaxAge = 7 * 24 * time.Hour  // Keep 7 days
target.Compress = true              // gzip-compress old logs
```

:::

```go
// Console output
cfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// File output
cfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/app.log")}

// Custom Writer
cfg.Targets = []dd.OutputTarget{dd.CustomOutput(customWriter)}

// Multi-target output
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
}
```

## JSON Configuration Options

### JSONOptions

JSON output format configuration.

```go
type JSONOptions struct {
    PrettyPrint bool           // Pretty-print output (default false)
    Indent      string         // Indent string (default "  ")
    FieldNames  *JSONFieldNames // Custom JSON field names
}
```

### JSONFieldNames

Customize the field names in JSON output. Useful for adapting to different log collection systems.

```go
type JSONFieldNames struct {
    Timestamp string  // Timestamp field name (default "timestamp")
    Level     string  // Level field name (default "level")
    Caller    string  // Caller field name (default "caller")
    Message   string  // Message field name (default "message")
    Fields    string  // Field container name (default "fields")
}
```

Implements the pointer-receiver method `(*JSONFieldNames).IsComplete() bool`: returns `true` when all 5 field names are non-empty, useful for checking whether all field names have been fully customized.

Usage example:

```go
cfg := dd.DefaultJSONOptions()
cfg.FieldNames = &dd.JSONFieldNames{
    Timestamp: "ts",
    Level:     "lvl",
    Message:   "msg",
}
```

### DefaultJSONOptions

```go
func DefaultJSONOptions() *JSONOptions
```

Returns the default `JSONOptions`: no pretty-printing by default (two-space indent), field names use the defaults.

```go
opts := dd.DefaultJSONOptions()
opts.PrettyPrint = true

logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    JSON:   opts,
})
```

## SamplingConfig

Sampling configuration for reducing log volume in high-throughput scenarios.

```go
type SamplingConfig struct {
    Enabled    bool          // Whether to enable sampling
    Initial    int           // Number of messages always logged before sampling
    Thereafter int           // Sampling rate (value of 10 means 1 of every 10 is logged)
    Tick       time.Duration // Counter reset interval (0 means no reset)
}
```

```go
cfg := dd.DefaultConfig()
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,
    Thereafter: 10,
    Tick:       time.Minute,
}
logger, _ := dd.New(cfg)
```

## FieldValidationConfig

Field validation configuration, controlling naming conventions for field keys.

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode      // Validation mode
    Convention               FieldNamingConvention    // Naming convention
    AllowCommonAbbreviations bool                      // Allow common abbreviations (ID, URL, etc.)
    EnableSecurityValidation bool                      // Enable security validation (Log4Shell, homograph attacks, etc.)
}
```

### FieldValidationMode

| Constant | Description |
|----------|-------------|
| `FieldValidationNone` | Disable validation (default) |
| `FieldValidationWarn` | Warn on non-conforming fields but still accept |
| `FieldValidationStrict` | Emit an error to stderr on naming mismatch (the log entry is still written normally, not rejected) |

Implements a `String()` method returning the mode name.

### FieldNamingConvention

| Constant | Description | Example |
|----------|-------------|---------|
| `NamingConventionAny` | Accept any format (default) | - |
| `NamingConventionSnakeCase` | snake_case | `user_id`, `created_at` |
| `NamingConventionCamelCase` | camelCase | `userId`, `createdAt` |
| `NamingConventionPascalCase` | PascalCase | UserId, CreatedAt |
| `NamingConventionKebabCase` | kebab-case | `user-id`, `created-at` |

Implements a `String()` method returning the naming-convention name.

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

Validates that a field key conforms to the configured naming convention.

## Field Validation Configuration

### DefaultFieldValidationConfig

```go
func DefaultFieldValidationConfig() *FieldValidationConfig
```

Default configuration: validation disabled.

### StrictSnakeCaseConfig

```go
func StrictSnakeCaseConfig() *FieldValidationConfig
```

Strict snake_case validation; field names must be in `snake_case` format.

### StrictCamelCaseConfig

```go
func StrictCamelCaseConfig() *FieldValidationConfig
```

Strict camelCase validation; field names must be in `camelCase` format.

### Usage

```go
logger, _ := dd.New(dd.Config{
    Level:           dd.LevelInfo,
    FieldValidation: dd.StrictSnakeCaseConfig(),
})

// Valid
logger.InfoWith("ok", dd.String("user_name", "admin"))

// Non-conforming naming (not snake_case; the log is still written, error goes to stderr)
logger.InfoWith("fail", dd.String("userName", "admin"))
```

## Configuration Examples

### Production

```go
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
    Security: dd.DefaultSecurityConfig(),
})
```

### Development

```go
logger, _ := dd.New(dd.DevelopmentConfig())
```

### Multiple Output Targets

```go
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## Next Steps

- [Logger](./logger) -- Create loggers from configuration
- [Output Targets](../output-integration/writers) -- FileWriter, BufferedWriter, MultiWriter
- [Security Filtering](../security-audit/security) -- SecurityConfig in depth
- [Hook System](../security-audit/hooks) -- HooksConfig in depth
- [Audit Logging](../security-audit/audit) -- AuditConfig in depth

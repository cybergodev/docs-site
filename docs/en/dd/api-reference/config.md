---
title: "Configuration - CyberGo DD | Config Details"
description: "CyberGo DD Config API: preset configs (Default/Development/JSON), OutputTarget settings, field validation, sampling, and type-safe logger customization."
---

# Configuration

DD configures logger behavior through the `Config` struct and provides multiple preset configuration factory functions.

## Preset Configuration Factories

```go
// Default config: INFO level, text format
cfg := dd.DefaultConfig()

// Development config: DEBUG level, dynamic caller detection
cfg := dd.DevelopmentConfig()

// JSON config: JSON format output
cfg := dd.JSONConfig()
```

| Factory Function | Return Type | Level | Format | Use Case |
|------------------|-------------|-------|--------|----------|
| `DefaultConfig()` | `Config` | Info | Text | Production |
| `DevelopmentConfig()` | `Config` | Debug | Text | Development |
| `JSONConfig()` | `Config` | Debug | JSON | Log collection |

:::tip Security Enabled by Default
All preset configurations (`DefaultConfig`, `DevelopmentConfig`, `JSONConfig`) have security filtering enabled by default, automatically redacting passwords, API keys, credit card numbers, and other sensitive data.
:::

## Config Struct

```go
type Config struct {
    // Log level
    Level          LogLevel         // Log level (default LevelInfo)
    Format         LogFormat        // Output format (FormatText / FormatJSON)

    // Time configuration
    TimeFormat     string           // Time format (default ISO 8601)
    IncludeTime    bool             // Whether to include time (default true)
    IncludeLevel   bool             // Whether to include level (default true)

    // Caller information
    DynamicCaller  bool             // Dynamic caller detection (default true)
    FullPath       bool             // Whether to show full path (default false)

    // Output targets
    Targets        []OutputTarget   // Output target list

    // JSON configuration
    JSON           *JSONOptions     // JSON output options

    // Security configuration
    Security       *SecurityConfig  // Security config

    // Field validation
    FieldValidation *FieldValidationConfig

    // Lifecycle handlers
    FatalHandler      FatalHandler       // Fatal level custom handler
    WriteErrorHandler WriteErrorHandler  // Write error callback

    // Extensibility
    ContextExtractors []ContextExtractor // Context extractor list
    Hooks             *HookRegistry      // Hook registry
    Sampling          *SamplingConfig    // Sampling config
}
```

### Clone

```go
func (c *Config) Clone() Config
```

Creates a deep copy of the configuration, safe to modify without affecting the original.

```go
base := dd.DefaultConfig()
custom := base.Clone()
custom.Level = dd.LevelDebug
```

### Validate

```go
func (c Config) Validate() error
```

Validates the configuration, checking that output targets, levels, formats, etc. are valid.

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
if err := cfg.Validate(); err != nil {
    log.Fatal(err)
}
```

## Output Targets

### OutputType

Output target type enumeration.

```go
type OutputType int
```

| Constant | Value | Description |
|----------|-------|-------------|
| `OutputConsole` | `0` | Console output (stdout) |
| `OutputFile` | `1` | File output |
| `OutputCustom` | `2` | Custom Writer |

### OutputTarget

Output target configuration, describing a single output target.

```go
type OutputTarget struct {
    Type       OutputType     // Output type
    Path       string         // File path (effective for OutputFile)
    MaxSizeMB  int            // File size limit MB (effective for OutputFile)
    MaxBackups int            // Number of backups to retain (effective for OutputFile)
    MaxAge     time.Duration  // Old file retention duration (effective for OutputFile)
    Compress   bool           // Whether to gzip compress (effective for OutputFile)
    Writer     io.Writer      // Custom Writer (effective for OutputCustom)
}
```

### Output Target Constructors

```go
func ConsoleOutput() OutputTarget
func FileOutput(path string) OutputTarget
func CustomOutput(w io.Writer) OutputTarget
```

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
    PrettyPrint bool           // Whether to pretty print (default false)
    Indent      string         // Indent string (default "  ")
    FieldNames  *JSONFieldNames // Custom JSON field names
}
```

### JSONFieldNames

Custom field names in JSON output. Used to adapt to different log collection systems.

```go
type JSONFieldNames struct {
    Timestamp string  // Timestamp field name (default "timestamp")
    Level     string  // Level field name (default "level")
    Caller    string  // Caller field name (default "caller")
    Message   string  // Message field name (default "message")
    Fields    string  // Fields container name (default "fields")
}
```

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

Returns default JSON output options.

```go
cfg := dd.JSONConfig()
// Includes default JSONOptions
```

## SamplingConfig

Sampling configuration for reducing log volume in high-throughput scenarios.

```go
type SamplingConfig struct {
    Enabled    bool          // Whether to enable sampling
    Initial    int           // Number of messages always logged before sampling
    Thereafter int           // Sampling rate (value of 10 means log 1 out of every 10)
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

Field validation configuration for controlling field key naming conventions.

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
| `FieldValidationWarn` | Warn on non-conforming fields, but still accept |
| `FieldValidationStrict` | Reject non-conforming fields, output error |

Implements `String()` method, returns mode name.

### FieldNamingConvention

| Constant | Description | Example |
|----------|-------------|---------|
| `NamingConventionAny` | Accept any format (default) | - |
| `NamingConventionSnakeCase` | snake_case | `user_id`, `created_at` |
| `NamingConventionCamelCase` | camelCase | `userId`, `createdAt` |
| `NamingConventionPascalCase` | PascalCase | `UserId`, `CreatedAt` |
| `NamingConventionKebabCase` | kebab-case | `user-id`, `created-at` |

Implements `String()` method, returns naming convention name.

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

Validates that a field key name conforms to the configured naming convention.

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

Strict snake_case validation. Field names must be in `snake_case` format.

### StrictCamelCaseConfig

```go
func StrictCamelCaseConfig() *FieldValidationConfig
```

Strict camelCase validation. Field names must be in `camelCase` format.

### Usage

```go
logger, _ := dd.New(dd.Config{
    Level:           dd.LevelInfo,
    FieldValidation: dd.StrictSnakeCaseConfig(),
})

// Valid
logger.InfoWith("ok", dd.String("user_name", "admin"))

// Invalid (not snake_case)
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

- [Logger](./logger) -- Create logger with config
- [Output Targets](./writers) -- FileWriter, BufferedWriter, MultiWriter
- [Security Filtering](./security) -- SecurityConfig in detail
- [Hook System](./hooks) -- HooksConfig in detail

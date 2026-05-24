---
title: "Config API - CyberGo env | Configuration Details"
description: "CyberGo env library Config configuration struct API complete reference documentation, including file search paths, security limit parameters, key-value validation options, variable expansion settings, audit logging configuration, and predefined configuration presets for Development and Production environments."
---

# Config API

Complete configuration options reference for the `Config` struct.

## Struct Definition

Config uses nested structs for organization while maintaining backward compatibility through Go's field promotion:

```go
type Config struct {
    FileConfig       // File loading behavior
    ValidationConfig // Key and value validation
    LimitsConfig     // Size and count limits
    JSONConfig       // JSON parsing options
    YAMLConfig       // YAML parsing options
    ParsingConfig    // General parsing behavior
    ComponentConfig  // Custom components and advanced options
}
```

**Two Access Methods:**

```go
// Old way (via field promotion, still valid)
cfg.Filenames = []string{".env"}
cfg.MaxFileSize = 1024

// New way (recommended, clearer)
cfg.FileConfig.Filenames = []string{".env"}
cfg.LimitsConfig.MaxFileSize = 1024
```

### Nested Structs

```go
// FileConfig controls file loading behavior
type FileConfig struct {
    Filenames         []string // List of files to load
    FailOnMissingFile bool     // Whether to error when file not found
    OverwriteExisting bool     // Whether to overwrite existing environment variables
    AutoApply         bool     // Whether to automatically apply to os.Environ
}

// ValidationConfig controls key and value validation
type ValidationConfig struct {
    RequiredKeys   []string       // List of required key names
    AllowedKeys    []string       // Allowed key name whitelist
    ForbiddenKeys  []string       // Additional forbidden key list
    KeyPattern     *regexp.Regexp // Key name matching pattern
    ValidateValues bool           // Whether to validate value safety
    ValidateUTF8   bool           // Whether to validate values as valid UTF-8
}

// LimitsConfig controls size and count limits
type LimitsConfig struct {
    MaxFileSize       int64 // Max bytes per file
    MaxVariables      int   // Max variables per file
    MaxLineLength     int   // Max length per line
    MaxKeyLength      int   // Max key name length
    MaxValueLength    int   // Max value length
    MaxExpansionDepth int   // Max variable expansion depth
}

// JSONConfig controls JSON parsing behavior
type JSONConfig struct {
    JSONNullAsEmpty    bool // Convert null to empty string
    JSONNumberAsString bool // Convert numbers to strings
    JSONBoolAsString   bool // Convert booleans to strings
    JSONMaxDepth       int  // Max nesting depth
}

// YAMLConfig controls YAML parsing behavior
type YAMLConfig struct {
    YAMLNullAsEmpty    bool // Convert null/~ to empty string
    YAMLNumberAsString bool // Convert numbers to strings
    YAMLBoolAsString   bool // Convert booleans to strings
    YAMLMaxDepth       int  // Max nesting depth
}

// ParsingConfig controls general parsing behavior
type ParsingConfig struct {
    AllowExportPrefix bool // Allow export KEY=value syntax
    AllowYamlSyntax   bool // Allow YAML-style values
    ExpandVariables   bool // Whether to expand ${VAR} references
}

// ComponentConfig for custom components and advanced options
type ComponentConfig struct {
    CustomValidator Validator        // Custom key/value validator
    CustomExpander  VariableExpander // Custom variable expander
    CustomAuditor   AuditLogger      // Custom audit logger
    FileSystem      FileSystem       // Custom file system (for testing)
    AuditHandler    AuditHandler     // Custom audit handler
    AuditEnabled    bool             // Enable audit logging
    Prefix          string           // Only process variables with this prefix
}
```

## Configuration Fields

### File Handling

These fields control file loading behavior.

#### `Filenames` []string

List of file paths to load. **Default `[".env"]`**.

```go
cfg.Filenames = []string{".env", ".env.local"}
```

---

#### `FailOnMissingFile` bool

Whether to return an error when a file is not found. **Default `false`** (silently skip).

```go
cfg.FailOnMissingFile = true  // Error when file not found
```

---

#### `OverwriteExisting` bool

Whether to overwrite existing environment variables. **Default `false`**.

```go
cfg.OverwriteExisting = true  // Allow overwrite
```

---

#### `AutoApply` bool

Automatically apply to the system environment (`os.Environ`) after loading. **Default `false`**.

```go
cfg.AutoApply = true  // Auto-apply after loading
```

:::tip Note
The package-level `Load()` function automatically sets `AutoApply = true`. When using `New()` to create a Loader, you must set it manually.
:::

### Variable Expansion

#### `ExpandVariables` bool

Enable `${VAR}` syntax variable expansion. **Default `true`**.

```go
cfg.ExpandVariables = true
```

Supported expansion syntax:

| Syntax | Description |
|--------|-------------|
| `${VAR}` | Reference a variable |
| `${VAR:-default}` | Use default value when variable doesn't exist or is empty |
| `${VAR:=default}` | Set default value when variable doesn't exist or is empty |
| `${VAR:?error}` | Error when variable doesn't exist or is empty |

### Security Limits

#### `MaxFileSize` int64

Maximum bytes per file. **Default 2MB**, hard maximum 100MB.

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 MB
```

| Config | Default | Hard Maximum |
|--------|---------|--------------|
| `MaxFileSize` | 2MB (2097152) | 100MB |

---

#### `MaxLineLength` int

Maximum length per line. **Default 1024**, hard maximum 64KB.

```go
cfg.MaxLineLength = 2048
```

| Config | Default | Hard Maximum |
|--------|---------|--------------|
| `MaxLineLength` | 1024 | 65536 (64KB) |

---

#### `MaxKeyLength` int

Maximum key name length. **Default 64**, hard maximum 1024.

```go
cfg.MaxKeyLength = 128
```

| Config | Default | Hard Maximum |
|--------|---------|--------------|
| `MaxKeyLength` | 64 | 1024 |

---

#### `MaxValueLength` int

Maximum value length. **Default 4096**, hard maximum 1MB.

```go
cfg.MaxValueLength = 8192
```

| Config | Default | Hard Maximum |
|--------|---------|--------------|
| `MaxValueLength` | 4096 | 1048576 (1MB) |

---

#### `MaxVariables` int

Maximum variables per file. **Default 500**, hard maximum 10000.

```go
cfg.MaxVariables = 1000
```

| Config | Default | Hard Maximum |
|--------|---------|--------------|
| `MaxVariables` | 500 | 10000 |

---

#### `MaxExpansionDepth` int

Maximum variable expansion depth. **Default 5**, hard maximum 20.

```go
cfg.MaxExpansionDepth = 10
```

| Config | Default | Hard Maximum |
|--------|---------|--------------|
| `MaxExpansionDepth` | 5 | 20 |

### Key Validation

#### `KeyPattern` *regexp.Regexp

Custom key name matching pattern. **Default `nil`** (uses fast byte-level validation).

:::tip Performance Optimization
A `nil` value enables fast byte-level validation (~10x performance improvement). Default validation rules: starts with a letter, contains only letters, digits, and underscores.
:::

```go
import "regexp"

// Custom pattern
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
```

---

#### `AllowedKeys` []string

Allowed key name whitelist. When empty, all keys are allowed (except forbidden keys).

```go
cfg.AllowedKeys = []string{"APP_NAME", "APP_VERSION", "PORT"}
```

---

#### `ForbiddenKeys` []string

Additional forbidden key list (added on top of built-in forbidden keys).

```go
cfg.ForbiddenKeys = []string{"CUSTOM_DANGEROUS_VAR"}
```

:::tip Built-in Forbidden Keys
The library built-in forbids system-critical variables like `PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES`, etc. See [Constants & Errors](/en/env/api-reference/constants#defaultforbiddenkeys).
:::

---

#### `RequiredKeys` []string

List of required key names. Checked when `Validate()` is called.

```go
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
```

---

#### `ValidateValues` bool

Validates value safety (control characters, null bytes, etc.). **Default `true`**.

:::warning Security Recommendation
It is recommended to keep this enabled at all times. Only disable in special scenarios (e.g., when you need to store values containing control characters).
:::

```go
cfg.ValidateValues = true  // Enabled by default
```

---

#### `ValidateUTF8` bool

Validates whether values are valid UTF-8 encoded. **Default `false`**.

```go
cfg.ValidateUTF8 = true  // Enable UTF-8 validation
```

### Parsing Options

#### `AllowExportPrefix` bool

Allow `export KEY=value` syntax. **Default `true`**.

```go
cfg.AllowExportPrefix = false  // Disallow export prefix
```

---

#### `AllowYamlSyntax` bool

Allow YAML-style syntax (`KEY: value`). **Default `false`**.

```go
cfg.AllowYamlSyntax = true
```

### JSON Options

#### `JSONNullAsEmpty` bool

Convert JSON `null` values to empty strings. **Default `true`**.

```go
cfg.JSONNullAsEmpty = true
```

---

#### `JSONNumberAsString` bool

Convert JSON numbers to strings. **Default `true`**.

```go
cfg.JSONNumberAsString = true
```

---

#### `JSONBoolAsString` bool

Convert JSON booleans to strings. **Default `true`**.

```go
cfg.JSONBoolAsString = true
```

---

#### `JSONMaxDepth` int

Maximum JSON nesting depth. **Default 10**.

```go
cfg.JSONMaxDepth = 20
```

### YAML Options

#### `YAMLNullAsEmpty` bool

Convert YAML `null`/`~` values to empty strings. **Default `true`**.

```go
cfg.YAMLNullAsEmpty = true
```

---

#### `YAMLNumberAsString` bool

Convert YAML numbers to strings. **Default `true`**.

```go
cfg.YAMLNumberAsString = true
```

---

#### `YAMLBoolAsString` bool

Convert YAML booleans to strings. **Default `true`**.

```go
cfg.YAMLBoolAsString = true
```

---

#### `YAMLMaxDepth` int

Maximum YAML nesting depth. **Default 10**.

```go
cfg.YAMLMaxDepth = 15
```

### Audit

#### `AuditEnabled` bool

Enable audit logging. **Default `false`**.

```go
cfg.AuditEnabled = true
```

---

#### `AuditHandler` AuditHandler

Custom audit handler.

```go
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

:::tip See Also
[Audit Logging](/en/env/guides/audit-logging) for complete audit configuration details.
:::

### Advanced Options

#### `Prefix` string

Only process variables with this prefix. **Default `""`** (process all variables).

```go
cfg.Prefix = "MYAPP_"  // Only load variables starting with MYAPP_
```

---

#### `FileSystem` FileSystem

Custom file system interface (for testing).

```go
cfg.FileSystem = &MockFileSystem{}
```

---

#### `CustomValidator` Validator

Custom key/value validator. Overrides the built-in validator.

```go
cfg.CustomValidator = &MyValidator{}
```

---

#### `CustomExpander` VariableExpander

Custom variable expander. Overrides the built-in expander.

```go
cfg.CustomExpander = &MyExpander{}
```

---

#### `CustomAuditor` AuditLogger

Custom audit logger. Overrides the built-in auditor.

```go
cfg.CustomAuditor = &MyAuditLogger{}
```

---

## Factory Functions

### DefaultConfig

```go
func DefaultConfig() Config
```

Returns a safe default configuration.

**Default Values:**

| Field | Value |
|-------|-------|
| `Filenames` | `[".env"]` |
| `FailOnMissingFile` | `false` |
| `OverwriteExisting` | `false` |
| `AutoApply` | `false` |
| `ExpandVariables` | `true` |
| `MaxFileSize` | 2MB |
| `MaxLineLength` | 1024 |
| `MaxKeyLength` | 64 |
| `MaxValueLength` | 4096 |
| `MaxVariables` | 500 |
| `MaxExpansionDepth` | 5 |
| `ValidateValues` | `true` |
| `KeyPattern` | `nil` (fast validation) |
| `AllowExportPrefix` | `true` |
| `AllowYamlSyntax` | `false` |
| `JSONNullAsEmpty` | `true` |
| `JSONNumberAsString` | `true` |
| `JSONBoolAsString` | `true` |
| `JSONMaxDepth` | 10 |
| `YAMLNullAsEmpty` | `true` |
| `YAMLNumberAsString` | `true` |
| `YAMLBoolAsString` | `true` |
| `YAMLMaxDepth` | 10 |
| `ValidateUTF8` | `false` |
| `AuditEnabled` | `false` |
| `Prefix` | `""` |

---

### DevelopmentConfig

```go
func DevelopmentConfig() Config
```

Returns development environment configuration (relaxed limits).

**Differences from Default:**
- `OverwriteExisting`: `true`
- `AllowYamlSyntax`: `true`
- `MaxFileSize`: 10MB

:::tip Security Guarantee
`ValidateValues` remains `true` across all preset configurations (consistent with the default value), ensuring security regardless of environment.
:::

```go
cfg := env.DevelopmentConfig()
cfg.Filenames = []string{".env.development"}
loader, _ := env.New(cfg)
```

---

### TestingConfig

```go
func TestingConfig() Config
```

Returns testing environment configuration.

**Differences from Default:**
- `OverwriteExisting`: `true`
- `MaxFileSize`: 64KB
- `MaxVariables`: 50

```go
func TestSomething(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}
    loader, _ := env.New(cfg)
    defer loader.Close()
}
```

---

### ProductionConfig

```go
func ProductionConfig() Config
```

Returns production environment configuration (strict validation + audit).

**Differences from Default:**
- `FailOnMissingFile`: `true`
- `AuditEnabled`: `true`
- `MaxFileSize`: 64KB
- `MaxVariables`: 50

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
loader, _ := env.New(cfg)
```

---

### Detailed Preset Comparison

| Feature | Default | Development | Testing | Production |
|---------|---------|-------------|---------|------------|
| Overwrite existing variables | No | Yes | Yes | No |
| Error on file not found | No | No | No | Yes |
| Audit logging | No | No | No | Yes |
| YAML syntax | No | Yes | No | No |
| File size limit | 2MB | 10MB | 64KB | 64KB |
| Max variables | 500 | 500 | 50 | 50 |
| Forbidden key check | Yes | Yes | Yes | Yes |
| Value validation | Yes | Yes | Yes | Yes |

:::tip Selection Guide
- **Development**: Use `DevelopmentConfig()` with relaxed limits for rapid iteration
- **Testing**: Use `TestingConfig()` with overwrite enabled for test isolation
- **Production**: Use `ProductionConfig()` with audit and strict validation enabled
:::

---

## Methods

### Validate

```go
func (c *Config) Validate() error
```

Validates configuration validity. Checks whether all limit values are within valid ranges.

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 1000

if err := cfg.Validate(); err != nil {
    // Configuration is invalid
}
```

**Validation Rules:**
- All limit values must be positive
- All limit values must not exceed hard maximums
- `KeyPattern` if non-nil must match valid key names (e.g., `TEST_KEY`), must not match empty strings, and must not match key names starting with digits
- `JSONMaxDepth` and `YAMLMaxDepth` must be between 1-100

---

### IsZero

```go
func (c *Config) IsZero() bool
```

Checks whether the Config is an uninitialized zero value. Used to determine whether `DefaultConfig()` should be used instead.

**Returns:**
- `bool` - Whether this is a zero-value configuration

**Detection Scope:**
- Numeric limits (MaxFileSize, MaxVariables, etc.)
- Boolean fields (ValidateValues, AutoApply, etc.)
- Pointer/interface fields (KeyPattern, FileSystem, etc.)
- Slice fields (Filenames, RequiredKeys, etc.)

:::warning Note
A partially initialized Config may not be detected as zero value. It is recommended to always start from `DefaultConfig()` for custom configuration:

```go
// Recommended
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}

// Not recommended (some fields are zero values)
var cfg env.Config
cfg.Filenames = []string{".env.production"}
```
:::

---

## Usage Examples

### Basic Configuration

```go
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env", ".env.local"}
cfg.OverwriteExisting = true

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()
```

### Production Configuration

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "DB_PORT", "API_KEY"}
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()

if err := loader.LoadFiles(".env"); err != nil {
    log.Fatal(err)
}

if err := loader.Validate(); err != nil {
    log.Fatal("Missing required configuration:", err)
}
```

### Prefix Filtering

```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_"  // Only load MYAPP_KEY1, MYAPP_KEY2, etc.
cfg.Filenames = []string{".env"}

loader, _ := env.New(cfg)
// loader contains only variables starting with MYAPP_
```

### Custom Validation

```go
import "regexp"

cfg := env.DefaultConfig()
// Only allow uppercase letters at the start
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
// Add custom forbidden keys
cfg.ForbiddenKeys = []string{"DEBUG", "TRACE"}

loader, _ := env.New(cfg)
```

---

## Related Documentation

- [Loader API](/en/env/api-reference/loader) - Loader methods
- [Constants & Errors](/en/env/api-reference/constants) - Limit constants and error types
- [Audit Logging](/en/env/guides/audit-logging) - Audit configuration guide

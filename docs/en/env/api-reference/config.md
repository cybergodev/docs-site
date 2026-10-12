---
sidebar_label: "Config"
title: "Config API - CyberGo env | Configuration Reference"
description: "Config API reference for CyberGo env: file loading options, size limits, key validation, JSON/YAML options, variable expansion, audit config, and presets."
sidebar_position: 4
---

# Config API

Complete configuration options reference for the `Config` struct.

## Struct Definition

Config uses nested structs to organize settings while maintaining backward compatibility through Go's field promotion:

```go
type Config struct {
    FileConfig       // File loading behavior
    ValidationConfig // Key and value validation
    LimitsConfig     // Size and count limits
    JSONConfig       // JSON parse options
    YAMLConfig       // YAML parse options
    ParsingConfig    // General parsing behavior
    ComponentConfig  // Custom components and advanced options
}
```

**Two access methods:**

```go
// Old way (via field promotion, still works)
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
    FailOnMissingFile bool     // Whether to error on missing file
    OverwriteExisting bool     // Whether to overwrite existing env vars
    AutoApply         bool     // Whether to auto-apply to os.Environ
}

// ValidationConfig controls key and value validation
type ValidationConfig struct {
    RequiredKeys   []string       // List of required key names
    AllowedKeys    []string       // Whitelist of allowed key names
    ForbiddenKeys  []string       // Additional forbidden keys list
    KeyPattern     *regexp.Regexp // Key name match pattern
    ValidateValues bool           // Whether to validate value safety
    ValidateUTF8   bool           // Whether to validate values as valid UTF-8
}

// LimitsConfig controls size and count limits
type LimitsConfig struct {
    MaxFileSize       int64 // Max bytes per file
    MaxVariables      int   // Max variables per file
    MaxLineLength     int   // Max single line length
    MaxKeyLength      int   // Max key name length
    MaxValueLength    int   // Max value length
    MaxExpansionDepth int   // Max variable expansion depth
}

// JSONConfig controls JSON parsing behavior
type JSONConfig struct {
    JSONNullAsEmpty    bool // null converts to empty string
    JSONNumberAsString bool // numbers convert to strings
    JSONBoolAsString   bool // booleans convert to strings
    JSONMaxDepth       int  // Max nesting depth
}

// YAMLConfig controls YAML parsing behavior
type YAMLConfig struct {
    YAMLNullAsEmpty    bool // null/~ converts to empty string
    YAMLNumberAsString bool // numbers convert to strings
    YAMLBoolAsString   bool // booleans convert to strings
    YAMLMaxDepth       int  // Max nesting depth
}

// ParsingConfig controls general parsing behavior
type ParsingConfig struct {
    AllowExportPrefix bool            // Allow export KEY=value syntax
    AllowYamlSyntax   bool            // Allow YAML-style values
    ExpandVariables   bool            // Whether to expand ${VAR} references
    ExpansionScope    ExpansionScope  // Scope from which ${VAR} references can be resolved
}

// ComponentConfig custom components and advanced options
type ComponentConfig struct {
    CustomValidator Validator        // Custom key/value validator
    CustomExpander  VariableExpander // Custom variable expander
    CustomAuditor   AuditLogger      // Custom audit logger
    FileSystem      FileSystem       // Custom filesystem (for testing)
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

Whether to return an error when a file doesn't exist. **Default `false`** (silent skip).

```go
cfg.FailOnMissingFile = true  // Error on missing file
```

---

#### `OverwriteExisting` bool

Whether to overwrite existing environment variables. **Default `false`**.

```go
cfg.OverwriteExisting = true  // Allow overwriting
```

---

#### `AutoApply` bool

Automatically apply to the system environment (`os.Environ`) after loading. **Default `false`**.

```go
cfg.AutoApply = true  // Auto-apply after loading
```

:::tip
The package-level `Load()` function automatically sets `AutoApply = true`. When using `New()` to create a Loader, you need to set it manually.
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
| `${VAR:-default}` | Use default if variable doesn't exist (uses original value if it exists even if empty) |
| `${VAR:=default}` | Same as `${VAR:-default}` (uses default if variable doesn't exist, does not write back to storage) |
| `${VAR:?error}` | Error if variable doesn't exist or is empty |

:::tip Empty-string handling
`${VAR:-default}` and `${VAR:=default}` use the default value only when the variable is **not set**; if the variable is explicitly set to an empty string (`VAR=`), the empty string original value is used. Only `${VAR:?error}` treats an empty string as an error. See [Variable Expansion](../guides/variable-expansion).
:::

### Security Limits

#### `MaxFileSize` int64

Maximum bytes per file. **Default 2MB**, hard limit 100MB.

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 MB
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxFileSize` | 2MB (2097152) | 100MB |

---

#### `MaxLineLength` int

Maximum length of a single line. **Default 1024**, hard limit 64KB.

```go
cfg.MaxLineLength = 2048
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxLineLength` | 1024 | 65536 (64KB) |

---

#### `MaxKeyLength` int

Maximum key name length. **Default 64**, hard limit 1024.

```go
cfg.MaxKeyLength = 128
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxKeyLength` | 64 | 1024 |

---

#### `MaxValueLength` int

Maximum value length. **Default 4096**, hard limit 1MB.

```go
cfg.MaxValueLength = 8192
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxValueLength` | 4096 | 1048576 (1MB) |

---

#### `MaxVariables` int

Maximum variables per file. **Default 500**, hard limit 10000.

```go
cfg.MaxVariables = 1000
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxVariables` | 500 | 10000 |

---

#### `MaxExpansionDepth` int

Maximum variable expansion depth. **Default 5**, hard limit 20.

```go
cfg.MaxExpansionDepth = 10
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxExpansionDepth` | 5 | 20 |

### Key Validation

#### `KeyPattern` *regexp.Regexp

Custom key name match pattern. **Default `nil`** (uses fast byte-level validation).

:::tip Performance
`nil` enables fast byte-level validation (about 10x performance improvement). Default validation rule: starts with a letter, contains only letters, numbers, and underscores.
:::

```go
import "regexp"

// Custom pattern
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
```

---

#### `AllowedKeys` []string

Whitelist of allowed key names. When empty, all keys are allowed (except forbidden keys).

```go
cfg.AllowedKeys = []string{"APP_NAME", "APP_VERSION", "PORT"}
```

---

#### `ForbiddenKeys` []string

Additional forbidden keys list (added to built-in forbidden keys).

```go
cfg.ForbiddenKeys = []string{"CUSTOM_DANGEROUS_VAR"}
```

:::tip Built-in forbidden keys
The library has built-in forbidden keys including `PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES` and other system-critical variables. See [Constants & Errors](./constants#defaultforbiddenkeys).
:::

---

#### `RequiredKeys` []string

List of required key names. Checked when `Validate()` is called.

```go
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
```

---

#### `ValidateValues` bool

Validate value safety (control characters, null bytes, etc.). **Default `true`**.

:::warning Security recommendations
It is recommended to keep this enabled. Disable only in special scenarios (e.g., when you need to store values containing control characters).
:::

```go
cfg.ValidateValues = true  // Enabled by default
```

---

#### `ValidateUTF8` bool

Validate that values are valid UTF-8 encoded. **Default `false`**.

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

Parse the **values** in .env files with YAML scalar semantics (`null`/`~` are treated as empty strings; YAML boolean and number literals are recognized per YAML rules). **Default `false`**.

```go
cfg.AllowYamlSyntax = true
```

:::tip
The `KEY: value` colon-separated form is **always available** (the line parser unconditionally accepts both `=` and `:` as separators) and is unrelated to this switch; this switch only affects YAML scalar semantics on the value side.
:::

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

:::tip
See [Audit Logging](../guides/audit-logging) for complete audit configuration documentation.
:::

### Advanced Options

#### `Prefix` string

Only process variables with this prefix. **Default `""`** (process all variables).

```go
cfg.Prefix = "MYAPP_"  // Only load variables starting with MYAPP_
```

---

#### `FileSystem` FileSystem

Custom filesystem interface (for testing).

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

Returns safe default configuration.

**Default values:**

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

**Differences from default config:**
- `OverwriteExisting`: `true`
- `AllowYamlSyntax`: `true`
- `MaxFileSize`: 10MB

:::tip Security guarantees
`ValidateValues` remains `true` in all preset configurations (consistent with the default), ensuring security regardless of environment.
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

**Differences from default config:**
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

**Differences from default config:**
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
| Overwrite existing variables | ✗ | ✓ | ✓ | ✗ |
| Error on missing file | ✗ | ✗ | ✗ | ✓ |
| Audit logging | ✗ | ✗ | ✗ | ✓ |
| YAML syntax | ✗ | ✓ | ✗ | ✗ |
| File size limit | 2MB | 10MB | 64KB | 64KB |
| Max variables | 500 | 500 | 50 | 50 |
| Forbidden key check | ✓ | ✓ | ✓ | ✓ |
| Value validation | ✓ | ✓ | ✓ | ✓ |

:::tip How to choose
- **Development**: Use `DevelopmentConfig()` with relaxed limits for fast iteration
- **Testing**: Use `TestingConfig()` with overwrite support for test isolation
- **Production**: Use `ProductionConfig()` with audit and strict validation
:::

---

## Methods

### Validate

```go
func (c *Config) Validate() error
```

Validates configuration validity. Checks that all limit values are within valid ranges.

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 1000

if err := cfg.Validate(); err != nil {
    // configuration invalid
}
```

**Validation rules:**
- All limit values must be positive
- All limit values must not exceed hard limits
- If `KeyPattern` is non-nil, it must match a valid key name (e.g., `TEST_KEY`), must not match empty string, and must not match keys starting with a digit
- `JSONMaxDepth` and `YAMLMaxDepth` must be between 1-100

---

### IsZero

```go
func (c *Config) IsZero() bool
```

Checks whether the Config is an uninitialized zero value. Used to determine whether `DefaultConfig()` should be used.

**Returns:**
- `bool` - whether it's a zero-value configuration

**Detection scope:**
- Numeric limits (MaxFileSize, MaxVariables, etc.)
- Boolean fields (ValidateValues, AutoApply, etc.)
- Pointer/interface fields (KeyPattern, FileSystem, etc.)
- Slice fields (Filenames, RequiredKeys, etc.)

:::warning
A partially initialized Config may not be detected as zero value. Always start customizing from `DefaultConfig()`:

```go
// Recommended
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}

// Not recommended (some fields will be zero)
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

### Using Prefix Filtering

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
// Only allow uppercase letter prefix
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
// Add custom forbidden keys
cfg.ForbiddenKeys = []string{"DEBUG", "TRACE"}

loader, _ := env.New(cfg)
```

---

## Preset Comparison and Configuration Pitfalls

### Full differences among the four presets

| Option | Default | Development | Testing | Production |
|--------|---------|-------------|---------|------------|
| `FailOnMissingFile` | false | false | false | **true** |
| `OverwriteExisting` | false | **true** | **true** | false |
| `ValidateValues` | true | true | true | true |
| `AllowExportPrefix` | true | true | true | true |
| `AllowYamlSyntax` | false | **true** | false | false |
| `ExpandVariables` | true | true | true | true |
| `MaxFileSize` | 2 MB | 10 MB | 64 KB | 64 KB |
| `MaxVariables` | 500 | 500 | 50 | 50 |
| `JSONMaxDepth`/`YAMLMaxDepth` | 10 | 10 | 10 | 10 |
| `AuditEnabled` | false | false | false | **true** |

Key point: `DevelopmentConfig` relaxes **convenience** (overwriting, YAML syntax, file size) — value validation stays on in every preset; no preset ever sacrifices injection protection.

### Key DefaultConfig values

| Item | Default |
|------|---------|
| Key pattern | Built-in byte-level validation (equivalent to `^[A-Za-z][A-Za-z0-9_]*$`) |
| `ValidateValues` | true |
| `JSONNullAsEmpty`/`JSONNumberAsString`/`JSONBoolAsString` | true |
| `ExpandVariables` | true (scope `ExpansionFileThenProcess`) |
| `Prefix` | empty (no filtering) |

### The IsZero pitfall: always start from DefaultConfig()

`New()` automatically applies `DefaultConfig()` to a **zero-valued** Config. `IsZero()` decides based on "are the common default fields all zero" — a Config with only a few fields set is not misjudged as zero, but the rule depends on the field inventory, and **assigning fields one by one from a zero struct** easily hits edge cases. The recommended pattern is always:

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig() // modify on top of complete defaults
cfg.Filenames = []string{".env.production"}
cfg.OverwriteExisting = true
```

### KeyPattern security probes (SEC-06)

A custom `KeyPattern` is probed four ways by `Config.Validate()`; failing any probe rejects the configuration:

1. It must match a valid key (e.g. `TEST_KEY`)
2. It must reject the empty string
3. It must reject keys starting with a digit (e.g. `123_INVALID`)
4. It must reject keys containing `=`, `:`, newlines, or control characters — preventing keys that carry separators from re-parsing into **different lines** after a serialization round-trip (round-trip injection)

### ExpansionScope

`ExpansionScope` is an int enum that controls which scopes `${VAR}`/`$VAR` references in values can resolve against (configured via the `ParsingConfig.ExpansionScope` field):

```go
type ExpansionScope int

const (
    ExpansionFileThenProcess ExpansionScope = iota // zero value (default)
    ExpansionFileOnly                              // file-defined variables only
)
```

| Constant | Semantics |
|----------|-----------|
| `ExpansionFileThenProcess` | Zero value (default). Resolves against file-defined variables first, then falls back to the process environment (`os.LookupEnv`), matching traditional dotenv semantics |
| `ExpansionFileOnly` | Only file-defined variables are visible; references that exist only in the process environment expand to the empty string. For untrusted config files (SEC-03): stops `${VAR}` references from reading the process environment and capturing unrelated process secrets (cloud credentials, tokens) into values |

For the attack-scenario analysis and configuration examples, see the ["Expansion Scope" section of the variable expansion guide](../guides/variable-expansion).

## Related Documentation

- [Loader API](./loader) - Loader methods
- [Constants & Errors](./constants) - Limit constants and error types
- [Audit Logging](../guides/audit-logging) - Audit configuration guide

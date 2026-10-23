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
    DuplicateKeyPolicy DuplicateKeyPolicy // In-document duplicate-key resolution policy
}

// ComponentConfig custom components and advanced options
type ComponentConfig struct {
    CustomValidator Validator        // Custom key/value validator
    CustomExpander  VariableExpander // Custom variable expander
    CustomAuditor   AuditLogger      // Custom audit logger
    FileSystem      FileSystem       // Custom filesystem (for testing)
    AuditHandler    AuditHandler     // Custom audit handler
    AuditEnabled    bool             // Enable audit logging
    AuditFailClosed  bool             // Fail the operation when an audit event is lost
    Prefix          string           // Only process variables with this prefix
}
```

### Field Quick Reference (Qualified Names)

The seven embedded sections are exposed as `Config.FileConfig`, `Config.ValidationConfig`, `Config.LimitsConfig`, `Config.JSONConfig`, `Config.YAMLConfig`, `Config.ParsingConfig`, and `Config.ComponentConfig`. The tables below list every field's qualified name, default, and a one-line summary; see the corresponding subsection under "Configuration Fields" for full semantics.

**`FileConfig` (file loading)**

| Field | Default | Description |
|-------|---------|-------------|
| `FileConfig.Filenames` | `[".env"]` | List of files to load |
| `FileConfig.FailOnMissingFile` | `false` | Error on missing file (otherwise skip silently) |
| `FileConfig.OverwriteExisting` | `false` | Whether to overwrite existing variables |
| `FileConfig.AutoApply` | `false` | Auto-apply to the process environment after loading |

**`ValidationConfig` (key/value validation)**

| Field | Default | Description |
|-------|---------|-------------|
| `ValidationConfig.RequiredKeys` | `nil` | Required keys, checked by `Validate` |
| `ValidationConfig.AllowedKeys` | `nil` | Key whitelist (empty = allow all) |
| `ValidationConfig.ForbiddenKeys` | `nil` | Extra forbidden keys (merged with the built-in list) |
| `ValidationConfig.KeyPattern` | `nil` | Custom key regexp (nil = fast byte-level validation) |
| `ValidationConfig.ValidateValues` | `true` | Value safety checks (control chars, null bytes, ...) |
| `ValidationConfig.ValidateUTF8` | `false` | Value UTF-8 validity check |

**`LimitsConfig` (size and count limits)**

| Field | Default | Description |
|-------|---------|-------------|
| `LimitsConfig.MaxFileSize` | 8MB | Max bytes per file (hard cap 100MB) |
| `LimitsConfig.MaxVariables` | 1000 | Max variables per file (hard cap 10000) |
| `LimitsConfig.MaxLineLength` | 8192 | Max line length (hard cap 64KB; enforced for all formats) |
| `LimitsConfig.MaxKeyLength` | 128 | Max key length (hard cap 1024) |
| `LimitsConfig.MaxValueLength` | 8192 | Max value length (hard cap 1MB) |
| `LimitsConfig.MaxExpansionDepth` | 5 | Max expansion depth (hard cap 20) |

**`JSONConfig` (JSON parsing)**

| Field | Default | Description |
|-------|---------|-------------|
| `JSONConfig.JSONNullAsEmpty` | `true` | `null` becomes an empty string |
| `JSONConfig.JSONNumberAsString` | `true` | Numbers render as canonical decimal strings |
| `JSONConfig.JSONBoolAsString` | `true` | Retained for symmetry only; no effect on JSON output |
| `JSONConfig.JSONMaxDepth` | 16 | Max nesting depth (valid range 1–100) |

**`YAMLConfig` (YAML parsing)**

| Field | Default | Description |
|-------|---------|-------------|
| `YAMLConfig.YAMLNullAsEmpty` | `true` | `null`/`~` becomes an empty string |
| `YAMLConfig.YAMLNumberAsString` | `true` | Number-like scalars canonicalized (`007` → `7`) |
| `YAMLConfig.YAMLBoolAsString` | `true` | Booleans convert to strings (rejected when off) |
| `YAMLConfig.YAMLMaxDepth` | 16 | Max nesting depth (valid range 1–100) |

**`ParsingConfig` (.env parsing behavior)**

| Field | Default | Description |
|-------|---------|-------------|
| `ParsingConfig.AllowExportPrefix` | `true` | Allow `export KEY=value` syntax |
| `ParsingConfig.AllowYamlSyntax` | `false` | Parse .env values with YAML scalar semantics |
| `ParsingConfig.ExpandVariables` | `true` | Enable `${VAR}` expansion (.env only) |
| `ParsingConfig.ExpansionScope` | `ExpansionFileOnly` | Visible scope for expansion references |
| `ParsingConfig.DuplicateKeyPolicy` | `DuplicateKeyInherit` | In-document duplicate-key policy |

**`ComponentConfig` (components and advanced options)**

| Field | Default | Description |
|-------|---------|-------------|
| `ComponentConfig.CustomValidator` | `nil` | Custom key/value validator |
| `ComponentConfig.CustomExpander` | `nil` | Custom variable expander |
| `ComponentConfig.CustomAuditor` | `nil` | Custom audit logger |
| `ComponentConfig.FileSystem` | `nil` | Custom filesystem (nil = `DefaultFileSystem`) |
| `ComponentConfig.AuditHandler` | `nil` | Audit event handler |
| `ComponentConfig.AuditEnabled` | `false` | Enable audit logging |
| `ComponentConfig.AuditFailClosed` | `false` | Fail operations when audit events are lost |
| `ComponentConfig.Prefix` | `""` | Only process variables with this prefix (ASCII case-insensitive) |

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
| `${VAR:=default}` | Same as `${VAR:-default}` (uses default if variable doesn't exist, and assigns the default back to the variable) |
| `${VAR:?error}` | Error if variable doesn't exist or is empty |

:::tip Empty-string handling
`${VAR:-default}` and `${VAR:=default}` use the default value only when the variable is **not set**; if the variable is explicitly set to an empty string (`VAR=`), the empty string original value is used. Only `${VAR:?error}` treats an empty string as an error. See [Variable Expansion](../guides/variable-expansion).
:::

### Security Limits

#### `MaxFileSize` int64

Maximum bytes per file. **Default 8MB**, hard limit 100MB.

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 MB
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxFileSize` | 8MB (8388608) | 100MB |

---

#### `MaxLineLength` int

Maximum length of a single line. **Default 8192**, hard limit 64KB. Enforced for **all formats** (including JSON/YAML): a minified single-line JSON document counts as one line and must fit within this limit — the 64KB hard cap cannot be exceeded by config alone; pretty-print the document instead.

```go
cfg.MaxLineLength = 2048
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxLineLength` | 8192 | 65536 (64KB) |

---

#### `MaxKeyLength` int

Maximum key name length. **Default 128**, hard limit 1024.

```go
cfg.MaxKeyLength = 128
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxKeyLength` | 128 | 1024 |

---

#### `MaxValueLength` int

Maximum value length. **Default 8192**, hard limit 1MB.

```go
cfg.MaxValueLength = 8192
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxValueLength` | 8192 | 1048576 (1MB) |

---

#### `MaxVariables` int

Maximum variables per file. **Default 1000**, hard limit 10000.

```go
cfg.MaxVariables = 1000
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxVariables` | 1000 | 10000 |

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

Render JSON numbers as canonical decimal strings (`8080`, `0.5`). **Default `true`**. When disabled, numbers still load but render with Go's default float formatting (1e21 becomes `1e+21`) — numbers are never rejected under either setting.

```go
cfg.JSONNumberAsString = true
```

---

#### `JSONBoolAsString` bool

Retained for symmetry with `YAMLBoolAsString` and has **no effect on JSON output**: a decoded JSON bool carries no raw source text to preserve, so JSON booleans always render the canonical `true`/`false`. Do not rely on it to gate JSON bool handling. **Default `true`**.

```go
cfg.JSONBoolAsString = true
```

---

#### `JSONMaxDepth` int

Maximum JSON nesting depth. **Default 16**.

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

Canonicalize number-looking YAML scalars (`007` becomes `7`). **Default `true`**. When disabled, scalars are kept verbatim as written; values are never rejected under either setting.

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

Maximum YAML nesting depth. **Default 16**.

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

#### `AuditFailClosed` bool

When auditing is enabled, a lost audit event (handler error, handler panic, or an event dropped on a full channel) makes the operation that emitted it return an error (matching `ErrAuditFailed`) from `LoadFiles`/`Apply`/`Set`/`Delete` instead of being silently discarded. The built-in auditor latches the first failure; a custom `CustomAuditor` participates by implementing `TakeFailure() error`. Defaults to `false` (fail-open — operation results never depend on the audit pipeline).

```go
cfg := env.ProductionConfig()
cfg.AuditFailClosed = true // a lost audit event fails the operation that emitted it with ErrAuditFailed
```

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
| `MaxFileSize` | 8MB |
| `MaxLineLength` | 8192 |
| `MaxKeyLength` | 128 |
| `MaxValueLength` | 8192 |
| `MaxVariables` | 1000 |
| `MaxExpansionDepth` | 5 |
| `ValidateValues` | `true` |
| `KeyPattern` | `nil` (fast validation) |
| `AllowExportPrefix` | `true` |
| `AllowYamlSyntax` | `false` |
| `JSONNullAsEmpty` | `true` |
| `JSONNumberAsString` | `true` |
| `JSONBoolAsString` | `true` |
| `JSONMaxDepth` | 16 |
| `YAMLNullAsEmpty` | `true` |
| `YAMLNumberAsString` | `true` |
| `YAMLBoolAsString` | `true` |
| `YAMLMaxDepth` | 16 |
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
| File size limit | 8MB | 10MB | 64KB | 64KB |
| Max variables | 1000 | 1000 | 50 | 50 |
| Forbidden key check | ✓ | ✓ | ✓ | ✓ |
| Value validation | ✓ | ✓ | ✓ | ✓ |

:::tip How to choose
- **Development**: Use `DevelopmentConfig()` with relaxed limits for fast iteration
- **Testing**: Use `TestingConfig()` with overwrite support for test isolation
- **Production**: Use `ProductionConfig()` with audit and strict validation
:::

---

## Methods

Config provides two methods: `Config.Validate` and `Config.IsZero`.

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
| `MaxFileSize` | 8 MB | 10 MB | 64 KB | 64 KB |
| `MaxVariables` | 1000 | 1000 | 50 | 50 |
| `JSONMaxDepth`/`YAMLMaxDepth` | 16 | 16 | 16 | 16 |
| `AuditEnabled` | false | false | false | **true** |

Key point: `DevelopmentConfig` relaxes **convenience** (overwriting, YAML syntax, file size) — value validation stays on in every preset; no preset ever sacrifices injection protection.

### Key DefaultConfig values

| Item | Default |
|------|---------|
| Key pattern | Built-in byte-level validation (equivalent to `^[A-Za-z][A-Za-z0-9_]*$`) |
| `ValidateValues` | true |
| `JSONNullAsEmpty`/`JSONNumberAsString`/`JSONBoolAsString` | true |
| `ExpandVariables` | true (scope `ExpansionFileOnly`) |
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
    ExpansionFileThenProcess ExpansionScope = iota // enum zero value (not the runtime default)
    ExpansionFileOnly                              // file-defined variables only (DefaultConfig default)
)
```

| Constant | Semantics |
|----------|-----------|
| `ExpansionFileThenProcess` | Enum zero value (`iota`). Resolves against file-defined variables first, then falls back to the process environment (`os.LookupEnv`), matching traditional dotenv semantics. **Effective only when set explicitly** — `DefaultConfig()` does not use it |
| `ExpansionFileOnly` | Only file-defined variables are visible; references that exist only in the process environment expand to the empty string. The `DefaultConfig()` default (SEC-03): stops `${VAR}` references from reading the process environment and capturing unrelated process secrets (cloud credentials, tokens) into values |

For the attack-scenario analysis and configuration examples, see the ["Expansion Scope" section of the variable expansion guide](../guides/variable-expansion).

### DuplicateKeyPolicy (in-document duplicate keys)

`DuplicateKeyPolicy` is an int enum that controls how duplicate keys **within a single source document** are resolved (configured via `ParsingConfig.DuplicateKeyPolicy`):

```go
type DuplicateKeyPolicy = internal.DuplicateKeyPolicy

const (
    DuplicateKeyInherit   // zero value (default): each format's historical behavior
    DuplicateKeyFirstWins // .env/YAML keeps the first occurrence
    DuplicateKeyLastWins  // every format keeps the last occurrence
    DuplicateKeyError     // any duplicate key errors (errors.Is matches ErrDuplicateKey)
)
```

| Constant | Semantics |
|----------|-----------|
| `DuplicateKeyInherit` | Zero value (default). `.env` follows `OverwriteExisting` (first wins when false / last wins when true); YAML keeps the last occurrence; JSON keeps the last occurrence (`encoding/json` decode order) |
| `DuplicateKeyFirstWins` | `.env` and YAML keep the first occurrence. JSON data (including inline JSON inside YAML) whose duplicates are detected by the same pre-scan `DuplicateKeyError` uses is rejected — `encoding/json` discards earlier occurrences, so the policy cannot be honored for it; JSON documents without duplicates load unchanged |
| `DuplicateKeyLastWins` | Every format keeps the last occurrence, independent of `OverwriteExisting` |
| `DuplicateKeyError` | Any duplicate key in the same object/mapping (or the same `.env` file) errors, matching `ErrDuplicateKey` via `errors.Is`. JSON data is scanned conservatively by raw key bytes; keys spelled with different escape sequences are not detected and fall back to last-wins |

**Two related behaviors NOT governed by this policy:**

- **Cross-file merging** follows file order and `OverwriteExisting` (default false = first wins, true = later files override).
- **Flat-key collisions always error**: when two different source paths collapse onto the same flattened key in YAML/JSON (e.g. `a_b: 1` next to `a: {b: 2}`, or a literal `a_0` next to an array `a`), the error matches `ErrDuplicateKey` via `errors.Is`.

```go
cfg := env.DefaultConfig()
cfg.DuplicateKeyPolicy = env.DuplicateKeyError // reject duplicate keys
```

Case note: YAML/JSON keys are uppercased when flattened, while `.env` keys are stored as written — so keys differing only in case (a `.env` `db_host` and a YAML `db: {host: ...}` → `DB_HOST`) do not collide and coexist in the store.

`DuplicateKeyPolicy.String` returns a human-readable name for the policy: `inherit`, `first-wins`, `last-wins`, or `error` (unknown values return `unknown`).

## Related Documentation

- [Loader API](./loader) - Loader methods
- [Constants & Errors](./constants) - Limit constants and error types
- [Audit Logging](../guides/audit-logging) - Audit configuration guide

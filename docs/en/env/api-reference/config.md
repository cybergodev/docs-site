---
sidebar_label: "Config"
title: "Config API - CyberGo env | Configuration Reference"
description: "Config API reference for CyberGo env: file loading options, size limits, key validation, JSON/YAML options, variable expansion, audit config, and presets."
sidebar_position: 4
---

# Config API

`Config` is the single settings struct for a `Loader`: which files to load, the size and count limits, key and value validation, format options, variable expansion, and audit wiring.

## Struct Definition

`Config` uses nested structs so related settings stay grouped, while Go's field promotion keeps flat access working:

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

**Two ways to set a field:**

```go
// Promoted access — still supported
cfg.Filenames = []string{".env"}
cfg.MaxFileSize = 1024

// Qualified access — recommended, shows which section owns the field
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
    JSONNumberAsString bool // numbers render as canonical decimal strings
    JSONBoolAsString   bool // no effect; kept for symmetry with YAMLBoolAsString (Deprecated)
    JSONMaxDepth       int  // Max nesting depth
}

// YAMLConfig controls YAML parsing behavior
type YAMLConfig struct {
    YAMLNullAsEmpty    bool // null/~ converts to empty string
    YAMLNumberAsString bool // number-like scalars are canonicalized (007 becomes 7)
    YAMLBoolAsString   bool // booleans render as canonical true/false
    YAMLMaxDepth       int  // Max nesting depth
}

// ParsingConfig controls general parsing behavior
type ParsingConfig struct {
    AllowExportPrefix bool            // Allow export KEY=value syntax
    AllowYamlSyntax   bool            // Allow ':' as a separator and parse values as YAML scalars
    ExpandVariables   bool            // Whether to expand ${VAR} references
    ExpansionScope    ExpansionScope  // Scope from which ${VAR} references can be resolved
    DuplicateKeyPolicy DuplicateKeyPolicy // In-document duplicate-key resolution policy
}

// ComponentConfig custom components and advanced options
type ComponentConfig struct {
    CustomValidator Validator        // Custom key/value validator
    CustomExpander  VariableExpander // Custom variable expander
    CustomAuditor   AuditLogger      // Custom audit logger
    FileSystem      FileSystem       // Filesystem implementation (inject a mock in tests)
    AuditHandler    AuditHandler     // Custom audit handler
    AuditEnabled    bool             // Enable audit logging
    AuditFailClosed  bool             // Fail the operation when an audit event is lost
    Prefix          string           // Only process variables with this prefix
}
```

### Field Quick Reference (Qualified Names)

Each of the seven embedded sections supplies its own group of qualified field names, with the prefixes below. The tables that follow list every field's qualified name, its default, and a one-line summary. For full semantics, see the matching subsection under "Configuration Fields".

| Section | Prefix |
|---------|--------|
| File loading | `Config.FileConfig` |
| Key/value validation | `Config.ValidationConfig` |
| Size and count limits | `Config.LimitsConfig` |
| JSON parsing | `Config.JSONConfig` |
| YAML parsing | `Config.YAMLConfig` |
| General parsing | `Config.ParsingConfig` |
| Components and advanced options | `Config.ComponentConfig` |

**`FileConfig` (file loading)**

| Field | Default | Description |
|-------|---------|-------------|
| `FileConfig.Filenames` | `[".env"]` | List of files to load |
| `FileConfig.FailOnMissingFile` | `false` | Error on a missing file (otherwise skip it silently) |
| `FileConfig.OverwriteExisting` | `false` | Whether to overwrite an existing variable |
| `FileConfig.AutoApply` | `false` | Apply to the process environment after loading |

**`ValidationConfig` (key/value validation)**

| Field | Default | Description |
|-------|---------|-------------|
| `ValidationConfig.RequiredKeys` | `nil` | Required keys, checked by `Validate` and at the end of every parse (per file: all required keys must be satisfied in a single file) |
| `ValidationConfig.AllowedKeys` | `nil` | Key whitelist; empty allows every key |
| `ValidationConfig.ForbiddenKeys` | `nil` | Extra forbidden keys, merged with the built-in list |
| `ValidationConfig.KeyPattern` | `nil` | Custom key regexp; `nil` selects fast byte-level validation |
| `ValidationConfig.ValidateValues` | `true` | Value safety checks: control characters, null bytes, and similar |
| `ValidationConfig.ValidateUTF8` | `false` | Check that values are valid UTF-8 |

**`LimitsConfig` (size and count limits)**

| Field | Default | Description |
|-------|---------|-------------|
| `LimitsConfig.MaxFileSize` | 8 MB | Max bytes per file (hard cap 100 MB) |
| `LimitsConfig.MaxVariables` | 1000 | Max variables per file (hard cap 10000) |
| `LimitsConfig.MaxLineLength` | 8192 | Max line length (hard cap 64 KB; applies to every format) |
| `LimitsConfig.MaxKeyLength` | 128 | Max key length (hard cap 1024) |
| `LimitsConfig.MaxValueLength` | 8192 | Max value length (hard cap 1 MB) |
| `LimitsConfig.MaxExpansionDepth` | 5 | Max expansion depth (hard cap 20) |

**`JSONConfig` (JSON parsing)**

| Field | Default | Description |
|-------|---------|-------------|
| `JSONConfig.JSONNullAsEmpty` | `true` | `null` becomes an empty string |
| `JSONConfig.JSONNumberAsString` | `true` | Numbers render as canonical decimal strings |
| `JSONConfig.JSONBoolAsString` | `false` | Kept for symmetry with `YAMLBoolAsString`; no effect on JSON output (marked Deprecated) |
| `JSONConfig.JSONMaxDepth` | 16 | Max nesting depth (valid range 1–100) |

**`YAMLConfig` (YAML parsing)**

| Field | Default | Description |
|-------|---------|-------------|
| `YAMLConfig.YAMLNullAsEmpty` | `true` | `null`/`~` becomes an empty string |
| `YAMLConfig.YAMLNumberAsString` | `true` | Number-like scalars are canonicalized (`007` → `7`) |
| `YAMLConfig.YAMLBoolAsString` | `true` | Booleans render as canonical `true`/`false` (when off, the source spelling is kept) |
| `YAMLConfig.YAMLMaxDepth` | 16 | Max nesting depth (valid range 1–100) |

**`ParsingConfig` (general parsing)**

| Field | Default | Description |
|-------|---------|-------------|
| `ParsingConfig.AllowExportPrefix` | `true` | Allow `export KEY=value` syntax |
| `ParsingConfig.AllowYamlSyntax` | `false` | Parse `.env` lines with YAML semantics: `:` also separates key and value, and values follow YAML scalar rules |
| `ParsingConfig.ExpandVariables` | `true` | Enable `${VAR}` expansion (`.env` input only) |
| `ParsingConfig.ExpansionScope` | `ExpansionFileOnly` | Which sources expansion references can resolve against |
| `ParsingConfig.DuplicateKeyPolicy` | `DuplicateKeyInherit` | In-document duplicate-key policy |

**`ComponentConfig` (components and advanced options)**

| Field | Default | Description |
|-------|---------|-------------|
| `ComponentConfig.CustomValidator` | `nil` | Custom key/value validator |
| `ComponentConfig.CustomExpander` | `nil` | Custom variable expander |
| `ComponentConfig.CustomAuditor` | `nil` | Custom audit logger |
| `ComponentConfig.FileSystem` | `nil` | Filesystem implementation; `nil` means `DefaultFileSystem` |
| `ComponentConfig.AuditHandler` | `nil` | Audit event handler |
| `ComponentConfig.AuditEnabled` | `false` | Turn audit logging on |
| `ComponentConfig.AuditFailClosed` | `false` | Fail the operation when an audit event is lost |
| `ComponentConfig.Prefix` | `""` | Process only variables with this prefix (ASCII case-insensitive) |

## Configuration Fields

### File Loading

These fields control file loading behavior.

#### `Filenames` []string

List of file paths to load. **Default `[".env"]`**.

```go
cfg.Filenames = []string{".env", ".env.local"}
```

---

#### `FailOnMissingFile` bool

Whether a missing file is an error. **Default `false`**, which skips the file silently.

```go
cfg.FailOnMissingFile = true  // Error on missing file
```

---

#### `OverwriteExisting` bool

Whether a value from a file or from `Set` may replace an existing variable. **Default `false`**, which keeps the first value.

```go
cfg.OverwriteExisting = true  // Allow overwriting
```

---

#### `AutoApply` bool

Applies the loaded variables to the process environment (`os.Environ`) after loading. **Default `false`**.

```go
cfg.AutoApply = true  // Auto-apply after loading
```

:::tip
`Load()` sets `AutoApply = true` automatically. When you create the loader with `New()`, set it yourself.
:::

### Variable Expansion

#### `ExpandVariables` bool

Enables `${VAR}` expansion. **Default `true`**. Applies to `.env` input only; JSON and YAML values are never expanded.

```go
cfg.ExpandVariables = true
```

Supported expansion syntax:

| Syntax | Description |
|--------|-------------|
| `${VAR}` | Reference a variable |
| `${VAR:-default}` | Use the default if the variable is not set; keep the original value if it exists, even when empty |
| `${VAR:=default}` | Use the default if the variable is not set, and assign that default back to the variable |
| `${VAR:?error}` | Error if variable doesn't exist or is empty |

:::tip Empty-string handling
`${VAR:-default}` and `${VAR:=default}` use the default value only when the variable is **not set**.

If the variable is explicitly set to an empty string (`VAR=`), that empty string is the value. Only `${VAR:?error}` treats an empty string as an error. See [Variable Expansion](../guides/variable-expansion).
:::

### Security Limits

#### `MaxFileSize` int64

Maximum bytes per file. **Default 8 MB** (8388608 bytes), hard limit 100 MB.

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 MB
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxFileSize` | 8 MB (8388608 bytes) | 100 MB |

---

#### `MaxLineLength` int

Maximum length of a single line. **Default 8192**, hard limit 64 KB.

The limit applies to **all formats**, including JSON and YAML, because a minified single-line JSON document counts as one line. You cannot raise the 64 KB hard cap: `Validate()` rejects any higher value. Pretty-print the document instead.

```go
cfg.MaxLineLength = 2048
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxLineLength` | 8192 | 65536 (64 KB) |

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

Maximum value length. **Default 8192**, hard limit 1 MB.

```go
cfg.MaxValueLength = 8192
```

| Setting | Default | Hard Limit |
|---------|---------|------------|
| `MaxValueLength` | 8192 | 1048576 (1 MB) |

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

Regexp every key name must match. **Default `nil`**, which uses fast byte-level validation instead.

:::tip Performance
`nil` selects fast byte-level validation (see [Constants & Errors](./constants#defaultkeypattern)). The default rule accepts a key that starts with a letter and contains only letters, digits, and underscores.

`Config.Validate()` runs a custom pattern through probes; the rules are in "KeyPattern security probes" below.
:::

```go
import "regexp"

// Custom pattern
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
```

---

#### `AllowedKeys` []string

Whitelist of allowed key names. An empty list allows every key except the forbidden ones.

```go
cfg.AllowedKeys = []string{"APP_NAME", "APP_VERSION", "PORT"}
```

---

#### `ForbiddenKeys` []string

Extra forbidden keys, added to the built-in list.

```go
cfg.ForbiddenKeys = []string{"CUSTOM_DANGEROUS_VAR"}
```

:::tip Built-in forbidden keys
The library already forbids system-critical variables such as `PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, and `DYLD_INSERT_LIBRARIES`. See [Constants & Errors](./constants#defaultforbiddenkeys) for the full list.
:::

---

#### `RequiredKeys` []string

List of required key names. Checked by `Validate()` and at the end of every parse, so `LoadFiles` and `New` reject a missing required key immediately. **Default `nil`** (no check). Key names are compared in uppercase.

The check runs at the **end of each file's parse**, so every required key must be satisfiable in a single file; do not split them across multiple files.

```go
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
```

---

#### `ValidateValues` bool

Validate value safety: control characters, null bytes, and similar. **Default `true`**.

With the built-in validator this switch no longer turns validation off: the baseline checks (maximum value length, control-character rejection, and the UTF-8 check when `ValidateUTF8` is on) run on every write path, matching the `.env` line parser. Setting it to `false` still rejects values containing control characters. The switch remains effective for **custom validators that do not implement the baseline capability** — those skip value validation entirely when it is off.

:::warning Security recommendations
Keep it `true`. With a custom validator that lacks the baseline capability, turning it off means giving up value validation.
:::

```go
cfg.ValidateValues = true  // Enabled by default
```

---

#### `ValidateUTF8` bool

Validate that every value is valid UTF-8. **Default `false`**.

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

Parse `.env` lines with YAML semantics. Two things change:

- `:` separates key from value, in addition to `=`.
- A value that is a YAML null literal (`null`, `Null`, `NULL`) or `~` becomes an empty string. Boolean and number literals are recognized as scalars and kept as written.

**Default `false`.** With the flag off, only `=` separates, so a `KEY: value` line is skipped (and audited when auditing is on).

```go
cfg.AllowYamlSyntax = true
```

:::tip What changes in practice
`DB_HOST=localhost` parses under both settings.

With the flag off, `DB_HOST: localhost` is dropped. With it on, the same line yields key `DB_HOST` and value `localhost`, and `TOKEN=null` yields an empty string instead of the text `null`.
:::

### JSON Options

#### `JSONNullAsEmpty` bool

Convert JSON `null` values to empty strings. **Default `true`**.

```go
cfg.JSONNullAsEmpty = true
```

---

#### `JSONNumberAsString` bool

Render JSON numbers as canonical decimal strings (`8080`, `0.5`). **Default `true`**.

When disabled, numbers still load, but they render with Go's default float formatting: `1e21` becomes `1e+21`. Neither setting rejects a number.

```go
cfg.JSONNumberAsString = true
```

---

#### `JSONBoolAsString` bool

Retained for symmetry with `YAMLBoolAsString`. The field has **no effect on JSON output**: a decoded JSON bool carries no raw source text, so JSON booleans always render as the canonical `true`/`false`. **Default `false`**; the field is marked Deprecated.

```go
cfg.JSONBoolAsString = false
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

Canonicalize number-looking YAML scalars, so `007` becomes `7`. **Default `true`**.

When disabled, scalars are kept exactly as written. Neither setting rejects a value.

```go
cfg.YAMLNumberAsString = true
```

---

#### `YAMLBoolAsString` bool

Render YAML booleans as canonical lowercase strings (`true`/`false`). **Default `true`**. When disabled, the boolean keeps the spelling used in the source (`TRUE` stays `TRUE`).

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

Turns audit logging on. **Default `false`**.

```go
cfg.AuditEnabled = true
```

---

#### `AuditHandler` AuditHandler

Custom audit handler. Note that `loader.Close()` closes the handler, and `JSONAuditHandler` also closes the underlying writer, so do not pass `os.Stdout` or a writer you still need.

```go
auditFile, err := os.OpenFile("audit.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
if err != nil {
    log.Fatal(err)
}
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
```

:::tip
See [Audit Logging](../guides/audit-logging) for the full set of audit options.
:::

#### `AuditFailClosed` bool

When auditing is enabled, `AuditFailClosed` decides what a lost audit event does to the operation that emitted it. A lost event is any of these:

- a handler error
- a handler panic
- an event dropped on a full channel

The flag then has two settings:

- `false` (default, fail-open): the operation still succeeds. Its result never depends on the audit pipeline.
- `true` (fail-closed): `LoadFiles`, `Apply`, `Set`, and `Delete` return an error matching `ErrAuditFailed`.

The built-in auditor latches the first failure. A custom `CustomAuditor` joins in by implementing `TakeFailure() error`.

```go
cfg := env.ProductionConfig()
cfg.AuditFailClosed = true // a lost audit event fails the operation that emitted it with ErrAuditFailed
```

### Advanced Options

#### `Prefix` string

On file loads, keep only variables whose key starts with this prefix. The match is ASCII case-insensitive. **Default `""`**, which keeps every variable. `Set` and `Delete` are not affected.

```go
cfg.Prefix = "MYAPP_"  // Only load variables starting with MYAPP_
```

---

#### `FileSystem` FileSystem

Filesystem implementation the loader reads through. Use it to inject an in-memory filesystem in tests.

```go
cfg.FileSystem = &MockFileSystem{}
```

---

#### `CustomValidator` Validator

Custom key/value validator. Replaces the built-in validator.

```go
cfg.CustomValidator = &MyValidator{}
```

---

#### `CustomExpander` VariableExpander

Custom variable expander. Replaces the built-in expander.

```go
cfg.CustomExpander = &MyExpander{}
```

---

#### `CustomAuditor` AuditLogger

Custom audit logger. Replaces the built-in auditor.

```go
cfg.CustomAuditor = &MyAuditLogger{}
```

---

## Factory Functions

### DefaultConfig

```go
func DefaultConfig() Config
```

Returns the default, security-oriented configuration.

**Default values:**

| Field | Value |
|-------|-------|
| `Filenames` | `[".env"]` |
| `FailOnMissingFile` | `false` |
| `OverwriteExisting` | `false` |
| `AutoApply` | `false` |
| `ExpandVariables` | `true` |
| `MaxFileSize` | 8 MB |
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
| `JSONBoolAsString` | `false` (marked Deprecated; no effect on JSON output) |
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

Returns the development configuration, with relaxed limits for fast iteration.

**Differences from `DefaultConfig()`:**

| Field | Default | Development |
|-------|---------|-------------|
| `OverwriteExisting` | `false` | `true` |
| `AllowYamlSyntax` | `false` | `true` |
| `MaxFileSize` | 8 MB | 10 MB |

:::tip Security guarantees
`ValidateValues` stays `true` in every preset, matching the default. No preset weakens value validation.
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

Returns the testing configuration, sized for isolated test runs.

**Differences from `DefaultConfig()`:**

| Field | Default | Testing |
|-------|---------|---------|
| `OverwriteExisting` | `false` | `true` |
| `MaxFileSize` | 8 MB | 64 KB |
| `MaxVariables` | 1000 | 50 |

Every other field matches the default, including `AuditEnabled=false` (no audit noise in tests) and `FailOnMissingFile=false`.

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

Returns the production configuration: strict validation plus auditing.

**Differences from `DefaultConfig()`:**

| Field | Default | Production |
|-------|---------|------------|
| `FailOnMissingFile` | `false` | `true` |
| `AuditEnabled` | `false` | `true` |
| `MaxFileSize` | 8 MB | 64 KB |
| `MaxVariables` | 1000 | 50 |

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
// loader.Close() closes the handler (and JSONAuditHandler closes its writer), so use a file, not os.Stdout
auditFile, err := os.OpenFile("audit.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
if err != nil {
    log.Fatal(err)
}
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
loader, err := env.New(cfg)
if err != nil {
    auditFile.Close() // on failure the handler did not take over the file, so close it here
    log.Fatal(err)
}
```

---

### Detailed Preset Comparison

| Feature | Default | Development | Testing | Production |
|---------|---------|-------------|---------|------------|
| Overwrite existing variables | ✗ | ✓ | ✓ | ✗ |
| Error on missing file | ✗ | ✗ | ✗ | ✓ |
| Audit logging | ✗ | ✗ | ✗ | ✓ |
| YAML syntax | ✗ | ✓ | ✗ | ✗ |
| File size limit | 8 MB | 10 MB | 64 KB | 64 KB |
| Max variables | 1000 | 1000 | 50 | 50 |

:::tip How to choose
- **Development**: `DevelopmentConfig()` relaxes limits for fast iteration.
- **Testing**: `TestingConfig()` allows overwriting, so each test starts from a clean slate.
- **Production**: `ProductionConfig()` enables auditing and treats a missing file as an error.
:::

---

## Methods

`Config` has two methods: `Config.Validate` and `Config.IsZero`.

### Validate

```go
func (c *Config) Validate() error
```

Checks the configuration for consistency. It validates every limit against its allowed range, plus `JSONMaxDepth`, `YAMLMaxDepth`, `ExpansionScope`, and `DuplicateKeyPolicy`. When `KeyPattern` is set, it validates that too.

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 1000

if err := cfg.Validate(); err != nil {
    // configuration invalid
}
```

**Validation rules:**
- Every limit value must be positive
- No limit value may exceed its hard limit
- `JSONMaxDepth` and `YAMLMaxDepth` must be between 1 and 100
- `ExpansionScope` must be one of the two defined constants
- `DuplicateKeyPolicy` must be one of the four defined constants
- If `KeyPattern` is non-nil, it must pass three probes (see [KeyPattern security probes](#keypattern-security-probes-sec-06))

---

### IsZero

```go
func (c *Config) IsZero() bool
```

Reports whether the Config is an uninitialized zero value. `New()` uses this to decide whether to apply `DefaultConfig()`.

**Returns:**
- `bool` - whether it's a zero-value configuration

**Detection scope (since v1.3.0, every field):**
- Numeric limits, such as `MaxFileSize` and `MaxVariables`
- Boolean fields, such as `ValidateValues` and `AutoApply`
- Enum fields: `ExpansionScope`, `DuplicateKeyPolicy`
- Pointer and interface fields, such as `KeyPattern` and `FileSystem`
- String and slice fields, such as `Prefix`, `Filenames`, and `RequiredKeys`

:::warning
A partially set Config is not treated as zero: the limit fields you leave unset make `Validate()` fail with an `ErrInvalidConfig` wrapper (for example `MaxFileSize must be positive`). See "The IsZero pitfall" below for the fix.
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
auditFile, err := os.OpenFile("audit.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
if err != nil {
    log.Fatal(err)
}
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)

loader, err := env.New(cfg)
if err != nil {
    auditFile.Close() // on failure the handler did not take over the file, so close it here
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

### Fields the comparison table does not cover

The "Detailed Preset Comparison" table lists only the options whose values **differ** between presets. The table below covers the remaining fields (`AllowYamlSyntax` does differ, so it is included for cross-checking):

| Option | Default | Development | Testing | Production |
|--------|---------|-------------|---------|------------|
| `ValidateValues` | true | true | true | true |
| `AllowExportPrefix` | true | true | true | true |
| `AllowYamlSyntax` | false | **true** | false | false |
| `ExpandVariables` | true | true | true | true |
| `JSONMaxDepth`/`YAMLMaxDepth` | 16 | 16 | 16 | 16 |

The built-in forbidden-key check (`PATH`, `LD_PRELOAD`, and so on) is not affected by presets and stays on in all four.

Key point: `DevelopmentConfig` relaxes **convenience** only: overwriting, YAML syntax, and the file-size ceiling. Value validation stays on in every preset, so no preset weakens injection protection.

### Key DefaultConfig values

| Item | Default |
|------|---------|
| Key pattern | Built-in byte-level validation (equivalent to `^[A-Za-z][A-Za-z0-9_]*$`) |
| `ValidateValues` | true |
| `JSONNullAsEmpty`/`JSONNumberAsString` | true |
| `JSONBoolAsString` | false (no effect on JSON output) |
| `ExpandVariables` | true (scope `ExpansionFileOnly`) |
| `Prefix` | empty (no filtering) |

### The IsZero pitfall: always start from DefaultConfig()

The one rule: build on `DefaultConfig()` instead of assigning field by field on a zero-value `Config`.

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig() // modify on top of complete defaults
cfg.Filenames = []string{".env.production"}
cfg.OverwriteExisting = true
```

### KeyPattern security probes (SEC-06)

A custom `KeyPattern` goes through three probes in `Config.Validate()`. Failing any probe rejects the configuration:

1. It must reject the empty string
2. It must reject keys starting with a digit (e.g. `123_INVALID`)
3. It must reject keys containing `=`, `:`, a newline, or a control character. Otherwise a key that carries a separator would re-parse as **different lines** after a serialization round trip (round-trip injection).

The probe set deliberately omits magic keys, so a namespace-only pattern such as `^ZZZ_[A-Z0-9]*$` is accepted: a pattern that matches no ordinary key merely fails every key validation, which is not a security risk.

### ExpansionScope

`ExpansionScope` is an int enum. It controls which sources a `${VAR}` or `$VAR` reference in a value can resolve against. Set it with `ParsingConfig.ExpansionScope`.

```go
type ExpansionScope int

const (
    ExpansionFileThenProcess ExpansionScope = iota // enum zero value (not the runtime default)
    ExpansionFileOnly                              // file-defined variables only (DefaultConfig default)
)
```

| Constant | Semantics |
|----------|-----------|
| `ExpansionFileThenProcess` | Enum zero value (`iota`). Resolves file-defined variables first, then falls back to the process environment (`os.LookupEnv`), matching traditional dotenv semantics. It takes effect only when set explicitly; `DefaultConfig()` does not use it. |
| `ExpansionFileOnly` | Only file-defined variables are visible; a reference that exists only in the process environment expands to the empty string. This is the `DefaultConfig()` default (SEC-03). It keeps `${VAR}` references from reading the process environment, so unrelated secrets (cloud credentials, tokens) cannot be copied into values. |

For the attack scenarios and configuration examples, see the ["Expansion Scope" section of the variable expansion guide](../guides/variable-expansion).

### DuplicateKeyPolicy (in-document duplicate keys)

`DuplicateKeyPolicy` is an int enum. It controls how duplicate keys **within a single source document** are resolved. Set it with `ParsingConfig.DuplicateKeyPolicy`.

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
| `DuplicateKeyInherit` | Zero value (default). `.env` follows `OverwriteExisting`: first wins when false, last wins when true. YAML keeps the last occurrence. JSON keeps the last occurrence (`encoding/json` decode order) |
| `DuplicateKeyFirstWins` | `.env` and YAML keep the first occurrence. JSON data with duplicates is rejected, including inline JSON inside YAML: the same pre-scan that backs `DuplicateKeyError` detects them. `encoding/json` discards earlier occurrences, so this policy cannot be honored for JSON. JSON documents without duplicates load unchanged. |
| `DuplicateKeyLastWins` | Every format keeps the last occurrence, independent of `OverwriteExisting` |
| `DuplicateKeyError` | Any duplicate key in the same object or mapping (or in the same `.env` file) errors with `ErrDuplicateKey`, matchable via `errors.Is`. JSON is scanned conservatively by raw key bytes: keys spelled with different escape sequences are not detected, and those fall back to last-wins. |

**Two related behaviors not governed by this policy:**

- **Cross-file merging** follows file order and `OverwriteExisting`: default `false` = first wins, `true` = later files override.
- **Flat-key collisions always error.** Two different source paths can collapse onto the same flattened key in YAML or JSON, for example `a_b: 1` next to `a: {b: 2}`, or a literal `a_0` next to an array `a`. The error matches `ErrDuplicateKey` via `errors.Is`.

```go
cfg := env.DefaultConfig()
cfg.DuplicateKeyPolicy = env.DuplicateKeyError // reject duplicate keys
```

Case note: YAML and JSON keys are uppercased when flattened, while `.env` keys are stored as written. Keys that differ only in case therefore do not collide: a `.env` `db_host` and a YAML `db: {host: ...}` (which flattens to `DB_HOST`) coexist in the store.

`DuplicateKeyPolicy.String` returns a human-readable name for the policy: `inherit`, `first-wins`, `last-wins`, or `error` (unknown values return `unknown`).

## Related Documentation

- [Loader API](./loader) - Loader methods
- [Constants & Errors](./constants) - Limit constants and error types
- [Audit Logging](../guides/audit-logging) - Audit configuration guide

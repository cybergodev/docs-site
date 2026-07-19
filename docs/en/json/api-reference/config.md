---
sidebar_label: "Config"
title: "Config - CyberGo JSON | API Reference"
description: "CyberGo JSON Config reference: DefaultConfig, SecurityConfig, PrettyConfig, caching, size limits, and encoding options to customize JSON behavior in Go."
sidebar_position: 4
---

# Config

Config is used to customize the behavior of the Processor and all JSON operations.

## Config Struct

```go
type Config struct {
    // ===== Cache Settings =====
    MaxCacheSize int           `json:"max_cache_size"` // Maximum cache entries
    CacheTTL     time.Duration `json:"cache_ttl"`      // Cache expiration time
    EnableCache  bool          `json:"enable_cache"`   // Whether to enable cache
    CacheResults bool          `json:"cache_results"`  // Whether to cache operation results
    CacheSharedResults bool    `json:"cache_shared_results"` // Share cached results (skip defensive deep copy; caller must not mutate returned containers)

    // ===== Size Limits =====
    MaxJSONSize  int64 `json:"max_json_size"`  // Maximum JSON size (bytes)
    MaxPathDepth int   `json:"max_path_depth"` // Maximum path depth
    MaxBatchSize int   `json:"max_batch_size"` // Maximum batch operation count

    // ===== Security Limits =====
    MaxNestingDepthSecurity   int   `json:"max_nesting_depth"`           // Maximum nesting depth
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"` // Maximum security validation size
    MaxObjectKeys             int   `json:"max_object_keys"`             // Maximum object key count
    MaxArrayElements          int   `json:"max_array_elements"`          // Maximum array element count
    FullSecurityScan          bool  `json:"full_security_scan"`          // Enable full security scan

    // ===== Concurrency =====
    MaxConcurrency    int `json:"max_concurrency"`    // Maximum concurrency
    ParallelThreshold int `json:"parallel_threshold"` // Parallel processing threshold

    // ===== Processing Options =====
    EnableValidation bool `json:"enable_validation"` // Enable validation
    StrictMode       bool `json:"strict_mode"`       // Strict mode
    CreatePaths      bool `json:"create_paths"`      // Auto-create paths
    CleanupNulls     bool `json:"cleanup_nulls"`     // Cleanup null values
    CompactArrays    bool `json:"compact_arrays"`    // Compact arrays
    ContinueOnError  bool `json:"continue_on_error"` // Continue on batch operation error

    // ===== Input/Output Options =====
    AllowComments    bool `json:"allow_comments"`     // Allow comments
    PreserveNumbers  bool `json:"preserve_numbers"`   // Preserve number precision
    ValidateInput    bool `json:"validate_input"`     // Validate input
    ValidateFilePath bool `json:"validate_file_path"` // Validate file paths
    SkipValidation   bool `json:"skip_validation"`    // Skip validation (trusted input)

    // ===== Encoding Options =====
    Pretty          bool            `json:"pretty"`           // Pretty-print output
    Indent          string          `json:"indent"`           // Indentation string
    Prefix          string          `json:"prefix"`           // Prefix
    EscapeHTML      bool            `json:"escape_html"`      // HTML escaping
    SortKeys        bool            `json:"sort_keys"`        // Sort keys
    ValidateUTF8    bool            `json:"validate_utf8"`    // UTF-8 validation
    MaxDepth        int             `json:"max_depth"`        // Maximum encoding depth
    DisallowUnknown bool            `json:"disallow_unknown"` // Disallow unknown fields
    FloatPrecision  int             `json:"float_precision"`  // Float precision (-1 for auto)
    FloatTruncate   bool            `json:"float_truncate"`   // Truncate floats
    DisableEscaping bool            `json:"disable_escaping"` // Disable escaping
    EscapeUnicode   bool            `json:"escape_unicode"`   // Unicode escaping
    EscapeSlash     bool            `json:"escape_slash"`     // Slash escaping
    EscapeNewlines  bool            `json:"escape_newlines"`  // Newline escaping
    EscapeTabs      bool            `json:"escape_tabs"`      // Tab escaping
    IncludeNulls    bool            `json:"include_nulls"`    // Include null values
    CustomEscapes   map[rune]string `json:"custom_escapes,omitempty"` // Custom escape mapping

    // ===== Observability =====
    EnableMetrics     bool `json:"enable_metrics"`      // Enable metrics collection
    EnableHealthCheck bool `json:"enable_health_check"` // Enable health check

    // ===== Large File Processing =====
    ChunkSize       int64 `json:"chunk_size"`       // Chunk size
    MaxMemory       int64 `json:"max_memory"`       // Maximum memory usage
    BufferSize      int   `json:"buffer_size"`      // Buffer size
    SamplingEnabled bool  `json:"sampling_enabled"` // Enable sampling
    SampleSize      int   `json:"sample_size"`      // Sample count

    // ===== JSONL Configuration =====
    JSONLBufferSize    int   `json:"jsonl_buffer_size"`     // JSONL buffer size
    JSONLMaxLineSize   int   `json:"jsonl_max_line_size"`   // JSONL maximum line size
    JSONLSkipEmpty     bool  `json:"jsonl_skip_empty"`      // Skip empty lines
    JSONLSkipComments  bool  `json:"jsonl_skip_comments"`   // Skip comment lines
    JSONLContinueOnErr bool  `json:"jsonl_continue_on_err"` // Continue on error
    JSONLWorkers       int   `json:"jsonl_workers"`         // JSONL parallel worker count
    JSONLChunkSize     int   `json:"jsonl_chunk_size"`      // JSONL chunk size
    JSONLMaxMemory     int64 `json:"jsonl_max_memory"`      // JSONL maximum memory

    // ===== Merge Options =====
    MergeMode MergeMode `json:"merge_mode"` // Merge strategy

    // ===== Extension Points (no JSON tag, not serialized) =====
    CustomEncoder               CustomEncoder                // Custom encoder
    CustomTypeEncoders          map[reflect.Type]TypeEncoder // Custom type encoders
    CustomValidators            []Validator                  // Custom validators
    AdditionalDangerousPatterns []DangerousPattern           // Additional dangerous patterns
    DisableDefaultPatterns      bool                         // Disable default warning-level patterns
    Hooks                       []Hook                       // Operation hooks
    CustomPathParser            PathParser                   // Custom path parser
}
```

::: warning CacheSharedResults contract
When `CacheSharedResults` is `true`, a cache-hit `Get`/`GetFromParsed` returns the cached value **directly**, skipping the defensive deep copy (faster, fewer allocations). The caller **must not mutate** the returned `map[string]any`/`[]any`, since doing so corrupts the shared cache and affects subsequent reads. Primitives (`bool`, `float64`, `string`, `json.Number`, `nil`) are immutable and always safe. The default `false` preserves the safe copy-on-read behavior; enable it only when callers treat results as read-only (for example, read-heavy workloads that `Get` the same large subtrees repeatedly).
:::

## Configuration Presets

### DefaultConfig

Signature: `func DefaultConfig() Config`

Returns the default configuration, suitable for most scenarios.

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**Default Values**

| Field | Value | Description |
|------|-----|------|
| MaxJSONSize | 100MB | JSON size limit |
| MaxNestingDepthSecurity | 200 | Nesting depth |
| MaxPathDepth | 50 | Path depth |
| MaxSecurityValidationSize | 10MB | Security validation size limit |
| MaxObjectKeys | 100000 | Maximum object keys |
| MaxArrayElements | 100000 | Maximum array elements |
| MaxConcurrency | 50 | Concurrency limit |
| MaxBatchSize | 2000 | Batch operation count |
| CacheTTL | 5 minutes | Cache expiration |
| MaxCacheSize | 128 | Maximum cache entries |
| EnableCache | true | Enable cache |
| CacheResults | true | Cache operation results |
| CacheSharedResults | false | Share cached results (read-only high-throughput) |
| EnableValidation | true | Enable validation |
| StrictMode | false | Non-strict mode |
| FullSecurityScan | false | Sampled security scan (not full) |
| ValidateInput | true | Validate input |
| ValidateFilePath | true | Validate file paths |
| CreatePaths | true | Auto-create paths |
| Pretty | false | No pretty-print output |
| EscapeHTML | true | HTML escaping |
| ValidateUTF8 | true | UTF-8 validation |
| IncludeNulls | true | Include null |
| EscapeNewlines | true | Newline escaping |
| EscapeTabs | true | Tab escaping |
| FloatPrecision | -1 | Auto precision |
| MaxDepth | 100 | Encoding depth |
| Indent | "  " | Default indentation |
| ChunkSize | 1MB | Chunk size |
| MaxMemory | 100MB | Maximum memory |
| BufferSize | 64KB | Buffer size |
| SamplingEnabled | true | Enable sampling |
| SampleSize | 1000 | Sample count |
| JSONLBufferSize | 64KB | JSONL buffer size |
| JSONLMaxLineSize | 1MB | JSONL maximum line size |
| JSONLSkipEmpty | true | Skip empty lines |
| JSONLSkipComments | false | Do not skip comments |
| JSONLContinueOnErr | false | Stop on error |
| JSONLWorkers | 4 | Parallel worker count |
| JSONLChunkSize | 1000 | JSONL chunk size |
| JSONLMaxMemory | 100MB | JSONL maximum memory |
| MergeMode | MergeUnion | Union merge |

### SecurityConfig

Signature: `func SecurityConfig() Config`

Returns a security configuration, suitable for processing untrusted input.

```go
// Recommended for:
// - Public APIs and web services
// - User-submitted data
// - External webhooks
// - Authentication endpoints
// - Financial data processing
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**Security Configuration Features**

| Field | Value | Description |
|------|-----|------|
| MaxNestingDepthSecurity | 30 | Conservative nesting depth |
| MaxSecurityValidationSize | 10MB | Security validation size |
| MaxObjectKeys | 5000 | Conservative key limit |
| MaxArrayElements | 5000 | Conservative element limit |
| MaxJSONSize | 10MB | Conservative size limit |
| MaxPathDepth | 30 | Conservative path depth |
| FullSecurityScan | true | Full security scan |
| StrictMode | true | Strict mode |
| EnableValidation | true | Enable validation |
| EnableCache | true | Enable cache |
| MaxCacheSize | 256 | Cache size |
| CacheTTL | 3 minutes | Shorter TTL |

### PrettyConfig

Signature: `func PrettyConfig() Config`

Returns a pretty-print output configuration.

```go
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

## Configuration Methods

### Clone

Signature: `func (c *Config) Clone() *Config`

Deep copies the configuration.

```go
cfg := json.DefaultConfig()
cfgCopy := cfg.Clone()
cfgCopy.EnableValidation = true // Does not affect original config
```

### Validate

Signature: `func (c *Config) Validate() error`

Validates the configuration and automatically corrects invalid values. This method **modifies the Config in place**, correcting invalid fields to within their valid ranges: values that are too small (≤0) are raised to the minimum, and values that exceed the upper bound are capped at the maximum.

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1 // Invalid value
if err := cfg.Validate(); err != nil {
    panic(err)
}
// MaxJSONSize will be corrected in place to minimum value
```

### ValidateWithWarnings

Signature: `func (c *Config) ValidateWithWarnings() []ConfigWarning`

Validates the configuration and returns a list of correction warnings.

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1
warnings := cfg.ValidateWithWarnings()
for _, w := range warnings {
    fmt.Printf("%s: %s\n", w.Field, w.Reason)
}
```

### ConfigWarning Type

`ConfigWarning` represents auto-correction information during configuration validation.

```go
type ConfigWarning struct {
    Field    string // Corrected field name
    OldValue any    // Original value (may be nil for invalid values)
    NewValue any    // Corrected value
    Reason   string // Correction reason
}
```


### SecurityLimits Type

`SecurityLimits` summarizes the security-related limit fields in Config.

```go
type SecurityLimits struct {
    MaxNestingDepth           int   `json:"max_nesting_depth"`
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"`
    MaxObjectKeys             int   `json:"max_object_keys"`
    MaxArrayElements          int   `json:"max_array_elements"`
    MaxJSONSize               int64 `json:"max_json_size"`
    MaxPathDepth              int   `json:"max_path_depth"`
}
```

### AddHook

Signature: `func (c *Config) AddHook(hook Hook)`

Adds an operation hook.

```go
cfg := json.DefaultConfig()
cfg.AddHook(json.LoggingHook(slog.Default()))
```

### AddValidator

Signature: `func (c *Config) AddValidator(validator Validator)`

Adds a custom validator.

```go
cfg := json.DefaultConfig()
cfg.AddValidator(&MyValidator{})
```

### AddDangerousPattern

Signature: `func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

Adds an additional security pattern.

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

## Usage Examples

### Basic Usage

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Security Configuration

```go
// Process untrusted input
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Pretty Output

```go
// Pretty-print JSON
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

### Custom Configuration

```go
cfg := json.DefaultConfig()

// Security settings
cfg.MaxJSONSize = 10 * 1024 * 1024 // 10MB
cfg.MaxNestingDepthSecurity = 50
cfg.EnableValidation = true

// Hooks
cfg.Hooks = []json.Hook{json.LoggingHook(slog.Default())}

// Validators
cfg.CustomValidators = []json.Validator{&MyValidator{}}

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Clone and Modify

```go
// Create variants based on default config
base := json.DefaultConfig()

// Variant 1: Development config
devCfg := base.Clone()
devCfg.EnableMetrics = true

// Variant 2: Production config
prodCfg := base.Clone()
prodCfg.EnableValidation = true
```

## Configuration Constants

```go
const (
    // Size limits
    DefaultMaxJSONSize       = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth   = 200
    DefaultMaxPathDepth      = 50
    DefaultMaxDepth          = 100                 // Default nesting depth for encoding/decoding (Config.MaxDepth)
    DefaultMaxConcurrency    = 50
    DefaultMaxBatchSize      = 2000
    DefaultMaxSecuritySize   = 10 * 1024 * 1024   // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultParallelThreshold = 10

    // Cache
    DefaultCacheTTL = 5 * time.Minute
)
```

::: info Internal Constants
Path validation length limits (`maxPathLength`) and other constants have been converted to internal implementations and are no longer exported as public APIs. Related default values are reflected in the `Config` struct field defaults.
:::

---

## Merge Modes

`MergeMode` controls the merge strategy for `MergeJSON` and `MergeMany` functions.

### MergeUnion (Default)

Merges all keys/elements, using the override value for conflicts.

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeUnion
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// Result: {"a": 1, "b": 3, "c": 4}
```

### MergeIntersection

Only keeps keys that exist in both objects.

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// Result: {"b": 3}
```

### MergeDifference

Only keeps keys that exist in the base object but not in the override object.

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// Result: {"a": 1}
```

---

## Security Recommendations

| Configuration | Recommended Value | Description |
|--------|--------|------|
| MaxJSONSize | 10-100MB | Adjust based on server memory |
| MaxNestingDepthSecurity | 30-50 | Prevent deep nesting attacks |
| MaxPathDepth | 30-50 | Limit path complexity |
| EnableValidation | true | Always enable |
| FullSecurityScan | true (untrusted input) | Full security scan |

## Related

- [Processor](./processor/) - Processor methods
- [Constants & Errors](./constants) - Configuration constants
- [Security Overview](../security/) - Security best practices
- [Interface Definitions](./interfaces) - Extension interfaces

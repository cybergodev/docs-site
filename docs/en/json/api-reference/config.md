---
sidebar_label: "Config"
title: "Config - CyberGo JSON | Fields & Presets"
description: "CyberGo JSON Config reference: DefaultConfig, SecurityConfig and PrettyConfig presets, every field default, Validate clamping ranges, and MergeMode."
sidebar_position: 40
---

# Config

Config customizes the behavior of the Processor and of all JSON operations.

## The Config Struct

```go
type Config struct {
    // ===== Cache settings =====
    MaxCacheSize int           `json:"max_cache_size"` // Maximum cache entries
    CacheTTL     time.Duration `json:"cache_ttl"`      // Cache expiration time
    EnableCache  bool          `json:"enable_cache"`   // Whether to enable the cache
    CacheResults bool          `json:"cache_results"`  // Whether to cache operation results
    CacheSharedResults bool `json:"cache_shared_results"` // Share cached results (skips defensive deep copies; callers must not mutate the returned containers)

    // ===== Size limits =====
    MaxJSONSize  int64 `json:"max_json_size"`  // Maximum JSON size (bytes)
    MaxPathDepth int   `json:"max_path_depth"` // Path depth cap (reserved field: does not change behavior)
    MaxBatchSize int   `json:"max_batch_size"` // Maximum batch operation count

    // ===== Security limits =====
    MaxNestingDepthSecurity   int   `json:"max_nesting_depth"`           // Maximum nesting depth
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"` // Security validation size (reserved field: does not change behavior)
    MaxObjectKeys             int   `json:"max_object_keys"`             // Maximum object key count
    MaxArrayElements          int   `json:"max_array_elements"`          // Maximum array element count
    FullSecurityScan          bool  `json:"full_security_scan"`          // Enable a single full security scan

    // ===== Concurrency =====
    MaxConcurrency    int `json:"max_concurrency"`    // Maximum concurrency
    ParallelThreshold int `json:"parallel_threshold"` // Parallel processing threshold
    MaxOperationsPerSecond int `json:"max_operations_per_second"` // Rate cap for controlled operations (0 = unlimited)

    // ===== Processing options =====
    EnableValidation bool `json:"enable_validation"` // Enable validation (deprecated, not read)
    StrictMode       bool `json:"strict_mode"`       // Strict mode (deprecated, not read)
    CreatePaths      bool `json:"create_paths"`      // Create paths automatically
    CleanupNulls     bool `json:"cleanup_nulls"`     // Clean up null values
    CompactArrays    bool `json:"compact_arrays"`    // Compact arrays
    ContinueOnError  bool `json:"continue_on_error"` // Continue on batch errors

    // ===== Input/output options =====
    AllowComments    bool `json:"allow_comments"`     // Allow comments (deprecated, not read)
    PreserveNumbers  bool `json:"preserve_numbers"`   // Preserve number precision
    ValidateInput    bool `json:"validate_input"`     // Validate input (deprecated, not read)
    ValidateFilePath bool `json:"validate_file_path"` // Validate file paths
    SkipValidation   bool `json:"skip_validation"`    // Skip validation (trusted input)
    DetectDuplicateKeys bool `json:"detect_duplicate_keys"` // Detect and reject duplicate keys in objects

    // ===== Encoding options =====
    Pretty          bool            `json:"pretty"`           // Pretty output
    Indent          string          `json:"indent"`           // Indentation string
    Prefix          string          `json:"prefix"`           // Prefix
    EscapeHTML      bool            `json:"escape_html"`      // HTML escaping
    SortKeys        bool            `json:"sort_keys"`        // Sort keys
    ValidateUTF8    bool            `json:"validate_utf8"`    // UTF-8 validation
    MaxDepth        int             `json:"max_depth"`        // Maximum encoding depth
    DisallowUnknown bool            `json:"disallow_unknown"` // Disallow unknown fields
    FloatPrecision  int             `json:"float_precision"`  // Float precision (-1 = automatic)
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
    EnableHealthCheck bool `json:"enable_health_check"` // Enable health checks (deprecated, not read)

    // ===== Large file handling =====
    ChunkSize       int64 `json:"chunk_size"`       // Chunk size (deprecated, not read)
    MaxMemory       int64 `json:"max_memory"`       // Maximum memory usage
    BufferSize      int   `json:"buffer_size"`      // Buffer size
    SaveFileMode    os.FileMode `json:"save_file_mode,omitempty"` // Permission bits for newly created files (0 falls back to 0644)
    SamplingEnabled bool  `json:"sampling_enabled"` // Enable sampling (deprecated, not read)
    SampleSize      int   `json:"sample_size"`      // Sample count (deprecated, not read)

    // ===== JSONL configuration =====
    JSONLBufferSize    int   `json:"jsonl_buffer_size"`     // JSONL buffer size
    JSONLMaxLineSize   int   `json:"jsonl_max_line_size"`   // JSONL maximum line size
    JSONLSkipEmpty     bool  `json:"jsonl_skip_empty"`      // Skip empty lines
    JSONLSkipComments  bool  `json:"jsonl_skip_comments"`   // Skip comment lines
    JSONLContinueOnErr bool  `json:"jsonl_continue_on_err"` // Continue on errors
    JSONLWorkers       int   `json:"jsonl_workers"`         // JSONL parallel worker count
    JSONLChunkSize     int   `json:"jsonl_chunk_size"`      // JSONL chunk size
    JSONLMaxMemory     int64 `json:"jsonl_max_memory"`      // JSONL maximum memory

    // ===== Merge options =====
    MergeMode MergeMode `json:"merge_mode"` // Merge strategy

    // ===== File access security =====
    AllowedFileDirs []string `json:"allowed_file_dirs,omitempty"` // Directory whitelist for file operations (empty = built-in blocking only)

    // ===== Extension points (no JSON tags, not serialized) =====
    CustomEncoder               CustomEncoder                // Custom encoder (deprecated, not wired)
    CustomTypeEncoders          map[reflect.Type]TypeEncoder // Custom type encoders (deprecated, not wired)
    CustomValidators            []Validator                  // Custom validators (deprecated, never executed)
    AdditionalDangerousPatterns []DangerousPattern           // Additional dangerous patterns
    DisableDefaultPatterns      bool                         // Disable default warning-level patterns
    Hooks                       []Hook                       // Operation hooks
    CustomPathParser            PathParser                   // Custom path parser
}
```

::: warning The CacheSharedResults contract
When `CacheSharedResults` is `true`, cache hits in `Get`/`GetFromParsed` **return the cached value directly**, skipping the defensive deep copy (faster, fewer allocations). In that case **callers must not mutate** the returned `map[string]any`/`[]any`; otherwise the shared cache is corrupted and subsequent reads are affected. Primitive values (`bool`, `float64`, `string`, `json.Number`, `nil`) are immutable and always safe. The default `false` keeps the safe "copy on read" behavior; enable it only when callers treat results as read-only (e.g. read-heavy workloads repeatedly reading the same large subtree).
:::

::: warning Extension field wiring status
The three interface fields `CustomEncoder`, `CustomTypeEncoders`, and `CustomValidators` are **deprecated** (marked Deprecated in the source): they are declared and take part in config cloning and cache-key computation, but the encoders/validators are **never invoked by the encode/operation pipelines** — setting them has no effect, and the built-in encoder cannot be replaced. All three are kept within v1. `CustomPathParser` **is wired**: once set, all path-based operations call the custom parser in place of the built-in one (see [Interface Definitions](./interfaces#pathparser)). Currently available extension points:

- Customizing encoding → `CustomEscapes` (**effective**, see the encoding options below) or implementing `json.Marshaler`/`encoding.TextMarshaler` (see [Custom Encoders](../extensions/custom-encoder))
- Operation interception → `Hooks` + `AddHook` (**effective**, see the [Hook System](../extensions/hooks))
- Custom path syntax → `CustomPathParser` (**effective**, see [Interface Definitions](./interfaces#pathparser))
- Input validation → `ValidateSchema` (see [Schema Validation](./schema))
:::

## Config Field Reference

All exported `Config` fields are listed below, grouped by purpose. Defaults are taken from [`DefaultConfig()`](#defaultconfig); valid ranges and auto-correction rules per field are in [Clamping ranges at a glance](#validatewithwarnings).

### Cache

| Field                 | Type            | Default | Description                                                                        |
| --------------------- | --------------- | ------- | ---------------------------------------------------------------------------------- |
| `MaxCacheSize`        | `int`           | 128     | Maximum cache entries; at 0 each shard still holds 1 entry — set `EnableCache = false` to turn caching off |
| `CacheTTL`            | `time.Duration` | 5 minutes | Cache entry lifetime                                                             |
| `EnableCache`         | `bool`          | true    | Whether to enable the cache                                                        |
| `CacheResults`        | `bool`          | true    | Whether to cache operation results (cached per operation)                          |
| `CacheSharedResults`  | `bool`          | false   | Cache hits return the shared value directly, skipping the defensive deep copy; callers must not mutate the returned containers (contract in the warning above) |

### Size Limits

| Field          | Type    | Default | Description                                                    |
| -------------- | ------- | ------- | -------------------------------------------------------------- |
| `MaxJSONSize`  | `int64` | 100MB   | Maximum JSON input size (bytes); exceeding it returns `ErrSizeLimit` |
| `MaxPathDepth` | `int`   | 50      | Reserved field: does not change behavior today; only feeds the config cache key and the `Validate` clamp (10–200). Path segment count is actually capped at 100 segments internally; exceeding it produces the error message `path too deep` |
| `MaxBatchSize` | `int`   | 2000    | Cap on operations per batch (`ProcessBatch`, `SetMultiple`); exceeding it returns `ErrSizeLimit` |

### Security Limits

| Field                       | Type    | Default | Description                                                                                                                             |
| --------------------------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `MaxNestingDepthSecurity`   | `int`   | 200     | Maximum nesting depth; exceeding it returns `ErrDepthLimit`                                                                               |
| `MaxSecurityValidationSize` | `int64` | 10MB    | Reserved field: does not change behavior today; only feeds the config cache key and the `Validate` clamp (1MB–100MB). Security scanning does not switch strategy based on this value |
| `MaxObjectKeys`             | `int`   | 100000  | Maximum key count per object; exceeding it returns `ErrSizeLimit`                                                                         |
| `MaxArrayElements`          | `int`   | 100000  | Maximum element count per array; exceeding it returns `ErrSizeLimit`                                                                      |
| `FullSecurityScan`          | `bool`  | false   | false (default): input under 4KB is scanned in full; 4KB and above uses a 32KB rolling window covering every byte, plus a suspicious-character density check on 4KB samples from the beginning, middle, and end. true: a single full scan instead |

### Concurrency

| Field               | Type  | Default | Description                                                                              |
| ------------------- | ----- | ------- | ---------------------------------------------------------------------------------------- |
| `MaxConcurrency`    | `int` | 50      | Maximum concurrency                                                                      |
| `ParallelThreshold` | `int` | 10      | Parallel processing threshold (falls back to sequential below this element count)         |
| `MaxOperationsPerSecond` | `int` | 0 (no rate limit) | Rate cap for controlled operations (Get/Set/Delete, etc.): a new operation arriving less than `1/MaxOperationsPerSecond` seconds after the previous one is rejected with a rate-limit error. `Validate` clamps it to [0, 1000000] |

### Processing Options

| Field              | Type   | Default | Description                                                 |
| ------------------ | ------ | ------- | ------------------------------------------------------------ |
| `EnableValidation` | `bool` | true    | Deprecated: not read by any operation (validation always runs by default unless `SkipValidation`); only takes part in the config cache key |
| `StrictMode`       | `bool` | false   | Deprecated: not read by any parser or operation; setting it changes nothing — it only takes part in the config cache key |
| `CreatePaths`      | `bool` | true    | Create missing intermediate paths automatically on Set      |
| `CleanupNulls`     | `bool` | false   | Clean up null values                                        |
| `CompactArrays`    | `bool` | false   | Compact arrays                                              |
| `ContinueOnError`  | `bool` | false   | Continue when a single batch item fails                     |

### Input/Output Options

| Field               | Type   | Default | Description                                                                     |
| ------------------- | ------ | ------- | -------------------------------------------------------------------------------- |
| `AllowComments`     | `bool` | false   | Deprecated: not read by any parser (comment lines in JSONL are controlled separately by `JSONLSkipComments`); only takes part in the config cache key |
| `PreserveNumbers`   | `bool` | false   | Decoding preserves number literals (`1.10` does not become `1.1`); encoding writes them back verbatim |
| `ValidateInput`     | `bool` | true    | Deprecated: not read by any operation; setting it changes nothing — it only takes part in the config cache key |
| `ValidateFilePath`  | `bool` | true    | Validate file paths                                                              |
| `SkipValidation`    | `bool` | false   | Skip non-essential validation (trusted input only)                               |
| `DetectDuplicateKeys` | `bool` | false  | Rejects any input object containing duplicate keys, returning an error wrapping `ErrDuplicateKey`. The default `false` matches `encoding/json` (the last duplicate key wins); when explicitly enabled it applies even with `SkipValidation`. Keys are compared by raw bytes (different escape spellings count as different keys) |

### Encoding Options

| Field              | Type              | Default            | Description                                                                          |
| ------------------ | ----------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `Pretty`           | `bool`            | false              | Pretty output                                                                        |
| `Indent`           | `string`          | "  " (two spaces)  | Indentation string                                                                   |
| `Prefix`           | `string`          | "" (empty)         | Prefix for every line                                                                |
| `EscapeHTML`       | `bool`            | true               | HTML character escaping (`<` `>` `&`)                                                 |
| `SortKeys`         | `bool`            | false              | Sort object keys in output                                                           |
| `ValidateUTF8`     | `bool`            | true               | UTF-8 validation (reserved field, does not change behavior currently)                |
| `MaxDepth`         | `int`             | 100                | Maximum encoding depth (0 means unlimited)                                           |
| `DisallowUnknown`  | `bool`            | false              | Disallow unknown fields when decoding (equivalent to `Decoder.DisallowUnknownFields()`) |
| `FloatPrecision`   | `int`             | -1                 | Float precision (-1 automatic; 0–15 explicit)                                        |
| `FloatTruncate`    | `bool`            | false              | Truncate directly instead of rounding when precision is active                       |
| `DisableEscaping`  | `bool`            | false              | Disable escaping logic (use only for fully controlled output)                        |
| `EscapeUnicode`    | `bool`            | false              | Non-ASCII characters become `\uXXXX`                                                 |
| `EscapeSlash`      | `bool`            | false              | `/` is escaped as `\/`                                                               |
| `EscapeNewlines`   | `bool`            | true               | Newline escaping                                                                     |
| `EscapeTabs`       | `bool`            | true               | Tab escaping                                                                         |
| `IncludeNulls`     | `bool`            | true               | Include fields with null values when encoding                                        |
| `CustomEscapes`    | `map[rune]string` | nil                | Custom character escape mapping                                                      |

### Observability

| Field                | Type   | Default | Description                                                                       |
| -------------------- | ------ | ------- | ---------------------------------------------------------------------------------- |
| `EnableMetrics`      | `bool` | false   | Enable metrics collection (`GetStats` / `GetHealthStatus` need it to have data)    |
| `EnableHealthCheck`  | `bool` | false   | Deprecated: not read (`GetHealthStatus`/`GetStats` ignore this toggle; whether there is data depends on `EnableMetrics`); only takes part in the config cache key |

### Large File Handling (Sampling and Streaming)

| Field             | Type    | Default | Description                                                       |
| ----------------- | ------- | ------- | ------------------------------------------------------------------ |
| `ChunkSize`       | `int64` | 1MB     | Deprecated: not read by any code path (streaming reads use `BufferSize`); only takes part in the config cache key |
| `MaxMemory`       | `int64` | 100MB   | Maximum memory for large-file processing                          |
| `BufferSize`      | `int`   | 64KB    | Large-file read buffer size                                       |
| `SaveFileMode`    | `os.FileMode` | 0 (falls back to 0644) | Permission bits for files **newly created** by `SaveToFile` / `MarshalToFile`; existing files keep their permissions (consistent with `os.WriteFile`). Prefer `0600` for sensitive data; `Validate` masks it to permission bits ≤ 0777 |
| `SamplingEnabled` | `bool`  | true    | Deprecated: not read (the rolling-window mode is selected by input size; `FullSecurityScan` only toggles between window and full scanning); only takes part in the config cache key |
| `SampleSize`      | `int`   | 1000    | Deprecated: not read by any code path; only takes part in the config cache key |

### JSONL Configuration

| Field                 | Type    | Default | Description                                      |
| --------------------- | ------- | ------- | ------------------------------------------------- |
| `JSONLBufferSize`     | `int`   | 64KB    | JSONL read buffer size                           |
| `JSONLMaxLineSize`    | `int`   | 1MB     | Maximum size of a single JSONL line              |
| `JSONLSkipEmpty`      | `bool`  | true    | Skip empty lines                                 |
| `JSONLSkipComments`   | `bool`  | false   | Skip `#` / `//` comment lines                    |
| `JSONLContinueOnErr`  | `bool`  | false   | Continue with subsequent lines on parse errors   |
| `JSONLWorkers`        | `int`   | 4       | Reserved: no code reads it; the parallel worker count comes from the `workers` argument of `StreamJSONLParallel` |
| `JSONLChunkSize`      | `int`   | 1000    | Reserved: no code reads it; the chunk size comes from the `chunkSize` argument of `StreamJSONLChunked` |
| `JSONLMaxMemory`      | `int64` | 100MB   | Maximum memory for JSONL processing              |

### Merge Options

| Field       | Type        | Default   | Description                                                                              |
| ----------- | ----------- | --------- | ----------------------------------------------------------------------------------------- |
| `MergeMode` | `MergeMode` | MergeUnion | Merge strategy of `MergeJSON` / `MergeMany` (see [Merge Modes](#merge-modes))              |

### File Access Security

| Field              | Type        | Default | Description |
| ------------------ | ----------- | ------- | ----------- |
| `AllowedFileDirs`  | `[]string`  | empty   | **Directory whitelist** for path-based file APIs: when non-empty, every path passed to `LoadFromFile`, `UnmarshalFromFile`, `SaveToFile`, `MarshalToFile`, the `ForeachFile*` family, and `StreamJSONLFile` (after symlink resolution) must be inside one of the listed directories, or `ErrSecurityViolation` is returned. The whitelist applies **in addition to** the built-in platform block list. Entries must be absolute paths (`Validate` resolves relative paths to absolute ones with a warning; empty entries are dropped); matching is by prefix on the cleaned path. A non-empty list in a per-call cfg overrides the processor's own list; the deprecated `NDJSONProcessor` entry points do not honor the whitelist |

```go
cfg := json.DefaultConfig()
// Only allow access to files under /var/lib/myapp/data
cfg.AllowedFileDirs = []string{"/var/lib/myapp/data"}
```

### Extension Points

The following fields have no JSON tags and are not serialized; wiring status in the warning above.

| Field                       | Type                               | Default | Description                                                                        |
| ---------------------------- | ---------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `CustomEncoder`              | `CustomEncoder`                    | nil     | Custom encoder (deprecated: not wired, setting it has no effect; use `json.Marshaler` instead) |
| `CustomTypeEncoders`         | `map[reflect.Type]TypeEncoder`     | nil     | Encoders registered per Go type (deprecated: not wired, setting it has no effect)   |
| `CustomValidators`           | `[]Validator`                      | nil     | Custom validators run before operations (deprecated: never executed; use `AddHook` with a Before hook instead) |
| `AdditionalDangerousPatterns` | `[]DangerousPattern`              | nil     | Dangerous patterns appended on top of the built-in ones                             |
| `DisableDefaultPatterns`     | `bool`                             | false   | Disable built-in warning-level patterns (critical patterns are always enforced and cannot be disabled) |
| `Hooks`                      | `[]Hook`                           | nil     | Before/after operation hooks (effective)                                            |
| `CustomPathParser`           | `PathParser`                       | nil     | Custom path parser (effective; replaces the built-in path parser)                   |

## Encoding Options in Detail

Encoding options (`Pretty`/`Indent`/`EscapeHTML`/`SortKeys`/`FloatPrecision`, etc.) control the output shape of the `Marshal`/`Encode` families. Defaults align with the standard library (e.g. `EscapeHTML: true`, `IncludeNulls: true`). When any non-default encoding option is set, the library switches to its custom encoder path internally.

### Key Sorting (SortKeys)

```go
cfg := json.DefaultConfig()
cfg.SortKeys = true
s, _ := json.Encode(map[string]any{"b": 2, "a": 1}, cfg)
// Output: {"a":1,"b":2} — stable key order, convenient for comparison and testing
```

### Float Precision (FloatPrecision / FloatTruncate)

```go
cfg := json.DefaultConfig()
cfg.FloatPrecision = 2 // -1 (default) = automatic precision
s, _ := json.Encode(3.14159265, cfg)
// Output: 3.14
```

`FloatTruncate` controls how rounding happens when `FloatPrecision` is active: the default (`false`) applies standard round-half; setting it to `true` switches to **direct truncation** — with precision 2, `3.999` outputs `3.99` (rounding would give `4.00`). It only takes part in encoding when `FloatPrecision >= 0`.

### Custom Character Escaping (CustomEscapes)

```go
cfg := json.DefaultConfig()
cfg.CustomEscapes = map[rune]string{
    '<': "&lt;",
}
s, _ := json.Encode("<a>", cfg)
// Output: "&lt;a>"
```

### Common Toggles at a Glance

| Option | Default | Effect when toggled/set true |
|--------|---------|------------------------------|
| `EscapeHTML` | `true` | `false`: `<` `>` `&` are not escaped |
| `EscapeUnicode` | `false` | `true`: non-ASCII characters become `\uXXXX` |
| `EscapeSlash` | `false` | `true`: `/` is escaped as `\/` |
| `EscapeNewlines` / `EscapeTabs` | `true` | `false`: control characters pass through raw (use with care when producing JSONL-friendly text) |
| `DisableEscaping` | `false` | `true`: skips escaping logic entirely (use only for fully controlled output) |
| `IncludeNulls` | `true` | `false`: fields with `null` values are omitted when encoding |
| `PreserveNumbers` | `false` | `true`: decoding preserves number literals (`1.10` does not become `1.1`), written back verbatim when encoding |

## Input and Observability Toggles

The following fields control decoding strictness and runtime observability (defaults in [`DefaultConfig`](#defaultconfig)):

| Field | Default | Scope | Description |
|-------|---------|-------|-------------|
| `DisallowUnknown` | `false` | `NewDecoder(r, cfg)` | When `true`, equivalent to calling `DisallowUnknownFields()` on the returned Decoder — decoding errors on unknown fields |
| `ValidateUTF8` | `true` | Reserved | Does not change behavior currently (see note below) |
| `AllowComments` | `false` | Deprecated | Not read by any parser (see note below) |
| `EnableMetrics` | `false` | At `New(cfg)` construction | When `true`, creates a metrics collector so `GetStats` operation/error counters and the per-check results of `GetHealthStatus` have data |
| `EnableHealthCheck` | `false` | Deprecated | Not read (see note below) |
| `SamplingEnabled` | `true` | Deprecated | Not read (see note below) |

::: warning Reserved/deprecated field notes
The following fields are declared and take part in config comparison and hashing (so they do distinguish processor caches for different cfgs), but are **not read by the corresponding pipelines** — setting them changes nothing. `ValidateUTF8`, `MaxPathDepth`, and `MaxSecurityValidationSize` are not marked Deprecated in the source and are reserved fields; the rest are marked Deprecated. All are kept within v1:

- `EnableValidation`: validation always runs by default unless `SkipValidation` is `true` — this toggle is not read by any operation.
- `StrictMode`: not read by any parser or operation.
- `AllowComments`: does not make parsing accept `//` or `#` comments; comment lines in JSONL files are controlled separately by `JSONLSkipComments`.
- `ValidateInput`: not read by any operation.
- `EnableHealthCheck`: health checks are on-demand via `GetHealthStatus`; whether there is data depends on `EnableMetrics` (see [Lifecycle and Statistics](./processor/lifecycle#health-check)).
- `ChunkSize`: not read by any code path; streaming reads actually use `BufferSize`.
- `SamplingEnabled` / `SampleSize`: these two fields play no part in security scanning; the scan mode is decided by input size and `FullSecurityScan`.
- `MaxPathDepth`: imposes no cap on path segment count. The segment limit is 100 internally and exceeding it produces the error message `path too deep`; the path string limit is 5000 bytes, returning `ErrInvalidPath` when validation is on and it is exceeded.
- `MaxSecurityValidationSize`: plays no part in security scanning. The threshold is fixed by input size: under 4KB is scanned in full, 4KB and above uses the 32KB rolling window.
- `ValidateUTF8`: on the input side, rejecting invalid UTF-8 is unconditional security behavior; on the output side, standard-library semantics apply — neither is affected by this toggle.
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

**Defaults**

| Field | Value | Description |
|-------|-------|-------------|
| MaxJSONSize | 100MB | JSON size limit |
| MaxNestingDepthSecurity | 200 | Nesting depth |
| MaxPathDepth | 50 | Path depth (reserved field, does not change behavior) |
| MaxSecurityValidationSize | 10MB | Security validation size cap (reserved field, does not change behavior) |
| MaxObjectKeys | 100000 | Maximum object key count |
| MaxArrayElements | 100000 | Maximum array element count |
| MaxConcurrency | 50 | Concurrency |
| ParallelThreshold | 10 | Falls back to sequential processing below this element count |
| MaxOperationsPerSecond | 0 | Rate cap for controlled operations (0 = no limit) |
| MaxBatchSize | 2000 | Batch operation count |
| CacheTTL | 5 minutes | Cache expiration |
| MaxCacheSize | 128 | Maximum cache entries |
| EnableCache | true | Enable cache |
| CacheResults | true | Cache operation results |
| CacheSharedResults | false | Share cached results (high-performance read-only scenarios) |
| EnableValidation | true | Enable validation (deprecated, not read) |
| StrictMode | false | Non-strict mode (deprecated, not read) |
| FullSecurityScan | false | Full scan for small input; 4KB and above uses the rolling window (see the security limits table) |
| ValidateInput | true | Validate input (deprecated, not read) |
| ValidateFilePath | true | Validate file paths |
| DetectDuplicateKeys | false | No duplicate-key detection (last duplicate key wins) |
| CreatePaths | true | Create paths automatically |
| Pretty | false | No pretty output |
| EscapeHTML | true | HTML escaping |
| ValidateUTF8 | true | UTF-8 validation |
| IncludeNulls | true | Include nulls |
| EscapeNewlines | true | Newline escaping |
| EscapeTabs | true | Tab escaping |
| FloatPrecision | -1 | Automatic precision |
| MaxDepth | 100 | Encoding depth |
| Indent | "  " | Default indentation |
| ChunkSize | 1MB | Chunk size (deprecated, not read) |
| MaxMemory | 100MB | Maximum memory |
| BufferSize | 64KB | Buffer size |
| SaveFileMode | 0 | Permission bits for newly created files (0 falls back to 0644) |
| SamplingEnabled | true | Enable sampling (deprecated, not read) |
| SampleSize | 1000 | Sample count (deprecated, not read) |
| JSONLBufferSize | 64KB | JSONL buffer size |
| JSONLMaxLineSize | 1MB | JSONL maximum line size |
| JSONLSkipEmpty | true | Skip empty lines |
| JSONLSkipComments | false | Do not skip comments |
| JSONLContinueOnErr | false | Stop on errors |
| JSONLWorkers | 4 | Reserved, does not change behavior |
| JSONLChunkSize | 1000 | Reserved, does not change behavior |
| JSONLMaxMemory | 100MB | JSONL maximum memory |
| MergeMode | MergeUnion | Union merge |

### SecurityConfig

Signature: `func SecurityConfig() Config`

Returns the security configuration, suitable for handling untrusted input.

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

**Security configuration characteristics**

| Field | Value | Description |
|-------|-------|-------------|
| MaxNestingDepthSecurity | 30 | Conservative nesting depth |
| MaxSecurityValidationSize | 10MB | Security validation size (reserved field, does not change behavior) |
| MaxObjectKeys | 5000 | Conservative key limit |
| MaxArrayElements | 5000 | Conservative element limit |
| MaxJSONSize | 10MB | Conservative size limit |
| MaxPathDepth | 30 | Conservative path depth (reserved field, does not change behavior) |
| FullSecurityScan | true | Single full scan for every input |
| StrictMode | true | Strict mode (deprecated field: `SecurityConfig` sets it to `true`, but it is not read by any parser — no actual effect) |
| EnableValidation | true | Enable validation (deprecated field: `SecurityConfig` sets it to `true`, but it is not read by any operation — no actual effect) |
| EnableCache | true | Enable cache |
| MaxCacheSize | 256 | Cache size |
| CacheTTL | 3 minutes | Shorter TTL |

### PrettyConfig

Signature: `func PrettyConfig() Config`

Returns the pretty-print configuration.

```go
result, err := json.Encode(data, json.PrettyConfig())
```

## Config Methods

### Clone

Signature: `func (c *Config) Clone() *Config`

Deep-copies the configuration (`Config.Clone` returns a new `*Config`; modifying the copy does not affect the original). Value fields are copied one by one; among reference fields, the two maps `CustomEscapes` and `CustomTypeEncoders` and the three slices `CustomValidators`, `AdditionalDangerousPatterns`, and `Hooks` are deep-copied and independently modifiable; interface fields (`CustomEncoder`, `CustomPathParser`) are shallow-copied (typically stateless or singleton implementations). Calling on a nil Config returns nil.

```go
cfg := json.DefaultConfig()
cfgCopy := cfg.Clone()
cfgCopy.EnableMetrics = true // Does not affect the original config
```

### Validate

Signature: `func (c *Config) Validate() error`

Validates the configuration and auto-corrects invalid values. This method **modifies the Config in place**, clamping illegal fields into the valid range: too small (≤0) is raised to the minimum, too large (above the cap) is lowered to the maximum. Calling on a nil Config returns an error. After correction it always returns nil — use `ValidateWithWarnings` to see what was corrected.

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1 // invalid value
if err := cfg.Validate(); err != nil {
    panic(err)
}
// MaxJSONSize is corrected in place to the minimum
```

### ValidateWithWarnings

Signature: `func (c *Config) ValidateWithWarnings() []ConfigWarning`

Validates the configuration and returns the list of correction warnings.

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1
warnings := cfg.ValidateWithWarnings()
for _, w := range warnings {
    fmt.Printf("%s: %s\n", w.Field, w.Reason)
}
```

**Clamping ranges at a glance** (auto-correction rules of `Validate`/`ValidateWithWarnings`; ≤0 counts as invalid and gets the lower bound, above the cap gets the upper bound):

| Field | Valid range (lower–upper) | Notes |
|-------|---------------------------|-------|
| `MaxJSONSize` | 1MB – 100MB | int64 |
| `MaxPathDepth` | 10 – 200 | Reserved field; remains inert after clamping |
| `MaxNestingDepthSecurity` | 10 – 200 | |
| `MaxConcurrency` | 1 – 200 | ≤0 resets to the default 50 (not the lower bound 1) |
| `ParallelThreshold` | 1 – 50 | |
| `MaxObjectKeys` | 100 – 100000 | |
| `MaxArrayElements` | 100 – 100000 | |
| `MaxSecurityValidationSize` | 1MB – 100MB | int64; reserved field, remains inert after clamping |
| `MaxBatchSize` | 10 – 10000 | |
| `MaxCacheSize` | 0 – 2000 (only negatives are invalid) | When negative, set to 0 and **EnableCache is also turned off**; 0 itself is legal but does not disable caching |
| `CacheTTL` | ≤0 invalid, reset to `DefaultCacheTTL` (5 minutes) | |
| `MaxDepth` | [0, 1000], out-of-range reset to 100 | 0 means unlimited depth; negative is invalid |
| `FloatPrecision` | [-1, 15], out-of-range reset to -1 | -1 is the automatic-precision sentinel |
| `ChunkSize` | 64KB – 100MB | |
| `MaxMemory` | 10MB – 1GB | |
| `BufferSize` | 4KB – 1MB | |
| `SampleSize` | 100 – 10000 | |
| `JSONLBufferSize` | 4KB – 1MB | |
| `JSONLMaxLineSize` | 1KB – 100MB | |
| `JSONLWorkers` | 1 – 64 | |
| `JSONLChunkSize` | 100 – 10000 | |
| `JSONLMaxMemory` | 10MB – 1GB | int64 |
| `MaxOperationsPerSecond` | [0, 1000000], negatives reset to 0 (disables rate limiting) | Rate cap |
| `SaveFileMode` | Masked to permission bits (≤ 0777) | Extra bits such as `os.ModeDir` are masked with a warning |
| `AllowedFileDirs` | Entries normalized | Relative paths resolved to absolute (with a warning); empty or unresolvable entries dropped (with a warning) |

### The ConfigWarning Type

`ConfigWarning` describes an auto-correction made during configuration validation.

```go
type ConfigWarning struct {
    Field    string // Name of the corrected field
    OldValue any    // Original value (may be nil for invalid values)
    NewValue any    // Corrected value
    Reason   string // Why it was corrected
}
```

| Field | Type | Description |
|-------|------|-------------|
| `Field` | `string` | Name of the corrected field (e.g. `MaxJSONSize`) |
| `OldValue` | `any` | Value before correction (may be nil for invalid values) |
| `NewValue` | `any` | Value after correction |
| `Reason` | `string` | Reason for the correction (e.g. below the lower bound, above the upper bound) |

### Security-Related Fields Overview

Security limits have no separate aggregate type — they are provided directly as the following Config fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `MaxJSONSize` | `int64` | 100MB | Cap on input JSON size (`ErrSizeLimit`) |
| `MaxPathDepth` | `int` | 50 | Reserved field, does not change behavior today (only feeds the config cache key and the `Validate` clamp 10–200) |
| `MaxBatchSize` | `int` | 2000 | Cap on operations per batch (`ErrSizeLimit`) |
| `MaxNestingDepthSecurity` | `int` | 200 (`DefaultMaxNestingDepth`, Validate clamps to 10–200) | Cap on input nesting depth (`ErrDepthLimit`); semantically distinct from `MaxDepth`, the encoding/decoding nesting depth (default 100) — do not confuse them |
| `MaxSecurityValidationSize` | `int64` | 10MB | Reserved field, does not change behavior today (only feeds the config cache key and the `Validate` clamp 1MB–100MB) |
| `MaxObjectKeys` | `int` | 100000 | Maximum object key count (`ErrSizeLimit`) |
| `MaxArrayElements` | `int` | 100000 | Maximum array element count (`ErrSizeLimit`) |
| `FullSecurityScan` | `bool` | `false` (scan mode follows input size) | `false`: under 4KB scanned in full, 4KB and above uses a 32KB rolling window covering every byte; `true`: every input is scanned in a single full pass |

### AddHook

Signature: `func (c *Config) AddHook(hook Hook)`

Adds an operation hook.

```go
cfg := json.DefaultConfig()
cfg.AddHook(json.LoggingHook(slog.Default()))
```

### AddValidator

<Badge type="danger" text="Deprecated" />

Signature: `func (c *Config) AddValidator(validator Validator)`

Adds a custom validator (appended to `CustomValidators`).

::: warning Deprecated
Validators added via `AddValidator` are **never executed by any public operation** (`CustomValidators` is not wired into the operation pipeline). For custom pre-operation checks, use `AddHook` with a Before hook instead (e.g. [`ValidationHook`](../extensions/hooks)). This method is kept within v1 and will not be removed.
:::

```go
cfg := json.DefaultConfig()
cfg.AddValidator(&MyValidator{}) // Deprecated: the validator is never executed
```

### AddDangerousPattern

Signature: `func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

Adds an extra security pattern.

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
// Handling untrusted input
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
result, err := json.Encode(data, json.PrettyConfig())
```

### Custom Configuration

```go
cfg := json.DefaultConfig()

// Security settings
cfg.MaxJSONSize = 10 * 1024 * 1024 // 10MB
cfg.MaxNestingDepthSecurity = 50
cfg.FullSecurityScan = true

// Hooks (the recommended way to intercept operations and run custom checks)
cfg.AddHook(json.LoggingHook(slog.Default()))
cfg.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    return nil // custom checks
}))

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Clone and Modify

```go
// Create variants from the default configuration
base := json.DefaultConfig()

// Variant 1: development configuration
devCfg := base.Clone()
devCfg.EnableMetrics = true

// Variant 2: production configuration
prodCfg := base.Clone()
prodCfg.FullSecurityScan = true
```

## Configuration Constants

```go
const (
    // Size limits
    DefaultMaxJSONSize       = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth   = 200
    DefaultMaxPathDepth      = 50
    DefaultMaxDepth          = 100                 // Default encode/decode nesting depth (Config.MaxDepth)
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

::: info Internal constants
Path validation length limits (`maxPathLength`) and similar constants have moved to internal implementation and are no longer exported as public API. Their defaults are reflected in the field defaults of the `Config` struct.
:::

---

## Merge Modes

`MergeMode` controls the merge strategy of the `MergeJSON` and `MergeMany` functions.

`MergeMode` implements `fmt.Stringer`: `func (m MergeMode) String() string` returns `"union"` / `"intersection"` / `"difference"` (unknown values return `"unknown(N)"`), convenient for logging and debug output.

| Constant           | Value | `String()` returns |
| ------------------ | ----- | ------------------ |
| `MergeUnion`       | 0     | `"union"`          |
| `MergeIntersection` | 1    | `"intersection"`   |
| `MergeDifference`  | 2     | `"difference"`     |

### MergeUnion (default)

Merges all keys/elements; on conflict the overriding value wins.

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

Keeps only keys present in both objects.

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

Keeps only keys present in the base object but absent from the overriding object.

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

| Setting | Recommended value | Notes |
|---------|-------------------|-------|
| MaxJSONSize | 10-100MB | Tune to your server memory |
| MaxNestingDepthSecurity | 30-50 | Prevents deep-nesting attacks |
| MaxPathDepth | any (reserved field) | Does not change behavior; the path string cap is 5000 bytes (returning `ErrInvalidPath` when validation is on and it is exceeded) and the segment cap is 100 internally |
| SkipValidation | false | Keep input validation on (it is on by default — do not turn it off; EnableValidation is deprecated and not read) |
| FullSecurityScan | true (untrusted input) | Switches to a single full scan, so the outcome no longer depends on where a payload sits; the default rolling window already covers every byte |

## See Also

- [Processor](./processor/) - Processor methods
- [Constants and Errors](./constants) - Configuration constants
- [Security Overview](../security/) - Security best practices
- [Interface Definitions](./interfaces) - Extension interfaces

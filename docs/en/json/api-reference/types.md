---
sidebar_label: "Type Definitions"
title: "Type Definitions - CyberGo JSON | Core Types Overview"
description: "CyberGo JSON type reference: Result[T], AccessResult, CompiledPath, Schema and ValidationError, BatchOperation and BatchResult, plus Encoder/Decoder."
sidebar_position: 60
---

# Type Definitions

The json package exports the types below, covering value results, pre-compiled paths, schema validation, batch operations, statistics, and stream encoding/decoding.

## Result[T] - Unified Result Type

`Result[T]` is a generic result wrapper built by the caller, offering type-safe error handling and value access.

### Struct Definition

```go
type Result[T any] struct {
    Value  T     // Result value
    Exists bool  // Whether the value was found
    Error  error // Error, if any
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `Value` | `T` | Result value; its type is determined by the generic parameter `T` |
| `Exists` | `bool` | Whether the path exists (whether a value was found) |
| `Error` | `error` | Operation error (`nil` when there is none) |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Ok()` | `func (r Result[T]) Ok() bool` | Checks the result is valid (no error and found) |
| `Unwrap()` | `func (r Result[T]) Unwrap() T` | Returns the value; the zero value on failure |
| `UnwrapOr()` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | Returns the value or a default |

### Usage Example

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"user": {"name": "Alice", "age": 30}}`

	// Get a typed value with GetTyped
	name := json.GetTyped[string](data, "user.name")
	fmt.Printf("Name: %s\n", name)

	// Provide a default via the defaultValue parameter
	nickname := json.GetTyped[string](data, "user.nickname", "not set")
	fmt.Printf("Nickname: %s\n", nickname)

	age := json.GetTyped[int](data, "user.age", 0)
	fmt.Printf("Age: %d\n", age)
}
```

:::tip Naming conventions
- `GetTyped[T]` reads a value of the given type and returns `T` directly, with an optional `defaultValue` parameter
- `Result[T]` is a general-purpose result wrapper constructed by the caller, for cases that must distinguish "no value" from "failed"
:::

---

## CompiledPath - Pre-compiled Path

`CompiledPath` is a type alias for a pre-compiled JSON path; it avoids re-parsing the path string when the same path is accessed repeatedly.

### Type Definition

```go
type CompiledPath = internal.CompiledPath
```

### Use Cases

When performing many repeated operations on the same path (e.g. batch queries in a loop), compile the path up front to avoid re-parsing the path string on every call.

### Compile Function

#### Processor.CompilePath

Signature: `func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

Pre-compiles a JSON path via the Processor, returning a `*CompiledPath` reusable in later operations.

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

compiled, err := processor.CompilePath("user.profile.name")
if err != nil {
    panic(err)
}
// compiled can be reused in later operations
val, err := processor.GetCompiled(jsonStr, compiled)
```

:::tip Performance hint
For high-frequency access to the same path, pre-compiling removes the path-parsing step from each call. Suited to batch operations and looped queries.
:::

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Get` | `func (cp *CompiledPath) Get(data any) (any, error)` | Gets the value at the compiled path from already-parsed JSON data |
| `Exists` | `func (cp *CompiledPath) Exists(data any) bool` | Checks whether the path has a value in the parsed data |
| `Len` | `func (cp *CompiledPath) Len() int` | Returns the number of path segments |
| `IsEmpty` | `func (cp *CompiledPath) IsEmpty() bool` | Returns true when the path has no segments |
| `Path` | `func (cp *CompiledPath) Path() string` | Returns the original path string from compile time |
| `String` | `func (cp *CompiledPath) String() string` | String representation, equivalent to `Path` |
| `Segments` | `func (cp *CompiledPath) Segments() []PathSegment` | Returns the parsed path segments (see the PathSegment section below) |
| `Release` | `func (cp *CompiledPath) Release()` | Returns the instance to the object pool; do not use it afterwards |

A path hash (FNV-1a) is also precomputed at compile time — it is an internal cache key only, with no public accessor.

### Usage Example

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	cp, err := p.CompilePath("user.name")
	if err != nil {
		panic(err)
	}
	defer cp.Release()

	// GetCompiled takes a raw JSON string, no need to parse into a Go value first
	val, err := p.GetCompiled(`{"user": {"name": "CyberGo"}}`, cp)
	if err != nil {
		panic(err)
	}
	fmt.Println(val) // Output: CyberGo
}
```

:::tip Choosing between GetCompiled and PreParse
`GetCompiled` fully parses the input string on every call — a good fit for one-off queries. When querying the same document repeatedly, use `PreParse` to get a `ParsedJSON` and call `GetFromParsed`, or `Parse` first and then `cp.Get(data)`, to avoid repeated parsing.
:::

---

## PathSegment - Path Segment

`PathSegment` represents a single parsed path segment; it is the element returned by the `ParsePath` method of the [`PathParser`](./interfaces#pathparser) interface and can also be obtained via the `Segments` method of `CompiledPath`.

### Type Definition

```go
type PathSegment = internal.PathSegment
```

::: warning An alias over an internal type
Like `CompiledPath`, `PathSegment` is a type alias of `internal.PathSegment`: field types PathSegmentType, PathSegmentFlags, and the segment-type constants (PropertySegment, etc.) are not exported from the root package. Determine segment types with the accessor methods `TypeString`, `IsArrayAccess`, etc. — do not compare the `Type` field directly against internal constants.
:::

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `Type` | PathSegmentType | Segment type enum (property/array index/slice/wildcard, etc.; test with `TypeString`) |
| `Key` | `string` | Key name used by property segments and extraction segments |
| `Index` | `int` | Subscript of array index segments; start value of slice segments (whether set, see `HasStart`) |
| `End` | `int` | End value of slice segments (whether set, see `HasEnd`) |
| `Step` | `int` | Step of slice segments (whether set, see `HasStep`) |
| `Flags` | PathSegmentFlags | Bit flags recording negative index, wildcard, flat extraction, and whether start/end/step are set |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `TypeString` | `func (ps PathSegment) TypeString() string` | Segment type name: `property` / `array` / `slice` / `wildcard` / `recursive` / `filter` / `extract` / `append` |
| `String` | `func (ps PathSegment) String() string` | Path representation of the segment (e.g. `name`, `[0]`, `[1:3]`, `[*]`) |
| `IsArrayAccess` | `func (ps PathSegment) IsArrayAccess() bool` | True for array index, slice, or wildcard segments |
| `IsWildcardSegment` | `func (ps *PathSegment) IsWildcardSegment() bool` | True for wildcard segments (`[*]`) |
| `IsFlatExtract` | `func (ps *PathSegment) IsFlatExtract() bool` | True for flat extraction segments |
| `IsNegativeIndex` | `func (ps *PathSegment) IsNegativeIndex() bool` | True for negative array indices (e.g. `[-1]`) |
| `HasStart` | `func (ps *PathSegment) HasStart() bool` | Whether the slice segment sets a start value |
| `HasEnd` | `func (ps *PathSegment) HasEnd() bool` | Whether the slice segment sets an end value |
| `HasStep` | `func (ps *PathSegment) HasStep() bool` | Whether the slice segment sets a step |
| `GetStart` | `func (ps *PathSegment) GetStart() (int, bool)` | Returns the start value and whether it is set (0, false when unset) |
| `GetEnd` | `func (ps *PathSegment) GetEnd() (int, bool)` | Returns the end value and whether it is set |
| `GetStep` | `func (ps *PathSegment) GetStep() (int, bool)` | Returns the step and whether it is set |
| `GetArrayIndex` | `func (ps PathSegment) GetArrayIndex(arrayLength int) (int, error)` | Resolves the array subscript: negative indices convert to positive (`-1` means the last element); out of range or a non-array-index segment returns an error |

### Usage Example

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	cp, err := p.CompilePath("users[0].name")
	if err != nil {
		panic(err)
	}
	defer cp.Release()

	// Segments returns the parsed path segments
	for _, seg := range cp.Segments() {
		fmt.Printf("Segment %s (%s)\n", seg.String(), seg.TypeString())
	}

	// Array index segment: GetArrayIndex resolves the actual subscript (negative
	// indices convert to positive; out of range returns an error)
	arrSeg := cp.Segments()[1]
	idx, err := arrSeg.GetArrayIndex(1)
	if err != nil {
		panic(err)
	}
	fmt.Println("Array index:", idx)
	// Output:
	// Segment users (property)
	// Segment [0] (array)
	// Segment name (property)
	// Array index: 0
}
```

---

## AccessResult - Property Access Result

`AccessResult` is the safe property access result, providing chained type conversion.

### Struct Definition

```go
type AccessResult struct {
    Value  any    // Result value
    Exists bool   // Whether the path exists
    Type   string // Runtime type information (for debugging)
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `Value` | `any` | Result value |
| `Exists` | `bool` | Whether the path exists |
| `Type` | `string` | Runtime type information (for debugging) |

When the value is JSON `null`, `Exists` is `true`, `Type` is `"null"`, and `Value` is `nil` — `Exists` is what separates "present but empty" from "absent".

### Creation Methods

#### Processor.SafeGet

Signature: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Safely gets a property, returning an `AccessResult` for chained type conversion.

The package-level function `SafeGet` works too:

Signature: `func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

result := processor.SafeGet(data, "user.age")

if !result.Exists {
    fmt.Println("Path does not exist")
    return
}

// Check the type
fmt.Println("Type:", result.Type)
```

### Chained Conversion Methods

| Method | Return type | Description |
|--------|-------------|-------------|
| `Unwrap()` | `any` | Returns the value; nil when absent |
| `UnwrapOr(defaultValue)` | `any` | Returns the value or a default |
| `AsString()` | `(string, error)` | Converts to a string (strict type check) |
| `AsStringConverted()` | `(string, error)` | Format-converts to a string |
| `AsInt()` | `(int, error)` | Converts to an integer (bool not converted) |
| `AsFloat64()` | `(float64, error)` | Converts to float64 (bool not converted) |
| `AsBool()` | `(bool, error)` | Converts to a boolean |
| `Ok()` | `bool` | Checks whether the path exists |

`AsString()` returns an error wrapping `ErrTypeMismatch` on a conversion failure (so `errors.Is` matches); `AsInt()`, `AsFloat64()`, and `AsBool()` return a plain error without the sentinel. When the path does not exist, each conversion method returns `ErrPathNotFound`.

:::warning Note
The `AsInt64()`, `AsArray()`, and `AsObject()` methods have been removed. Use `GetTyped[T]` for those types.
:::

```go
result := processor.SafeGet(data, "user.profile")

// Chained calls
name, _ := result.AsString()
email, _ := result.AsString()
age, _ := result.AsInt()
price, _ := result.AsFloat64()
active, _ := result.AsBool()

// Use GetTyped when you need array or object types
arr := json.GetTyped[[]any](data, "items")
obj := json.GetTyped[map[string]any](data, "user.profile")
```

### Usage Example

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	data := `{"user": {"name": "Alice", "age": 30, "active": true}}`

	// Safe get and convert
	result := processor.SafeGet(data, "user.age")

	// Use the AccessResult methods directly
	age, err := result.AsInt()
	if err != nil {
		panic(err)
	}
	fmt.Printf("Age: %d\n", age)

	// Get a missing path
	missing := processor.SafeGet(data, "user.nickname")
	if !missing.Exists {
		fmt.Println("Nickname does not exist")
	}
}
```

---

## Schema - JSON Schema Type

`Schema` defines structural validation rules for JSON data, supporting a subset of JSON Schema Draft 7.

### Struct Definition

```go
type Schema struct {
    Type                 string            `json:"type,omitempty"`
    Properties           map[string]*Schema `json:"properties,omitempty"`
    Items                *Schema           `json:"items,omitempty"`
    Required             []string          `json:"required,omitempty"`
    MinLength            int               `json:"minLength,omitempty"`
    MaxLength            int               `json:"maxLength,omitempty"`
    Minimum              float64           `json:"minimum,omitempty"`
    Maximum              float64           `json:"maximum,omitempty"`
    Pattern              string            `json:"pattern,omitempty"`
    Format               string            `json:"format,omitempty"`
    AdditionalProperties bool              `json:"additionalProperties,omitempty"`
    MinItems             int               `json:"minItems,omitempty"`
    MaxItems             int               `json:"maxItems,omitempty"`
    UniqueItems          bool              `json:"uniqueItems,omitempty"`
    Enum                 []any             `json:"enum,omitempty"`
    Const                any               `json:"const,omitempty"`
    MultipleOf           float64           `json:"multipleOf,omitempty"`
    ExclusiveMinimum     bool              `json:"exclusiveMinimum,omitempty"`
    ExclusiveMaximum     bool              `json:"exclusiveMaximum,omitempty"`
    Title                string            `json:"title,omitempty"`
    Description          string            `json:"description,omitempty"`
    Default              any               `json:"default,omitempty"`
    Examples             []any             `json:"examples,omitempty"`
}
```

### Creating a Schema

#### Direct construction

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name":  {Type: "string"},
        "email": {Type: "string", Format: "email"},
        "age":   {Type: "number"},
    },
}
```

::: warning Two hard restrictions
- `Type` supports seven values: `object`/`array`/`string`/`number`/`integer`/`boolean`/`null`; `integer` follows JSON Schema semantics and accepts values that are mathematically integers (`1` and `1.0` pass, `1.5` fails with an `expected type integer` error). See [Schema Validation](./schema#schema-constraint-fields-overview).
- Assigning `MinLength`/`MaxLength`/`Minimum`/`Maximum`/`MinItems`/`MaxItems`/`ExclusiveMinimum`/`ExclusiveMaximum` through a struct literal **has no effect**; they must be enabled via the pointer fields of `NewSchema` (deprecated alias: `NewSchemaWithConfig`). See [Schema Validation](./schema#creating-a-schema).
:::

#### Using NewSchema

Signature: `func NewSchema(cfg SchemaConfig) *Schema` — the **canonical constructor** for a configured Schema; length/range pointer constraints are enabled through it.

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchema(cfg)
```

The older name `NewSchemaWithConfig(cfg)` is fully equivalent to `NewSchema` and **deprecated** (retained within v1); use `NewSchema(cfg)` in new code.

#### Using DefaultSchema

Signature: `func DefaultSchema() *Schema`

Returns an empty Schema instance with default configuration.

```go
schema := json.DefaultSchema()
schema.Type = "object"
schema.Required = []string{"id"}
```

### The SchemaConfig Struct

```go
type SchemaConfig struct {
    Type                 string
    Properties           map[string]*Schema
    Items                *Schema
    Required             []string
    MinLength            *int
    MaxLength            *int
    Minimum              *float64
    Maximum              *float64
    Pattern              string
    Format               string
    AdditionalProperties *bool
    MinItems             *int
    MaxItems             *int
    UniqueItems          bool
    Enum                 []any
    Const                any
    MultipleOf           *float64
    ExclusiveMinimum     *bool
    ExclusiveMaximum     *bool
    Title                string
    Description          string
    Default              any
    Examples             []any
}
```

| Field category | Fields | Type | Description |
|----------------|--------|------|-------------|
| Direct fields | `Type`/`Pattern`/`Format`/`UniqueItems`/`Enum`/`Const`/`Title`/`Description`/`Default`/`Examples` | Value types | Effective on direct assignment |
| Structural fields | `Properties`/`Items`/`Required` | Value types | Sub-schemas, required properties |
| Pointer fields | `MinLength`/`MaxLength`/`Minimum`/`Maximum`/`MinItems`/`MaxItems`/`MultipleOf`/`ExclusiveMinimum`/`ExclusiveMaximum` | `*int`/`*float64`/`*bool` | **The constraint activates only when non-nil** (pointers distinguish "unset" from "zero value") |
| Pointer fields | `AdditionalProperties` | `*bool` | Effective when non-nil; defaults to `true` when nil |

#### DefaultSchemaConfig

Signature: `func DefaultSchemaConfig() SchemaConfig`

Returns a SchemaConfig with defaults (`AdditionalProperties` points to `true`; the rest are zero values).

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchema(cfg)
```

### Usage Example

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// Length/range constraints enabled via NewSchema pointer fields
	minLen, maxLen := 1, 100
	minAge, maxAge := 0.0, 150.0

	nameCfg := json.DefaultSchemaConfig()
	nameCfg.Type = "string"
	nameCfg.MinLength = &minLen
	nameCfg.MaxLength = &maxLen

	ageCfg := json.DefaultSchemaConfig()
	ageCfg.Type = "number" // "number" accepts every number; use "integer" for integers only
	ageCfg.Minimum = &minAge
	ageCfg.Maximum = &maxAge

	schema := &json.Schema{
		Type:     "object",
		Required: []string{"name", "email"},
		Properties: map[string]*json.Schema{
			"name":  json.NewSchema(nameCfg),
			"email": {Type: "string", Format: "email"},
			"age":   json.NewSchema(ageCfg),
		},
	}

	// Validate the JSON
	data := `{"name": "Alice", "email": "alice@example.com", "age": 30}`
	errors, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}

	if len(errors) > 0 {
		for _, e := range errors {
			fmt.Printf("Validation error [%s]: %s\n", e.Path, e.Message)
		}
	} else {
		fmt.Println("Validation passed")
	}
	// Output: Validation passed
}
```

---

## ValidationError

The schema validation error type.

### Struct Definition

```go
type ValidationError struct {
    Path    string `json:"path"`    // Path where the error occurred
    Message string `json:"message"` // Error message
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `Path` | `string` | JSON path where the validation error occurred |
| `Message` | `string` | Message describing the validation failure |

### Methods

#### Error

Signature: `func (ve *ValidationError) Error() string`

Implements the error interface.

```go
for _, e := range errors {
    fmt.Println(e.Error())
}
```

---

## BatchOperation

A batch operation definition; the input unit of `ProcessBatch`.

### Struct Definition

```go
type BatchOperation struct {
    Type    string `json:"type"`     // Operation type: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // JSON data string
    Path    string `json:"path"`     // Target path
    Value   any    `json:"value"`    // Value for Set operations
    ID      string `json:"id"`       // Operation identifier
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `Type` | `string` | Operation type; only `"get"`, `"set"`, `"delete"`, `"validate"` are supported — other values report `unknown operation type` in the corresponding `BatchResult.Error` |
| `JSONStr` | `string` | Target JSON string this operation acts on (each operation carries its own) |
| `Path` | `string` | Target path |
| `Value` | `any` | Used only by `"set"` operations; the value to write |
| `ID` | `string` | Operation identifier, copied verbatim into `BatchResult.ID` for reconciliation |

:::tip Batch cap
When the operation count of `ProcessBatch` exceeds `Config.MaxBatchSize` (default 2000), the whole call returns `ErrSizeLimit`; the `BatchResult.Result` of a `"validate"` operation is `map[string]any{"valid": bool}`.
:::

---

## BatchResult

A batch operation result.

### Struct Definition

```go
type BatchResult struct {
    ID     string `json:"id"`     // Operation identifier (matches BatchOperation.ID)
    Result any    `json:"result"` // Operation result
    Error  error  `json:"error"`  // Error, if any
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `ID` | `string` | Matches `BatchOperation.ID`, one-to-one with input order |
| `Result` | `any` | Operation result; for `"get"` the retrieved value, for `"set"`/`"delete"` the modified JSON string, for `"validate"` a `map[string]any{"valid": bool}` |
| `Error` | `error` | This single operation's error; **returned per item** — one failure does not abort the batch (execution proceeds item by item internally) |

---

## WarmupResult

The cache warm-up result, returned by `WarmupCache`.

### Struct Definition

```go
type WarmupResult struct {
    TotalPaths  int      `json:"total_paths"`            // Total path count
    Successful  int      `json:"successful"`             // Successfully warmed up count
    Failed      int      `json:"failed"`                 // Failed count
    SuccessRate float64  `json:"success_rate"`           // Success rate
    FailedPaths []string `json:"failed_paths,omitempty"` // List of failed paths
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `TotalPaths` | `int` | Total number of paths submitted for warm-up |
| `Successful` | `int` | Number of paths successfully written to the cache |
| `Failed` | `int` | Number of paths that failed warm-up |
| `SuccessRate` | `float64` | Success rate as a **percentage 0–100** (not 0–1) |
| `FailedPaths` | `[]string` | List of failed paths (nil when all succeed) |

::: warning An error is returned when everything fails
When **all paths fail**, `WarmupCache` returns a non-nil error alongside the `WarmupResult` (carrying the last error); when the cache is disabled (`EnableCache: false`) it returns an error directly.
:::

---

## ParsedJSON

A pre-parsed JSON document, reusable across multiple queries.

### Struct Definition

`ParsedJSON`'s internal fields are unexported; access goes through methods.

```go
type ParsedJSON struct {
    // Internal fields (unexported)
    // Use the Data() method to get the parsed data
}
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Data` | `func (p *ParsedJSON) Data() any` | Returns the underlying parsed data; nil after `Release` |
| `Release` | `func (p *ParsedJSON) Release()` | Sets the internal data to nil, so the parse tree can be garbage-collected even if the `ParsedJSON` itself is still referenced |

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Pre-parse the JSON
parsed, err := processor.PreParse(`{"user": {"name": "Alice", "age": 30}}`)
if err != nil {
    panic(err)
}

// Query the pre-parsed result multiple times
name, _ := processor.GetFromParsed(parsed, "user.name")
age, _ := processor.GetFromParsed(parsed, "user.age")
```

### Use Cases

| Scenario | Description |
|----------|-------------|
| High-frequency queries | Avoids repeated parsing when querying the same JSON many times |
| Batch path retrieval | Fetch multiple paths at once with `GetMultiple` |
| Performance optimization | Parses once; later queries skip the parse step |

:::tip Performance hint
When querying the same JSON string repeatedly, pre-parsing with `PreParse` removes the repeated parse.
:::

---

## Stats

Processor statistics, obtained via the package-level `GetStats()` or `Processor.GetStats()`.

### Struct Definition

```go
type Stats struct {
    CacheSize        int64         `json:"cache_size"`        // Current cache size
    CacheMemory      int64         `json:"cache_memory"`      // Cache memory usage (bytes)
    MaxCacheSize     int           `json:"max_cache_size"`    // Maximum cache size
    HitCount         int64         `json:"hit_count"`         // Cache hit count
    MissCount        int64         `json:"miss_count"`        // Cache miss count
    HitRatio         float64       `json:"hit_ratio"`         // Cache hit ratio
    CacheTTL         time.Duration `json:"cache_ttl"`         // Cache expiration time
    CacheEnabled     bool          `json:"cache_enabled"`     // Whether the cache is enabled
    IsClosed         bool          `json:"is_closed"`         // Whether the processor is closed
    MemoryEfficiency float64       `json:"memory_efficiency"` // Memory efficiency
    OperationCount   int64         `json:"operation_count"`   // Total operation count
    ErrorCount       int64         `json:"error_count"`       // Total error count
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `CacheSize` | `int64` | Current cache entry count |
| `CacheMemory` | `int64` | Estimated cache memory usage (bytes) |
| `MaxCacheSize` | `int` | Configured cache entry cap (`Config.MaxCacheSize`) |
| `HitCount` | `int64` | Cache hit count |
| `MissCount` | `int64` | Cache miss count |
| `HitRatio` | `float64` | Hit ratio (0–1) |
| `CacheTTL` | `time.Duration` | Current cache entry TTL |
| `CacheEnabled` | `bool` | Whether the cache is enabled |
| `IsClosed` | `bool` | Whether the processor has been `Close`d |
| `MemoryEfficiency` | `float64` | Memory efficiency metric (cache hit count / MB of cache memory; may exceed 1) |
| `OperationCount` | `int64` | Cumulative operation count of the processor |
| `ErrorCount` | `int64` | Cumulative error count of the processor |

---

## Config Security Fields Overview

Security limits have no separate aggregate type — they are provided directly as fields of [`Config`](./config#the-config-struct):

| Config field | Type | Default | Description |
|-------------|------|---------|-------------|
| `MaxJSONSize` | `int64` | 100MB (`DefaultMaxJSONSize`) | Cap on input JSON size; exceeding it returns `ErrSizeLimit` |
| `MaxPathDepth` | `int` | 50 (`DefaultMaxPathDepth`) | Reserved field, does not change behavior today (only feeds the config cache key and `Validate` clamps). The segment cap is fixed at 100 internally and exceeding it produces the error message `path too deep`; the path string cap is 5000 bytes, returning `ErrInvalidPath` when validation is on and it is exceeded |
| `MaxBatchSize` | `int` | 2000 (`DefaultMaxBatchSize`) | Cap on operations per batch; exceeding it returns `ErrSizeLimit` |
| `MaxNestingDepthSecurity` | `int` | 200 (`DefaultMaxNestingDepth`) | Cap on input nesting depth (for security scanning); exceeding it returns `ErrDepthLimit`; do not confuse with `Config.MaxDepth` (encoding/decoding nesting depth, default 100) |
| `MaxSecurityValidationSize` | `int64` | 10MB (`DefaultMaxSecuritySize`) | Reserved field, does not change behavior today (only feeds the config cache key and `Validate` clamps); security scanning does not switch strategy based on it |
| `MaxObjectKeys` | `int` | 100000 (`DefaultMaxObjectKeys`) | Maximum object key count; exceeding it returns `ErrSizeLimit` |
| `MaxArrayElements` | `int` | 100000 (`DefaultMaxArrayElements`) | Maximum array element count; exceeding it returns `ErrSizeLimit` |
| `FullSecurityScan` | `bool` | `false` (scan mode follows input size) | `false`: under 4KB scanned in full, 4KB and above uses a 32KB rolling window covering every byte plus a density check on 4KB samples from the beginning, middle, and end; `true`: every input is scanned in a single full pass |

`Config.Validate` clamps out-of-range values back into the legal ranges (e.g. `MaxNestingDepthSecurity` clamped to 10–200, `MaxObjectKeys` to 100–100000); use `ValidateWithWarnings` to see the adjustments. For the full semantics of each field see [Config](./config#the-config-struct).

---

## HealthStatus

Health status information, obtained via the package-level `GetHealthStatus()` or `Processor.GetHealthStatus()`.

### Struct Definition

```go
type HealthStatus struct {
    Timestamp time.Time              `json:"timestamp"` // Check timestamp
    Healthy   bool                   `json:"healthy"`   // Whether healthy
    Checks    map[string]CheckResult `json:"checks"`    // Per-check results
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `Timestamp` | `time.Time` | Timestamp of this health check |
| `Healthy` | `bool` | Overall health conclusion (true when all checks pass) |
| `Checks` | `map[string]CheckResult` | Per-check results, keyed by check name |

### The CheckResult Struct

The result of a single health check.

```go
type CheckResult struct {
    Healthy bool   `json:"healthy"` // Whether this check is healthy
    Message string `json:"message"` // Check message
}
```

| Field | Type | Description |
|-------|------|-------------|
| `Healthy` | `bool` | Whether this check passed |
| `Message` | `string` | Descriptive pass/fail message |

---

## IterableValue

The iteration value wrapper.

### Method Overview

**Basic access**

| Method | Description |
|--------|-------------|
| `Get(path)` | Get a value by path |
| `GetString(path)` | Get a string |
| `GetInt(path)` | Get an integer |
| `GetFloat64(path)` | Get a float |
| `GetBool(path)` | Get a boolean |
| `GetArray(path)` | Get an array |
| `GetObject(path)` | Get an object |

**Getters with defaults**

| Method | Description |
|--------|-------------|
| `GetWithDefault(path, defaultValue)` | Get a value, or the default when absent |
| `GetStringWithDefault(path, defaultValue)` | Get a string, or the default when absent |
| `GetIntWithDefault(path, defaultValue)` | Get an integer, or the default when absent |
| `GetFloat64WithDefault(path, defaultValue)` | Get a float, or the default when absent |
| `GetBoolWithDefault(path, defaultValue)` | Get a boolean, or the default when absent |

**Checks and traversal**

| Method | Description |
|--------|-------------|
| `Exists(path)` | Check whether a field exists |
| `IsNull(path)` | Check whether the given path is null |
| `IsNullData()` | Check whether the underlying value is null |
| `IsEmpty(path)` | Check whether the given path is empty |
| `IsEmptyData()` | Check whether the underlying value is empty |
| `GetData()` | Get the underlying raw data |
| `Break()` | Return the break signal, stopping iteration |
| `ForeachNested(path, fn)` | Traverse nested structures |
| `Release()` | Release resources |

See the [Iterators](./iterator) documentation.

---

## Encoding Error Types

The json package exports the following encode/decode error types for fine-grained error handling.

### SyntaxError - Syntax Error

A JSON syntax parse error, indicating the input is not valid JSON.

#### Struct Definition

```go
type SyntaxError struct {
    Offset int64 // Position where the error occurred (byte offset)
    // Contains other unexported fields
}
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *SyntaxError) Error() string` | Returns the error description, including the offset |

```go
data := `{invalid json}`
_, err := json.ParseAny(data)
if syntaxErr, ok := err.(*json.SyntaxError); ok {
    fmt.Printf("Syntax error, offset: %d\n", syntaxErr.Offset)
}
```

---

### UnmarshalTypeError - Unmarshal Type Error

Returned when a JSON value cannot be converted to the target Go type.

#### Struct Definition

```go
type UnmarshalTypeError struct {
    Value  string       // Description of the JSON value (e.g. "string", "number")
    Type   reflect.Type // Target Go type
    Offset int64        // Position where the error occurred (byte offset)
    Struct string       // Name of the struct containing the field, if any
    Field  string       // Field name, if any
    Err    error        // Internal error, if any
}
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *UnmarshalTypeError) Error() string` | Returns the type-mismatch error description |
| `Unwrap` | `func (e *UnmarshalTypeError) Unwrap() error` | Returns the internal error |

```go
type User struct {
    Age int `json:"age"`
}
var user User
err := json.Unmarshal([]byte(`{"age": "not_a_number"}`), &user)
if typeErr, ok := err.(*json.UnmarshalTypeError); ok {
    fmt.Printf("Type error: JSON value %s cannot convert to %v\n", typeErr.Value, typeErr.Type)
}
```

---

### UnsupportedTypeError - Unsupported Type Error

Returned when trying to encode a type Go does not support.

#### Struct Definition

```go
type UnsupportedTypeError struct {
    Type reflect.Type // The unsupported Go type
}
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *UnsupportedTypeError) Error() string` | Returns a description of the unsupported type |

```go
type Chan chan int
data := Chan(make(chan int))
_, err := json.Marshal(data)
if unsupportedErr, ok := err.(*json.UnsupportedTypeError); ok {
    fmt.Printf("Unsupported type: %v\n", unsupportedErr.Type)
}
```

---

### UnsupportedValueError - Unsupported Value Error

Returned when trying to encode an unsupported value (e.g. NaN, Infinity).

#### Struct Definition

```go
type UnsupportedValueError struct {
    Value reflect.Value // The unsupported value
    Str   string        // Error description
}
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *UnsupportedValueError) Error() string` | Returns a description of the unsupported value |

```go
val := math.NaN()
_, err := json.Marshal(val)
if valErr, ok := err.(*json.UnsupportedValueError); ok {
    fmt.Printf("Unsupported value: %s\n", valErr.Str)
}
```

---

### InvalidUnmarshalError - Invalid Unmarshal Target Error

Returned when the target argument of `Unmarshal` is not a pointer or is nil.

#### Struct Definition

```go
type InvalidUnmarshalError struct {
    Type reflect.Type // Type of the target argument
}
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *InvalidUnmarshalError) Error() string` | Returns the invalid-target error description |

```go
var target string // A pointer should be passed
err := json.Unmarshal([]byte(`"hello"`), target) // Error: no pointer passed
if invalidErr, ok := err.(*json.InvalidUnmarshalError); ok {
    fmt.Printf("Invalid unmarshal target: %v\n", invalidErr.Type)
}
```

---

### MarshalerError - Marshaler Error

Wraps the error returned by a type's `MarshalJSON` or `MarshalText` method.

#### Struct Definition

```go
type MarshalerError struct {
    Type reflect.Type // The type implementing MarshalJSON or MarshalText
    Err  error        // The error returned by MarshalJSON or MarshalText
    // Contains other unexported fields
}
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *MarshalerError) Error() string` | Returns the marshaler error description |
| `Unwrap` | `func (e *MarshalerError) Unwrap() error` | Returns the internal error |

```go
type BadMarshaler struct{}

func (BadMarshaler) MarshalJSON() ([]byte, error) {
    return nil, errors.New("marshal failed")
}

_, err := json.Marshal(BadMarshaler{})
if marshalErr, ok := err.(*json.MarshalerError); ok {
    fmt.Printf("Marshaler error (type: %v): %v\n", marshalErr.Type, marshalErr.Err)
}
```

---

## Encoder - JSON Encoder

`Encoder` writes JSON values to an output stream. Its method signatures match `encoding/json.Encoder`, with an optional `Config` parameter added.

### Creation

Signature: `func NewEncoder(w io.Writer, cfg ...Config) *Encoder`

Creates an encoder writing to `w`. Supports an optional `Config` parameter to customize encoding behavior.

```go
file, _ := os.Create("output.json")
defer file.Close()

encoder := json.NewEncoder(file)
err := encoder.Encode(map[string]any{"name": "Alice"})
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Encode` | `func (enc *Encoder) Encode(v any) error` | Encodes a Go value as JSON and writes it to the stream |
| `SetEscapeHTML` | `func (enc *Encoder) SetEscapeHTML(on bool)` | Sets whether HTML special characters are escaped |
| `SetIndent` | `func (enc *Encoder) SetIndent(prefix, indent string)` | Sets the indentation format |

### Usage Example

```go
package main

import (
	"bytes"
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetIndent("", "  ")
	encoder.SetEscapeHTML(true)

	err := encoder.Encode(map[string]any{
		"name":  "Alice",
		"email": "alice@example.com",
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(buf.String())
}
```

---

## Decoder - JSON Decoder

`Decoder` reads and decodes JSON values from an input stream. Its method signatures match `encoding/json.Decoder`, with an optional `Config` parameter added.

### Creation

Signature: `func NewDecoder(r io.Reader, cfg ...Config) *Decoder`

Creates a decoder reading from `r`. Supports an optional `Config` parameter.

```go
file, _ := os.Open("data.json")
defer file.Close()

decoder := json.NewDecoder(file)
for decoder.More() {
    var obj map[string]any
    if err := decoder.Decode(&obj); err != nil {
        break
    }
    fmt.Println(obj)
}
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Decode` | `func (dec *Decoder) Decode(v any) error` | Reads the next JSON value from the stream and decodes it |
| `UseNumber` | `func (dec *Decoder) UseNumber()` | Makes the decoder parse numbers as `Number` instead of `float64` |
| `DisallowUnknownFields` | `func (dec *Decoder) DisallowUnknownFields()` | Errors on unknown fields during decoding |
| `Buffered` | `func (dec *Decoder) Buffered() io.Reader` | Returns a Reader over the data remaining in the decoder buffer |
| `InputOffset` | `func (dec *Decoder) InputOffset() int64` | Returns the offset of the current input position |
| `More` | `func (dec *Decoder) More() bool` | Checks whether more JSON values remain in the stream |
| `Token` | `func (dec *Decoder) Token() (Token, error)` | Reads the next JSON token |

### Usage Example

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"strings"
)

func main() {
	input := `{"name":"Alice","age":30}{"name":"Bob","age":25}`
	decoder := json.NewDecoder(strings.NewReader(input))

	for decoder.More() {
		var person map[string]any
		if err := decoder.Decode(&person); err != nil {
			break
		}
		fmt.Printf("Name: %s, Age: %v\n", person["name"], person["age"])
	}
}
```

### Streaming Decode Example

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"strings"
)

func main() {
	// Decode multiple values from a JSON stream
	input := `[1,2,3][4,5,6]`
	decoder := json.NewDecoder(strings.NewReader(input))

	for decoder.More() {
		var arr []any
		if err := decoder.Decode(&arr); err != nil {
			panic(err)
		}
		fmt.Println(arr)
	}
}
```

### Token Reading Example

```go
decoder := json.NewDecoder(strings.NewReader(`{"name":"Alice"}`))
for {
    token, err := decoder.Token()
    if err != nil {
        break
    }
    switch v := token.(type) {
    case json.Delim:
        fmt.Printf("Delimiter: %s\n", string(v))
    case string:
        fmt.Printf("String: %s\n", v)
    case float64:
        fmt.Printf("Number: %v\n", v)
    case bool:
        fmt.Printf("Bool: %v\n", v)
    case nil:
        fmt.Println("null")
    }
}
```

---

## Token - JSON Token

`Token` is a JSON token value holding one of the following types:

- `Delim`, representing the four JSON delimiters `[ ] { }`
- `bool`, representing a JSON boolean
- `float64`, representing a JSON number
- `Number`, representing a JSON number when `UseNumber` is enabled
- `string`, representing a JSON string
- `nil`, representing JSON null

```go
type Token any
```

Obtained via `Decoder.Token()`.

---

## Number - JSON Number

`Number` represents a JSON number string; used by the Decoder when `UseNumber` mode is enabled.

```go
type Number string
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `String` | `func (n Number) String() string` | Returns the string representation of the number |
| `Float64` | `func (n Number) Float64() (float64, error)` | Converts to float64 |
| `Int64` | `func (n Number) Int64() (int64, error)` | Converts to int64 |

```go
decoder := json.NewDecoder(strings.NewReader(`{"price": 19.99}`))
decoder.UseNumber()
var obj map[string]any
decoder.Decode(&obj)

if num, ok := obj["price"].(json.Number); ok {
    f, _ := num.Float64()
    fmt.Println(f) // 19.99
}
```

---

## Delim - JSON Delimiter

`Delim` is the JSON delimiter type, corresponding to the four characters `[`, `]`, `{`, `}`.

```go
type Delim rune
```

### Methods

#### String

Signature: `func (d Delim) String() string`

Returns the string representation of the delimiter.

```go
token, _ := decoder.Token()
if delim, ok := token.(json.Delim); ok {
    fmt.Println(delim.String()) // "[" or "{" etc.
}
```

---

## See Also

- [Package Functions](./functions/) - Package-level function reference
- [Config](./config) - Configuration options
- [Processor](./processor/) - Processor methods
- [Interface Definitions](./interfaces) - Extension interfaces

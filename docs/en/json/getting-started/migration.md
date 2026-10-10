---
title: "Migrating from encoding/json - CyberGo JSON | 3-Step Guide"
description: "Migrate from encoding/json to CyberGo JSON: three-step import swap, Marshal/Encoder/Decoder and error-type compatibility, security behavior differences, FAQ."
sidebar_label: "Migrating from the Standard Library"
sidebar_position: 60
---

# Migrating from the Standard Library

`cybergodev/json` is **100% compatible** with the standard `encoding/json` — just swap the import path and existing code compiles and runs without any changes (the few boundary differences from default input security validation are covered in [Behavioral Differences](#behavioral-differences) below). This page walks you through the migration and the incremental capabilities available afterwards.

## Migration in Three Steps

1. **Install**:

   ```bash
   go get github.com/cybergodev/json
   ```

2. **Replace the import**: change `"encoding/json"` to `"github.com/cybergodev/json"`.

   ```go
   // Before migration
   import "encoding/json"

   // After migration
   import "github.com/cybergodev/json"
   ```

3. **Done**: it compiles; no existing code needs changing.

## Fully Compatible APIs

The table maps `encoding/json` to `cybergodev/json`:

| encoding/json | cybergodev/json | Notes |
|---|---|---|
| `Marshal(v)` | `Marshal(v, cfg...)` | Signature-compatible; extra optional cfg parameter |
| `Unmarshal(data, &v)` | `Unmarshal(data, &v, cfg...)` | Same as above |
| `MarshalIndent(v, prefix, indent)` | Same name | Fully compatible |
| `Compact(dst, src)` | Same name | Fully compatible |
| `Indent(dst, src, prefix, indent)` | Same name | Fully compatible |
| `HTMLEscape(dst, src)` | Same name | Fully compatible |
| `Valid(data)` | `Valid(data, cfg...)` | Signature-compatible |
| `NewEncoder(w)` | `NewEncoder(w, cfg...)` | Signature-compatible |
| `NewDecoder(r)` | `NewDecoder(r, cfg...)` | Signature-compatible |
| `Number` | `Number` | Type-compatible (`String`/`Int64`/`Float64`/`MarshalJSON` all preserved) |
| `Delim` | `Delim` | Type-compatible (`String()` preserved) |
| `Token` | `Token` | Type-compatible |

**Method-level** compatibility of `Encoder` and `Decoder` is equally complete — streaming code needs no changes after migration:

| Method | Belongs to | Compatibility |
|---|---|---|
| `Encode(v)` / `SetIndent(prefix, indent)` / `SetEscapeHTML(on)` | `*Encoder` | Fully compatible |
| `Decode(v)` / `Token()` / `More()` / `Buffered()` / `InputOffset()` | `*Decoder` | Fully compatible |
| `UseNumber()` / `DisallowUnknownFields()` | `*Decoder` | Fully compatible |

Error types map one to one as well; code relying on `errors.As` / type assertions works directly: `SyntaxError`, `UnmarshalTypeError`, `InvalidUnmarshalError`, `MarshalerError`, `UnsupportedTypeError`, and `UnsupportedValueError` all exist and behave identically (see [Error Variables](../api-reference/constants#error-variables)).

The error structs' **locator fields** are likewise preserved; code that pinpoints failures or tallies error categories by these fields needs no changes:

| Type | Field | Type | Description |
|------|-------|------|-------------|
| `SyntaxError` | `Offset` | `int64` | Bytes read before the error occurred |
| `UnmarshalTypeError` | `Offset` | `int64` | Bytes read before the error occurred |
| `UnmarshalTypeError` | `Struct` | `string` | Name of the root type containing the failing field |
| `UnmarshalTypeError` | `Field` | `string` | Full path from the root to the failing value |
| `UnsupportedValueError` | `Str` | `string` | Text representation of the unsupported value (e.g. NaN, +Inf) |

When `UnmarshalTypeError`'s `Struct` / `Field` are non-empty, `Error()` prints `json: cannot unmarshal <value> into Go struct field <Struct>.<Field> of type <type>` — verbatim identical to the standard library.

::: tip Optional cfg parameters
Every extra `cfg ...Config` parameter is **optional** (variadic). Without it, behavior on ordinary data matches the standard library (boundary differences of default input validation in [Behavioral Differences](#behavioral-differences) below); pass cfg only to enable security mode, caching, and other enhancements.

Three **intentional exceptions** regarding cfg (from the library's design conventions):

- **Typed read functions** (`GetTyped`, `GetString`, `GetInt`, etc.) take **default values** as their variadic parameter, not cfg — Go allows only one variadic parameter. For configuration-aware typed reads, use `SafeGet`, or the typed methods (`GetString`, `GetInt`) of a Processor created with `New(cfg)`.
- **Convenience variants** (`SetCreate`, `SetMultipleCreate`, `DeleteClean`) equal the plain versions with `CreatePaths` (or `CleanupNulls` + `CompactArrays`) forcibly enabled.
- `Valid` returns a single `bool` (standard-library signature); use `ValidWithConfig` (returning `bool, error`) when you need the failure reason.
:::

## Code Example: Change Only the Import

The example below shows the "import-only" swap; encoding, decoding, and struct tag usage are identical to `encoding/json`:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	type User struct {
		Name string   `json:"name"`
		Age  int      `json:"age"`
		Tags []string `json:"tags"`
	}

	// Encode — exactly as with encoding/json
	user := User{Name: "Alice", Age: 30, Tags: []string{"go", "json"}}
	b, err := json.Marshal(user)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b))
	// Output: {"name":"Alice","age":30,"tags":["go","json"]}

	// Decode — exactly as with encoding/json
	var u User
	if err := json.Unmarshal(b, &u); err != nil {
		panic(err)
	}
	fmt.Printf("%+v\n", u)
	// Output: {Name:Alice Age:30 Tags:[go json]}
}
```

## Incremental Capabilities

After migrating, while keeping standard-library compatibility, you can adopt these capabilities the standard library lacks:

| Capability | Example | Learn more |
|---|---|---|
| Path queries | `json.GetString(data, "user.name")` | [Path Expression Syntax](./path-syntax) |
| Get with defaults | `json.GetInt(data, "timeout", 30)` | [Query & Get](../api-reference/functions/query) |
| Generic get | `json.GetTyped[User](data, "user")` | [Generic Operations](../api-reference/generics) |
| Path modification | `json.Set(data, "user.name", "Bob")` | [Modification Operations](../api-reference/functions/modify) |
| Schema validation | `json.ValidateSchema(data, schema)` | [Schema Validation](../api-reference/schema) |
| Streaming JSONL | `json.StreamLinesInto[T](r, fn)` | [JSONL Processing](../streaming/jsonl) |
| High-performance processor | `p, _ := json.New()` | [Processor Guide](./processor-guide) |
| Pre-parse / pre-compiled paths | `p.PreParse` / `p.CompilePath` | [Processor Guide](./processor-guide) |
| Concurrent iteration | `json.NewParallelIterator(items).ForEach(fn)` | [Concurrency](../advanced/concurrency) |
| Context cancellation | `json.GetWithContext(ctx, data, path)` | [Query & Get](../api-reference/functions/query) |
| Deep JSON comparison | `json.CompareJSON(a, b)` | [Utility Functions](../api-reference/helpers) |
| Hooks / audit / timing | `p.AddHook(json.LoggingHook(logger))` | [Hook System](../extensions/hooks) |
| Security mode | `json.SecurityConfig()` | [Security Mode](../security/security-mode) |
| Runtime stats / health | `json.GetStats()` / `json.GetHealthStatus()` | [Processor Guide](./processor-guide#monitoring-and-diagnostics) |

## Behavioral Differences

For **ordinary data**, the default configuration behaves like `encoding/json`. What to note: `cybergodev/json` ships with a layer of **input security validation** by default (part of its positioning as a secure JSON library) and rejects oversized input or input containing dangerous patterns, where the standard library accepts everything. The differences:

| Difference | encoding/json | CyberGo default behavior | When you need different behavior |
|---|---|---|---|
| Input size | Unlimited | Above 100MB (`MaxJSONSize`) returns `ErrSizeLimit` | Raise `cfg.MaxJSONSize` |
| Nesting depth | No explicit limit | Above 200 levels returns `ErrDepthLimit` | Adjust `MaxNestingDepthSecurity` |
| Dangerous content patterns | Not checked | 28 built-in patterns blocked by default (`__proto__`, `<script`, `javascript:`, `eval(`, `onload`, etc.), returning `ErrSecurityViolation` | After confirming trust, set `cfg.DisableDefaultPatterns = true` (critical patterns like `__proto__` still block) |
| Container width | Unlimited | Per object ≤ 100k keys, per array ≤ 100k elements | Adjust `MaxObjectKeys` / `MaxArrayElements` |
| Invalid UTF-8 | Replaced with U+FFFD at decode | Rejected outright (`ErrInvalidJSON`) | Fix the input encoding beforehand |
| BOM prefix | Syntax error | Rejected (`ErrInvalidJSON`) | Strip the BOM in preprocessing |

Two easily misunderstood points:

1. **Richer error information**: a `JsonsError` from a failed path operation carries the operation name, path, and underlying cause (supporting `errors.Is`/`errors.As` and `Unwrap`), but it does **not** change the error types of standard-library-compatible functions (`Unmarshal`/`Decode`, etc.) — those still return standard forms like `SyntaxError` and `UnmarshalTypeError`.
2. **Validation applies to input only**: the limits above target JSON text input (`Unmarshal`, `Get`, `Parse`, `Valid`, etc.); `Marshal`/`Encode` of Go values does no content validation.

For untrusted input, prefer the `json.SecurityConfig()` preset (tighter limits + full scanning); see [Security Mode](../security/security-mode).

## Migration FAQ

**Q: Does `json.Number` big-number precision behavior change?**

No. `Decoder.UseNumber()` matches the standard library; `Number.Int64()`/`Float64()` behave unchanged. Use `json.Number` as usual when the original number text must be preserved.

**Q: Is the default HTML escaping identical?**

Yes. `Marshal`/`Encode` escape `<`, `>`, `&` by default (same as the standard library), and `Encoder.SetEscapeHTML(false)` turns it off — compatible in both behavior and signature.

**Q: What about existing code using `json.Marshaler`/`json.Unmarshaler` custom types?**

Fully compatible. Both interfaces keep working; custom types implementing them behave identically on the encode/decode paths.

**Q: Can I use the incremental capabilities only in new code and leave old code untouched?**

Yes — that is the design goal. Package-level functions cache the corresponding Processor by trailing cfg (see the cfg conventions above); calls without cfg go through the global processor with the default configuration — identical to the standard library for ordinary data, with differences limited to the default input validation (see the [Behavioral Differences](#behavioral-differences) table above).

**Q: `Unmarshal` rejected legitimate data containing words like `onload` or `eval(`. What now?**

That is the default input validation intercepting injection patterns. After confirming the input is trusted, disable the default pattern set:

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true
err := json.Unmarshal(data, &v, cfg)
```

Note that the three critical patterns `__proto__`, `constructor[`, and `prototype.` are **always blocked**, unaffected by this switch. To only add rules, append custom patterns via `AdditionalDangerousPatterns` instead of disabling the defaults.

**Q: A document larger than 100MB was rejected with `ErrSizeLimit`. What should I do?**

Two routes: raise `cfg.MaxJSONSize` if you truly must process it whole; better, switch to streaming (`NewStreamIterator` / `NewStreamObjectIterator` for per-element reads, or the JSONL family for line-by-line processing) to avoid loading it all into memory — see [Large File Handling](../streaming/large-files).

## Next Steps

- [Quick Start](./) — Core features in 5 minutes
- [Path Expression Syntax](./path-syntax) — Learn the path query syntax
- [Cheat Sheet](./cheatsheet) — Quick API reference

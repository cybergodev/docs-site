---
title: "Migrating from encoding/json - CyberGo JSON | 3-Step Guide"
description: "Migrate from encoding/json to CyberGo JSON: signature-compatible import swap, Marshal/Unmarshal mapping, and default security validation differences."
sidebar_label: "Migrating from the Standard Library"
sidebar_position: 60
---

# Migrating from the Standard Library

`cybergodev/json` shares the **function signatures** of the standard `encoding/json`: after replacing the import path, existing code compiles as-is. There is one deliberate semantic difference — this library validates input by default, rejecting oversized data or data containing dangerous patterns, where the standard library accepts everything (see [Behavioral Differences](#what-are-the-behavioral-differences-from-the-standard-library)). This page covers the three-step migration, the API mapping tables, and the incremental capabilities.

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

3. **Compile**: signatures match, so code compiles; if the input contains words such as `onload` or `eval(`, or exceeds 100MB, default validation rejects it at run time — see the [migration FAQ](#migration-faq).

## Signature-Compatible APIs

The table maps `encoding/json` to `cybergodev/json`. Entries marked signature-compatible can be swapped at the signature level; behavioral differences from default input validation are collected in [Behavioral Differences](#what-are-the-behavioral-differences-from-the-standard-library):

| encoding/json | cybergodev/json | Notes |
|---|---|---|
| `Marshal(v)` | `Marshal(v, cfg...)` | Signature-compatible with an extra optional cfg; output above `MaxJSONSize` returns `ErrSizeLimit` |
| `Unmarshal(data, &v)` | `Unmarshal(data, &v, cfg...)` | Signature-compatible; input is security-validated by default |
| `MarshalIndent(v, prefix, indent)` | Same name | Signature-compatible; byte-identical output to the standard library for typical values |
| `Compact(dst, src)` | Same name | Signature-compatible; input is security-validated by default |
| `Indent(dst, src, prefix, indent)` | Same name | Signature-compatible; input is security-validated by default |
| `HTMLEscape(dst, src)` | Same name | Signature-compatible |
| `Valid(data)` | `Valid(data, cfg...)` | Signature-compatible; checks size, UTF-8, and dangerous patterns beyond syntax |
| `NewEncoder(w)` | `NewEncoder(w, cfg...)` | Signature-compatible |
| `NewDecoder(r)` | `NewDecoder(r, cfg...)` | Signature-compatible |
| `Number` | `Number` | Type-compatible (`String`/`Int64`/`Float64`/`MarshalJSON` all preserved) |
| `Delim` | `Delim` | Type-compatible (`String()` preserved) |
| `Token` | `Token` | Type-compatible |

**Method-level** signatures of `Encoder` and `Decoder` map one to one as well:

| Method | Belongs to | Compatibility |
|---|---|---|
| `Encode(v)` / `SetIndent(prefix, indent)` / `SetEscapeHTML(on)` | `*Encoder` | Signature-compatible |
| `Decode(v)` / `Token()` / `More()` / `Buffered()` / `InputOffset()` | `*Decoder` | Signature-compatible |
| `UseNumber()` / `DisallowUnknownFields()` | `*Decoder` | Signature-compatible; `DisallowUnknownFields` is honored on the default decode path |

Error types map one to one as well; code relying on `errors.As` / type assertions works directly: `SyntaxError`, `UnmarshalTypeError`, `InvalidUnmarshalError`, `MarshalerError`, `UnsupportedTypeError`, and `UnsupportedValueError` all exist with matching types and field layouts (see [Error Variables](../api-reference/constants#error-variables)).

The error structs' **locator fields** are likewise preserved, so code that pinpoints failures or tallies error categories by these fields keeps working:

| Type | Field | Type | Description |
|------|-------|------|-------------|
| `SyntaxError` | `Offset` | `int64` | Bytes read before the error occurred |
| `UnmarshalTypeError` | `Offset` | `int64` | Bytes read before the error occurred |
| `UnmarshalTypeError` | `Struct` | `string` | Name of the root type containing the failing field |
| `UnmarshalTypeError` | `Field` | `string` | Full path from the root to the failing value |
| `UnsupportedValueError` | `Str` | `string` | Text representation of the unsupported value (e.g. NaN, +Inf) |

When `UnmarshalTypeError`'s `Struct` / `Field` are non-empty, `Error()` prints `json: cannot unmarshal <value> into Go struct field <Struct>.<Field> of type <type>` — verbatim identical to the standard library.

::: tip Optional cfg parameters
Every extra `cfg ...Config` parameter is **optional** (variadic). Without it the default configuration applies and most ordinary data yields the same results as the standard library; the only differences come from default input validation (see [Behavioral Differences](#what-are-the-behavioral-differences-from-the-standard-library)). Pass cfg to enable security mode, caching, and other capabilities.

Three **intentional exceptions** regarding cfg (from the library's design conventions):

- **Typed read functions** (`GetTyped`, `GetString`, `GetInt`, etc.) take **default values** as their variadic parameter, not cfg — Go allows only one variadic parameter. For configuration-aware typed reads, use `SafeGet`, or the typed methods (`GetString`, `GetInt`) of a Processor created with `New(cfg)`.
- **Flag-preset variants** (`SetCreate`, `SetMultipleCreate`, `DeleteClean`) equal the plain versions with `CreatePaths` (or `CleanupNulls` + `CompactArrays`) forcibly enabled.
- `Valid` returns a single `bool` (standard-library signature); use `ValidWithConfig` (returning `bool, error`) when you need the failure reason.
:::

## Code Example: Change Only the Import

The example below shows the import-only swap; encoding, decoding, and struct tag usage stay the same:

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

	// Encode — same signature and same output as encoding/json
	user := User{Name: "Alice", Age: 30, Tags: []string{"go", "json"}}
	b, err := json.Marshal(user)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b))
	// Output: {"name":"Alice","age":30,"tags":["go","json"]}

	// Decode — matches encoding/json when the input passes validation
	var u User
	if err := json.Unmarshal(b, &u); err != nil {
		panic(err)
	}
	fmt.Printf("%+v\n", u)
	// Output: {Name:Alice Age:30 Tags:[go json]}
}
```

## Incremental Capabilities

After migrating you can adopt these capabilities the standard library lacks while keeping signature compatibility:

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

## What Are the Behavioral Differences from the Standard Library?

For input that carries no dangerous pattern, stays within limits, and is validly encoded, the default configuration returns the same results as `encoding/json`. Differences come from **input security validation**, which is on by default: oversized input or input containing dangerous patterns is rejected, where the standard library accepts everything.

| Difference | encoding/json | CyberGo default behavior | When you need different behavior |
|---|---|---|---|
| Input size | Unlimited | Above 100MB (`MaxJSONSize`) returns `ErrSizeLimit` | Raise `cfg.MaxJSONSize` |
| Nesting depth | No explicit limit | Above 200 levels (`MaxNestingDepthSecurity`) returns `ErrDepthLimit` | Adjust `MaxNestingDepthSecurity` |
| Dangerous content patterns | Not checked | 28 built-in patterns blocked by default (`__proto__`, `<script`, `javascript:`, `eval(`, `onload`, etc.), returning `ErrSecurityViolation` | After confirming trust, set `cfg.DisableDefaultPatterns = true` (the 3 critical patterns such as `__proto__` still block) |
| Container width | Unlimited | Per object ≤ 100k keys, per array ≤ 100k elements (exceeding returns `ErrSizeLimit`) | Adjust `MaxObjectKeys` / `MaxArrayElements` |
| Invalid UTF-8 | Replaced with U+FFFD at decode | Rejected outright (`ErrInvalidJSON`; `Valid` returns false) | Fix the input encoding beforehand |
| BOM prefix | Syntax error | Rejected (`ErrInvalidJSON`) | Strip the BOM in preprocessing |
| `Marshal` output cap | No cap | Output above `MaxJSONSize` returns `ErrSizeLimit` | Raise `cfg.MaxJSONSize` |
| `Marshal` nesting depth | Unlimited | Above `MaxDepth` (default 100) returns `ErrDepthLimit` | Raise `cfg.MaxDepth`, or set 0 for no limit |

Two points that are easy to misread:

1. **Finer error types for path operations**: a `JsonsError` from a failed path query or modification carries the operation name, path, and underlying cause (supporting `errors.Is`/`errors.As` and `Unwrap`), but it does **not** change the error types of standard-library-compatible functions (`Unmarshal`/`Decode`, etc.) — those still return standard forms like `SyntaxError` and `UnmarshalTypeError`.
2. **Validation scope**: content-pattern validation targets JSON text input only (`Unmarshal`, `Get`, `Parse`, `Valid`, etc.); `Marshal`/`Encode` of Go values does no content-pattern validation, but output size (`MaxJSONSize`) and nesting depth (`MaxDepth`, default 100) still apply.

For untrusted input, prefer the `json.SecurityConfig()` preset (tighter limits + full scanning); see [Security Mode](../security/security-mode).

## Migration FAQ

**Q: Does `json.Number` big-number precision behavior change?**

No. `Decoder.UseNumber()` matches the standard library; `Number.Int64()`/`Float64()` behave unchanged. Use `json.Number` as usual when the original number text must be preserved.

**Q: Is the default HTML escaping identical?**

Yes. `Marshal`/`Encode` escape `<`, `>`, `&` by default (same as the standard library), and `Encoder.SetEscapeHTML(false)` turns it off. Note that `Marshal` always escapes even when `cfg.EscapeHTML=false`; use `Encode` when the config must be honored.

**Q: What about existing code using `json.Marshaler`/`json.Unmarshaler` custom types?**

Signature-compatible. Both interfaces keep working; custom types implementing them behave the same on the encode/decode paths.

**Q: Can I use the incremental capabilities only in new code and leave old code untouched?**

Yes. Package-level functions cache the corresponding Processor by trailing cfg (see the cfg conventions above); calls without cfg go through the global processor with the default configuration — results match the standard library whenever the input does not trip validation; see the [Behavioral Differences](#what-are-the-behavioral-differences-from-the-standard-library) table above.

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

- [Quick Start](./) — core reads, writes, and error handling in a few minutes
- [Path Expression Syntax](./path-syntax) — Learn the path query syntax
- [Cheat Sheet](./cheatsheet) — Quick API reference

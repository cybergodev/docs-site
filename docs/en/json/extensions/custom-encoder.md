---
sidebar_label: "Custom Encoder"
title: "Custom Encoder - CyberGo JSON | Custom Type Encoding"
description: "CyberGo JSON custom encoders: json.Marshaler and TextMarshaler, Config.CustomEscapes escaping, time.Time built-in format, portable across encoding/json."
sidebar_position: 30
---

# Custom Encoder

The json library stays encoding-compatible with the standard `encoding/json`, so a custom type's JSON shape is primarily customized by implementing the standard-library interfaces. This page covers the extension points that **actually take effect in the current version**:

- [`json.Marshaler`](#the-json-marshaler-interface) — a type customizes its own JSON encoding
- [`encoding.TextMarshaler`](#the-encoding-textmarshaler-interface) — a type customizes its text encoding (output as a JSON string)
- [`time.Time`](#built-in-time-time-support) — the library's built-in RFC3339Nano time format
- [`Config.CustomEscapes`](#custom-character-escaping-customescapes) — custom character escape mapping

:::tip Interfaces first
For "how should this type encode", prefer implementing `MarshalJSON` or `MarshalText`; such implementations work with this library, the standard `encoding/json`, and any compatible library — maximum portability.
:::

## The json.Marshaler Interface

A type implementing `MarshalJSON() ([]byte, error)` fully controls its own JSON representation. During encoding the library calls this method first (both value and pointer receivers supported), consistent with the standard `encoding/json`.

Interface signature (compatible with `encoding/json.Marshaler`):

```go
type Marshaler interface {
    MarshalJSON() ([]byte, error)
}
```

Below, a Hex type encodes a `uint64` as a `0x`-prefixed hexadecimal string:

```go
package main

import (
	"fmt"
	"strconv"

	"github.com/cybergodev/json"
)

// Hex wraps a uint64 as a hexadecimal representation.
type Hex uint64

// MarshalJSON implements json.Marshaler, encoding the number as an "0x.." string.
func (h Hex) MarshalJSON() ([]byte, error) {
	return []byte(`"0x` + strconv.FormatUint(uint64(h), 16) + `"`), nil
}

func main() {
	type Device struct {
		ID    Hex    `json:"id"`
		Label string `json:"label"`
	}
	d := Device{ID: Hex(255), Label: "sensor-1"}

	out, err := json.Marshal(d)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
	// Output: {"id":"0xff","label":"sensor-1"}
}
```

::: warning Avoid infinite recursion
If you need "regular encoding" as a helper inside `MarshalJSON`, use the standard library's `stdjson.Marshal`, or call this library on a **different concrete type**. Calling `Marshal` again on the same type re-enters `MarshalJSON`, producing infinite recursion.
:::

:::tip Errors and special cases
Errors returned by `MarshalJSON`/`MarshalText` are wrapped into `MarshalerError` (preserving `errors.As`/`Unwrap` capability) and propagated; the return value must be valid JSON. Two standard-library behaviors also apply: `[]byte` encodes as a base64 string (a `[N]byte` array does not); types implementing `MarshalText` also determine the encoded form of map keys.
:::

## The encoding.TextMarshaler Interface

A type that does not implement `MarshalJSON` but implements `MarshalText() ([]byte, error)` is encoded as a JSON string whose value is the text content (quoting and escaping applied automatically). Suited to types whose shape a piece of text fully expresses.

Interface signature (compatible with `encoding.TextMarshaler`):

```go
type TextMarshaler interface {
    MarshalText() ([]byte, error)
}
```

Below, a Slug type normalizes itself to lowercase hyphenated form when encoded:

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

// Slug represents a URL-friendly short text.
type Slug string

// MarshalText implements encoding.TextMarshaler, outputting the normalized text.
func (s Slug) MarshalText() ([]byte, error) {
	return []byte(strings.ToLower(strings.ReplaceAll(string(s), " ", "-"))), nil
}

func main() {
	type Article struct {
		Title string `json:"title"`
		Slug  Slug   `json:"slug"`
	}
	a := Article{Title: "Hello World", Slug: Slug("Hello World")}

	out, err := json.Marshal(a)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
	// Output: {"title":"Hello World","slug":"hello-world"}
}
```

:::tip Precedence of the two interfaces
If a type implements both, `MarshalJSON` wins over `MarshalText`. When the type should encode as a JSON string, implementing `MarshalText` is usually simpler (no manual quoting or escaping).
:::

## Built-in time.Time Support

`time.Time` encodes correctly with zero configuration: it implements `MarshalJSON` itself (value receiver, RFC3339Nano output preserving sub-second precision), and the library adopts it directly through the [`json.Marshaler`](#the-json-marshaler-interface) mechanism above — behavior identical to the standard `encoding/json`.

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/json"
)

func main() {
	type Event struct {
		Name string    `json:"name"`
		At   time.Time `json:"at"`
	}
	t := time.Date(2026, 1, 15, 10, 30, 0, 0, time.UTC)
	e := Event{Name: "deploy", At: t}

	out, err := json.Marshal(e)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
	// Output: {"name":"deploy","at":"2026-01-15T10:30:00Z"}
}
```

For a different time format, implement `MarshalJSON` for that type (see [above](#the-json-marshaler-interface)) to override the built-in behavior — a custom type's `MarshalJSON` always takes precedence over the default `time.Time` handling.

## Custom Character Escaping (CustomEscapes)

`Config.CustomEscapes` is a `map[rune]string` used to **globally override** how certain characters escape. When encoding a string, the library consults this map first: a hit writes the corresponding string into the output verbatim (you must ensure it is JSON-valid); a miss falls through to the default escaping.

Below, the copyright sign `©` is rewritten as ASCII text (hits are written verbatim; other characters use the default handling):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	cfg := json.DefaultConfig()
	// © is output verbatim by default; rewrite it as ASCII text here
	cfg.CustomEscapes = map[rune]string{
		'©': "(c)",
	}

	out, err := json.Encode(map[string]string{"note": "Copyright © 2026"}, cfg)
	if err != nil {
		panic(err)
	}
	fmt.Println(out)
	// Output: {"note":"Copyright (c) 2026"}
}
```

::: warning Custom escape strings must be JSON-valid
`CustomEscapes` values are **written verbatim** into the output with no second processing, so mind Go source-level string escaping: to emit a literal backslash escape sequence in the output, write a double backslash `\\` in Go source (a single backslash is consumed by Go's own escaping, producing the character itself rather than an escape sequence).
:::

:::tip When the custom escape path activates
Setting `CustomEscapes` (non-nil) activates the custom encoding path. That path also reads fields such as `EscapeHTML`, `EscapeUnicode`, `EscapeSlash`, `EscapeNewlines`, `EscapeTabs`, `SortKeys`, `FloatPrecision`, and `IncludeNulls` (see [Config](../api-reference/config)).
:::

## Choosing an Extension Point

| Need | How |
|------|-----|
| A type customizes its own JSON shape | Implement `MarshalJSON()` |
| A type encodes as a JSON string (text representation) | Implement `MarshalText()` |
| Globally change the escaping of certain characters | `Config.CustomEscapes` |
| Control indentation, HTML escaping, Unicode escaping, key ordering, float precision, etc. | `Config` fields `Pretty`/`EscapeHTML`/`EscapeUnicode`/`SortKeys`/`FloatPrecision` (see [Config](../api-reference/config)) |
| Override the default `time.Time` format | Implement `MarshalJSON()` on a custom time type |

## Encoding-Related Config Fields That Take Effect

| Field | Type | Description |
|-------|------|-------------|
| `CustomEscapes` | `map[rune]string` | Custom character escape mapping (hits are output verbatim) |
| `EscapeHTML` | `bool` | Whether to escape `<` `>` `&` (default `true`) |
| `EscapeUnicode` | `bool` | Whether to escape characters `>0x7F` as Unicode escapes |
| `EscapeSlash` | `bool` | Whether to escape `/` |
| `EscapeNewlines` / `EscapeTabs` | `bool` | Whether to escape newlines/tabs |
| `SortKeys` | `bool` | Whether to sort object keys (object keys are sorted by default) |
| `FloatPrecision` | `int` | Float precision (`-1` for default) |
| `IncludeNulls` | `bool` | Whether to include null-valued fields |

## Deprecated Extension Fields

::: warning Deprecated extension fields
`Config.CustomEncoder` (the `CustomEncoder` interface) and `Config.CustomTypeEncoders` (the `TypeEncoder` interface) are **deprecated** (marked Deprecated in the source): they are declared and take part in config cloning and cache-key computation, but are **never invoked by the encoding pipeline** — setting them does not change encoding output, and the built-in encoder cannot be replaced. Both are kept within v1. To customize encoding, use the effective mechanisms above (`MarshalJSON`/`MarshalText`/`CustomEscapes`).

```go
// Deprecated: the two fields below are declared but not wired; setting
// them has no effect
type CustomEncoder interface {
    Encode(value any) (string, error)
}

type TypeEncoder interface {
    Encode(v reflect.Value) (string, error)
}
```
:::

## See Also

- [Interface Definitions](../api-reference/interfaces) - `Marshaler` / `TextMarshaler` / `CustomEncoder` / `TypeEncoder` interfaces
- [Config](../api-reference/config) - Encoding-related configuration fields
- [Hooks](./hooks) - Pre/post operation interception (incl. the available validation hook)

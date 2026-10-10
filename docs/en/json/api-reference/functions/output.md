---
sidebar_label: "Encoding Output"
title: "Encoding Output Functions - CyberGo JSON | Marshal & Encode"
description: "CyberGo JSON is a Go library for encoding output, offering stdlib-compatible Marshal/Unmarshal, Encode/Compact/Indent, Prettify and HTMLEscape serialization."
sidebar_position: 50
---

# Encoding Output Functions

Encode/decode functions of the json package: serialization, deserialization, formatting, and configurable encoding.

## Serialization Functions

### Marshal

Signature: `func Marshal(value any, cfg ...Config) ([]byte, error)`

Serializes a Go value into a JSON byte slice. 100% compatible with `encoding/json.Marshal`: calling `json.Marshal(v)` without cfg is fully identical to the standard library.

The optional trailing `Config` controls encoding behavior (indentation, number handling, etc.), mirroring `Processor.Marshal` at package level / instance level.

```go
// encoding/json compatible (no cfg)
data, err := json.Marshal(map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"test"}

// With configuration (non-breaking optional parameter)
data, err = json.Marshal(value, json.PrettyConfig())
```

::: warning Marshal output is always HTML-escaped
Consistent with `encoding/json.Marshal`, the output of `Marshal` is **always** HTML-escaped — even if you pass `cfg.EscapeHTML = false`, this path overrides it back on. When the caller must control escaping behavior, use [`Encode`](#encode) instead.
:::

### Unmarshal

Signature: `func Unmarshal(data []byte, value any, cfg ...Config) error`

Deserializes a JSON byte slice into a Go value. 100% compatible with `encoding/json.Unmarshal`: calling `json.Unmarshal(data, &v)` without cfg is fully identical to the standard library.

The optional trailing `Config` controls security limits, number preservation, and more, mirroring `Processor.Unmarshal`.

```go
var result struct {
    Name string `json:"name"`
}
// encoding/json compatible (no cfg)
err := json.Unmarshal([]byte(`{"name":"test"}`), &result)

// With configuration
err = json.Unmarshal(data, &v, json.SecurityConfig())
```

:::tip The no-cfg fast path still runs security validation
When called without cfg, `Unmarshal` still validates the input against the processor's built-in security limits (size, nesting depth, dangerous patterns) before delegating to `encoding/json` — so even as a drop-in replacement for the standard library, the security line is not bypassed.
:::

### MarshalIndent

Signature: `func MarshalIndent(v any, prefix, indent string, cfg ...Config) ([]byte, error)`

Serialization with indentation. 100% compatible with `encoding/json.MarshalIndent`: calling `json.MarshalIndent(v, prefix, indent)` without cfg is fully identical to the standard library.

The optional trailing `Config` attaches extra configuration; the `prefix` and `indent` parameters override the corresponding fields of `Config`.

```go
// encoding/json compatible (no cfg)
data, err := json.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))

// With configuration
data, err = json.MarshalIndent(v, "", "  ", json.SecurityConfig())
```

## Formatting Functions

### Compact

Signature: `func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error`

Compacts JSON, removing unnecessary whitespace, and writes the result to `dst`. Compatible with `encoding/json.Compact` (buffer form).

```go
var buf bytes.Buffer
err := json.Compact(&buf, []byte(`{"name": "test"}`))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

### CompactString

Signature: `func CompactString(jsonStr string, cfg ...Config) (string, error)`

Compacts JSON in a string-in/string-out form, removing unnecessary whitespace. It is the package-level mirror of `Processor.Compact`, symmetric with `Prettify` (which mirrors `Processor.Prettify`).

::: info Signature asymmetry: the Compact family and its Processor mirrors
The package-level `Compact` keeps the `encoding/json.Compact`-compatible signature (buffer input), so its name is **misaligned** with the Processor-method version — the Processor's `Compact(jsonStr) (string, error)` is called `CompactString` at package level, and its buffer form is `CompactBuffer`:

| Package-level function | Signature form | Mirrored Processor method |
|------------------------|----------------|---------------------------|
| `Compact(dst *bytes.Buffer, src []byte)` | Buffer input (encoding/json compatible) | `CompactBuffer(dst, src)` |
| `CompactString(jsonStr string) (string, error)` | String in, string out | `Compact(jsonStr)` |
| `Prettify(jsonStr string) (string, error)` | String in, string out | `Prettify(jsonStr)` |
:::

```go
compact, err := json.CompactString(`{
    "name": "Alice",
    "age": 30
}`)
// compact == `{"name":"Alice","age":30}`

// With configuration (e.g. preserve original number formats)
cfg := json.DefaultConfig()
cfg.PreserveNumbers = true
compact, err = json.CompactString(jsonStr, cfg)
```

### Indent

Signature: `func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

Formats JSON with indentation and writes the result to `dst`. Compatible with `encoding/json.Indent`.

```go
var buf bytes.Buffer
err := json.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(buf.String())
// {
//   "name": "test"
// }
```

### HTMLEscape

Signature: `func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

HTML-escapes JSON content, replacing special characters such as `<`, `>`, `&` (plus U+2028 and U+2029) with the corresponding Unicode escape sequences, and writes the result to `dst`. No return value.

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
fmt.Println(buf.String())
// {"html":"<script>alert(1)</script>"}
```

### Prettify

Signature: `func Prettify(jsonStr string, cfg ...Config) (string, error)`

Formats a JSON string with the default pretty-print indentation and returns the formatted string.

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    panic(err)
}
fmt.Println(pretty)
// {
//   "name": "Alice",
//   "age": 30
// }
```

## Configurable Encoding Functions

### Encode

Signature: `func Encode(value any, cfg ...Config) (string, error)`

Encodes a Go value into a JSON string. This is the **canonical** string-returning encoder (`Marshal` is the `[]byte`-returning `encoding/json` drop-in); the optional trailing `Config` selects the encoding behavior for this call (`Pretty`, `EscapeHTML`, `SortKeys`, `FloatPrecision`, ...), and the default configuration applies when omitted.

```go
result, err := json.Encode(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**With configuration**

```go
result, err := json.Encode(user, json.SecurityConfig())
```

### EncodePretty

Signature: `func EncodePretty(value any, cfg ...Config) (string, error)`

Encodes a Go value into a pretty-printed (indented) JSON string, with optional configuration parameters.

```go
result, err := json.EncodePretty(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**With configuration**

```go
result, err := json.EncodePretty(user, json.PrettyConfig())
```

### EncodeWithConfig

<Badge type="danger" text="Deprecated" />

Signature: `func EncodeWithConfig(value any, cfg ...Config) (string, error)`

Encodes a Go value into a JSON string using the given configuration.

::: warning Deprecated
`EncodeWithConfig` is functionally identical to [`Encode`](#encode) (both delegate to the same implementation) — the name predates `Encode` accepting an optional trailing `Config`. Use `Encode(value, cfg)` in new code, or [`Marshal`](#marshal) when a `[]byte` output is acceptable. `EncodeWithConfig` will not be removed within v1.
:::

```go
// Fully equivalent to json.Encode(data, json.PrettyConfig())
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
if err != nil {
    panic(err)
}
fmt.Println(result)
```

## Batch Encoding Functions

### EncodeBatch

Signature: `func EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

Batch-encodes key-value pairs into a JSON object string. Equivalent to `Encode(map[string]any(pairs), cfg)`, with keys output in lexicographic order (consistent with `encoding/json`).

```go
result, err := json.EncodeBatch(map[string]any{
    "name":  "Alice",
    "age":   30,
    "email": "alice@example.com",
})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"age":30,"email":"alice@example.com","name":"Alice"}
```

### EncodeFields

Signature: `func EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

Encodes only the specified fields, producing filtered output. Keys in `fields` that **do not actually exist** are silently ignored (only the intersection of both sides is output); if `value` does not encode to a JSON object, `ErrTypeMismatch` is returned (`value is not an object, cannot filter fields`).

```go
user := struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
}{
    Name: "Alice", Email: "a@b.com", Password: "secret",
}

// Output only public fields
result, err := json.EncodeFields(user, []string{"name", "email"})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"name":"Alice","email":"a@b.com"}
```

### EncodeStream

Signature: `func EncodeStream(values any, cfg ...Config) (string, error)`

Encodes multiple values into a JSON array stream. `values` is usually a slice or enumerable collection, and the output is a JSON array string like `[v1,v2,...]`. Equivalent to `Encode(values, cfg)`: when `values` is a slice, a JSON array is output; when a non-collection value is passed, that value itself is output per `Encode` semantics.

```go
values := []map[string]any{
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"},
}

result, err := json.EncodeStream(values)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

## Processor Formatting Methods

The `Processor` type provides additional formatting methods. Create a Processor with `json.New()` (returns `(*Processor, error)`):

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
```

### Processor.CompactBuffer

Signature: `func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

Compacts JSON bytes and writes them to the `dst` buffer. The package-level `Compact` function delegates to this method.

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "Alice"}`))
// buf.String() => {"name":"Alice"}
```

### Processor.Indent

Signature: `func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

Writes indented JSON to the `dst` buffer. Compatible with `encoding/json.Indent`.

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"Alice"}`), "", "  ")
```

### Processor.HTMLEscape

Signature: `func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

Writes HTML-escaped JSON to the `dst` buffer; no return value. Compatible with `encoding/json.HTMLEscape`.

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>"}`))
```

:::tip
For the full Processor method documentation, see [Processor](../processor/).
:::

## Streaming Encode/Decode

`NewEncoder(w)` / `NewDecoder(r)` are fully compatible with `encoding/json` (including `SetIndent`, `SetEscapeHTML`, `UseNumber`, `Token`, and other methods), supporting streaming encode/decode from an `io.Writer`/`io.Reader`:

```go
// Stream-encode to stdout
enc := json.NewEncoder(os.Stdout)
enc.SetIndent("", "  ")
_ = enc.Encode(user)

// Stream-decode (read JSON values one by one)
dec := json.NewDecoder(resp.Body)
for dec.More() {
    var msg Message
    if err := dec.Decode(&msg); err != nil {
        break
    }
}
```

:::tip
The full method tables for `Encoder`/`Decoder` are in [Type Definitions](../types#encoder-json-encoder).
:::

## Configuration Presets

The following helpers return pre-configured `Config` values that can be passed to any function accepting `...Config`:

```go
// Default configuration
cfg := json.DefaultConfig()

// Pretty-print configuration
cfg = json.PrettyConfig()

// Security configuration
cfg = json.SecurityConfig()
```

:::tip
For the full Config field documentation, see [Config](../config).
:::

## See Also

- [Query & Get](./query) - Get, GetString and other query operations
- [Modification Functions](./modify) - Set, Delete and other modification operations
- [File I/O](./file-io) - LoadFromFile, SaveToFile and other file operations
- [Config](../config) - The Config type and options
- [Interfaces](../interfaces) - Processor, Encoder, Decoder types

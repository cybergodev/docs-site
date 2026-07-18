---
sidebar_label: "Encoding & Output"
title: "Encoding & Output Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON encode/decode: Marshal/Unmarshal, Compact/Indent/HTMLEscape, and Encode/EncodePretty/Prettify configurable encoding, stdlib compatible."
sidebar_position: 5
---

# Encoding & Output Functions

The json package provides encoding and decoding functions, including serialization, deserialization, formatting, and configured encoding.

## Serialization Functions

### Marshal

Signature: `func Marshal(value any, cfg ...Config) ([]byte, error)`

Serializes a Go value to a JSON byte slice. 100% compatible with `encoding/json.Marshal`: called without `cfg`, `json.Marshal(v)` behaves identically to the standard library.

The optional trailing `Config` controls encoding behavior (indentation, number handling, etc.), mirroring `Processor.Marshal` at the package/instance level.

```go
// Compatible with encoding/json (no cfg)
data, err := json.Marshal(map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"test"}

// With configuration (non-breaking optional parameter)
data, err = json.Marshal(value, json.PrettyConfig())
```

### Unmarshal

Signature: `func Unmarshal(data []byte, value any, cfg ...Config) error`

Deserializes a JSON byte slice into a Go value. 100% compatible with `encoding/json.Unmarshal`: called without `cfg`, `json.Unmarshal(data, &v)` behaves identically to the standard library.

The optional trailing `Config` controls security limits, number preservation, and more, mirroring `Processor.Unmarshal`.

```go
var result struct {
    Name string `json:"name"`
}
// Compatible with encoding/json (no cfg)
err := json.Unmarshal([]byte(`{"name":"test"}`), &result)

// With configuration
err = json.Unmarshal(data, &v, json.SecurityConfig())
```

### MarshalIndent

Signature: `func MarshalIndent(v any, prefix, indent string, cfg ...Config) ([]byte, error)`

Serialization with indentation. 100% compatible with `encoding/json.MarshalIndent`: called without `cfg`, `json.MarshalIndent(v, prefix, indent)` behaves identically to the standard library.

The optional trailing `Config` can attach configuration; the `prefix` and `indent` parameters override the corresponding fields in `Config`.

```go
// Compatible with encoding/json (no cfg)
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

Compacts JSON by removing unnecessary whitespace and writes the result to `dst`. Compatible with `encoding/json.Compact` (buffer form).

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

Compacts JSON in string-in/string-out form, removing unnecessary whitespace. It is the package-level mirror of `Processor.Compact`, symmetric with `Prettify` (which mirrors `Processor.Prettify`).

::: info Compact vs CompactString
- `Compact(dst, src)`: buffer form, compatible with `encoding/json.Compact`, mirrors `Processor.CompactBuffer`
- `CompactString(s)`: string form, mirrors `Processor.Compact`
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

HTML-escapes JSON content, replacing special characters such as `<`, `>`, `&` (as well as U+2028 and U+2029) with the corresponding Unicode escape sequences, writing the result to `dst`. No return value.

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
fmt.Println(buf.String())
// {"html":"\u003cscript\u003ealert(1)\u003c/script\u003e"}
```

### Prettify

Signature: `func Prettify(jsonStr string, cfg ...Config) (string, error)`

Formats a JSON string using default pretty-print indentation, returning the formatted string.

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

## Configured Encoding Functions

### Encode

Signature: `func Encode(value any, cfg ...Config) (string, error)`

Encodes a Go value to a JSON string with optional configuration parameters.

::: warning Deprecated
`Encode` is functionally identical to [`EncodeWithConfig`](#encodewithconfig) (both delegate to the same implementation). Prefer `EncodeWithConfig`, or use [`Marshal`](#marshal) when a `[]byte` output is acceptable. `Encode` will be removed in a future major version.
:::

```go
result, err := json.Encode(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**With Configuration**

```go
result, err := json.Encode(user, json.SecurityConfig())
```

### EncodePretty

Signature: `func EncodePretty(value any, cfg ...Config) (string, error)`

Encodes a Go value to a formatted JSON string (with indentation) with optional configuration parameters.

```go
result, err := json.EncodePretty(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**With Configuration**

```go
result, err := json.EncodePretty(user, json.PrettyConfig())
```

### EncodeWithConfig

Signature: `func EncodeWithConfig(value any, cfg ...Config) (string, error)`

Encodes a Go value to a JSON string using the specified configuration. Suitable for scenarios requiring fine-grained control over encoding behavior.

```go
// Using pretty-print configuration
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**Using Security Configuration**

```go
result, err := json.EncodeWithConfig(data, json.SecurityConfig())
```

## Batch Encoding Functions

### EncodeBatch

Signature: `func EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

Batch encodes key-value pairs into a JSON object string.

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

Encodes only specified fields for selective field output.

```go
user := struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
}{
    Name: "Alice", Email: "a@b.com", Password: "secret",
}

// Only output public fields
result, err := json.EncodeFields(user, []string{"name", "email"})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"name":"Alice","email":"a@b.com"}
```

### EncodeStream

Signature: `func EncodeStream(values any, cfg ...Config) (string, error)`

Encodes multiple values into a JSON array stream. `values` is typically a slice or enumerable collection, outputting a JSON array string like `[v1,v2,...]`.

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

The `Processor` type provides additional formatting methods. Create a Processor using `json.New()` (returns `(*Processor, error)`):

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
```

### Processor.CompactBuffer

Signature: `func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

Compacts JSON bytes and writes to the `dst` buffer. The package-level `Compact` function delegates to this method.

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

Writes HTML-escaped JSON to the `dst` buffer with no return value. Compatible with `encoding/json.HTMLEscape`.

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>"}`))
```

:::tip
For complete Processor documentation, see [Processor](../interfaces).
:::

## Configuration Presets

The following helper functions return pre-configured `Config` values that can be passed to any function accepting `...Config`:

```go
// Default configuration
cfg := json.DefaultConfig()

// Pretty-print configuration
cfg = json.PrettyConfig()

// Security configuration
cfg = json.SecurityConfig()
```

:::tip
For complete Config field documentation, see [Configuration](../config).
:::

## See Also

- [Query & Get Functions](./query) - Get, GetString and other query operations
- [Modify Functions](./modify) - Set, Delete and other modify operations
- [File Operations](./file-io) - LoadFromFile, SaveToFile and other file operations
- [Configuration](../config) - Config type and options
- [Interfaces](../interfaces) - Processor, Encoder, Decoder types

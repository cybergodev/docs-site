---
sidebar_label: "Encoding Output"
title: "Processor Encoding Output - CyberGo JSON | Marshal/Encode"
description: "Processor output methods: Encode/EncodePretty, Marshal/Unmarshal with encoding/json-compatible signatures, Compact/Indent formatting and ValidateSchema."
sidebar_position: 50
---

# Output Methods

Output methods fall into three groups: the string-returning `Encode` family, the `[]byte` methods whose signatures match `encoding/json` (`Marshal`/`Unmarshal`), and the formatting methods that write into a Buffer (`CompactBuffer`, `Indent`, `HTMLEscape`).

## Basic Output

### Encode

Signature: `func (p *Processor) Encode(value any, cfg ...Config) (string, error)`

Encodes any value into a JSON string. This is the canonical string-returning encoder (`Marshal` is the `[]byte` one). The optional trailing `Config` selects this call's encoding behavior; without it the processor configuration applies.

```go
result, err := p.Encode(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(result)
```

### EncodePretty

Signature: `func (p *Processor) EncodePretty(value any, cfg ...Config) (string, error)`

Encodes any value into an indented JSON string. Without `cfg` it uses the processor configuration with `Pretty=true` forced; with a `cfg` that value is used as-is, without forcing `Pretty`.

```go
result, err := p.EncodePretty(user)
if err != nil {
    panic(err)
}
```

## Advanced Encoding

### EncodeWithConfig

<Badge type="danger" text="Deprecated" />

Signature: `func (p *Processor) EncodeWithConfig(value any, cfg ...Config) (string, error)`

Encodes a value into a JSON string with the given configuration.

::: warning Deprecated
`Processor.EncodeWithConfig` is identical to [`Encode`](#encode) (both delegate to the same implementation); the name predates `Encode` accepting a trailing `Config`. Use `p.Encode(value, cfg)` in new code, or [`Marshal`](#marshal) when `[]byte` output is acceptable. `EncodeWithConfig` is kept for the lifetime of v1 and will not be removed.
:::

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `any` | Yes | Value to encode |
| `cfg` | `Config` | No | Encoding configuration (optional) |

```go
// Equivalent to p.Encode(data, json.PrettyConfig())
result, err := p.EncodeWithConfig(data, json.PrettyConfig())
```

### EncodeBatch

Signature: `func (p *Processor) EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

Batch-encodes key-value pairs into a JSON object.

```go
result, err := p.EncodeBatch(map[string]any{
    "name": "CyberGo",
    "version": "1.0.0",
})
```

### EncodeFields

Signature: `func (p *Processor) EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

Encodes only the specified fields, for partial serialization. `value` must be a struct, a map, or a pointer to either; passing a scalar or slice returns an error matching `errors.Is(err, ErrTypeMismatch)`.

```go
type User struct {
    Name    string `json:"name"`
    Email   string `json:"email"`
    Private string `json:"private"`
}

user := User{Name: "CyberGo", Email: "test@example.com", Private: "secret"}
// Encode only the name and email fields
result, err := p.EncodeFields(user, []string{"name", "email"})
```

### EncodeStream

Signature: `func (p *Processor) EncodeStream(values any, cfg ...Config) (string, error)`

Encodes multiple values into a JSON array stream. A slice `values` yields a JSON array string such as `[v1,v2,...]`; any other type is encoded by the [`Encode`](#encode) rules. It is equivalent to `p.Encode(values, cfg...)`.

```go
values := []any{"item1", "item2", "item3"}
result, err := p.EncodeStream(values)
```

## Encoding/Decoding

### Marshal

Signature: `func (p *Processor) Marshal(value any, cfg ...Config) ([]byte, error)`

Encodes a Go value into a JSON byte slice. The signature matches `encoding/json.Marshal`, so swapping the import compiles as-is; output bytes match the standard library for typical values, while the default security checks differ (see the note below).

:::tip Output is always HTML-escaped
Consistent with `encoding/json.Marshal`, this method's output is **always** HTML-escaped — even a passed `cfg` setting `EscapeHTML=false` is overridden on this path. When the caller must control escaping, use [`Encode`](#encode).
:::

```go
data, err := p.Marshal(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"CyberGo"}
```

### MarshalIndent

Signature: `func (p *Processor) MarshalIndent(value any, prefix, indent string, cfg ...Config) ([]byte, error)`

Encodes a Go value into a pretty-printed JSON byte slice. The signature matches `encoding/json.MarshalIndent`.

```go
data, err := p.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

### Unmarshal

Signature: `func (p *Processor) Unmarshal(data []byte, value any, cfg ...Config) error`

Parses a JSON byte slice into a target variable. The signature matches `encoding/json.Unmarshal`; the default path runs security validation (input size, dangerous patterns, rejecting invalid UTF-8), so a few behaviors differ from the standard library.

```go
var user User
err := p.Unmarshal([]byte(`{"name":"Alice","age":30}`), &user)
if err != nil {
    panic(err)
}
```

## Formatting

### Prettify

Signature: `func (p *Processor) Prettify(jsonStr string, cfg ...Config) (string, error)`

Formats a JSON string with indentation. An empty `cfg.Indent` means 2 spaces; `cfg.Prefix` sets a per-line prefix. The result is cached per `cfg`.

```go
pretty, err := p.Prettify(`{"name":"Alice","age":30}`)
// Output:
// {
//   "name": "Alice",
//   "age": 30
// }

// 4-space indentation
cfg := json.DefaultConfig()
cfg.Indent = "    "
pretty, err = p.Prettify(`{"name":"Alice","age":30}`, cfg)
```

### Print (removed)

::: warning API change notice
Print, PrintE, PrintPretty and PrintPrettyE have been removed from the library. Replacements:

```go
// Compact output
s, err := p.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// Pretty output
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```
:::

### ValidateSchema

Signature: `func (p *Processor) ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

Validates JSON data against the given Schema. **Schema violations are reported through the returned `[]ValidationError`**; `error` is non-nil only when parsing or a precondition fails (invalid JSON, `schema` is `nil`). Validation passing returns `(nil, nil)`; validation failing with a normal flow returns `(non-empty slice, nil)`.

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
    },
}

errors, err := p.ValidateSchema(jsonStr, schema)
if err != nil {
    panic(err)
}
for _, ve := range errors {
    fmt.Printf("Path %s: %s\n", ve.Path, ve.Message)
}
```

## Formatting Operations

### Compact

Signature: `func (p *Processor) Compact(jsonStr string, cfg ...Config) (string, error)`

Compacts a JSON string, removing all whitespace.

::: warning Naming difference between the method and the package-level function
The "string in, string out" compaction has **different names** at the two entry points: package-level `json.CompactString(s)` versus the method's preferred name `p.Compact(s)` (an equivalent [`CompactString`](#compactstring) method also exists). The package-level `json.Compact(dst, src)` is the `encoding/json.Compact`-compatible Buffer form; its method counterpart is [`CompactBuffer`](#compactbuffer).
:::

```go
compact, err := p.Compact(`{"name": "CyberGo"}`)
// Output: {"name":"CyberGo"}
```

### CompactString

Signature: `func (p *Processor) CompactString(jsonStr string, cfg ...Config) (string, error)`

Compacts JSON in a string-in, string-out form; behaves the same as [`Compact`](#compact) and is the Processor mirror of the package-level [`json.CompactString`](../functions/output#compactstring).

```go
compact, err := p.CompactString(`{"name": "CyberGo"}`)
// Output: {"name":"CyberGo"}
```

### CompactBuffer

Signature: `func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

Compacts JSON and writes it to a Buffer. Signature-compatible with `encoding/json.Compact`; the Buffer form of [`Compact`](#compact) (package-level counterpart: `json.Compact`).

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "test"}`))
```

### Indent

Signature: `func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

Formats JSON and writes it to a Buffer.

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

### HTMLEscape

Signature: `func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

HTML-escapes JSON and writes it to a Buffer.

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

## See Also

- [Config](../config) - Configuration options
- [Parse & Load](./parse) - Parse/Load methods

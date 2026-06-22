---
title: "Processor Output Methods - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor output: Encode, EncodePretty, EncodeWithConfig, EncodeBatch/EncodeFields, and Compact/Indent/HTMLEscape for varied output."
---

# Output Methods

Processor provides multiple JSON encoding output methods.

## Basic Output

### Encode

Signature: `func (p *Processor) Encode(value any, config ...Config) (string, error)`

Encodes any value to a JSON string.

```go
result, err := p.Encode(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(result)
```

### EncodePretty

Signature: `func (p *Processor) EncodePretty(value any, config ...Config) (string, error)`

Encodes any value to a formatted JSON string.

```go
result, err := p.EncodePretty(user)
if err != nil {
    panic(err)
}
```

## Advanced Encoding

### EncodeWithConfig

Signature: `func (p *Processor) EncodeWithConfig(value any, cfg ...Config) (string, error)`

Encodes a value to a JSON string using the specified configuration.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `any` | Yes | Value to encode |
| `cfg` | `Config` | No | Encoding configuration (optional) |

```go
// Using PrettyConfig
result, err := p.EncodeWithConfig(data, json.PrettyConfig())

// Using SecurityConfig
result, err = p.EncodeWithConfig(data, json.SecurityConfig())

// Using custom configuration
cfg := json.DefaultConfig()
cfg.Pretty = true
cfg.SortKeys = true
cfg.EscapeHTML = true
result, err = p.EncodeWithConfig(data, cfg)
```

### EncodeBatch

Signature: `func (p *Processor) EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

Batch encodes key-value pairs into a JSON object.

```go
result, err := p.EncodeBatch(map[string]any{
    "name": "CyberGo",
    "version": "1.0.0",
})
```

### EncodeFields

Signature: `func (p *Processor) EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

Encodes only specified fields, commonly used for partial serialization.

```go
type User struct {
    Name    string `json:"name"`
    Email   string `json:"email"`
    Private string `json:"private"`
}

user := User{Name: "CyberGo", Email: "test@example.com", Private: "secret"}
// Only encode name and email fields
result, err := p.EncodeFields(user, []string{"name", "email"})
```

### EncodeStream

Signature: `func (p *Processor) EncodeStream(values any, cfg ...Config) (string, error)`

Encodes multiple values into a JSON array stream. `values` is typically a slice or enumerable collection, outputting a JSON array string like `[v1,v2,...]`.

```go
values := []any{"item1", "item2", "item3"}
result, err := p.EncodeStream(values)
```

## Encoding/Decoding

### Marshal

Signature: `func (p *Processor) Marshal(value any, cfg ...Config) ([]byte, error)`

Encodes a Go value to a JSON byte slice. 100% compatible with `encoding/json.Marshal`.

```go
data, err := p.Marshal(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"CyberGo"}
```

### MarshalIndent

Signature: `func (p *Processor) MarshalIndent(value any, prefix, indent string, cfg ...Config) ([]byte, error)`

Encodes a Go value to a formatted JSON byte slice. 100% compatible with `encoding/json.MarshalIndent`.

```go
data, err := p.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

### Unmarshal

Signature: `func (p *Processor) Unmarshal(data []byte, value any, cfg ...Config) error`

Parses a JSON byte slice into the target variable. 100% compatible with `encoding/json.Unmarshal`.

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

Formats a JSON string with indentation.

```go
pretty, err := p.Prettify(`{"name":"Alice","age":30}`)
// Output:
// {
//   "name": "Alice",
//   "age": 30
// }
```

### Print (Removed)

::: warning API Change Notice
`Print`, `PrintE`, `PrintPretty`, `PrintPrettyE` have been removed from the library and are no longer available. Please use the following alternatives:

```go
// Compact output
s, err := p.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// Formatted output
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```
:::

### ValidateSchema

Signature: `func (p *Processor) ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

Validates JSON data against the specified Schema.

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

```go
compact, err := p.Compact(`{"name": "CyberGo"}`)
// Output: {"name":"CyberGo"}
```

### CompactBuffer

Signature: `func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

Writes compacted JSON to a Buffer.

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "test"}`))
```

### Indent

Signature: `func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

Writes formatted JSON to a Buffer.

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

### HTMLEscape

Signature: `func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

Writes HTML-escaped JSON to a Buffer.

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

## See Also

- [Config](../config) - Configuration options
- [Parse and Load](./parse) - Parse/Load methods

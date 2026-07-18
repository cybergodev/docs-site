---
sidebar_label: "Parse & Validate"
title: "Processor Parse and Validate - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor parse: Valid validation, Parse, ParseAny for any type, PreParse optimization, and GetFromParsed with configurable parsing."
sidebar_position: 6
---

# Parse and Validate Methods

Processor provides JSON parsing and validity-checking methods. File I/O and streaming load are documented in [File I/O](./file-io).

## Validation Methods

### Valid

Signature: `func (p *Processor) Valid(jsonStr string, cfg ...Config) (bool, error)`

Validates whether a JSON string is valid.

```go
valid, err := p.Valid(data)
if valid && err == nil {
    // Valid JSON
}
```

### ValidBytes

Signature: `func (p *Processor) ValidBytes(data []byte) bool`

Validates whether a byte slice is valid JSON.

```go
if p.ValidBytes([]byte(data)) {
    // Valid JSON
}
```

## Parse Methods

### Parse

Signature: `func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

Parses a JSON string into the target variable. Supports standard mode and number preservation mode.

```go
// Parse into map
var obj map[string]any
err := p.Parse(`{"name":"Alice"}`, &obj)

// Parse into struct
type User struct { Name string }
var user User
err = p.Parse(`{"name":"Alice"}`, &user)

// Use number preservation mode
cfg := json.DefaultConfig()
cfg.PreserveNumbers = true
var data any
err = p.Parse(`{"price":19.99}`, &data, cfg)
```

### ParseAny

Signature: `func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

Parses a JSON string as `any` type.

```go
data, err := p.ParseAny(`{"name": "test"}`)
if err != nil {
    panic(err)
}
```

### PreParse

Signature: `func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)`

Pre-parses JSON data for subsequent multiple queries on the same data, avoiding repeated parsing.

```go
parsed, err := p.PreParse(jsonStr)
if err != nil {
    panic(err)
}

// Multiple queries on parsed data
name, _ := p.GetFromParsed(parsed, "user.name")
age, _ := p.GetFromParsed(parsed, "user.age")
```

### GetFromParsed

Signature: `func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

Gets a value from pre-parsed data. Use with `PreParse` to improve multiple query performance.

### SetFromParsed

Signature: `func (p *Processor) SetFromParsed(parsed *ParsedJSON, path string, value any, cfg ...Config) (*ParsedJSON, error)`

Sets a value on pre-parsed data, returning a new `ParsedJSON`.

```go
parsed, _ := p.PreParse(jsonStr)
newParsed, err := p.SetFromParsed(parsed, "user.name", "Bob")
```

## Method Selection

| Scenario | Recommended Method |
|----------|-------------------|
| Only validate | `Valid` / `ValidBytes` |
| Parse into target variable | `Parse` |
| Multiple queries on same data | `PreParse` + `GetFromParsed` |

## See Also

- [File I/O](./file-io) - LoadFromFile/SaveToFile file methods
- [Output Methods](./output) - Encode/EncodePretty encoding methods
- [Path Query](./query) - Get series methods

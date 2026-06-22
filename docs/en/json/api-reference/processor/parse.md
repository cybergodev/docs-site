---
title: "Processor Parse and Load - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor parse: Valid validation, Parse, ParseAny for any type, PreParse optimization, and GetFromParsed with configurable parsing."
---

# Parse and Load Methods

Processor provides JSON parsing and data loading capabilities.

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

## File Loading

### LoadFromFile

Signature: `func (p *Processor) LoadFromFile(filePath string, cfg ...Config) (string, error)`

Loads JSON data from a file and returns the raw string.

```go
data, err := p.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data) // Raw JSON string
```

### LoadFromFileAsData (Now Private)

::: warning API Change Notice
`LoadFromFileAsData` has been converted to an internal method (`loadFromFileAsData`) and is no longer exported as a public API. Please use the `LoadFromFile` + `Parse` combination instead:

```go
jsonStr, err := p.LoadFromFile("data.json")
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
// data type is map[string]any or []any
if obj, ok := data.(map[string]any); ok {
    fmt.Println(obj["name"])
}
```
:::

## Reader Loading

### LoadFromReader

Signature: `func (p *Processor) LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

Loads JSON data from a Reader and returns the raw string.

```go
file, _ := os.Open("data.json")
defer file.Close()

data, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
```

### LoadFromReaderAsData (Now Private)

::: warning API Change Notice
`LoadFromReaderAsData` has been converted to an internal method (`loadFromReaderAsData`) and is no longer exported as a public API. Please use the `LoadFromReader` + `Parse` combination instead:

```go
file, _ := os.Open("data.json")
defer file.Close()

jsonStr, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
```
:::

## Method Selection

| Scenario | Recommended Method |
|----------|-------------------|
| Need raw string | `LoadFromFile` / `LoadFromReader` |
| Need parsed data | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| Multiple queries on same data | `PreParse` + `GetFromParsed` |
| Only validate | `Valid` / `ValidBytes` |
| Parse into target variable | `Parse` |
| Save data to file | `SaveToFile` / `MarshalToFile` |
| Write to Writer | `SaveToWriter` |
| Read and decode from file | `UnmarshalFromFile` |

## File Writing

### SaveToFile

Signature: `func (p *Processor) SaveToFile(filePath string, data any, cfg ...Config) error`

Saves data as a JSON file. Automatically creates parent directories.

```go
err := p.SaveToFile("data.json", map[string]any{"name": "CyberGo"})

// Save with pretty-print configuration
err = p.SaveToFile("data.json", data, json.PrettyConfig())
```

### MarshalToFile

Signature: `func (p *Processor) MarshalToFile(path string, data any, cfg ...Config) error`

Encodes data to JSON and writes to a file. Automatically creates parent directories.

```go
err := p.MarshalToFile("output.json", data)

// Save with formatting
err = p.MarshalToFile("output.json", data, json.PrettyConfig())
```

### UnmarshalFromFile

Signature: `func (p *Processor) UnmarshalFromFile(path string, v any, cfg ...Config) error`

Reads JSON from a file and decodes into the target variable.

```go
var config Config
err := p.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### SaveToWriter

Signature: `func (p *Processor) SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

Encodes data to JSON and writes to an io.Writer.

```go
var buf bytes.Buffer
err := p.SaveToWriter(&buf, data, json.PrettyConfig())
```

## See Also

- [Output Methods](./output) - Encode/EncodePretty methods
- [Path Query](./query) - Get series methods

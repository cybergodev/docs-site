---
sidebar_label: "File I/O"
title: "Processor File I/O Methods - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor file methods: LoadFromFile/LoadFromReader to load, SaveToFile/MarshalToFile to save, UnmarshalFromFile to read, SaveToWriter for streams."
sidebar_position: 9
---

# File I/O Methods

Processor provides JSON file read/write and streaming load methods, covering files, `io.Reader`, and `io.Writer`.

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
LoadFromFileAsData has been converted to an internal method (`loadFromFileAsData`) and is no longer exported as a public API. Please use the `LoadFromFile` + `Parse` combination instead:

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
LoadFromReaderAsData has been converted to an internal method (`loadFromReaderAsData`) and is no longer exported as a public API. Please use the `LoadFromReader` + `Parse` combination instead:

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

## Method Selection

| Scenario | Recommended Method |
|----------|-------------------|
| Need raw string | `LoadFromFile` / `LoadFromReader` |
| Need parsed data | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| Save data to file | `SaveToFile` / `MarshalToFile` |
| Write to Writer | `SaveToWriter` |
| Read and decode from file | `UnmarshalFromFile` |

## See Also

- [Parse & Validate](./parse) - Parse/Valid parsing methods
- [File I/O Functions](../functions/file-io) - Package-level file functions

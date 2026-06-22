---
title: "File Operation Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON file I/O: LoadFromReader streaming, ParseJSONL/ToJSONL, StreamLinesInto[T] generic streams, and NewJSONLWriter for large-file scenarios."
---

# File Operation Functions

The json package provides file operation and JSONL processing functions.

## File Read Functions

### LoadFromFile

Signature: `func LoadFromFile(filePath string, cfg ...Config) (string, error)`

Loads JSON data from a file.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | Yes | File path |
| `cfg` | `Config` | No | Optional configuration |

```go
data, err := json.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data)
```

### SaveToFile

Signature: `func SaveToFile(filePath string, data any, cfg ...Config) error`

Saves JSON data to a file.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | Yes | File path |
| `data` | `any` | Yes | Data to save |
| `cfg` | `Config` | No | Optional configuration |

```go
err := json.SaveToFile("output.json", map[string]any{
    "name": "Alice",
    "age":  30,
})
if err != nil {
    panic(err)
}
```

### MarshalToFile

Signature: `func MarshalToFile(filePath string, data any, cfg ...Config) error`

Serializes data and writes to a file.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | Yes | File path |
| `data` | `any` | Yes | Data to serialize |
| `cfg` | `Config` | No | Optional configuration |

```go
err := json.MarshalToFile("data.json", myStruct)
```

### UnmarshalFromFile

Signature: `func UnmarshalFromFile(filePath string, v any, cfg ...Config) error`

Reads and deserializes data from a file.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | Yes | File path |
| `v` | `any` | Yes | Target object pointer |
| `cfg` | `Config` | No | Optional configuration |

```go
var config MyConfig
err := json.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### LoadFromReader

Signature: `func LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

Loads JSON data from an io.Reader. Suitable for reading JSON from network connections, HTTP request bodies, and other streaming data sources.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reader` | `io.Reader` | Yes | Data source |
| `cfg` | `Config` | No | Optional configuration |

```go
// Read from HTTP response body
resp, _ := http.Get("https://api.example.com/data")
defer resp.Body.Close()
data, err := json.LoadFromReader(resp.Body)

// Read from string
data, err = json.LoadFromReader(strings.NewReader(`{"name":"test"}`))
```

### SaveToWriter

Signature: `func SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

Writes JSON data to an io.Writer.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `writer` | `io.Writer` | Yes | Output destination |
| `data` | `any` | Yes | Data to write |
| `cfg` | `Config` | No | Optional configuration |

```go
var buf bytes.Buffer
err := json.SaveToWriter(&buf, map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
```

## JSONL Processing Functions

JSONL (JSON Lines) is a newline-delimited JSON format where each line is an independent JSON object.

### ParseJSONL

Signature: `func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

Parses JSONL (newline-separated JSON) data.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `[]byte` | Yes | JSONL byte data |
| `cfg` | `Config` | No | Optional configuration |

```go
jsonl := `{"name":"Alice"}
{"name":"Bob"}
{"name":"Charlie"}`
results, err := json.ParseJSONL([]byte(jsonl))
if err != nil {
    panic(err)
}
for i, r := range results {
    fmt.Printf("[%d] %v\n", i, r)
}
```

### StreamLinesInto

Signature: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Stream-reads JSONL data from an io.Reader and processes each line through a callback function. This is the recommended way to process JSONL generically.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reader` | `io.Reader` | Yes | Data source |
| `fn` | `func(lineNum int, data T) error` | Yes | Processing callback (receives line number and data) |
| `cfg` | `Config` | No | Optional configuration |

**Return Values**

| Type | Description |
|------|-------------|
| `[]T` | Slice of all processed results |
| `error` | Error information |

```go
type User struct {
    Name string `json:"name"`
}

file, _ := os.Open("users.jsonl")
defer file.Close()

// Basic usage
results, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("Line %d: User %s\n", lineNum, user.Name)
    return nil // Return error to interrupt processing
})
if err != nil {
    panic(err)
}
fmt.Printf("Total processed %d records\n", len(results))
```

### ToJSONL

Signature: `func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

Converts a data slice to JSONL format.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `[]any` | Yes | Data slice |
| `cfg` | `Config` | No | Optional configuration |

```go
items := []any{
    map[string]any{"name": "Alice"},
    map[string]any{"name": "Bob"},
}
jsonl, err := json.ToJSONL(items)
if err != nil {
    panic(err)
}
fmt.Println(string(jsonl))
// {"name":"Alice"}
// {"name":"Bob"}
```

### ToJSONLString

Signature: `func ToJSONLString(data []any, cfg ...Config) (string, error)`

Converts a data slice to a JSONL string.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `[]any` | Yes | Data slice |
| `cfg` | `Config` | No | Optional configuration |

```go
jsonlStr, err := json.ToJSONLString(items)
```

## JSONL Configuration

::: warning
The standalone `JSONLConfig` struct and `DefaultJSONLConfig()` function have been removed. JSONL configuration is now unified into the `Config` struct's `JSONL*` fields.
:::

### Configure JSONL via Config

```go
cfg := json.DefaultConfig()

// JSONL configuration
cfg.JSONLBufferSize    = 64 * 1024    // Read buffer size (default: 64KB)
cfg.JSONLMaxLineSize   = 1024 * 1024  // Maximum single line size (default: 1MB)
cfg.JSONLSkipEmpty     = true         // Skip empty lines (default: true)
cfg.JSONLSkipComments  = false        // Skip comment lines (default: false)
cfg.JSONLContinueOnErr = false        // Continue on error (default: false)
cfg.JSONLWorkers       = 4            // Parallel worker goroutines (default: 4)
cfg.JSONLChunkSize     = 1000         // Lines per batch (default: 1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // Maximum memory (default: 100MB)

processor, err := json.New(cfg)
```

See [Config Configuration](../config#config-struct)

## JSONL Writer

### NewJSONLWriter

Signature: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

Creates a JSONL writer.

```go
file, _ := os.Create("output.jsonl")
defer file.Close()
jw := json.NewJSONLWriter(file)
jw.Write(map[string]any{"id": 1, "name": "Alice"})
jw.Write(map[string]any{"id": 2, "name": "Bob"})
```

**JSONLWriter Methods**

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(data any) error` | Write a single line |
| `WriteAll` | `(data []any) error` | Write multiple lines |
| `WriteRaw` | `(line []byte) error` | Write a raw byte line |
| `Err` | `() error` | Return accumulated errors |
| `Stats` | `() JSONLStats` | Return write statistics |

```go
jw := json.NewJSONLWriter(file)

items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
}
if err := jw.WriteAll(items); err != nil {
    log.Fatal(err)
}

if err := jw.Err(); err != nil {
    log.Fatal(err)
}
```

## See Also

- [Encode and Decode Functions](./encode-decode) - Marshal, Unmarshal and other serialization operations
- [Stream Processing](../../large-files) - Stream processor details
- [Processor JSONL Methods](../processor/jsonl) - Processor-level JSONL method details

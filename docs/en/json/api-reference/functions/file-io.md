---
sidebar_label: "File I/O"
title: "File Operation Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON file I/O: LoadFromFile/SaveToFile for read/write, LoadFromReader/SaveToWriter for streaming, and MarshalToFile/UnmarshalFromFile serialization."
sidebar_position: 9
---

# File Operation Functions

The json package provides file operation functions, supporting file read/write and streaming I/O.

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

Serializes data and writes it to a file.

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

Loads JSON data from an io.Reader. Suitable for reading JSON from streaming sources like network connections, HTTP request bodies, etc.

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

// Read from a string
data, err = json.LoadFromReader(strings.NewReader(`{"name":"test"}`))
```

### SaveToWriter

Signature: `func SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

Writes JSON data to an io.Writer.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `writer` | `io.Writer` | Yes | Output target |
| `data` | `any` | Yes | Data to write |
| `cfg` | `Config` | No | Optional configuration |

```go
var buf bytes.Buffer
err := json.SaveToWriter(&buf, map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
```

## See Also

- [JSONL Processing Functions](./jsonl) - ParseJSONL, StreamLinesInto and other newline-delimited JSON processing
- [Encoding & Output Functions](./output) - Marshal, Unmarshal and other serialization operations
- [Stream Processing](../../streaming/large-files) - Stream processor details

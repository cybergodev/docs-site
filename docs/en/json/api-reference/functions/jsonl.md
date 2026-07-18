---
sidebar_label: "JSONL"
title: "JSONL Processing Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON JSONL: ParseJSONL/ToJSONL/ToJSONLString conversion, StreamLinesInto[T] streaming, NewJSONLWriter, and JSONL* Config fields for JSON Lines support."
sidebar_position: 8
---

# JSONL Processing Functions

The json package provides JSONL (JSON Lines) processing functions, supporting parsing, streaming reads, conversion, and writing of newline-delimited JSON data.

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
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
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
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

type User struct {
    Name string `json:"name"`
}

func main() {
    src := `{"name":"Alice"}
{"name":"Bob"}`

    // Basic usage
    results, err := json.StreamLinesInto[User](strings.NewReader(src), func(lineNum int, user User) error {
        fmt.Printf("Line %d: User %s\n", lineNum, user.Name)
        return nil // Return error to interrupt processing
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Total processed %d records\n", len(results))
}
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
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
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
}
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
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    items := []any{
        map[string]any{"name": "Alice"},
        map[string]any{"name": "Bob"},
    }
    jsonlStr, err := json.ToJSONLString(items)
    if err != nil {
        panic(err)
    }
    fmt.Println(jsonlStr)
}
```

## JSONL Configuration

::: warning
The standalone JSONLConfig struct and `DefaultJSONLConfig()` function have been removed. JSONL configuration is now unified into the `Config` struct's `JSONL*` fields.
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
package main

import (
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Create("output.jsonl")
    if err != nil {
        panic(err)
    }
    defer file.Close()
    jw := json.NewJSONLWriter(file)
    jw.Write(map[string]any{"id": 1, "name": "Alice"})
    jw.Write(map[string]any{"id": 2, "name": "Bob"})
}
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

- [File Operation Functions](./file-io) - LoadFromFile, SaveToFile and other file operations
- [Processor JSONL Methods](../processor/jsonl) - Processor-level JSONL methods in detail
- [Stream Processing](../../streaming/large-files) - Stream processor details

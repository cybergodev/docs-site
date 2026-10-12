---
sidebar_label: "File I/O"
title: "File Operation Functions - CyberGo JSON | LoadFromFile Usage"
description: "CyberGo JSON is a Go library for file I/O, offering LoadFromFile, SaveToFile, LoadFromReader and SaveToWriter for atomic, validated JSON persistence."
sidebar_position: 90
---

# File Operation Functions

The file operation functions of the json package support file reading/writing, streaming I/O, and typed serialization. Every file path passes security validation before reading or writing (see [File Path Validation](#security-file-path-validation)).

## File Reading and Writing

### LoadFromFile

Signature: `func LoadFromFile(filePath string, cfg ...Config) (string, error)`

Loads JSON data from a file and returns the **raw string** (no re-encoding; byte order and whitespace from the file are preserved). File size is bounded by `Config.MaxJSONSize`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | Yes | File path (must pass security validation) |
| `cfg` | `Config` | No | Optional configuration (e.g. tightening `MaxJSONSize`) |

```go
data, err := json.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data) // Raw JSON string
```

### SaveToFile

Signature: `func SaveToFile(filePath string, data any, cfg ...Config) error`

Saves data as a JSON file. Missing parent directories are created automatically; writes are **atomic** (write a temp file, then rename — a crash never truncates an existing file). String / `[]byte` inputs are pre-parsed to avoid double escaping.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | Yes | File path (must pass security validation) |
| `data` | `any` | Yes | Data to save (a Go value or a JSON string) |
| `cfg` | `Config` | No | Optional configuration (e.g. `PrettyConfig()` for pretty output) |

```go
// Compact save (default)
err := json.SaveToFile("output.json", map[string]any{
    "name": "Alice",
    "age":  30,
})

// Pretty save
err = json.SaveToFile("output.json", data, json.PrettyConfig())
```

**Full Example: SaveToFile + LoadFromFile Round Trip**

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/json"
)

func main() {
	// Create a temp file so the example runs standalone
	tmp, err := os.CreateTemp("", "cybergo-*.json")
	if err != nil {
		panic(err)
	}
	path := tmp.Name()
	tmp.Close()
	defer os.Remove(path)

	// Write: the map is encoded with keys sorted by name
	err = json.SaveToFile(path, map[string]any{"name": "Alice", "age": 30})
	if err != nil {
		panic(err)
	}

	// Read back: returns the raw file content
	data, err := json.LoadFromFile(path)
	if err != nil {
		panic(err)
	}
	fmt.Println(data)
	// Output: {"age":30,"name":"Alice"}
}
```

## Streaming I/O

### LoadFromReader

Signature: `func LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

Loads JSON data from an `io.Reader` and returns the raw string. Bytes read are bounded by `Config.MaxJSONSize` (guarding against memory exhaustion) — a good fit for streaming sources such as network connections, HTTP response bodies, and pipes.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reader` | `io.Reader` | Yes | Data source |
| `cfg` | `Config` | No | Optional configuration |

```go
// Read from an HTTP response body
resp, _ := http.Get("https://api.example.com/data")
defer resp.Body.Close()
data, err := json.LoadFromReader(resp.Body)

// Read from a string
data, err = json.LoadFromReader(strings.NewReader(`{"name":"test"}`))
```

**Full Example: Reading from strings.Reader and os.File**

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	// Read from strings.Reader (raw content returned as-is)
	reader := strings.NewReader(`{"name":"Alice","age":30}`)
	data, err := json.LoadFromReader(reader)
	if err != nil {
		panic(err)
	}
	fmt.Println(data)
	// Output: {"name":"Alice","age":30}
}
```

Reading from an `os.File` works the same way — `os.File` implements `io.Reader`:

```go
file, err := os.Open("data.json")
if err != nil {
    panic(err)
}
defer file.Close()

data, err := json.LoadFromReader(file)
```

### SaveToWriter

Signature: `func SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

Encodes data as JSON and writes it to an `io.Writer`. Like `SaveToFile`, it pre-parses string / `[]byte` inputs to prevent double escaping, but it performs **no file path validation** (the destination is caller-controlled).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `writer` | `io.Writer` | Yes | Output destination |
| `data` | `any` | Yes | Data to write |
| `cfg` | `Config` | No | Optional configuration |

```go
var buf bytes.Buffer
err := json.SaveToWriter(&buf, map[string]any{"name": "test"}, json.PrettyConfig())
```

**Full Example: Writing to bytes.Buffer**

```go
package main

import (
	"bytes"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	var buf bytes.Buffer
	err := json.SaveToWriter(&buf, map[string]any{"name": "Alice", "age": 30}, json.PrettyConfig())
	if err != nil {
		panic(err)
	}
	fmt.Print(buf.String())
	// Output:
	// {
	//   "age": 30,
	//   "name": "Alice"
	// }
}
```

Writing to an `os.File` works the same way — just pass the file handle.

## Serialization Convenience Methods

### MarshalToFile

Signature: `func MarshalToFile(filePath string, data any, cfg ...Config) error`

Serializes data as JSON and writes it to a file. **In the current version it shares the same "encode + atomic write" pipeline as `SaveToFile`**: it likewise creates parent directories automatically, writes atomically (temp file + rename), and pre-parses string / `[]byte` inputs to avoid double escaping; the passed `cfg` takes effect **in full** (indentation, escaping, number handling — historical versions read only the `Pretty` flag and silently dropped the other encoding options). The two are behaviorally equivalent; pick by semantics: `MarshalToFile` for writing Go values, `SaveToFile` to emphasize "saving a JSON document".

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | Yes | File path |
| `data` | `any` | Yes | Data to serialize |
| `cfg` | `Config` | No | Optional configuration (`PrettyConfig()` produces indented output) |

```go
err := json.MarshalToFile("data.json", myStruct)
err = json.MarshalToFile("data.json", myStruct, json.PrettyConfig())
```

### UnmarshalFromFile

Signature: `func UnmarshalFromFile(filePath string, v any, cfg ...Config) error`

Reads JSON from a file and deserializes it into a target variable. A convenience combo of "read file + `Unmarshal`"; reading is bounded by `MaxJSONSize`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | Yes | File path |
| `v` | `any` | Yes | Pointer to the target object |
| `cfg` | `Config` | No | Optional configuration |

```go
var config MyConfig
err := json.UnmarshalFromFile("config.json", &config)
```

**Full Example: MarshalToFile + UnmarshalFromFile Struct Round Trip**

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/json"
)

type User struct {
	Name string `json:"name"`
	Age  int    `json:"age"`
}

func main() {
	tmp, err := os.CreateTemp("", "cybergo-*.json")
	if err != nil {
		panic(err)
	}
	path := tmp.Name()
	tmp.Close()
	defer os.Remove(path)

	// Serialize the struct and write it to the file
	err = json.MarshalToFile(path, User{Name: "Alice", Age: 30})
	if err != nil {
		panic(err)
	}

	// Read from the file and deserialize
	var user User
	err = json.UnmarshalFromFile(path, &user)
	if err != nil {
		panic(err)
	}
	fmt.Printf("%s, %d\n", user.Name, user.Age)
	// Output: Alice, 30
}
```

## Security: File Path Validation

All file functions (`LoadFromFile` / `SaveToFile` / `MarshalToFile` / `UnmarshalFromFile`) run multi-layer security validation on paths before operating, controlled by `Config.ValidateFilePath` (default `true`). The validation covers the following attack vectors:

| Protection | Description |
|------------|-------------|
| Path traversal | Detects `..`, `..\`, their URL-encoded variants (`%2e%2e`, multi-layer encodings), and Unicode homoglyphs (fullwidth dot / slash) |
| Null-byte injection | Rejects `\x00` inside paths |
| Symlink escape | Resolves the symlink's real path to prevent pointing into restricted areas |
| System directories (Unix) | Blocks access to sensitive paths such as `/dev/`, `/proc/`, `/etc/passwd`, `/root/` |
| Windows reserved names | Rejects `CON`, `PRN`, `COM1-9`, `LPT1-9`, UNC paths, alternate data streams (ADS) |
| File size | Checks whether an existing file exceeds `MaxJSONSize` before reading, and uses `io.LimitReader` during the read to defeat TOCTOU |

```go
// Path traversal attacks are rejected with a security error
_, err := json.LoadFromFile("../../etc/passwd")
// err is non-nil: path traversal pattern detected

// Normal paths are unaffected
data, err := json.LoadFromFile("config/app.json")
```

::: warning Note
File path validation always applies to file operations (`LoadFromReader` / `SaveToWriter` involve no paths, hence no validation). When handling user-supplied filenames, these checks are one layer of defense in depth — you should still enforce an allowlist at the application layer.
:::

## File Iteration Functions

The json package provides the `ForeachFile` family, which iterates a JSON array / object directly from a file — no manual read + parse needed:

| Function | Purpose |
|----------|---------|
| `ForeachFile(path, fn, cfg...)` | Iterate the file's top-level array / object |
| `ForeachFileWithPath(path, pathExpr, fn, cfg...)` | Iterate the collection at a given path inside the file |
| `ForeachFileChunked(path, chunkSize, fn, cfg...)` | Iterate large arrays chunk by chunk |
| `ForeachFileNested(path, fn, cfg...)` | Recursively iterate all nested structures |

```go
err := json.ForeachFile("users.json", func(key any, item *json.IterableValue) error {
    fmt.Println(item.GetString("name"))
    return nil
})
```

These functions are a convenience combo of `LoadFromFile` + `Foreach`, well suited to large collections. For streaming and memory-optimization details see [Streaming](../../streaming/large-files).

## Choosing a Method

| Scenario | Recommended function |
|----------|----------------------|
| Read a file into a raw string | `LoadFromFile` |
| Read a file and deserialize into a struct | `UnmarshalFromFile` |
| Read from a Reader / HTTP body | `LoadFromReader` |
| Save a Go value to a file (compact) | `SaveToFile` / `MarshalToFile` |
| Save with pretty printing | `SaveToFile(path, data, json.PrettyConfig())` |
| Write to a Writer / Buffer | `SaveToWriter` |
| Iterate a collection in a file | `ForeachFile` family |

## See Also

- [JSONL Functions](./jsonl) - ParseJSONL, StreamLinesInto and other newline-delimited JSON processing
- [Encoding Output](./output) - Marshal, Unmarshal and other serialization operations
- [Streaming](../../streaming/large-files) - Streaming processors and large-file iteration in detail
- [Processor File I/O](../processor/file-io) - The corresponding Processor instance methods

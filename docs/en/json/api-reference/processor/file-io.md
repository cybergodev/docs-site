---
sidebar_label: "File I/O"
title: "Processor File I/O - CyberGo JSON | LoadFromFile/SaveToFile"
description: "Processor file I/O: LoadFromFile/LoadFromReader raw reads, SaveToFile/MarshalToFile atomic writes, UnmarshalFromFile decode and ForeachFile iteration."
sidebar_position: 90
---

# File Operation Methods

File methods cover files, `io.Reader` and `io.Writer`. Methods that take a file path validate it for security before operating (see the [Function Reference](../functions/file-io#security-file-path-validation)).

## File Loading

### LoadFromFile

Signature: `func (p *Processor) LoadFromFile(filePath string, cfg ...Config) (string, error)`

Loads JSON data from a file and returns the **raw string** (byte order and whitespace preserved, no re-encoding). Bytes read are bounded by `MaxJSONSize`; exceeding it returns `ErrSizeLimit`.

```go
data, err := p.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data) // Raw JSON string
```

### LoadFromFileAsData (now private)

::: warning API change notice
LoadFromFileAsData has become an internal method (`loadFromFileAsData`) and is no longer exported as public API. Use the `LoadFromFile` + `Parse` combination instead:

```go
jsonStr, err := p.LoadFromFile("data.json")
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
// data is a map[string]any or []any
if obj, ok := data.(map[string]any); ok {
    fmt.Println(obj["name"])
}
```

:::

## Reader Loading

### LoadFromReader

Signature: `func (p *Processor) LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

Loads JSON data from an `io.Reader` and returns the raw string. Reads are bounded by `MaxJSONSize`; typical sources are `os.File`, HTTP bodies and pipes.

```go
file, _ := os.Open("data.json")
defer file.Close()

data, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
```

### LoadFromReaderAsData (now private)

::: warning API change notice
LoadFromReaderAsData has become an internal method (`loadFromReaderAsData`) and is no longer exported as public API. Use the `LoadFromReader` + `Parse` combination instead:

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

Saves data as a JSON file. Creates parent directories automatically and uses **atomic writes** (temp file + rename). String / `[]byte` inputs are pre-parsed to avoid double escaping.

```go
err := p.SaveToFile("data.json", map[string]any{"name": "CyberGo"})

// Save pretty output with PrettyConfig
err = p.SaveToFile("data.json", data, json.PrettyConfig())
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
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	tmp, err := os.CreateTemp("", "cybergo-*.json")
	if err != nil {
		panic(err)
	}
	path := tmp.Name()
	tmp.Close()
	defer os.Remove(path)

	err = p.SaveToFile(path, map[string]any{"name": "Alice", "age": 30})
	if err != nil {
		panic(err)
	}

	data, err := p.LoadFromFile(path)
	if err != nil {
		panic(err)
	}
	fmt.Println(data)
	// Output: {"age":30,"name":"Alice"}
}
```

### MarshalToFile

Signature: `func (p *Processor) MarshalToFile(path string, data any, cfg ...Config) error`

Encodes data as JSON and writes it to a file. Creates parent directories automatically; atomic writes. It **shares the same "encode + atomic write" pipeline** as `SaveToFile`: string / `[]byte` inputs are pre-parsed the same way, and the passed `cfg` is honored in full (`Pretty` / `Indent` / `EscapeHTML` all take effect). The two differ only in the operation name inside error messages.

```go
err := p.MarshalToFile("output.json", data)

// Pretty save
err = p.MarshalToFile("output.json", data, json.PrettyConfig())
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
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	tmp, err := os.CreateTemp("", "cybergo-*.json")
	if err != nil {
		panic(err)
	}
	path := tmp.Name()
	tmp.Close()
	defer os.Remove(path)

	err = p.MarshalToFile(path, User{Name: "Alice", Age: 30})
	if err != nil {
		panic(err)
	}

	var user User
	err = p.UnmarshalFromFile(path, &user)
	if err != nil {
		panic(err)
	}
	fmt.Printf("%s, %d\n", user.Name, user.Age)
	// Output: Alice, 30
}
```

### UnmarshalFromFile

Signature: `func (p *Processor) UnmarshalFromFile(path string, v any, cfg ...Config) error`

Reads JSON from a file and decodes it into a target variable. Reads are bounded by `MaxJSONSize`.

```go
type AppConfig struct {
    Host string `json:"host"`
    Port int    `json:"port"`
}

var config AppConfig
err := p.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### SaveToWriter

Signature: `func (p *Processor) SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

Encodes data as JSON and writes it to an `io.Writer`. String / `[]byte` inputs are likewise pre-parsed to avoid double escaping; no file path is involved, so no path validation runs.

```go
var buf bytes.Buffer
err := p.SaveToWriter(&buf, data, json.PrettyConfig())
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
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	var buf bytes.Buffer
	err = p.SaveToWriter(&buf, map[string]any{"name": "Alice", "age": 30}, json.PrettyConfig())
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

## File Iteration

The `ForeachFile` family iterates a JSON collection straight from a file, equivalent to `LoadFromFile` followed by the matching `Foreach` method:

| Method | Purpose |
|--------|---------|
| `ForeachFile(path, fn, cfg...)` | Iterate the file's top-level array / object |
| `ForeachFileWithPath(path, pathExpr, fn, cfg...)` | Iterate the collection at a given path inside the file |
| `ForeachFileChunked(path, chunkSize, fn, cfg...)` | Iterate large arrays chunk by chunk |
| `ForeachFileNested(path, fn, cfg...)` | Recursively iterate all nested structures |

```go
err := p.ForeachFile("users.json", func(key any, item *json.IterableValue) error {
    fmt.Println(item.GetString("name"))
    return nil
})
```

Callbacks support `item.Break()` for early termination. For streaming and large-file optimization details see [Streaming](../../streaming/large-files).

## Choosing a Method

| Scenario | Recommended method |
|----------|--------------------|
| Need the raw string | `LoadFromFile` / `LoadFromReader` |
| Need parsed data | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| Save a Go value to a file | `SaveToFile` / `MarshalToFile` |
| Read a file and decode into a struct | `UnmarshalFromFile` |
| Write to a Writer | `SaveToWriter` |
| Iterate a collection in a file | `ForeachFile` family |

## See Also

- [Parse & Validate](./parse) - Parse/Valid parsing methods
- [File Functions](../functions/file-io) - Package-level file read/write functions (incl. path security validation in detail)
- [Streaming](../../streaming/large-files) - Streaming processors and large-file iteration in detail

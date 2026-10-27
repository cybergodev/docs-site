---
sidebar_label: "Parse & Validate"
title: "Processor Parse & Validate - CyberGo JSON | Parse & Valid"
description: "Processor parse and validate methods: Valid/ValidBytes checks, Parse/ParseAny parsing, PreserveNumbers number retention and PreParse/GetFromParsed reuse."
sidebar_position: 60
---

# Parse and Validate Methods

Parse methods turn JSON text into Go values or structs; validate methods only decide validity. For file I/O and streaming loads see [File I/O](./file-io). Behavior matches the [package-level parse functions](../functions/parse); the package-level `Valid` returns a single `bool` (standard-library compatible signature), so use the Processor `Valid` or the package-level `ValidWithConfig` when you need the failure reason.

## Validation Methods

### Valid

Signature: `func (p *Processor) Valid(jsonStr string, cfg ...Config) (bool, error)`

Checks whether a JSON string is valid. Returns `(true, nil)` when valid; `(false, error)` when invalid, with the error carrying the reason (`ErrInvalidJSON`, or `ErrSizeLimit` when `MaxJSONSize` is exceeded).

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	cases := []string{
		`{"name":"CyberGo","age":25}`,
		`{"name":}`,
	}
	for _, c := range cases {
		valid, err := p.Valid(c)
		fmt.Printf("valid=%-5v hasError=%v\n", valid, err != nil)
	}
}

// Output:
// valid=true  hasError=false
// valid=false hasError=true
```

### ValidBytes

Signature: `func (p *Processor) ValidBytes(data []byte) bool`

Checks whether a byte slice is valid JSON, returning only a boolean (signature-compatible with `encoding/json.Valid`; good for quick checks that need no error detail).

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	fmt.Println(p.ValidBytes([]byte(`{"ok":true}`))) // true
	fmt.Println(p.ValidBytes([]byte(`{not json}`)))  // false
}

// Output:
// true
// false
```

## Parse Methods

### Parse

Signature: `func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

Parses a JSON string into a target variable; `target` must be a non-nil pointer. Supports parsing into `map[string]any`, structs, or `any`, and can switch number-preservation mode via `Config`.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

type User struct {
	Name string `json:"name"`
	Age  int    `json:"age"`
}

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"name":"CyberGo","age":25}`

	// Parse into map[string]any (numbers default to float64)
	var obj map[string]any
	if err := p.Parse(data, &obj); err != nil {
		panic(err)
	}
	fmt.Printf("map: name=%v age=%T(%v)\n", obj["name"], obj["age"], obj["age"])

	// Parse into a struct
	var u User
	if err := p.Parse(data, &u); err != nil {
		panic(err)
	}
	fmt.Printf("struct: %+v\n", u)
}

// Output:
// map: name=CyberGo age=float64(25)
// struct: {Name:CyberGo Age:25}
```

### ParseAny

Signature: `func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

Parses a JSON string and returns the root value directly as `any` — no target type needs declaring. Internally equivalent to `Parse(jsonStr, &v)`.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data, err := p.ParseAny(`{"name":"CyberGo","age":25}`)
	if err != nil {
		panic(err)
	}
	obj := data.(map[string]any)
	fmt.Printf("name=%v age=%v\n", obj["name"], obj["age"])
}

// Output:
// name=CyberGo age=25
```

### PreserveNumbers Mode

By default (`PreserveNumbers=false`) every JSON number parses as `float64`, which loses large-integer precision and changes decimal notation. With `PreserveNumbers=true`, numbers stay as the library's `Number` type (`%T` prints `json.Number`, because the library package shares the standard library's name; underneath is the original string with an API matching `json.Number`), preserving the original text and precision. Typical uses are monetary amounts, large integers and scientific notation. The example below shows the Go type difference under both modes via `%T`:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"id":42,"price":19.99}`

	// Default mode: every number parses as float64
	var def any
	if err := p.Parse(data, &def); err != nil {
		panic(err)
	}
	defM := def.(map[string]any)
	fmt.Printf("Default: id type=%T value=%v\n", defM["id"], defM["id"])

	// PreserveNumbers mode: numbers kept as json.Number
	cfg := json.DefaultConfig()
	cfg.PreserveNumbers = true
	var preserved any
	if err := p.Parse(data, &preserved, cfg); err != nil {
		panic(err)
	}
	preM := preserved.(map[string]any)
	fmt.Printf("Preserved: id type=%T value=%v\n", preM["id"], preM["id"])
}

// Output:
// Default: id type=float64 value=42
// Preserved: id type=json.Number value=42
```

:::tip When to enable it
Enable `PreserveNumbers` for monetary amounts, integers beyond `float64`'s exact range (about ±2^53, i.e. 9007199254740992), or when numbers must be written back verbatim (avoiding `19.99` turning into `19.990000` or vice versa). For example, `9007199254740993` (2^53+1) rounds to `9007199254740992` in the default mode, while `json.Number` mode keeps it unchanged. `json.Number` values must be read explicitly with `.Int64()`, `.Float64()` or `.String()`.
:::

## Pre-Parse Optimization (PreParse)

When querying **the same JSON** at multiple paths, each [`Get`](./query) re-parses the whole document. `PreParse` parses once; `GetFromParsed` then navigates the parsed structure directly.

### PreParse

Signature: `func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)`

Pre-parses JSON and returns a reusable `*ParsedJSON`. Call `parsed.Release()` when done to drop the internal reference so the parse tree can be garbage-collected.

### GetFromParsed

Signature: `func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

Gets a value by path from pre-parsed data: parsing is skipped and the path is navigated directly.

::: warning Do not mutate the tree behind Data()
The tree returned by `Data()` / `PreParse` is the parse-cache entry itself (zero-copy), and other `GetFromParsed` calls on the same processor may read it concurrently. Mutating it poisons the cache. When you need to change data, copy it first or use `Get` (returns a deep copy) and `SetFromParsed` (deep-copies internally).
:::

### Full Comparison Example

The example contrasts "repeated package-level `Get` (re-parsing each time)" with "`PreParse` + `GetFromParsed` (parse once)"; results are identical, and the more queries and the larger the document, the more parsing is saved:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25},"meta":{"version":2,"env":"prod"}}`

	// Approach 1: every package-level Get re-parses the JSON
	name1, err := json.Get(data, "user.name")
	if err != nil {
		panic(err)
	}
	age1, err := json.Get(data, "user.age")
	if err != nil {
		panic(err)
	}
	ver1, err := json.Get(data, "meta.version")
	if err != nil {
		panic(err)
	}

	// Approach 2: PreParse once, GetFromParsed reuses the parse result
	// (recommended for repeated queries)
	parsed, err := p.PreParse(data)
	if err != nil {
		panic(err)
	}
	defer parsed.Release()

	name2, err := p.GetFromParsed(parsed, "user.name")
	if err != nil {
		panic(err)
	}
	age2, err := p.GetFromParsed(parsed, "user.age")
	if err != nil {
		panic(err)
	}
	ver2, err := p.GetFromParsed(parsed, "meta.version")
	if err != nil {
		panic(err)
	}

	fmt.Println("Get     :", name1, age1, ver1)
	fmt.Println("PreParse:", name2, age2, ver2)
}

// Output:
// Get     : CyberGo 25 2
// PreParse: CyberGo 25 2
```

### SetFromParsed

Signature: `func (p *Processor) SetFromParsed(parsed *ParsedJSON, path string, value any, cfg ...Config) (*ParsedJSON, error)`

Sets a value on pre-parsed data and returns a **new** `*ParsedJSON` (deep-copied internally; the original stays unchanged), on which you can keep querying with `GetFromParsed`.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	parsed, err := p.PreParse(`{"user":{"name":"CyberGo","age":25}}`)
	if err != nil {
		panic(err)
	}
	defer parsed.Release()

	// SetFromParsed returns a new ParsedJSON; the original stays unchanged
	modified, err := p.SetFromParsed(parsed, "user.name", "Bob")
	if err != nil {
		panic(err)
	}
	defer modified.Release()

	oldName, _ := p.GetFromParsed(parsed, "user.name")
	newName, _ := p.GetFromParsed(modified, "user.name")
	ageAfter, _ := p.GetFromParsed(modified, "user.age")
	fmt.Println("Original name:", oldName)
	fmt.Println("Modified name:", newName)
	fmt.Println("Modified age :", ageAfter)
}

// Output:
// Original name: CyberGo
// Modified name: Bob
// Modified age : 25
```

### The ParsedJSON Type

`ParsedJSON` wraps the parsed data; its fields are unexported and only two methods are exposed:

| Method | Description |
|--------|-------------|
| `Data() any` | Returns the underlying parsed data (usually `map[string]any` or `[]any`) |
| `Release()` | Nulls the internal data reference so the parse tree can be GC'd; afterwards `Data()` returns `nil` — use with `defer` |

## Method Selection Guide

| Scenario | Recommended method | Input | Output |
|----------|--------------------|-------|--------|
| Just check validity (no error detail) | `ValidBytes` | `[]byte` | `bool` |
| Check validity and get the failure reason | `Valid` | `string` | `(bool, error)` |
| Parse into a struct / concrete type | `Parse` | `string` | Written via the `target` pointer |
| Parse into `any` (no pre-declared type) | `ParseAny` | `string` | `any` |
| `encoding/json` compatible (`[]byte` input) | [`Unmarshal`](./output#unmarshal) | `[]byte` | Written via the `target` pointer |
| Multiple path queries on the same JSON | `PreParse` + `GetFromParsed` | `string` | `*ParsedJSON` / `any` |
| Modify parsed data, then keep querying | `PreParse` + `SetFromParsed` + `GetFromParsed` | `string` | `*ParsedJSON` |
| Preserve original number precision | Any parse method above + `Config{PreserveNumbers: true}` | — | Numbers become `json.Number` |

:::tip Parse vs ParseAny vs Unmarshal
- **`Unmarshal(data, &v)`**: signature matches the standard `encoding/json`; input is `[]byte`, so it drops in for the standard library or network/file byte streams. The default path runs security validation, so a few behaviors differ.
- **`Parse(jsonStr, &v)`**: input is `string`; same semantics as `Unmarshal`, with native `Config` support (security limits, `PreserveNumbers`, and so on).
- **`ParseAny(jsonStr)`**: no target type to declare, returns `any` directly — good for unknown structures or one-off reads.

The three share the same parsing core; they differ only in input type and whether a target variable must be prepared.
:::

## See Also

- [File I/O](./file-io) - LoadFromFile/SaveToFile and other file methods
- [Output Methods](./output) - Encode/EncodePretty/Unmarshal encoding methods
- [Path Queries](./query) - The Get family of methods
- [Package-Level Parse Functions](../functions/parse) - Parse/ParseAny/Valid without a Processor

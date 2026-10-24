---
sidebar_label: "Quick Start"
title: "Quick Start - CyberGo JSON | Get Started in 5 Minutes"
description: "CyberGo JSON quick start: installation, path queries with GetString/GetInt/SafeGet, Set and Delete, Marshal/Unmarshal, iteration, and first-hour FAQs."
sidebar_position: 10
---

# Quick Start

`github.com/cybergodev/json` is a Go JSON library with `encoding/json`-compatible signatures plus path query and modification operations. This page walks from installation to reads and writes, encoding, iteration, and error handling, with a minimal runnable example for each.

## Installation

```bash
go get github.com/cybergodev/json
```

**Requires Go 1.25+** (the source `go.mod` declares `go 1.25.0`).

## Basic Usage

### Package-Level Functions

Package-level functions are called directly; no processor instance is needed:

#### Getting Values

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{
        "name": "CyberGo",
        "version": 1,
        "active": true,
        "price": 99.99,
        "tags": ["json", "go", "fast"],
        "meta": {"author": "dev"}
    }`

	// Generic get
	val, err := json.Get(data, "name")
	if err != nil {
		panic(err)
	}
	fmt.Println(val) // CyberGo

	// Type-safe getters
	name := json.GetString(data, "name")
	version := json.GetInt(data, "version")
	active := json.GetBool(data, "active")
	price := json.GetFloat(data, "price")
	tags := json.GetArray(data, "tags")
	meta := json.GetObject(data, "meta")

	fmt.Println(name, version, active, price)
	fmt.Println(tags) // [json go fast]
	fmt.Println(meta) // map[author:dev]

	// Get with default values
	desc := json.GetString(data, "description", "N/A")
	count := json.GetInt(data, "count", 0)
	fmt.Println(desc, count) // N/A 0
}
```

#### Nested Paths

Dot-separated nested paths are supported:

```go
data := `{"user": {"profile": {"name": "Alice"}}}`

name := json.GetString(data, "user.profile.name")
fmt.Println(name) // Alice
```

#### Array Indices

Access by array index is supported:

```go
data := `{"items": ["a", "b", "c"]}`

// Both syntaxes are supported
item0 := json.GetString(data, "items.0")   // "a"
item1 := json.GetString(data, "items.1")   // "b"
last := json.GetString(data, "items.-1")   // "c"

// Bracket syntax
first := json.GetString(data, "items[0]")  // "a"
last2 := json.GetString(data, "items[-1]") // "c"

// Range access (returns an array)
arr := json.GetArray(data, "items[0:2]")   // ["a", "b"]
```

:::tip More path syntax
Beyond basic properties and array indices, advanced syntax such as **array slices** `[1:5]`, **wildcards** `[*]`, and **field extraction** `{name,email}` is also supported. See [Path Expression Syntax](./path-syntax).
:::

#### Setting Values

```go
data := `{"name": "old"}`

// Set a new value
updated, err := json.Set(data, "name", "new")
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"name":"new"}

// Add a new field
updated, err = json.Set(data, "version", 1)
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"name":"old","version":1}

// Chained modifications: each call returns new JSON, so take the result and check err
updated, err = json.Set(updated, "name", "updated")
if err != nil {
    panic(err)
}
updated, err = json.Set(updated, "version", 2)
if err != nil {
    panic(err)
}
updated, err = json.Set(updated, "active", true)
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"active":true,"name":"updated","version":2}
```

#### Deleting Values

```go
data := `{"name": "test", "temp": "remove"}`

// Delete a field
updated, err := json.Delete(data, "temp")
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"name":"test"}
```

### Encoding and Decoding

`Marshal`/`Unmarshal`/`MarshalIndent` share the `encoding/json` signatures, and struct tags behave the same. The difference: input is security-validated by default (oversized input, dangerous patterns, and invalid UTF-8 are rejected). Details in [Migrating from the Standard Library](./migration#what-are-the-behavioral-differences-from-the-standard-library).

```go
type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

// Encode
user := User{Name: "Alice", Age: 30}
bytes, err := json.Marshal(user)
if err != nil {
    panic(err)
}
fmt.Println(string(bytes)) // {"name":"Alice","age":30}

// Indented encoding
pretty, err := json.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(pretty))
// {
//   "name": "Alice",
//   "age": 30
// }

// Decode
var u User
if err := json.Unmarshal(bytes, &u); err != nil {
    panic(err)
}
fmt.Println(u.Name, u.Age) // Alice 30
```

### Validation

```go
valid := `{"key": "value"}`
invalid := `{key: value}`

fmt.Println(json.Valid([]byte(valid)))   // true
fmt.Println(json.Valid([]byte(invalid))) // false
```

### Formatting

```go
// Fragments in this section rely on the imports below (likewise for other sections)
import (
    "bytes"
    "fmt"

    "github.com/cybergodev/json"
)

compact := `{"name":"test","nested":{"key":"value"}}`

// Pretty-print
pretty, err := json.Prettify(compact)
if err != nil {
    panic(err)
}
fmt.Println(pretty)
// {
//   "name": "test",
//   "nested": {
//     "key": "value"
//   }
// }

// Compact output
jsonStr := `{
  "name": "test"
}`
var buf bytes.Buffer
err = json.Compact(&buf, []byte(jsonStr))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

## Using a Processor

For repeated operations on the same data, use a `Processor`: it holds an independent cache, carries configuration, and supports pre-parsing and path pre-compilation.

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// Create a processor with the default configuration
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close() // Release the cache and background goroutines

	data := `{"name": "test", "value": 42}`

	// Operate via the processor
	name := p.GetString(data, "name")
	value := p.GetInt(data, "value")

	fmt.Println(name, value)
}
```

## Configuration Options

```go
// Default configuration
cfg := json.DefaultConfig()

// Security-hardened configuration (for untrusted input)
// cfg = json.SecurityConfig()

// Pretty-print configuration
// cfg = json.PrettyConfig()

// Custom configuration
cfg = json.DefaultConfig()
cfg.MaxJSONSize = 50 * 1024 * 1024 // 50MB
cfg.EnableCache = true
cfg.CacheTTL = 5 * time.Minute

// Create a processor with the custom configuration
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Iteration and Traversal

Iterate over array elements and access their fields without building a full path per element:

```go
data := `{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}`

err := json.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("User %v: %s (age %d)\n", key, name, age)
})
if err != nil {
    panic(err)
}
// User 0: Alice (age 30)
// User 1: Bob (age 25)
```

:::tip
The `Foreach*` function family has 12 members (including 4 file variants, `ForeachFile*`, and excluding the JSONL-specific `ForeachJSONL`; see the full list in the [Cheat Sheet · Iteration Function Family](./cheatsheet#iteration-function-family)). Use `ForeachWithError` when you need **early termination** (the callback returns an `error`; return `item.Break()` to stop). Deep nested traversal, carrying the current path, and other variants are covered in the same cheat-sheet section.
:::

## Error Handling

Common errors from path operations are **sentinel errors** — tell them apart precisely with `errors.Is`:

```go
val, err := json.Get(data, "user.profile.email")
if err != nil {
    switch {
    case errors.Is(err, json.ErrPathNotFound):
        // Key missing or array index out of range — common in practice; fall back to a default value
    case errors.Is(err, json.ErrInvalidJSON):
        // The JSON itself is malformed
    default:
        // Other errors (limit exceeded, type conflicts, etc.): JsonsError already
        // carries the operation name and path, so logging it is enough — no need
        // to enumerate every category
        fmt.Println(err)
    }
}
```

If you would rather not check each case, typed functions with default values (`GetString`/`GetInt`, etc.) silently return the zero value or the default, which suits non-critical reads.

:::tip Where does ErrTypeMismatch apply?
When a plain `Get` hits a type conflict (e.g. an array index applied to a string path), it returns a descriptive error carrying context, **not** the `ErrTypeMismatch` sentinel. The sentinel is raised here:

- `SafeGet(...).AsString()` when the value is not a string wraps `ErrTypeMismatch`; failed `AsInt`/`AsFloat64`/`AsBool` conversions return a plain error that does not match the sentinel
- `GetCompiled` navigation hitting a type conflict mid-path
- `EncodeFields` given a non-object, and `ForeachFileChunked` when the root is not an array
- `ForeachWithPathAndControl` / `ForeachWithPathAndIterator` when the target value is not iterable

Note also that calling `ForeachWithError` or `ForeachWithPath` on a non-iterable value does **not** return `ErrTypeMismatch`: the callback runs zero times and `nil` is returned.
:::

## Common First-Hour Questions

The questions that come up most in the first hours are collected here; path-syntax details are in [Path Expression Syntax](./path-syntax).

**Q: What exactly is returned when a path is not found?**

A missing object key and an out-of-range array index both return `ErrPathNotFound`; only the message differs:

| Call | Object key missing | Array index out of range |
|------|--------------------|--------------------------|
| `json.Get` | `(nil, ErrPathNotFound)` | `(nil, ErrPathNotFound)` with the message `array index 10 out of bounds (length 3)` |
| `json.GetString` and other typed functions | Zero value or the passed default | Zero value or the passed default |
| `json.SafeGet` | `Exists: false` | `Exists: false` |

To decide whether an element exists, check `err` directly: `errors.Is(err, json.ErrPathNotFound)` covers both "key missing" and "index out of range". When you want "missing means default", use a typed function or `SafeGet` rather than an err branch on `Get`. Slice bounds are the exception: `items[10:20]` clamps to an empty array with no error. Full rules in [Syntax Pitfalls](./path-syntax#what-are-the-syntax-pitfalls).

**Q: Why is the number I got back a float64?**

`Get` returns `any`; under the default configuration, JSON numbers decode to `float64`:

```go
data := `{"version": 1}`

val, _ := json.Get(data, "version") // val is float64(1), not int
i := json.GetInt(data, "version")   // use a typed function when you need int
```

Large integers beyond `float64` precision (e.g. snowflake IDs) get rounded. Use `Config.PreserveNumbers` to keep the original number text, or `Decoder.UseNumber()` to get `json.Number`.

**Q: Why didn't the original JSON change after calling `Set`?**

`Set`/`Delete` follow a pure-function style: they return a **new string** carrying the modification and leave the original untouched. Discarding the return value is the most common beginner bug:

```go
data := `{"name": "old"}`

// ✗ result discarded, data unchanged
_, _ = json.Set(data, "name", "new")

// ✓ capture the return value
updated, err := json.Set(data, "name", "new")
if err != nil {
    panic(err)
}
```

When modifying multiple places, use `SetMultiple` to do it in one call; it is clearer than chained `Set` calls.

**Q: What happens if `Set` uses an out-of-range index?**

Unlike the query side, which returns `ErrPathNotFound` — under the default configuration (`CreatePaths: true`), `Set` pads the array with `null` up to the target index:

```go
updated, err := json.Set(`{"items":[1,2,3]}`, "items[5]", "x")
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"items":[1,2,3,null,null,"x"]}
```

To append at the end, use `items[+]` instead of relying on out-of-range indices.

**Q: Why is `defer p.Close()` needed everywhere?**

A `Processor` internally holds a cache and a background cleanup goroutine; `Close` drains in-flight operations and releases these resources. Creating processors at high frequency without closing them keeps accumulating resources. Package-level functions rely on a global processor whose lifecycle is managed for you, so you do not need to and should not call `Close` manually. See [Processor Guide](./processor-guide#lifecycle-management).

## Next Steps

- [Path Expression Syntax](./path-syntax) — learn the complete path query syntax
- [Processor Guide](./processor-guide) — when to use a processor, pre-parse optimization
- [Formatted Output](./print) — pretty-print and compact JSON
- [Migrating from the Standard Library](./migration) — signature swap and default validation differences
- [Cheat Sheet](./cheatsheet) — quick API reference
- [Large File Handling](../streaming/large-files) — processing large JSON files
- [API Reference](../api-reference/) — the complete API reference
- [Examples](../examples/) — browse more real-world examples

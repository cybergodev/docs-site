---
sidebar_label: "Print Functions"
title: "Print Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON print and formatting: Encode, EncodePretty, Prettify, and the standard fmt package for JSON output, replacing the removed Print functions."
sidebar_position: 11
---

# Print Functions

::: warning API Change Notice
Print, PrintPretty, PrintE, PrintPrettyE have been removed from the library and are no longer available. Please use the following alternatives.
:::

## Alternatives

### Print Compact JSON

Use `fmt.Println` + `EncodeWithConfig` (recommended) or `Marshal`:

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// Output: {"age":30,"name":"Alice"}

// Or use Marshal ([]byte output)
b, err := json.Marshal(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(b))
```

::: warning Encode Deprecated
`json.Encode` is marked as deprecated (functionally equivalent to `EncodeWithConfig`) and will be removed in a future major version. New code should use `EncodeWithConfig` or `Marshal`.
:::

### Print Formatted JSON

Use `fmt.Println` + `EncodePretty`:

```go
s, err := json.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// Output:
// {
//   "age": 30,
//   "name": "Alice"
// }
```

### Print JSON String (Prettify Existing JSON)

Use `Prettify`:

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

### Print Using Processor

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Encode and print (EncodeWithConfig recommended; Encode is deprecated)
s, err := p.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// Formatted print
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

## Complete Example

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    data := map[string]any{
        "users": []any{
            map[string]any{"id": 1, "name": "Alice"},
            map[string]any{"id": 2, "name": "Bob"},
        },
        "total": 2,
    }

    // Compact output (Encode is deprecated, EncodeWithConfig recommended)
    compact, err := json.EncodeWithConfig(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(compact)

    // Formatted output
    pretty, err := json.EncodePretty(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(pretty)
}
```

## See Also

- [Encoding & Output Functions](./functions/output) - Encode, EncodePretty, Prettify
- [Package Functions](./functions/) - Package-level function overview

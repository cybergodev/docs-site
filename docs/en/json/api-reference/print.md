---
title: "Print Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON print and formatting: Encode, EncodePretty, Prettify, and the standard fmt package for JSON output, replacing the removed Print functions."
---

# Print Functions

::: warning API Change Notice
`Print`, `PrintPretty`, `PrintE`, `PrintPrettyE` have been removed from the library and are no longer available. Please use the following alternatives.
:::

## Alternatives

### Print Compact JSON

Use `fmt.Println` + `Encode`:

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// Output: {"age":30,"name":"Alice"}
```

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

// Encode and print
s, err := p.Encode(data)
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

    // Compact output
    compact, err := json.Encode(data)
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

- [Encode/Decode Functions](./functions/encode-decode) - Encode, EncodePretty, Prettify
- [Package Functions](./functions) - Package-level function overview

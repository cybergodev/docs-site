---
title: "Print Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON print and format output reference: use Encode, EncodePretty, Prettify functions and the standard fmt package for JSON formatted output, replacing the now-private Print/PrintPretty series functions, supporting custom indentation and prefixes."
---

# Print Functions

::: warning API Change Notice
`Print`, `PrintPretty`, `PrintE`, `PrintPrettyE` have been converted to internal functions (lowercase naming) and are no longer exported as public APIs. Please use the following alternatives.
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

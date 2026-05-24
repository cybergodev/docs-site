---
title: "Debug Output - CyberGo DD | Print/JSON/Text/Exit"
description: "CyberGo DD debug output API: Print, JSON, Text, and Exit functions for quick debugging via package-level calls without creating a Logger instance."
---

# Debug Output

DD provides a set of quick debug output functions for data visualization during development and debugging.

## Package-level Debug Functions

Directly callable via the `dd.` prefix:

### Print Series

| Function | Signature | Description |
|----------|-----------|-------------|
| `Print` | `(args ...any)` | Output to global logger's Writer (LevelInfo, security filtered) |
| `Println` | `(args ...any)` | Same as Print (underlying Log() already adds newline, security filtered) |
| `Printf` | `(format string, args ...any)` | Formatted output (LevelInfo, security filtered) |

```go
dd.Print("value:", 42, true)
dd.Println("same as Print")
dd.Printf("user: %s, ID: %d", name, id)
```

:::tip Security Filtering
The `Print` series functions undergo sensitive data filtering, suitable for outputting debug data that may contain sensitive information.
:::

### JSON Output

| Function | Signature | Description |
|----------|-----------|-------------|
| `JSON` | `(data ...any)` | Compact JSON format output to stdout (with caller info) |
| `JSONF` | `(format string, args ...any)` | Formatted string as compact JSON output to stdout (with caller info) |

```go
user := map[string]any{"name": "admin", "role": "super"}
dd.JSON(user)
// Output: main.go:42 {"name":"admin","role":"super"}
```

:::warning No Security Filtering
`JSON`/`JSONF` outputs raw data directly and **does not go through sensitive data filtering**. Do not use in production environments.
:::

### Text Output

| Function | Signature | Description |
|----------|-----------|-------------|
| `Text` | `(data ...any)` | Pretty-printed format output to stdout |
| `Textf` | `(format string, args ...any)` | Formatted text output to stdout |

```go
dd.Text(complexData)
dd.Textf("Processing result: %+v", result)
```

### Exit Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `Exit` | `(data ...any)` | Text output with caller info then exit (exit code 0), complex types auto pretty-printed, no security filtering |
| `Exitf` | `(format string, args ...any)` | Formatted output with caller info then exit (exit code 0), no security filtering |

```go
dd.Exit("Debug breakpoint", someData)
// Outputs text with caller info (complex types auto pretty-printed) then os.Exit(0)
```

## Logger Methods

Logger instances also provide identically named methods (except Exit/Exitf, which are only available as package-level functions):

```go
logger := dd.Default()

// Print series writes to configured Writer (security filtered)
logger.Print("instance method")

// JSON/Text outputs directly to stdout (no security filtering)
logger.JSON(data)
logger.Text(data)
```

:::warning Difference Between Logger Methods and Package Functions
`logger.Print()` outputs through the current Logger instance's configured Writer with security filtering, while `dd.Print()` outputs through the global logger's Writer with security filtering. Both behave similarly but may have different output targets. `logger.JSON()` and `logger.Text()` are the same as `dd.JSON()` and `dd.Text()`, outputting directly to stdout **without security filtering**.
:::

## Usage Scenarios

| Scenario | Recommended Function |
|----------|---------------------|
| Quick value printing | `dd.Print()` |
| Inspect struct | `dd.JSON()` |
| Formatted output | `dd.Text()` |
| Debug breakpoint | `dd.Exit()` |
| May contain sensitive data | `dd.Print()` (auto-filtered) |
| Performance profiling data | `dd.JSON()` |

:::danger Debug Only
These functions are designed for development debugging and **should not be used in production code**. Use standard log methods like `Info`, `Error`, etc. in production environments.
:::

## Next Steps

- [Logger](./logger) -- Logger debug methods
- [Package Functions](./functions) -- Global functions
- [Testing Helper](./recorder) -- LoggerRecorder testing tool

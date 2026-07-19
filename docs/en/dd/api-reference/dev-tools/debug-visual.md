---
sidebar_label: "Debug Visual"
title: "Debug Output - CyberGo DD | Print/JSON/Text/Exit"
description: "Complete API documentation for CyberGo DD's debug visualization functions, including Print formatted printing, JSON structured output, Text plain-text output, and Exit fatal-exit. These quick-debug functions are callable directly via package-level functions without creating a Logger instance, dramatically simplifying the development and debugging workflow."
sidebar_position: 1
---

# Debug Output

DD provides a set of quick debug-output functions for data visualization during development and debugging.

## Package-level Debug Functions

Callable directly via the `dd.` prefix:

### Print Family

| Function | Signature | Description |
|----------|-----------|-------------|
| `Print` | `(args ...any)` | Output to the global logger's Writer (LevelInfo, subject to security filtering) |
| `Println` | `(args ...any)` | Same as Print (the underlying Log() already appends a newline; subject to security filtering) |
| `Printf` | `(format string, args ...any)` | Formatted output (LevelInfo, subject to security filtering) |

```go
dd.Print("value:", 42, true)
dd.Println("behaves like Print")
dd.Printf("user: %s, ID: %d", name, id)
```

:::tip Security Filtering
The `Print` family goes through sensitive-data filtering, suitable for printing debug data that may contain sensitive information.
:::

### JSON Output

| Function | Signature | Description |
|----------|-----------|-------------|
| `JSON` | `(data ...any)` | Compact-JSON output to stdout (includes caller info) |
| `JSONF` | `(format string, args ...any)` | Formatted string output as compact JSON to stdout (includes caller info) |

```go
user := map[string]any{"name": "admin", "role": "super"}
dd.JSON(user)
// Output: main.go:42 {"name":"admin","role":"super"}
```

:::warning No Security Filtering
`JSON`/`JSONF` output raw data directly and **do not go through sensitive-data filtering**. Do not use them in production.
:::

### Text Output

| Function | Signature | Description |
|----------|-----------|-------------|
| `Text` | `(data ...any)` | Pretty-printed output to stdout |
| `Textf` | `(format string, args ...any)` | Formatted text output to stdout |

```go
dd.Text(complexData)
dd.Textf("result: %+v", result)
```

### Exit Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `Exit` | `(data ...any)` | Text output with caller info followed by exit (exit code 0); complex types are pretty-printed automatically; does not go through security filtering |
| `Exitf` | `(format string, args ...any)` | Formatted output with caller info followed by exit (exit code 0; does not go through security filtering) |

```go
dd.Exit("debug breakpoint", someData)
// Outputs text with caller info (complex types are pretty-printed) then calls os.Exit(0)
```

## Logger Methods

Logger instances also provide same-named methods (except Exit/Exitf, which are package-level only):

```go
logger := dd.Default()

// Print family writes to the configured Writer (subject to security filtering)
logger.Print("instance method")

// JSON/Text output directly to stdout (does not go through security filtering)
logger.JSON(data)
logger.Text(data)
```

:::warning Logger methods vs package-level functions
`logger.Print()` writes to the current Logger instance's configured Writer and goes through security filtering; `dd.Print()` writes to the global logger's Writer and also goes through security filtering. The two behave similarly but may target different writers. `logger.JSON()` and `logger.Text()`, like `dd.JSON()` and `dd.Text()`, output directly to stdout and **do not go through security filtering**.
:::

## Use Cases

| Scenario | Recommended function |
|----------|----------------------|
| Quick value printing | `dd.Print()` |
| Inspect a struct | `dd.JSON()` |
| Formatted output | `dd.Text()` |
| Debug breakpoint | `dd.Exit()` |
| Possibly contains sensitive info | `dd.Print()` (auto-filtered) |
| Performance profiling data | `dd.JSON()` |

:::danger Debug only
The `JSON`, `Text`, and `Exit` families are designed for development debugging and **should not be used in production code** (they bypass sensitive-data filtering and write directly to stdout). `Print`/`Println`/`Printf` behave like `Info` (LevelInfo + security filtering + configured writer) and can be used in production. In production, prefer standard log methods like `Info`, `Error`, etc.
:::

## Next Steps

- [Logger](../core/logger) -- Logger debug methods
- [Package Functions](../core/functions) -- Global functions
- [Test Helper](./recorder) -- LoggerRecorder test tool

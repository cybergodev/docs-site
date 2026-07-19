---
sidebar_label: "Overview"
title: "Processor - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor: New creation, GetString/Set/Delete operations, Foreach iteration, Encode encoding and Close lifecycle, suitable for high-frequency reuse."
sidebar_position: 1
---

# Processor

Processor provides high performance, configurability, and flexible reuse capabilities, suitable for repeated operations on the same data source.

## Features

- **High Performance**: Internal caching mechanism for more efficient repeated operations
- **Configurable**: Supports multiple configuration options
- **Chained Calls**: Methods return modified JSON, supporting consecutive operations
- **Resource Management**: Explicit lifecycle control

## Creating a Processor

### New

Signature: `func New(cfg ...Config) (*Processor, error)`

Creates a Processor instance with optional Config parameters.

```go
// Use default configuration
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Use custom configuration
cfg := json.DefaultConfig()
cfg.StrictMode = true
processor, err = json.New(cfg)

// Use security configuration
processor, err = json.New(json.SecurityConfig())
```

## Chained Calls

Processor methods return modified JSON strings, supporting consecutive operations:

```go
processor, _ := json.New()

// Set multiple values
result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## API Directory

| Category | Description |
|----------|-------------|
| [Query & Get](./query) | GetString/Int/Float/Bool/Get/GetWithContext/SafeGet/GetArray/GetObject/GetMultiple/CompilePath/GetCompiled |
| [Modify](./modify) | Set/SetMultiple/SetCreate/SetMultipleCreate/MergeJSON/MergeMany/CompareJSON |
| [Delete Operations](./delete) | Delete/DeleteClean |
| [Encode & Output](./output) | Encode/EncodePretty/EncodeWithConfig/MarshalIndent/Prettify/Compact/CompactBuffer/Indent/HTMLEscape/EncodeBatch/EncodeFields/EncodeStream |
| [Parse & Validate](./parse) | Parse/ParseAny/Valid/ValidBytes/Marshal/Unmarshal |
| [Batch Operations](./batch) | ProcessBatch/WarmupCache |
| [JSONL](./jsonl) | StreamJSONL/StreamJSONLParallel/StreamJSONLParallelWithContext/StreamJSONLChunked/StreamJSONLFile/ForeachJSONL/MapJSONL/ReduceJSONL/FilterJSONL/CollectJSONL/FirstJSONL |
| [File I/O](./file-io) | LoadFromFile/LoadFromReader/SaveToFile/MarshalToFile/SaveToWriter/UnmarshalFromFile |
| [Iteration Methods](./iterate) | Foreach/ForeachWithPath/ForeachNested/ForeachReturn/ForeachWithError/ForeachNestedWithError/ForeachWithPathAndIterator/ForeachWithPathAndControl/ForeachFile/ForeachFileWithPath/ForeachFileChunked/ForeachFileNested |
| [Lifecycle](./lifecycle) | Close/IsClosed/GetConfig/AddHook/ClearCache/GetStats/GetHealthStatus |

---

## Global Processor Management

Package-level functions use an internal global processor. You can manage it with the following functions:

### SetGlobalProcessor

Signature: `func SetGlobalProcessor(processor *Processor)`

Sets a custom global processor. All package-level functions (Get, Set, Marshal, etc.) will use this processor.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `processor` | `*Processor` | Custom processor instance |

```go
package main

import (
    "github.com/cybergodev/json"
)

func main() {
    // Create a processor with custom configuration
    cfg := json.SecurityConfig()
    processor, err := json.New(cfg)
    if err != nil {
        panic(err)
    }

    // Set as global processor
    json.SetGlobalProcessor(processor)

    // Now all package-level functions use the security configuration
    data, err := json.Get(`{"name":"Alice"}`, "name")
    // Uses SecurityConfig limits
    _ = data
}
```

::: warning Note
- Passing `nil` performs no operation
- The previous global processor is automatically closed
- This function is thread-safe
:::

### ShutdownGlobalProcessor

Signature: `func ShutdownGlobalProcessor()`

Closes and removes the global processor. Subsequent package-level operations will create a new default processor.

```go
package main

import (
    "github.com/cybergodev/json"
)

func main() {
    // Use global processor
    data, _ := json.Get(`{"key":"value"}`, "key")
    _ = data

    // Clean up when application shuts down
    json.ShutdownGlobalProcessor()

    // Subsequent operations create a new default processor
    data2, _ := json.Get(`{"key":"value2"}`, "key")
    _ = data2
}
```

::: tip Use Cases
- Long-running services cleaning up resources on shutdown
- When you need to reset processor configuration
- Isolating different test cases in test environments
:::

---

## See Also

- [Package Functions](../functions/) - Top-level function reference
- [Config](../config) - Configuration options
- [Interface Definitions](../interfaces) - Hook interface
- [Hook System](../../extensions/hooks) - Detailed hook usage guide

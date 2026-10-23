---
sidebar_label: "Overview"
title: "Processor - CyberGo JSON | Chaining & Lifecycle"
description: "CyberGo JSON Processor: parse once, operate many times — GetString/Set/Delete, Foreach, Encode, caching, Close lifecycle — ideal for reusable data sources."
sidebar_position: 10
---

# Processor

The Processor delivers high performance, customizability, and more flexible reuse — well suited to repeated operations on the same data source.

## Characteristics

- **High performance**: internal caching makes repeated operations more efficient
- **Configurable**: supports a wide range of configuration options
- **Chaining**: methods return the modified JSON, enabling consecutive operations
- **Resource management**: explicit lifecycle control

## Creating a Processor

### New

Signature: `func New(cfg ...Config) (*Processor, error)`

Creates a Processor instance. Configure it with the optional Config parameter.

```go
// With the default configuration
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// With a custom configuration
cfg := json.DefaultConfig()
cfg.FullSecurityScan = true
processor, err = json.New(cfg)

// With the security configuration
processor, err = json.New(json.SecurityConfig())
```

## Chaining

Processor methods return the modified JSON string, enabling consecutive operations:

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
| [Query & Get](./query) | GetString/Int/Float/Bool/Get/GetWithContext/SafeGet/GetArray/GetObject/GetMultiple/CompilePath/GetCompiled/PreParse/GetFromParsed |
| [Modification Operations](./modify) | Set/SetMultiple/SetCreate/SetMultipleCreate/MergeJSON/MergeMany/CompareJSON |
| [Delete Operations](./delete) | Delete/DeleteClean |
| [Encoding Output](./output) | Encode/EncodePretty/EncodeWithConfig (deprecated)/MarshalIndent/Prettify/Compact/CompactString/CompactBuffer/Indent/HTMLEscape/EncodeBatch/EncodeFields/EncodeStream/ValidateSchema |
| [Parse & Validate](./parse) | Parse/ParseAny/Valid/ValidBytes/Marshal/Unmarshal |
| [Batch Operations](./batch) | ProcessBatch/WarmupCache |
| [JSONL](./jsonl) | StreamJSONL/StreamJSONLParallel/StreamJSONLParallelWithContext/StreamJSONLChunked/StreamJSONLFile/ForeachJSONL/MapJSONL/ReduceJSONL/FilterJSONL/CollectJSONL/FirstJSONL/ParseJSONL/ToJSONL/ToJSONLString |
| [File I/O](./file-io) | LoadFromFile/LoadFromReader/SaveToFile/MarshalToFile/SaveToWriter/UnmarshalFromFile/ForeachFile family |
| [Iteration Methods](./iterate) | Foreach/ForeachWithPath/ForeachNested/ForeachReturn/ForeachWithError/ForeachNestedWithError/ForeachWithPathAndIterator/ForeachWithPathAndControl/ForeachFile/ForeachFileWithPath/ForeachFileChunked/ForeachFileNested |
| [Lifecycle](./lifecycle) | Close/IsClosed/GetConfig/AddHook/SetLogger/ClearCache/WarmupCache/GetStats/GetHealthStatus/SetGlobalProcessor/ShutdownGlobalProcessor |

---

## Global Processor Management

Package-level functions use an internal global processor. It can be managed through these functions:

### SetGlobalProcessor

Signature: `func SetGlobalProcessor(processor *Processor)`

Sets a custom global processor. All package-level functions (Get, Set, Marshal, etc.) will use it.

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
	// Create a processor with a custom configuration
	cfg := json.SecurityConfig()
	processor, err := json.New(cfg)
	if err != nil {
		panic(err)
	}

	// Set it as the global processor
	json.SetGlobalProcessor(processor)

	// All package-level functions now use the security configuration
	data, err := json.Get(`{"name":"Alice"}`, "name")
	// The SecurityConfig limits are in effect
	_ = data
}
```

::: warning Note
- Passing `nil` does nothing
- The previous global processor is closed automatically
- This function is thread-safe
:::

### ShutdownGlobalProcessor

Signature: `func ShutdownGlobalProcessor()`

Shuts down and removes the global processor. Subsequent package-level operations create a new default processor.

```go
package main

import (
	"github.com/cybergodev/json"
)

func main() {
	// Use the global processor
	data, _ := json.Get(`{"key":"value"}`, "key")
	_ = data

	// Clean up when the application shuts down
	json.ShutdownGlobalProcessor()

	// Later operations create a new default processor
	data2, _ := json.Get(`{"key":"value2"}`, "key")
	_ = data2
}
```

:::tip Use cases
- Long-running services cleaning up resources at shutdown
- When you need to reset the processor configuration
- Isolating test cases in test environments
:::

---

## See Also

- [Package Functions](../functions/) - Top-level function reference
- [Config](../config) - Configuration options
- [Interface Definitions](../interfaces) - Hook interfaces
- [Hook System](../../extensions/hooks) - Detailed hook usage guide

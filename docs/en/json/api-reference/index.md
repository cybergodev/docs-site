---
sidebar_label: "Overview"
title: "API Reference - CyberGo JSON | Complete Functions & Types"
description: "CyberGo JSON API reference: module index for GetString/GetTyped queries, Set/Delete modifications, Marshal encoding and ValidateSchema validation."
sidebar_position: 10
---

# API Reference

The modules below index the API surface of `github.com/cybergodev/json` in two views: by module and by feature.

:::tip Two API styles
**Package-level functions** (e.g. `json.GetString(data, "path")`) need no instance; **Processor methods** (e.g. `p.GetString(data, "path")`) reuse configuration, the pre-parse cache, and the hook system. For choosing between them, see the decision tree in the [Processor Guide](../getting-started/processor-guide).
:::

## Module Index

### Function APIs

| Module | Description |
|--------|-------------|
| [Package Functions](./functions/) | Package-level function reference (query/modify/delete/encode/parse/batch/JSONL/file/iteration) |
| [Processor](./processor/) | Processor methods (mirrors the package functions, plus lifecycle and pre-parsing) |

### Types and Interfaces

| Module | Description |
|--------|-------------|
| [Config](./config) | Configuration options in detail (DefaultConfig / SecurityConfig / PrettyConfig) |
| [Type Definitions](./types) | Core types (Config / Schema / Stats / AccessResult, plus Encoder / Decoder, CompiledPath / PathSegment) |
| [Interface Definitions](./interfaces) | Extension interfaces (Hook / PathParser take effect; CustomEncoder / Validator are deprecated) |
| [Iterators and IterableValue](./iterator) | Iterator / BatchIterator / ParallelIterator / StreamIterator types |
| [Generic Operations](./generics) | Generic APIs (GetTyped[T] / StreamLinesInto[T] / Result[T]) |
| [Constants and Errors](./constants) | Constants and error types (including `Default*` constants and a Config field mapping table) |

### Utilities and Helpers

| Module | Description |
|--------|-------------|
| [Helper Functions](./helpers) | CompareJSON / MergeJSON, cache management, the global processor, SafeError / RedactedPath, AccessResult methods |
| [Formatted Output](../getting-started/print) | Pretty vs compact output, incl. Print-family migration notes |

### Cross-Module Topics

| Module | Description |
|--------|-------------|
| [Streaming](../streaming/large-files) | Large-file guide (full-load vs streaming iteration) |
| [JSONL / NDJSON Streaming](../streaming/jsonl) | Streaming reads and writes with the StreamJSONL family and JSONLWriter |
| [Security Validation](../security/security-mode) | Security-mode API (SecurityConfig / DangerousPattern / RegisterDangerousPattern) |
| [Schema Validation](./schema) | Schema validation (ValidateSchema / DefaultSchema / NewSchema) |
| [Hook System](../extensions/hooks) | Operation interception hooks (LoggingHook / TimingHook / ValidationHook / ErrorHook) |
| [Custom Encoders](../extensions/custom-encoder) | Custom encoding via `MarshalJSON` / `MarshalText` (the `CustomEncoder` / `TypeEncoder` interfaces are deprecated) |

## Quick Lookup

### By Feature

#### Path Queries

| Function | Description |
|----------|-------------|
| [`Get`](./functions/query#get), `GetWithContext`, [`GetString`](./functions/query#getstring), `GetInt`, `GetFloat`, `GetBool`, `GetArray`, `GetObject` | Type-safe gets |
| [`GetTyped[T]`](./functions/query#gettyped-t) | Generic get |
| [`SafeGet`](./functions/query#safeget-package-level-function) | Safe get returning an AccessResult |
| [`GetMultiple`](./functions/query#getmultiple-package-level-function) | Batch get |

#### Modification Operations

| Function | Description |
|----------|-------------|
| [`Set`](./functions/modify#set), `SetMultiple` | Set values |
| [`SetCreate`](./functions/modify#setcreate), `SetMultipleCreate` | Set values with automatic path creation |
| [`Delete`](./functions/delete#delete), `DeleteClean` | Delete values |
| [`ProcessBatch`](./functions/batch#processbatch) | Batch operations |

#### Encoding and Decoding

| Function | Description |
|----------|-------------|
| [`Marshal`](./functions/output#marshal), [`Unmarshal`](./functions/output#unmarshal) | Same signatures as `encoding/json`, optional `cfg`; default input is security-validated, with minor behavior differences |
| [`MarshalIndent`](./functions/output#marshalindent) | Indented encoding, same signature as `encoding/json.MarshalIndent`, optional `cfg` |
| [`Encode`](./functions/output#encode), [`EncodePretty`](./functions/output#encodepretty) | Encode to string (with config / pretty output) |
| [`EncodeWithConfig`](./functions/output#encodewithconfig) (deprecated) | Functionally equivalent to `Encode`, retained within v1 — use `Encode` or `Marshal` in new code |
| `NewEncoder`, `NewDecoder` | Streaming encode/decode |
| [`Parse`](./functions/parse#parse), [`ParseAny`](./functions/parse#parseany) | Parse into a target variable / parse as `any` |
| [`EncodeBatch`](./processor/output#encodebatch), `EncodeFields`, `EncodeStream` | Encode key-value pairs into an object / encode selected fields / encode multiple values into an array |

#### Formatting

| Function | Description |
|----------|-------------|
| [`Prettify`](./functions/output#prettify) | Pretty-print JSON |
| [`Compact`](./functions/output#compact) | Compact JSON (buffer form, same signature as `encoding/json.Compact`) |
| [`CompactString`](./functions/output#compactstring) | Compact JSON (string in/out form, mirrors `Processor.Compact`) |
| [`Indent`](./functions/output#indent) | Indent and write to a buffer (same signature as `encoding/json.Indent`) |
| [`HTMLEscape`](./functions/output#htmlescape) | Escape HTML characters into a buffer (same signature as `encoding/json.HTMLEscape`) |

#### File Operations

| Function | Description |
|----------|-------------|
| [`LoadFromFile`](./functions/file-io#loadfromfile), `SaveToFile` | Read and write files |
| [`LoadFromReader`](./functions/file-io#loadfromreader) | Read from a Reader |
| [`MarshalToFile`](./functions/file-io#marshaltofile), `UnmarshalFromFile` | File encode/decode |
| [`SaveToWriter`](./functions/file-io#savetowriter) | Write to any Writer |

#### Iteration and Traversal

| Function | Description |
|----------|-------------|
| [`Foreach`](./functions/iterate#foreach) (deprecated), [`ForeachWithError`](./functions/iterate#foreachwitherror), `ForeachNested` (deprecated), `ForeachNestedWithError` | Iterate arrays/objects (incl. deep traversal; the void variants are deprecated — prefer `*WithError`) |
| [`ForeachWithPath`](./functions/iterate#foreachwithpath), `ForeachWithPathAndIterator`, `ForeachWithPathAndControl` | Iterate at a given path (carrying the current path / with break control) |
| [`ForeachReturn`](./functions/iterate#foreachreturn) | Iterate and return the modified JSON |
| [`ForeachFile`](./functions/iterate#foreachfile), `ForeachFileWithPath`, `ForeachFileChunked`, `ForeachFileNested` | Item-by-item file iteration (fully loaded, then item-by-item/batched callbacks) |
| [`NewIterator`](./iterator#newiterator), `NewBatchIterator`, `NewParallelIterator`, `NewStreamIterator` | Standalone iterator constructors (see [Iterators](./iterator)) |

#### Cache and Globals

| Function | Description |
|----------|-------------|
| [`WarmupCache`](./helpers#warmupcache), `ClearCache` | Cache warm-up / clearing |
| [`GetStats`](./helpers#getstats-package-level-function), `GetHealthStatus` | Runtime statistics / health check |
| `GetConfig`, `SetLogger` | Read processor config / inject a logger (both global and Processor methods) |
| [`SetGlobalProcessor`](./helpers#global-processor-management), `ShutdownGlobalProcessor` | Replace and shut down the global processor |
| `RegisterDangerousPattern`, `UnregisterDangerousPattern`, `ListDangerousPatterns` | Global dangerous-pattern registry register / remove / list (see [Helper Functions](./helpers#registerdangerouspattern)) |
| [`CompilePath`](./processor/query#compilepath) (Processor), [`PreParse`](./processor/query#preparse) (Processor) | Path pre-compilation / JSON pre-parsing |

#### Streaming

| Type/Method | Description |
|-------------|-------------|
| [`StreamLinesInto[T]`](./functions/jsonl#streamlinesinto) | Stream JSONL from a Reader and convert to `[]T` |
| [`ParseJSONL`](./functions/jsonl#parsejsonl) | Parse JSONL bytes into `[]any` |
| [`ToJSONL`](./functions/jsonl#tojsonl), `ToJSONLString` | Convert `[]any` to JSONL format |
| `JSONLWriter` | JSONL writer (Write/WriteAll/WriteRaw) |
| `NDJSONProcessor` ([deprecated](../streaming/jsonl#ndjsonprocessor)) | NDJSON/JSONL processor (created by `NewNDJSONProcessor`; use the StreamJSONL family in new code) |
| [`ForeachFile`](./functions/iterate#foreachfile) | Item-by-item file iteration (whole file loaded) |

#### Validation

| Function | Description |
|----------|-------------|
| [`Valid`](./functions/parse#valid) | JSON validation, same signature as `encoding/json.Valid` |
| [`ValidWithConfig`](./functions/parse#validwithconfig) | JSON validation with config |
| [`ValidateSchema`](./functions/parse#validateschema) | Schema validation (used with the `Schema` type) |
| [`CompareJSON`](./helpers#comparejson) | Compare JSON for equivalence |
| `MergeJSON`, `MergeMany` | JSON merging (union/intersection/difference modes, see [Helper Functions](./helpers)) |

## Naming Conventions

| Pattern | Description | Example |
|---------|-------------|---------|
| `Get{Type}` | Get as the given type, with optional `defaultValue` | `GetString`, `GetInt` |
| `GetTyped[T]` | Generic get, returns `T` | `GetTyped[User]` |
| `New{Type}` | Create an instance | `New` (returns `*Processor`), `NewEncoder` |
| `Default{Type}` | Default configuration | `DefaultConfig` |
| `{Type}Config` | Configuration preset | `SecurityConfig`, `PrettyConfig` |
| `Foreach*` | Iteration variants (WithError / WithPath / Nested / File) | `ForeachNestedWithError` |
| `Stream*` | Streaming variants (Into / Parallel / File / Chunked) | `StreamJSONLParallel` |
| `{Verb}Hook` | Hook factories | `LoggingHook`, `ValidationHook` |

## See Also

- [Quick Start](../getting-started/): installation and basic usage
- [Processor Guide](../getting-started/processor-guide): when to use a processor
- [Path Expression Syntax](../getting-started/path-syntax): path query syntax
- [Examples](../examples/): runnable code samples
- [Large File Handling](../streaming/large-files): streaming guide

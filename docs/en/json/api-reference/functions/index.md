---
sidebar_label: "Overview"
title: "Package Functions - CyberGo JSON | Complete Function List"
description: "CyberGo JSON is a Go catalog of package-level functions, offering categorized Get/Set/Marshal/ProcessBatch lists to help developers find the right function."
sidebar_position: 10
---

# Package Functions

Top-level functions of the json package, callable directly without creating a Processor instance. Grouped by feature:

## [Query & Get](./query)

Path queries, type-safe gets, safe gets, and batch get functions.

**Key functions**: [`Get`](./query#get) · [`GetWithContext`](./query#getwithcontext) · [`GetString`](./query#getstring) · [`GetInt`](./query#getint) · [`GetFloat`](./query#getfloat) · [`GetBool`](./query#getbool) · [`GetArray`](./query#getarray) · [`GetObject`](./query#getobject) · [`GetTyped[T]`](./query#gettyped-t) · [`SafeGet`](./query#safeget-package-level-function) · [`GetMultiple`](./query#getmultiple-package-level-function)

## [Modification Operations](./modify)

Functions for setting and merging JSON data.

**Key functions**: [`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [Delete Operations](./delete)

Functions for deleting nodes of JSON data.

**Key functions**: [`Delete`](./delete#delete) · [`DeleteClean`](./delete#deleteclean)

## [Encoding Output](./output)

Serialization, deserialization, and streaming encode/decode functions.

**Key functions**: [`Marshal`](./output#marshal) · [`Unmarshal`](./output#unmarshal) · [`MarshalIndent`](./output#marshalindent) · [`Encode`](./output#encode) · [`EncodePretty`](./output#encodepretty) · [`EncodeWithConfig`](./output#encodewithconfig) (deprecated) · [`Prettify`](./output#prettify) · [`Compact`](./output#compact) · [`CompactString`](./output#compactstring) · [`Indent`](./output#indent) · [`HTMLEscape`](./output#htmlescape) · [`NewEncoder`](../types#encoder-json-encoder) · [`NewDecoder`](../types#decoder-json-decoder) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [Parse & Validate](./parse)

Functions for parsing JSON into target objects, Processor-instance parsing, and JSON validity/Schema validation.

**Key functions**: [`Parse`](./parse#parse) · [`ParseAny`](./parse#parseany) · [`Processor.Parse`](./parse#processor-parse) · [`Processor.ParseAny`](./parse#processor-parseany) · [`Valid`](./parse#valid) · [`ValidWithConfig`](./parse#validwithconfig) · [`ValidateSchema`](./parse#validateschema)

## [Batch Operations](./batch)

Functions for batch-processing multiple JSON operations (get/set/delete/validate).

**Key functions**: [`ProcessBatch`](./batch#processbatch) · [`BatchOperation`](./batch#batchoperation) · [`BatchResult`](./batch#batchresult)

## [JSONL](./jsonl)

Functions for JSONL (JSON Lines) parsing, streaming reads, conversion, and writing.

**Key functions**: [`ParseJSONL`](./jsonl#parsejsonl) · [`ToJSONL`](./jsonl#tojsonl) · [`ToJSONLString`](./jsonl#tojsonlstring) · [`StreamLinesInto[T]`](./jsonl#streamlinesinto) · [`NewJSONLWriter`](./jsonl#newjsonlwriter)

## [File I/O](./file-io)

File reading/writing and streaming I/O functions.

**Key functions**: [`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter)

## [Iteration Methods](./iterate)

Iteration functions over JSON arrays, objects, nested structures, and files.

**Key functions**: [`Foreach`](./iterate#foreach) · [`ForeachWithPath`](./iterate#foreachwithpath) · [`ForeachNested`](./iterate#foreachnested) · [`ForeachReturn`](./iterate#foreachreturn) · [`ForeachWithError`](./iterate#foreachwitherror) · [`ForeachNestedWithError`](./iterate#foreachnestedwitherror) · [`ForeachWithPathAndIterator`](./iterate#foreachwithpathanditerator) · [`ForeachWithPathAndControl`](./iterate#foreachwithpathandcontrol) · [`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [File Iteration](../../streaming/large-files)

Guides and practices for streaming file iteration scenarios (API reference for the package-level `ForeachFile*` functions is in [Iteration Methods](./iterate#file-iteration-functions)).

**Key functions**: [`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [Utility Functions](../helpers)

Utility functions for type conversion, comparison, cache management, error handling, and more.

**Key functions**: [`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-package-level-function) · [`GetStats`](../helpers#getstats-package-level-function) · [`GetHealthStatus`](../helpers#gethealthstatus-package-level-function) · [`SetGlobalProcessor`](../helpers#global-processor-management) · [`ShutdownGlobalProcessor`](../helpers#global-processor-management) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## Quick Navigation

| Purpose | Recommended functions | Docs |
|---------|------------------------|------|
| Get a single value | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [Query & Get](./query#path-query-functions) |
| Get any type | `Get`, `GetTyped[T]` | [Query & Get](./query#generic-get-functions) |
| Get with a default | `GetString(data, path, "default")` | [Query & Get](./query#type-safe-get-functions) |
| Generic get | `GetTyped[T](data, path, defaultValue...)` | [Query & Get](./query#generic-get-functions) |
| Batch get | `GetMultiple` | [Query & Get](./query#processor-extension-methods) |
| Modify JSON | `Set`, `SetCreate` | [Modification Operations](./modify) |
| Delete from JSON | `Delete`, `DeleteClean` | [Delete Operations](./delete) |
| Serialize | `Marshal`, `Encode` | [Encoding Output](./output#serialization-functions) |
| Deserialize | `Unmarshal`, `Parse` | [Encoding Output](./output#serialization-functions) · [Parse & Validate](./parse#parse-functions) |
| Format | `Prettify`, `CompactString`, `Processor.Compact` | [Encoding Output](./output#serialization-functions) |
| Print output | `Encode` + `fmt.Println`, `EncodePretty` | [Formatted Output](../../getting-started/print) |
| Batch encoding | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [Batch Encoding](./output#batch-encoding-functions) · [Processor Output](../processor/output) |
| Batch operations | `ProcessBatch` | [Batch Operations](./batch) |
| Cache warm-up | `WarmupCache` | [Batch Operations](./batch#cache-warm-up-warmupcache) |
| Validate | `Valid` | [Parse & Validate](./parse#validation-functions) |
| JSON Schema validation | `ValidateSchema` | [Parse & Validate](./parse#validateschema) |
| Schema defaults | `DefaultSchema`, `DefaultSchemaConfig` | [Schema Validation](../schema#defaultschema) |
| File read/write | `LoadFromFile`, `SaveToFile` | [File I/O](./file-io#file-reading-and-writing) |
| File read/write (structs) | `MarshalToFile`, `UnmarshalFromFile` | [File I/O](./file-io#serialization-convenience-methods) |
| Streaming I/O | `LoadFromReader`, `SaveToWriter` | [File I/O](./file-io#streaming-i-o) |
| Iterate | `Foreach`, `ForeachWithPath`, `ForeachNested` | [Iteration Methods](./iterate#method-comparison) |
| File iteration | `ForeachFile`, `ForeachFileChunked` | [Iteration Methods](./iterate#file-iteration-method-comparison) |
| JSONL processing | `ParseJSONL`, `ToJSONL` | [JSONL](./jsonl#jsonl-processing-functions) |
| JSONL streaming | `StreamJSONL`, `StreamLinesInto[T]`, `FirstJSONL` | [JSONL](./jsonl#jsonl-streaming-functions-package-level) |
| Compare | `CompareJSON` | [Utility Functions](../helpers#json-comparison-functions) |
| Merge | `MergeJSON`, `MergeMany` | [Modification Operations](./modify#merge-functions) |
| Type conversion | `AccessResult` type conversion methods | [Utility Functions](../helpers#accessresult-type-conversion-methods) |
| Error handling | `JsonsError`, `errors.Is` | [Constants and Errors](../constants#error-variables) |

## See Also

- [Processor](../processor/) - Processor methods
- [Config](../config) - Configuration options
- [Constants and Errors](../constants) - Error types
- [Interface Definitions](../interfaces) - Extension interfaces
- [Path Expression Syntax](../../getting-started/path-syntax) - Path syntax in detail

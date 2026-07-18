---
sidebar_label: "Overview"
title: "Package Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON package functions: Get/GetString/GetInt path queries, Set/Delete/MergeJSON modification, Marshal/Unmarshal encoding, and ParseJSONL/ProcessBatch batch processing."
sidebar_position: 1
---

# Package Functions

Top-level functions provided by the json package, callable directly without creating a Processor instance. Organized by feature category:

## [Query & Get](./query)

Path queries, type-safe getters, safe access, and batch getters.

**Key Functions**: [`Get`](./query#get) · [`GetWithContext`](./query#getwithcontext) · [`GetString`](./query#getstring) · [`GetInt`](./query#getint) · [`GetFloat`](./query#getfloat) · [`GetBool`](./query#getbool) · [`GetArray`](./query#getarray) · [`GetObject`](./query#getobject) · [`GetTyped[T]`](./query#gettyped-t) · [`SafeGet`](./query#safeget-package-level-function) · [`GetMultiple`](./query#getmultiple-package-level-function)

## [Modify](./modify)

Functions for setting and merging JSON data.

**Key Functions**: [`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [Delete Operations](./delete)

Functions for deleting JSON data nodes.

**Key Functions**: [`Delete`](./delete#delete) · [`DeleteClean`](./delete#deleteclean)

## [Encoding & Output](./output)

Serialization, deserialization, and stream encoding/decoding functions.

**Key Functions**: [`Marshal`](./output#marshal) · [`Unmarshal`](./output#unmarshal) · [`MarshalIndent`](./output#marshalindent) · [`Encode`](./output#encode) · [`EncodePretty`](./output#encodepretty) · [`EncodeWithConfig`](./output#encodewithconfig) · [`Prettify`](./output#prettify) · [`Compact`](./output#compact) · [`CompactString`](./output#compactstring) · [`Indent`](./output#indent) · [`HTMLEscape`](./output#htmlescape) · [`NewEncoder`](../types#encoder-json-encoder) · [`NewDecoder`](../types#decoder-json-decoder) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [Parse & Validate](./parse)

Functions for parsing JSON into target objects, parsing via Processor instances, and JSON validity / JSON Schema validation.

**Key Functions**: [`Parse`](./parse#parse) · [`ParseAny`](./parse#parseany) · [`Processor.Parse`](./parse#processor-parse) · [`Processor.ParseAny`](./parse#processor-parseany) · [`Valid`](./parse#valid) · [`ValidWithConfig`](./parse#validwithconfig) · [`ValidateSchema`](./parse#validateschema)

## [Batch Operations](./batch)

Functions for batch processing multiple JSON operations (get/set/delete/validate).

**Key Functions**: [`ProcessBatch`](./batch#processbatch) · [`BatchOperation`](./batch#batchoperation) · [`BatchResult`](./batch#batchresult)

## [JSONL](./jsonl)

JSONL (JSON Lines) parsing, streaming reads, conversion, and writer functions.

**Key Functions**: [`ParseJSONL`](./jsonl#parsejsonl) · [`ToJSONL`](./jsonl#tojsonl) · [`ToJSONLString`](./jsonl#tojsonlstring) · [`StreamLinesInto[T]`](./jsonl#streamlinesinto) · [`NewJSONLWriter`](./jsonl#newjsonlwriter)

## [File I/O](./file-io)

File read/write and streaming I/O functions.

**Key Functions**: [`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter)

## [Iteration Methods](./iterate)

Iteration functions for traversing JSON arrays, objects, nested structures, and files.

**Key Functions**: [`Foreach`](./iterate#foreach) · [`ForeachWithPath`](./iterate#foreachwithpath) · [`ForeachNested`](./iterate#foreachnested) · [`ForeachReturn`](./iterate#foreachreturn) · [`ForeachWithError`](./iterate#foreachwitherror) · [`ForeachNestedWithError`](./iterate#foreachnestedwitherror) · [`ForeachWithPathAndIterator`](./iterate#foreachwithpathanditerator) · [`ForeachWithPathAndControl`](./iterate#foreachwithpathandcontrol) · [`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [File Iteration](../../streaming/large-files)

File stream iteration guide and practices (see [Iteration Methods](./iterate#file-iteration-functions) for the package-level `ForeachFile*` API reference).

**Key Functions**: [`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [Helper Utilities](../helpers)

Type conversion, comparison, cache management, error handling, and other utility functions.

**Key Functions**: [`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-package-function) · [`GetStats`](../helpers#getstats-package-function) · [`GetHealthStatus`](../helpers#gethealthstatus-package-function) · [`SetGlobalProcessor`](../helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](../helpers#shutdownglobalprocessor) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## Quick Navigation

| Use Case | Recommended Function | Documentation |
|----------|---------------------|---------------|
| Get single value | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [Query & Get](./query#path-query-functions) |
| Get any type | `Get`, `GetTyped[T]` | [Query & Get](./query#generic-getter-function) |
| Get with default | `GetString(data, path, "default")` | [Query & Get](./query#type-safe-getter-functions) |
| Generic get | `GetTyped[T](data, path, defaultValue...)` | [Query & Get](./query#generic-getter-function) |
| Batch get | `GetMultiple` | [Query & Get](./query#processor-extended-methods) |
| Modify JSON | `Set`, `SetCreate` | [Modify](./modify) |
| Delete JSON | `Delete`, `DeleteClean` | [Delete Operations](./delete) |
| Serialize | `Marshal`, `Encode` | [Encoding & Output](./output#serialization-functions) |
| Deserialize | `Unmarshal`, `Parse` | [Encoding & Output](./output#serialization-functions) · [Parse & Validate](./parse#parse-functions) |
| Format | `Prettify`, `CompactString`, `Processor.Compact` | [Encoding & Output](./output#serialization-functions) |
| Print output | `Encode` + `fmt.Println`, `EncodePretty` | [Print Functions](../print) |
| Batch encoding | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [Batch Encoding](./output#batch-encoding-functions) · [Processor Output](../processor/output) |
| Batch operations | `ProcessBatch` | [Batch Operations](./batch) |
| Validate | `Valid` | [Parse & Validate](./parse#validation-functions) |
| JSON Schema validation | `ValidateSchema` | [Parse & Validate](./parse#validateschema) |
| File read/write | `LoadFromFile`, `SaveToFile` | [File I/O](./file-io#file-read-functions) |
| Iterate traversal | `Foreach`, `ForeachWithPath`, `ForeachNested` | [Iteration Methods](./iterate#method-comparison) |
| File iteration | `ForeachFile`, `ForeachFileChunked` | [Iteration Methods](./iterate#file-iteration-method-comparison) |
| JSONL processing | `ParseJSONL`, `ToJSONL` | [JSONL](./jsonl#jsonl-processing-functions) |
| Compare | `CompareJSON` | [Helper Utilities](../helpers#json-comparison-functions) |
| Merge | `MergeJSON`, `MergeMany` | [Modify](./modify#merge-functions) |
| Type conversion | `AccessResult` type conversion methods | [Helper Utilities](../helpers#accessresult-type-conversion-methods) |
| Error handling | `JsonsError`, `errors.Is` | [Constants & Errors](../constants#error-variables) |

## Related

- [Processor](../processor/) - Processor methods
- [Config](../config) - Configuration options
- [Constants & Errors](../constants) - Error types
- [Interface Definitions](../interfaces) - Extension interfaces
- [Path Expression Syntax](../../getting-started/path-syntax) - Path syntax in detail

---
sidebar_label: "Overview"
title: "Package Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON package functions: Get/GetString/GetInt queries, Set/Delete/MergeJSON, Marshal/Unmarshal, and file I/O callable without a Processor."
sidebar_position: 1
---

# Package Functions

Top-level functions provided by the json package, callable directly without creating a Processor instance. Organized by feature category:

## [Query & Get](./get)

Path queries, type-safe getters, batch operations, parsing, and validation functions.

**Key Functions**: [`Get`](./get#get) · [`GetString`](./get#getstring) · [`GetInt`](./get#getint) · [`GetFloat`](./get#getfloat) · [`GetBool`](./get#getbool) · [`GetArray`](./get#getarray) · [`GetObject`](./get#getobject) · [`GetTyped[T]`](./get#gettyped-t) · [`SafeGet`](./get#safeget-package-level-function) · [`GetMultiple`](./get#getmultiple-package-level-function) · [`ProcessBatch`](./get#processor-processbatch) · [`Parse`](./get#parse) · [`ParseAny`](./get#parseany) · [`Valid`](./get#valid) · [`ValidWithConfig`](./get#validwithconfig)

## [Modify Operations](./modify)

Functions for setting, deleting, and merging JSON data.

**Key Functions**: [`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`Delete`](./modify#delete) · [`DeleteClean`](./modify#deleteclean) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [Encoding & Decoding](./encode-decode)

Serialization, deserialization, and stream encoding/decoding functions.

**Key Functions**: [`Marshal`](./encode-decode#marshal) · [`Unmarshal`](./encode-decode#unmarshal) · [`MarshalIndent`](./encode-decode#marshalindent) · [`Encode`](./encode-decode#encode) · [`EncodePretty`](./encode-decode#encodepretty) · [`EncodeWithConfig`](./encode-decode#encodewithconfig) · [`Prettify`](./encode-decode#prettify) · [`Compact`](./encode-decode#compact) · [`Indent`](./encode-decode#indent) · [`HTMLEscape`](./encode-decode#htmlescape) · [`NewEncoder`](../types#encoder-json-encoder) · [`NewDecoder`](../types#decoder-json-decoder) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [File Operations](./file-io)

File read/write and JSONL processing functions.

**Key Functions**: [`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter) · [`ParseJSONL`](./file-io#parsejsonl) · [`ToJSONL`](./file-io#tojsonl) · [`ToJSONLString`](./file-io#tojsonlstring) · [`StreamLinesInto[T]`](./file-io#streamlinesinto)

## [File Iteration](../../streaming/large-file)

File stream iteration functions (package-level functions, no Processor required).

**Key Functions**: [`ForeachFile`](../../streaming/large-file#foreachfile-package-level-function) · [`ForeachFileWithPath`](../../streaming/large-file#foreachfilewithpath-package-level-function) · [`ForeachFileChunked`](../../streaming/large-file#foreachfilechunked-package-level-function) · [`ForeachFileNested`](../../streaming/large-file#foreachfilenested-package-level-function)

## [Helper Utilities](../helpers)

Type conversion, comparison, cache management, error handling, and other utility functions.

**Key Functions**: [`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-package-function) · [`GetStats`](../helpers#getstats-package-function) · [`GetHealthStatus`](../helpers#gethealthstatus-package-function) · [`SetGlobalProcessor`](../helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](../helpers#shutdownglobalprocessor) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## Quick Navigation

| Use Case | Recommended Function | Documentation |
|----------|---------------------|---------------|
| Get single value | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [Query & Get](./get#path-query-functions) |
| Get any type | `Get`, `GetTyped[T]` | [Query & Get](./get#generic-getter-function) |
| Get with default | `GetString(data, path, "default")` | [Query & Get](./get#type-safe-getter-functions) |
| Generic get | `GetTyped[T](data, path, defaultValue...)` | [Query & Get](./get#generic-getter-function) |
| Batch get | `GetMultiple` | [Query & Get](./get#processor-extended-methods) |
| Modify JSON | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [Modify Operations](./modify) |
| Serialize | `Marshal`, `Encode` | [Encoding & Decoding](./encode-decode#serialization-functions) |
| Deserialize | `Unmarshal`, `Parse` | [Encoding & Decoding](./encode-decode#serialization-functions) · [Query & Get](./get#parse-functions) |
| Format | `Prettify`, `Processor.Compact` | [Encoding & Decoding](./encode-decode#serialization-functions) |
| Print output | `Encode` + `fmt.Println`, `EncodePretty` | [Print Functions](../print) |
| Batch encoding | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [Batch Encoding](./encode-decode#batch-encoding-functions) · [Processor Output](../processor/output) |
| Validate | `Valid` | [Query & Get](./get#validation-functions) |
| File read/write | `LoadFromFile`, `SaveToFile` | [File Operations](./file-io#file-read-functions) |
| JSONL processing | `ParseJSONL`, `ToJSONL` | [File Operations](./file-io#jsonl-processing-functions) |
| Compare | `CompareJSON` | [Helper Utilities](../helpers#json-comparison-functions) |
| Merge | `MergeJSON`, `MergeMany` | [Modify Operations](./modify#merge-functions) |
| Type conversion | `AccessResult` type conversion methods | [Helper Utilities](../helpers#accessresult-type-conversion-methods) |
| Error handling | `JsonsError`, `errors.Is` | [Constants & Errors](../constants#error-variables) |

## Related

- [Processor](../processor/) - Processor methods
- [Config](../config) - Configuration options
- [Constants & Errors](../constants) - Error types
- [Interface Definitions](../interfaces) - Extension interfaces
- [Path Expression Syntax](../../getting-started/path-syntax) - Path syntax in detail

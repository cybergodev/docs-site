---
title: "Package Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON package functions: Get/GetString/GetInt queries, Set/Delete/MergeJSON, Marshal/Unmarshal, and file I/O callable without a Processor."
---

# Package Functions

Top-level functions provided by the json package, callable directly without creating a Processor instance. Organized by feature category:

## [Query & Get](./functions/get)

Path queries, type-safe getters, batch operations, parsing, and validation functions.

**Key Functions**: [`Get`](./functions/get#get) · [`GetString`](./functions/get#getstring) · [`GetInt`](./functions/get#getint) · [`GetFloat`](./functions/get#getfloat) · [`GetBool`](./functions/get#getbool) · [`GetArray`](./functions/get#getarray) · [`GetObject`](./functions/get#getobject) · [`GetTyped[T]`](./functions/get#gettyped-t) · [`SafeGet`](./functions/get#safeget-package-level-function) · [`GetMultiple`](./functions/get#getmultiple-package-level-function) · [`ProcessBatch`](./functions/get#processor-processbatch) · [`Parse`](./functions/get#parse) · [`ParseAny`](./functions/get#parseany) · [`Valid`](./functions/get#valid) · [`ValidWithConfig`](./functions/get#validwithconfig)

## [Modify Operations](./functions/modify)

Functions for setting, deleting, and merging JSON data.

**Key Functions**: [`Set`](./functions/modify#set) · [`SetMultiple`](./functions/modify#setmultiple) · [`SetCreate`](./functions/modify#setcreate) · [`SetMultipleCreate`](./functions/modify#setmultiplecreate) · [`Delete`](./functions/modify#delete) · [`DeleteClean`](./functions/modify#deleteclean) · [`MergeJSON`](./functions/modify#mergejson) · [`MergeMany`](./functions/modify#mergemany)

## [Encoding & Decoding](./functions/encode-decode)

Serialization, deserialization, and stream encoding/decoding functions.

**Key Functions**: [`Marshal`](./functions/encode-decode#marshal) · [`Unmarshal`](./functions/encode-decode#unmarshal) · [`MarshalIndent`](./functions/encode-decode#marshalindent) · [`Encode`](./functions/encode-decode#encode) · [`EncodePretty`](./functions/encode-decode#encodepretty) · [`EncodeWithConfig`](./functions/encode-decode#encodewithconfig) · [`Prettify`](./functions/encode-decode#prettify) · [`Compact`](./functions/encode-decode#compact) · [`Indent`](./functions/encode-decode#indent) · [`HTMLEscape`](./functions/encode-decode#htmlescape) · [`NewEncoder`](./types#encoder-json-encoder) · [`NewDecoder`](./types#decoder-json-decoder) · [`EncodeBatch`](./processor/output#encodebatch) · [`EncodeFields`](./processor/output#encodefields) · [`EncodeStream`](./processor/output#encodestream) · [`SaveToWriter`](./functions/file-io#savetowriter)

## [File Operations](./functions/file-io)

File read/write and JSONL processing functions.

**Key Functions**: [`LoadFromFile`](./functions/file-io#loadfromfile) · [`LoadFromReader`](./functions/file-io#loadfromreader) · [`SaveToFile`](./functions/file-io#savetofile) · [`MarshalToFile`](./functions/file-io#marshaltofile) · [`UnmarshalFromFile`](./functions/file-io#unmarshalfromfile) · [`SaveToWriter`](./functions/file-io#savetowriter) · [`ParseJSONL`](./functions/file-io#parsejsonl) · [`ToJSONL`](./functions/file-io#tojsonl) · [`ToJSONLString`](./functions/file-io#tojsonlstring) · [`StreamLinesInto[T]`](./functions/file-io#streamlinesinto)

## [File Iteration](./large-file)

File stream iteration functions (package-level functions, no Processor required).

**Key Functions**: [`ForeachFile`](./large-file#foreachfile-package-level-function) · [`ForeachFileWithPath`](./large-file#foreachfilewithpath-package-level-function) · [`ForeachFileChunked`](./large-file#foreachfilechunked-package-level-function) · [`ForeachFileNested`](./large-file#foreachfilenested-package-level-function)

## [Helper Utilities](./helpers)

Type conversion, comparison, cache management, error handling, and other utility functions.

**Key Functions**: [`CompareJSON`](./helpers#comparejson) · [`MergeJSON`](./helpers#mergejson) · [`MergeMany`](./helpers#mergemany) · [`ClearCache`](./helpers#clearcache-package-function) · [`GetStats`](./helpers#getstats-package-function) · [`GetHealthStatus`](./helpers#gethealthstatus-package-function) · [`SetGlobalProcessor`](./helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](./helpers#shutdownglobalprocessor) · [`SafeError`](./helpers#safeerror) · [`RedactedPath`](./helpers#redactedpath) · [`WarmupCache`](./helpers#warmupcache)

---

## Quick Navigation

| Use Case | Recommended Function | Documentation |
|----------|---------------------|---------------|
| Get single value | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [Query & Get](./functions/get#path-query-functions) |
| Get any type | `Get`, `GetTyped[T]` | [Query & Get](./functions/get#generic-getter-function) |
| Get with default | `GetString(data, path, "default")` | [Query & Get](./functions/get#type-safe-getter-functions) |
| Generic get | `GetTyped[T](data, path, defaultValue...)` | [Query & Get](./functions/get#generic-getter-function) |
| Batch get | `GetMultiple` | [Query & Get](./functions/get#processor-extended-methods) |
| Modify JSON | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [Modify Operations](./functions/modify) |
| Serialize | `Marshal`, `Encode` | [Encoding & Decoding](./functions/encode-decode#serialization-functions) |
| Deserialize | `Unmarshal`, `Parse` | [Encoding & Decoding](./functions/encode-decode#serialization-functions) · [Query & Get](./functions/get#parse-functions) |
| Format | `Prettify`, `Processor.Compact` | [Encoding & Decoding](./functions/encode-decode#serialization-functions) |
| Print output | `Encode` + `fmt.Println`, `EncodePretty` | [Print Functions](./print) |
| Batch encoding | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [Batch Encoding](./functions/encode-decode#batch-encoding-functions) · [Processor Output](./processor/output) |
| Validate | `Valid` | [Query & Get](./functions/get#validation-functions) |
| File read/write | `LoadFromFile`, `SaveToFile` | [File Operations](./functions/file-io#file-read-functions) |
| JSONL processing | `ParseJSONL`, `ToJSONL` | [File Operations](./functions/file-io#jsonl-processing-functions) |
| Compare | `CompareJSON` | [Helper Utilities](./helpers#json-comparison-functions) |
| Merge | `MergeJSON`, `MergeMany` | [Modify Operations](./functions/modify#merge-functions) |
| Type conversion | `AccessResult` type conversion methods | [Helper Utilities](./helpers#accessresult-type-conversion-methods) |
| Error handling | `JsonsError`, `errors.Is` | [Constants & Errors](./constants#error-variables) |

## Related

- [Processor](./processor/) - Processor methods
- [Config](./config) - Configuration options
- [Constants & Errors](./constants) - Error types
- [Interface Definitions](./interfaces) - Extension interfaces
- [Path Expression Syntax](../path-syntax) - Path syntax in detail

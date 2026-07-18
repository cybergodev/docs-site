---
sidebar_label: "概述"
title: "包函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 包级函数：Get/GetString/GetInt 路径查询、Set/Delete/MergeJSON 修改、Marshal/Unmarshal 编解码与 ParseJSONL/ProcessBatch 批量处理。"
sidebar_position: 1
---

# 包函数

json 包提供的顶级函数，无需创建 Processor 实例即可直接调用。按功能分类如下：

## [查询获取](./query)

路径查询、类型安全获取、安全获取和批量获取函数。

**主要函数**：[`Get`](./query#get) · [`GetWithContext`](./query#getwithcontext) · [`GetString`](./query#getstring) · [`GetInt`](./query#getint) · [`GetFloat`](./query#getfloat) · [`GetBool`](./query#getbool) · [`GetArray`](./query#getarray) · [`GetObject`](./query#getobject) · [`GetTyped[T]`](./query#gettyped-t) · [`SafeGet`](./query#safeget-包级函数) · [`GetMultiple`](./query#getmultiple-包级函数)

## [修改操作](./modify)

设置、合并 JSON 数据的函数。

**主要函数**：[`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [删除操作](./delete)

删除 JSON 数据节点的函数。

**主要函数**：[`Delete`](./delete#delete) · [`DeleteClean`](./delete#deleteclean)

## [编码输出](./output)

序列化、反序列化、流式编码解码函数。

**主要函数**：[`Marshal`](./output#marshal) · [`Unmarshal`](./output#unmarshal) · [`MarshalIndent`](./output#marshalindent) · [`Encode`](./output#encode) · [`EncodePretty`](./output#encodepretty) · [`EncodeWithConfig`](./output#encodewithconfig) · [`Prettify`](./output#prettify) · [`Compact`](./output#compact) · [`CompactString`](./output#compactstring) · [`Indent`](./output#indent) · [`HTMLEscape`](./output#htmlescape) · [`NewEncoder`](../types#encoder-json-编码器) · [`NewDecoder`](../types#decoder-json-解码器) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [解析验证](./parse)

解析 JSON 到目标对象、Processor 实例解析和 JSON 有效性/Schema 验证函数。

**主要函数**：[`Parse`](./parse#parse) · [`ParseAny`](./parse#parseany) · [`Processor.Parse`](./parse#processor-parse) · [`Processor.ParseAny`](./parse#processor-parseany) · [`Valid`](./parse#valid) · [`ValidWithConfig`](./parse#validwithconfig) · [`ValidateSchema`](./parse#validateschema)

## [批量操作](./batch)

批量处理多个 JSON 操作（get/set/delete/validate）的函数。

**主要函数**：[`ProcessBatch`](./batch#processbatch) · [`BatchOperation`](./batch#batchoperation) · [`BatchResult`](./batch#batchresult)

## [JSONL](./jsonl)

JSONL（JSON Lines）解析、流式读取、转换和写入函数。

**主要函数**：[`ParseJSONL`](./jsonl#parsejsonl) · [`ToJSONL`](./jsonl#tojsonl) · [`ToJSONLString`](./jsonl#tojsonlstring) · [`StreamLinesInto[T]`](./jsonl#streamlinesinto) · [`NewJSONLWriter`](./jsonl#newjsonlwriter)

## [文件操作](./file-io)

文件读写和流式 I/O 函数。

**主要函数**：[`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter)

## [迭代方法](./iterate)

遍历 JSON 数组、对象、嵌套结构与文件的迭代函数。

**主要函数**：[`Foreach`](./iterate#foreach) · [`ForeachWithPath`](./iterate#foreachwithpath) · [`ForeachNested`](./iterate#foreachnested) · [`ForeachReturn`](./iterate#foreachreturn) · [`ForeachWithError`](./iterate#foreachwitherror) · [`ForeachNestedWithError`](./iterate#foreachnestedwitherror) · [`ForeachWithPathAndIterator`](./iterate#foreachwithpathanditerator) · [`ForeachWithPathAndControl`](./iterate#foreachwithpathandcontrol) · [`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [文件迭代](../../streaming/large-files)

文件流式迭代场景指南与实践（包级 `ForeachFile*` 函数的 API 参考见 [迭代方法](./iterate#文件迭代函数)）。

**主要函数**：[`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [辅助工具](../helpers)

类型转换、比较、缓存管理、错误处理等工具函数。

**主要函数**：[`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-包级函数) · [`GetStats`](../helpers#getstats-包级函数) · [`GetHealthStatus`](../helpers#gethealthstatus-包级函数) · [`SetGlobalProcessor`](../helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](../helpers#shutdownglobalprocessor) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## 快速导航

| 用途 | 推荐函数 | 文档 |
|------|----------|------|
| 获取单个值 | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [查询获取](./query#路径查询函数) |
| 获取任意类型 | `Get`, `GetTyped[T]` | [查询获取](./query#泛型获取函数) |
| 带默认值获取 | `GetString(data, path, "default")` | [查询获取](./query#类型安全获取函数) |
| 泛型获取 | `GetTyped[T](data, path, defaultValue...)` | [查询获取](./query#泛型获取函数) |
| 批量获取 | `GetMultiple` | [查询获取](./query#processor-扩展方法) |
| 修改 JSON | `Set`, `SetCreate` | [修改操作](./modify) |
| 删除 JSON | `Delete`, `DeleteClean` | [删除操作](./delete) |
| 序列化 | `Marshal`, `Encode` | [编码输出](./output#序列化函数) |
| 反序列化 | `Unmarshal`, `Parse` | [编码输出](./output#序列化函数) · [解析验证](./parse#解析函数) |
| 格式化 | `Prettify`, `CompactString`, `Processor.Compact` | [编码输出](./output#序列化函数) |
| 打印输出 | `Encode` + `fmt.Println`, `EncodePretty` | [打印函数](../print) |
| 批量编码 | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [批量编码](./output#批量编码函数) · [处理器输出](../processor/output) |
| 批量操作 | `ProcessBatch` | [批量操作](./batch) |
| 验证 | `Valid` | [解析验证](./parse#验证函数) |
| JSON Schema 验证 | `ValidateSchema` | [解析验证](./parse#validateschema) |
| 文件读写 | `LoadFromFile`, `SaveToFile` | [文件操作](./file-io#文件读取函数) |
| 迭代遍历 | `Foreach`, `ForeachWithPath`, `ForeachNested` | [迭代方法](./iterate#方法对比) |
| 文件迭代 | `ForeachFile`, `ForeachFileChunked` | [迭代方法](./iterate#文件迭代方法对比) |
| JSONL 处理 | `ParseJSONL`, `ToJSONL` | [JSONL](./jsonl#jsonl-处理函数) |
| 比较 | `CompareJSON` | [辅助工具](../helpers#json-比较函数) |
| 合并 | `MergeJSON`, `MergeMany` | [修改操作](./modify#合并函数) |
| 类型转换 | `AccessResult` 类型转换方法 | [辅助工具](../helpers#accessresult-类型转换方法) |
| 错误处理 | `JsonsError`, `errors.Is` | [常量错误](../constants#错误变量) |

## 相关

- [Processor](../processor/) - 处理器方法
- [Config](../config) - 配置选项
- [常量与错误](../constants) - 错误类型
- [接口定义](../interfaces) - 扩展接口
- [路径表达式语法](../../getting-started/path-syntax) - 路径语法详解

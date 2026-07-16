---
sidebar_label: "概览"
title: "包函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 包级函数：Get/GetString/GetInt 路径查询、Set/Delete/MergeJSON 修改、Marshal/Unmarshal 编解码、LoadFromFile/SaveToFile 文件操作，无需 Processor 即可调用。"
sidebar_position: 1
---

# 包函数

json 包提供的顶级函数，无需创建 Processor 实例即可直接调用。按功能分类如下：

## [查询与获取](./get)

路径查询、类型安全获取、批量操作、解析和验证函数。

**主要函数**：[`Get`](./get#get) · [`GetWithContext`](./get#getwithcontext) · [`GetString`](./get#getstring) · [`GetInt`](./get#getint) · [`GetFloat`](./get#getfloat) · [`GetBool`](./get#getbool) · [`GetArray`](./get#getarray) · [`GetObject`](./get#getobject) · [`GetTyped[T]`](./get#gettyped-t) · [`SafeGet`](./get#safeget-包级函数) · [`GetMultiple`](./get#getmultiple-包级函数) · [`ProcessBatch`](./get#processor-processbatch) · [`Parse`](./get#parse) · [`ParseAny`](./get#parseany) · [`Valid`](./get#valid) · [`ValidWithConfig`](./get#validwithconfig) · [`ValidateSchema`](./get#validateschema)

## [修改操作](./modify)

设置、删除、合并 JSON 数据的函数。

**主要函数**：[`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`Delete`](./modify#delete) · [`DeleteClean`](./modify#deleteclean) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [编码解码](./encode-decode)

序列化、反序列化、流式编码解码函数。

**主要函数**：[`Marshal`](./encode-decode#marshal) · [`Unmarshal`](./encode-decode#unmarshal) · [`MarshalIndent`](./encode-decode#marshalindent) · [`Encode`](./encode-decode#encode) · [`EncodePretty`](./encode-decode#encodepretty) · [`EncodeWithConfig`](./encode-decode#encodewithconfig) · [`Prettify`](./encode-decode#prettify) · [`Compact`](./encode-decode#compact) · [`Indent`](./encode-decode#indent) · [`HTMLEscape`](./encode-decode#htmlescape) · [`NewEncoder`](../types#encoder-json-编码器) · [`NewDecoder`](../types#decoder-json-解码器) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [文件操作](./file-io)

文件读写和 JSONL 处理函数。

**主要函数**：[`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter) · [`ParseJSONL`](./file-io#parsejsonl) · [`ToJSONL`](./file-io#tojsonl) · [`ToJSONLString`](./file-io#tojsonlstring) · [`StreamLinesInto[T]`](./file-io#streamlinesinto)

## [文件迭代](../../streaming/large-file)

文件流式迭代函数（包级函数，无需创建 Processor）。

**主要函数**：[`ForeachFile`](../../streaming/large-file#foreachfile-包级函数) · [`ForeachFileWithPath`](../../streaming/large-file#foreachfilewithpath-包级函数) · [`ForeachFileChunked`](../../streaming/large-file#foreachfilechunked-包级函数) · [`ForeachFileNested`](../../streaming/large-file#foreachfilenested-包级函数)

## [辅助工具](../helpers)

类型转换、比较、缓存管理、错误处理等工具函数。

**主要函数**：[`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-包级函数) · [`GetStats`](../helpers#getstats-包级函数) · [`GetHealthStatus`](../helpers#gethealthstatus-包级函数) · [`SetGlobalProcessor`](../helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](../helpers#shutdownglobalprocessor) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## 快速导航

| 用途 | 推荐函数 | 文档 |
|------|----------|------|
| 获取单个值 | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [查询获取](./get#路径查询函数) |
| 获取任意类型 | `Get`, `GetTyped[T]` | [查询获取](./get#泛型获取函数) |
| 带默认值获取 | `GetString(data, path, "default")` | [查询获取](./get#类型安全获取函数) |
| 泛型获取 | `GetTyped[T](data, path, defaultValue...)` | [查询获取](./get#泛型获取函数) |
| 批量获取 | `GetMultiple` | [查询获取](./get#processor-扩展方法) |
| 修改 JSON | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [修改操作](./modify) |
| 序列化 | `Marshal`, `Encode` | [编码解码](./encode-decode#序列化函数) |
| 反序列化 | `Unmarshal`, `Parse` | [编码解码](./encode-decode#序列化函数) · [查询获取](./get#解析函数) |
| 格式化 | `Prettify`, `Processor.Compact` | [编码解码](./encode-decode#序列化函数) |
| 打印输出 | `Encode` + `fmt.Println`, `EncodePretty` | [打印函数](../print) |
| 批量编码 | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [批量编码](./encode-decode#批量编码函数) · [处理器输出](../processor/output) |
| 验证 | `Valid` | [查询获取](./get#验证函数) |
| 文件读写 | `LoadFromFile`, `SaveToFile` | [文件操作](./file-io#文件读取函数) |
| JSONL 处理 | `ParseJSONL`, `ToJSONL` | [文件操作](./file-io#jsonl-处理函数) |
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

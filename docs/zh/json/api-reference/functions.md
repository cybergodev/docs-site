---
title: "包函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 包级函数：Get/GetString/GetInt 路径查询、Set/Delete/MergeJSON 修改、Marshal/Unmarshal 编解码、LoadFromFile/SaveToFile 文件操作，无需 Processor 即可调用。"
---

# 包函数

json 包提供的顶级函数，无需创建 Processor 实例即可直接调用。按功能分类如下：

## [查询与获取](./functions/get)

路径查询、类型安全获取、批量操作、解析和验证函数。

**主要函数**：[`Get`](./functions/get#get) · [`GetWithContext`](./functions/get#getwithcontext) · [`GetString`](./functions/get#getstring) · [`GetInt`](./functions/get#getint) · [`GetFloat`](./functions/get#getfloat) · [`GetBool`](./functions/get#getbool) · [`GetArray`](./functions/get#getarray) · [`GetObject`](./functions/get#getobject) · [`GetTyped[T]`](./functions/get#gettyped-t) · [`SafeGet`](./functions/get#safeget-包级函数) · [`GetMultiple`](./functions/get#getmultiple-包级函数) · [`ProcessBatch`](./functions/get#processor-processbatch) · [`Parse`](./functions/get#parse) · [`ParseAny`](./functions/get#parseany) · [`Valid`](./functions/get#valid) · [`ValidWithConfig`](./functions/get#validwithconfig) · [`ValidateSchema`](./functions/get#validateschema)

## [修改操作](./functions/modify)

设置、删除、合并 JSON 数据的函数。

**主要函数**：[`Set`](./functions/modify#set) · [`SetMultiple`](./functions/modify#setmultiple) · [`SetCreate`](./functions/modify#setcreate) · [`SetMultipleCreate`](./functions/modify#setmultiplecreate) · [`Delete`](./functions/modify#delete) · [`DeleteClean`](./functions/modify#deleteclean) · [`MergeJSON`](./functions/modify#mergejson) · [`MergeMany`](./functions/modify#mergemany)

## [编码解码](./functions/encode-decode)

序列化、反序列化、流式编码解码函数。

**主要函数**：[`Marshal`](./functions/encode-decode#marshal) · [`Unmarshal`](./functions/encode-decode#unmarshal) · [`MarshalIndent`](./functions/encode-decode#marshalindent) · [`Encode`](./functions/encode-decode#encode) · [`EncodePretty`](./functions/encode-decode#encodepretty) · [`EncodeWithConfig`](./functions/encode-decode#encodewithconfig) · [`Prettify`](./functions/encode-decode#prettify) · [`Compact`](./functions/encode-decode#compact) · [`Indent`](./functions/encode-decode#indent) · [`HTMLEscape`](./functions/encode-decode#htmlescape) · [`NewEncoder`](./types#encoder-json-编码器) · [`NewDecoder`](./types#decoder-json-解码器) · [`EncodeBatch`](./processor/output#encodebatch) · [`EncodeFields`](./processor/output#encodefields) · [`EncodeStream`](./processor/output#encodestream) · [`SaveToWriter`](./functions/file-io#savetowriter)

## [文件操作](./functions/file-io)

文件读写和 JSONL 处理函数。

**主要函数**：[`LoadFromFile`](./functions/file-io#loadfromfile) · [`LoadFromReader`](./functions/file-io#loadfromreader) · [`SaveToFile`](./functions/file-io#savetofile) · [`MarshalToFile`](./functions/file-io#marshaltofile) · [`UnmarshalFromFile`](./functions/file-io#unmarshalfromfile) · [`SaveToWriter`](./functions/file-io#savetowriter) · [`ParseJSONL`](./functions/file-io#parsejsonl) · [`ToJSONL`](./functions/file-io#tojsonl) · [`ToJSONLString`](./functions/file-io#tojsonlstring) · [`StreamLinesInto[T]`](./functions/file-io#streamlinesinto)

## [文件迭代](./large-file)

文件流式迭代函数（包级函数，无需创建 Processor）。

**主要函数**：[`ForeachFile`](./large-file#foreachfile-包级函数) · [`ForeachFileWithPath`](./large-file#foreachfilewithpath-包级函数) · [`ForeachFileChunked`](./large-file#foreachfilechunked-包级函数) · [`ForeachFileNested`](./large-file#foreachfilenested-包级函数)

## [辅助工具](./helpers)

类型转换、比较、缓存管理、错误处理等工具函数。

**主要函数**：[`CompareJSON`](./helpers#comparejson) · [`MergeJSON`](./helpers#mergejson) · [`MergeMany`](./helpers#mergemany) · [`ClearCache`](./helpers#clearcache-包级函数) · [`GetStats`](./helpers#getstats-包级函数) · [`GetHealthStatus`](./helpers#gethealthstatus-包级函数) · [`SetGlobalProcessor`](./helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](./helpers#shutdownglobalprocessor) · [`SafeError`](./helpers#safeerror) · [`RedactedPath`](./helpers#redactedpath) · [`WarmupCache`](./helpers#warmupcache)

---

## 快速导航

| 用途 | 推荐函数 | 文档 |
|------|----------|------|
| 获取单个值 | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [查询获取](./functions/get#路径查询函数) |
| 获取任意类型 | `Get`, `GetTyped[T]` | [查询获取](./functions/get#泛型获取函数) |
| 带默认值获取 | `GetString(data, path, "default")` | [查询获取](./functions/get#类型安全获取函数) |
| 泛型获取 | `GetTyped[T](data, path, defaultValue...)` | [查询获取](./functions/get#泛型获取函数) |
| 批量获取 | `GetMultiple` | [查询获取](./functions/get#processor-扩展方法) |
| 修改 JSON | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [修改操作](./functions/modify) |
| 序列化 | `Marshal`, `Encode` | [编码解码](./functions/encode-decode#序列化函数) |
| 反序列化 | `Unmarshal`, `Parse` | [编码解码](./functions/encode-decode#序列化函数) · [查询获取](./functions/get#解析函数) |
| 格式化 | `Prettify`, `Processor.Compact` | [编码解码](./functions/encode-decode#序列化函数) |
| 打印输出 | `Encode` + `fmt.Println`, `EncodePretty` | [打印函数](./print) |
| 批量编码 | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [批量编码](./functions/encode-decode#批量编码函数) · [处理器输出](./processor/output) |
| 验证 | `Valid` | [查询获取](./functions/get#验证函数) |
| 文件读写 | `LoadFromFile`, `SaveToFile` | [文件操作](./functions/file-io#文件读取函数) |
| JSONL 处理 | `ParseJSONL`, `ToJSONL` | [文件操作](./functions/file-io#jsonl-处理函数) |
| 比较 | `CompareJSON` | [辅助工具](./helpers#json-比较函数) |
| 合并 | `MergeJSON`, `MergeMany` | [修改操作](./functions/modify#合并函数) |
| 类型转换 | `AccessResult` 类型转换方法 | [辅助工具](./helpers#accessresult-类型转换方法) |
| 错误处理 | `JsonsError`, `errors.Is` | [常量错误](./constants#错误变量) |

## 相关

- [Processor](./processor/) - 处理器方法
- [Config](./config) - 配置选项
- [常量与错误](./constants) - 错误类型
- [接口定义](./interfaces) - 扩展接口
- [路径表达式语法](../path-syntax) - 路径语法详解

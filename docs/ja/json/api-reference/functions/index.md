---
sidebar_label: "概要"
title: "パッケージ関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON パッケージレベル関数：Get/GetString/GetInt パスクエリ、Set/Delete/MergeJSON 変更、Marshal/Unmarshal エンコード、ParseJSONL/ProcessBatch バッチ処理。"
sidebar_position: 1
---

# パッケージ関数

json パッケージが提供するトップレベル関数。Processor インスタンスを作成せずに直接呼び出せます。機能別に分類します。

## [クエリ取得](./query)

パスクエリ、型安全な取得、安全な取得、一括取得関数。

**主要関数**：[`Get`](./query#get) · [`GetWithContext`](./query#getwithcontext) · [`GetString`](./query#getstring) · [`GetInt`](./query#getint) · [`GetFloat`](./query#getfloat) · [`GetBool`](./query#getbool) · [`GetArray`](./query#getarray) · [`GetObject`](./query#getobject) · [`GetTyped[T]`](./query#gettyped-t) · [`SafeGet`](./query#safeget-パッケージレベル関数) · [`GetMultiple`](./query#getmultiple-パッケージレベル関数)

## [変更操作](./modify)

設定、JSON データのマージ関数。

**主要関数**：[`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [削除操作](./delete)

JSON データノードを削除する関数。

**主要関数**：[`Delete`](./delete#delete) · [`DeleteClean`](./delete#deleteclean)

## [エンコード出力](./output)

シリアライズ、デシリアライズ、ストリーミングエンコード・デコード関数。

**主要関数**：[`Marshal`](./output#marshal) · [`Unmarshal`](./output#unmarshal) · [`MarshalIndent`](./output#marshalindent) · [`Encode`](./output#encode) · [`EncodePretty`](./output#encodepretty) · [`EncodeWithConfig`](./output#encodewithconfig) · [`Prettify`](./output#prettify) · [`Compact`](./output#compact) · [`CompactString`](./output#compactstring) · [`Indent`](./output#indent) · [`HTMLEscape`](./output#htmlescape) · [`NewEncoder`](../types#encoder-json-エンコーダ) · [`NewDecoder`](../types#decoder-json-デコーダ) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [パースと検証](./parse)

JSON をターゲットオブジェクトにパース、Processor インスタンスパース、JSON 有効性/Schema 検証関数。

**主要関数**：[`Parse`](./parse#parse) · [`ParseAny`](./parse#parseany) · [`Processor.Parse`](./parse#processor-parse) · [`Processor.ParseAny`](./parse#processor-parseany) · [`Valid`](./parse#valid) · [`ValidWithConfig`](./parse#validwithconfig) · [`ValidateSchema`](./parse#validateschema)

## [バッチ操作](./batch)

複数の JSON 操作（get/set/delete/validate）をバッチ処理する関数。

**主要関数**：[`ProcessBatch`](./batch#processbatch) · [`BatchOperation`](./batch#batchoperation) · [`BatchResult`](./batch#batchresult)

## [JSONL](./jsonl)

JSONL（JSON Lines）のパース、ストリーミング読み込み、変換、書き込み関数。

**主要関数**：[`ParseJSONL`](./jsonl#parsejsonl) · [`ToJSONL`](./jsonl#tojsonl) · [`ToJSONLString`](./jsonl#tojsonlstring) · [`StreamLinesInto[T]`](./jsonl#streamlinesinto) · [`NewJSONLWriter`](./jsonl#newjsonlwriter)

## [ファイル I/O](./file-io)

ファイル読み書きとストリーミング I/O 関数。

**主要関数**：[`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter)

## [反復メソッド](./iterate)

JSON 配列、オブジェクト、ネスト構造、ファイルを走査する反復関数。

**主要関数**：[`Foreach`](./iterate#foreach) · [`ForeachWithPath`](./iterate#foreachwithpath) · [`ForeachNested`](./iterate#foreachnested) · [`ForeachReturn`](./iterate#foreachreturn) · [`ForeachWithError`](./iterate#foreachwitherror) · [`ForeachNestedWithError`](./iterate#foreachnestedwitherror) · [`ForeachWithPathAndIterator`](./iterate#foreachwithpathanditerator) · [`ForeachWithPathAndControl`](./iterate#foreachwithpathandcontrol) · [`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [ファイル反復](../../streaming/large-files)

ファイルストリーミング反復のシナリオガイドと実践（パッケージレベル `ForeachFile*` 関数の API リファレンスは [反復メソッド](./iterate#ファイル反復関数) を参照）。

**主要関数**：[`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [ヘルパーユーティリティ](../helpers)

型変換、比較、キャッシュ管理、エラー処理などのユーティリティ関数。

**主要関数**：[`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-パッケージレベル関数) · [`GetStats`](../helpers#getstats-パッケージレベル関数) · [`GetHealthStatus`](../helpers#gethealthstatus-パッケージレベル関数) · [`SetGlobalProcessor`](../helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](../helpers#shutdownglobalprocessor) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## クイックナビゲーション

| 用途 | 推奨関数 | ドキュメント |
|------|----------|------|
| 単一値の取得 | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [クエリ取得](./query#パスクエリ関数) |
| 任意型の取得 | `Get`, `GetTyped[T]` | [クエリ取得](./query#ジェネリック取得関数) |
| デフォルト値付き取得 | `GetString(data, path, "default")` | [クエリ取得](./query#型安全な取得関数) |
| ジェネリック取得 | `GetTyped[T](data, path, defaultValue...)` | [クエリ取得](./query#ジェネリック取得関数) |
| 一括取得 | `GetMultiple` | [クエリ取得](./query#processor-拡張メソッド) |
| JSON の変更 | `Set`, `SetCreate` | [変更操作](./modify) |
| JSON の削除 | `Delete`, `DeleteClean` | [削除操作](./delete) |
| シリアライズ | `Marshal`, `Encode` | [エンコード出力](./output#シリアライズ関数) |
| デシリアライズ | `Unmarshal`, `Parse` | [エンコード出力](./output#シリアライズ関数) · [パースと検証](./parse#パース関数) |
| フォーマット | `Prettify`, `CompactString`, `Processor.Compact` | [エンコード出力](./output#シリアライズ関数) |
| 出力の印字 | `Encode` + `fmt.Println`, `EncodePretty` | [出力関数](../print) |
| 一括エンコード | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [一括エンコード](./output#バッチエンコード関数) · [プロセッサ出力](../processor/output) |
| バッチ操作 | `ProcessBatch` | [バッチ操作](./batch) |
| バリデーション | `Valid` | [パースと検証](./parse#検証関数) |
| JSON Schema 検証 | `ValidateSchema` | [パースと検証](./parse#validateschema) |
| ファイル読み書き | `LoadFromFile`, `SaveToFile` | [ファイル I/O](./file-io#ファイル読み込み関数) |
| 反復走査 | `Foreach`, `ForeachWithPath`, `ForeachNested` | [反復メソッド](./iterate#メソッド比較) |
| ファイル反復 | `ForeachFile`, `ForeachFileChunked` | [反復メソッド](./iterate#ファイル反復メソッド比較) |
| JSONL 処理 | `ParseJSONL`, `ToJSONL` | [JSONL](./jsonl#jsonl-処理関数) |
| 比較 | `CompareJSON` | [ヘルパーユーティリティ](../helpers#json-比較関数) |
| マージ | `MergeJSON`, `MergeMany` | [変更操作](./modify#マージ関数) |
| 型変換 | `AccessResult` 型変換メソッド | [ヘルパーユーティリティ](../helpers#accessresult-型変換メソッド) |
| エラー処理 | `JsonsError`, `errors.Is` | [定数とエラー](../constants#エラー変数) |

## 関連

- [Processor](../processor/) - プロセッサメソッド
- [Config](../config) - 設定オプション
- [定数とエラー](../constants) - エラー型
- [インターフェース定義](../interfaces) - 拡張インターフェース
- [パス式構文](../../getting-started/path-syntax) - パス構文の詳細

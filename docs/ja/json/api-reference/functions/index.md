---
sidebar_label: "概要"
title: "パッケージ関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON パッケージ関数：Get/GetString/GetInt クエリ、Set/Delete/MergeJSON 変更、Marshal/Unmarshal、LoadFromFile/SaveToFile を Processor なしで呼び出せます。"
sidebar_position: 1
---

# パッケージ関数

json パッケージが提供するトップレベル関数。Processor インスタンスを作成せずに直接呼び出せます。機能別に分類します。

## [クエリと取得](./get)

パスクエリ、型安全な取得、一括操作、パース、バリデーション関数。

**主要関数**：[`Get`](./get#get) · [`GetString`](./get#getstring) · [`GetInt`](./get#getint) · [`GetFloat`](./get#getfloat) · [`GetBool`](./get#getbool) · [`GetArray`](./get#getarray) · [`GetObject`](./get#getobject) · [`GetTyped[T]`](./get#gettyped-t) · [`SafeGet`](./get#safeget-パッケージレベル関数) · [`GetMultiple`](./get#getmultiple-パッケージレベル関数) · [`ProcessBatch`](./get#processor-processbatch) · [`Parse`](./get#parse) · [`ParseAny`](./get#parseany) · [`Valid`](./get#valid) · [`ValidWithConfig`](./get#validwithconfig)

## [変更操作](./modify)

設定、削除、JSON データのマージ関数。

**主要関数**：[`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`Delete`](./modify#delete) · [`DeleteClean`](./modify#deleteclean) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [エンコード・デコード](./encode-decode)

シリアライズ、デシリアライズ、ストリーミングエンコード・デコード関数。

**主要関数**：[`Marshal`](./encode-decode#marshal) · [`Unmarshal`](./encode-decode#unmarshal) · [`MarshalIndent`](./encode-decode#marshalindent) · [`Encode`](./encode-decode#encode) · [`EncodePretty`](./encode-decode#encodepretty) · [`EncodeWithConfig`](./encode-decode#encodewithconfig) · [`Prettify`](./encode-decode#prettify) · [`Compact`](./encode-decode#compact) · [`Indent`](./encode-decode#indent) · [`HTMLEscape`](./encode-decode#htmlescape) · [`NewEncoder`](../types#encoder-json-エンコーダ) · [`NewDecoder`](../types#decoder-json-デコーダ) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [ファイル操作](./file-io)

ファイル読み書きと JSONL 処理関数。

**主要関数**：[`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter) · [`ParseJSONL`](./file-io#parsejsonl) · [`ToJSONL`](./file-io#tojsonl) · [`ToJSONLString`](./file-io#tojsonlstring) · [`StreamLinesInto[T]`](./file-io#streamlinesinto)

## [ファイル反復](../../streaming/large-file)

ファイルストリーミング反復関数（パッケージレベル関数、Processor 不要）。

**主要関数**：[`ForeachFile`](../../streaming/large-file#foreachfile-パッケージレベル関数) · [`ForeachFileWithPath`](../../streaming/large-file#foreachfilewithpath-パッケージレベル関数) · [`ForeachFileChunked`](../../streaming/large-file#foreachfilechunked-パッケージレベル関数) · [`ForeachFileNested`](../../streaming/large-file#foreachfilenested-パッケージレベル関数)

## [ヘルパーユーティリティ](../helpers)

型変換、比較、キャッシュ管理、エラー処理などのユーティリティ関数。

**主要関数**：[`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-パッケージレベル関数) · [`GetStats`](../helpers#getstats-パッケージレベル関数) · [`GetHealthStatus`](../helpers#gethealthstatus-パッケージレベル関数) · [`SetGlobalProcessor`](../helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](../helpers#shutdownglobalprocessor) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## クイックナビゲーション

| 用途 | 推奨関数 | ドキュメント |
|------|----------|------|
| 単一値の取得 | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [クエリ取得](./get#パスクエリ関数) |
| 任意型の取得 | `Get`, `GetTyped[T]` | [クエリ取得](./get#ジェネリック取得関数) |
| デフォルト値付き取得 | `GetString(data, path, "default")` | [クエリ取得](./get#型安全な取得関数) |
| ジェネリック取得 | `GetTyped[T](data, path, defaultValue...)` | [クエリ取得](./get#ジェネリック取得関数) |
| 一括取得 | `GetMultiple` | [クエリ取得](./get#processor-拡張メソッド) |
| JSON の変更 | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [変更操作](./modify) |
| シリアライズ | `Marshal`, `Encode` | [エンコード・デコード](./encode-decode#シリアライズ関数) |
| デシリアライズ | `Unmarshal`, `Parse` | [エンコード・デコード](./encode-decode#シリアライズ関数) · [クエリ取得](./get#パース関数) |
| フォーマット | `Prettify`, `Processor.Compact` | [エンコード・デコード](./encode-decode#シリアライズ関数) |
| 出力の印字 | `Encode` + `fmt.Println`, `EncodePretty` | [出力関数](../print) |
| 一括エンコード | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [一括エンコード](./encode-decode#バッチエンコード関数) · [プロセッサ出力](../processor/output) |
| バリデーション | `Valid` | [クエリ取得](./get#検証関数) |
| ファイル読み書き | `LoadFromFile`, `SaveToFile` | [ファイル操作](./file-io#ファイル読み込み関数) |
| JSONL 処理 | `ParseJSONL`, `ToJSONL` | [ファイル操作](./file-io#jsonl-処理関数) |
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

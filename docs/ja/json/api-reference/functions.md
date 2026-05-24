---
title: "パッケージ関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON パッケージレベル関数リファレンス：Get/GetString/GetInt/GetTyped パスクエリ、Set/Delete/MergeJSON 変更、Marshal/Unmarshal エンコード・デコード、LoadFromFile/SaveToFile ファイル操作を含み、Processor インスタンスを作成せずに直接呼び出し可能。"
---

# パッケージ関数

json パッケージが提供するトップレベル関数。Processor インスタンスを作成せずに直接呼び出せます。機能別に分類します。

## [クエリと取得](./functions/get)

パスクエリ、型安全な取得、一括操作、パース、バリデーション関数。

**主要関数**：[`Get`](./functions/get#get) · [`GetString`](./functions/get#getstring) · [`GetInt`](./functions/get#getint) · [`GetFloat`](./functions/get#getfloat) · [`GetBool`](./functions/get#getbool) · [`GetArray`](./functions/get#getarray) · [`GetObject`](./functions/get#getobject) · [`GetTyped[T]`](./functions/get#gettypedt) · [`SafeGet`](./functions/get#safegetパッケージ関数) · [`GetMultiple`](./functions/get#getmultipleパッケージ関数) · [`ProcessBatch`](./functions/get#processorprocessbatch) · [`Parse`](./functions/get#parse) · [`ParseAny`](./functions/get#parseany) · [`Valid`](./functions/get#valid) · [`ValidWithConfig`](./functions/get#validwithconfig)

## [変更操作](./functions/modify)

設定、削除、JSON データのマージ関数。

**主要関数**：[`Set`](./functions/modify#set) · [`SetMultiple`](./functions/modify#setmultiple) · [`SetCreate`](./functions/modify#setcreate) · [`SetMultipleCreate`](./functions/modify#setmultiplecreate) · [`Delete`](./functions/modify#delete) · [`DeleteClean`](./functions/modify#deleteclean) · [`MergeJSON`](./functions/modify#mergejson) · [`MergeMany`](./functions/modify#mergemany)

## [エンコード・デコード](./functions/encode-decode)

シリアライズ、デシリアライズ、ストリーミングエンコード・デコード関数。

**主要関数**：[`Marshal`](./functions/encode-decode#marshal) · [`Unmarshal`](./functions/encode-decode#unmarshal) · [`MarshalIndent`](./functions/encode-decode#marshalindent) · [`Encode`](./functions/encode-decode#encode) · [`EncodePretty`](./functions/encode-decode#encodepretty) · [`EncodeWithConfig`](./functions/encode-decode#encodewithconfig) · [`Prettify`](./functions/encode-decode#prettify) · [`Compact`](./functions/encode-decode#compact) · [`Indent`](./functions/encode-decode#indent) · [`HTMLEscape`](./functions/encode-decode#htmlescape) · [`NewEncoder`](./types#encoder-json-エンコーダ) · [`NewDecoder`](./types#decoder-json-デコーダ) · [`EncodeBatch`](./processor/output#encodebatch) · [`EncodeFields`](./processor/output#encodefields) · [`EncodeStream`](./processor/output#encodestream) · [`SaveToWriter`](./functions/file-io#savetowriter)

## [ファイル操作](./functions/file-io)

ファイル読み書きと JSONL 処理関数。

**主要関数**：[`LoadFromFile`](./functions/file-io#loadfromfile) · [`LoadFromReader`](./functions/file-io#loadfromreader) · [`SaveToFile`](./functions/file-io#savetofile) · [`MarshalToFile`](./functions/file-io#marshaltofile) · [`UnmarshalFromFile`](./functions/file-io#unmarshalfromfile) · [`SaveToWriter`](./functions/file-io#savetowriter) · [`ParseJSONL`](./functions/file-io#parsejsonl) · [`ToJSONL`](./functions/file-io#tojsonl) · [`ToJSONLString`](./functions/file-io#tojsonlstring) · [`StreamLinesInto[T]`](./functions/file-io#streamlinesintot)

## [ファイル反復](./large-file)

ファイルストリーミング反復関数（パッケージレベル関数、Processor 不要）。

**主要関数**：[`ForeachFile`](./large-file#foreachfileパッケージ関数) · [`ForeachFileWithPath`](./large-file#foreachfilewithpathパッケージ関数) · [`ForeachFileChunked`](./large-file#foreachfilechunkedパッケージ関数) · [`ForeachFileNested`](./large-file#foreachfilenestedパッケージ関数)

## [ヘルパーユーティリティ](./helpers)

型変換、比較、キャッシュ管理、エラー処理などのユーティリティ関数。

**主要関数**：[`CompareJSON`](./helpers#comparejson) · [`MergeJSON`](./helpers#mergejson) · [`MergeMany`](./helpers#mergemany) · [`ClearCache`](./helpers#clearcacheパッケージ関数) · [`GetStats`](./helpers#getstatsパッケージ関数) · [`GetHealthStatus`](./helpers#gethealthstatusパッケージ関数) · [`SetGlobalProcessor`](./helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](./helpers#shutdownglobalprocessor) · [`SafeError`](./helpers#safeerror) · [`RedactedPath`](./helpers#redactedpath) · [`WarmupCache`](./helpers#warmupcache)

---

## クイックナビゲーション

| 用途 | 推奨関数 | ドキュメント |
|------|----------|------|
| 単一値の取得 | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [クエリ取得](./functions/get#パスクエリ関数) |
| 任意型の取得 | `Get`, `GetTyped[T]` | [クエリ取得](./functions/get#ジェネリック取得関数) |
| デフォルト値付き取得 | `GetString(data, path, "default")` | [クエリ取得](./functions/get#型安全取得関数) |
| ジェネリック取得 | `GetTyped[T](data, path, defaultValue...)` | [クエリ取得](./functions/get#ジェネリック取得関数) |
| 一括取得 | `GetMultiple` | [クエリ取得](./functions/get#processor-拡張メソッド) |
| JSON の変更 | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [変更操作](./functions/modify) |
| シリアライズ | `Marshal`, `Encode` | [エンコード・デコード](./functions/encode-decode#シリアライズ関数) |
| デシリアライズ | `Unmarshal`, `Parse` | [エンコード・デコード](./functions/encode-decode#シリアライズ関数) · [クエリ取得](./functions/get#パース関数) |
| フォーマット | `Prettify`, `Processor.Compact` | [エンコード・デコード](./functions/encode-decode#シリアライズ関数) |
| 出力の印字 | `Encode` + `fmt.Println`, `EncodePretty` | [出力関数](./print) |
| 一括エンコード | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [一括エンコード](./functions/encode-decode#一括エンコード関数) · [プロセッサ出力](./processor/output) |
| バリデーション | `Valid` | [クエリ取得](./functions/get#バリデーション関数) |
| ファイル読み書き | `LoadFromFile`, `SaveToFile` | [ファイル操作](./functions/file-io#ファイル読み込み関数) |
| JSONL 処理 | `ParseJSONL`, `ToJSONL` | [ファイル操作](./functions/file-io#jsonl-処理関数) |
| 比較 | `CompareJSON` | [ヘルパーユーティリティ](./helpers#json-比較関数) |
| マージ | `MergeJSON`, `MergeMany` | [変更操作](./functions/modify#マージ関数) |
| 型変換 | `AccessResult` 型変換メソッド | [ヘルパーユーティリティ](./helpers#accessresult-型変換メソッド) |
| エラー処理 | `JsonsError`, `errors.Is` | [定数とエラー](./constants#エラー変数) |

## 関連

- [Processor](./processor/) - プロセッサメソッド
- [Config](./config) - 設定オプション
- [定数とエラー](./constants) - エラー型
- [インターフェース定義](./interfaces) - 拡張インターフェース
- [パス式構文](../path-syntax) - パス構文の詳細

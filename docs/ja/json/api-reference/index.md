---
title: "API リファレンス - CyberGo JSON | 完全関数ドキュメント"
description: "CyberGo JSON 完全 API リファレンス：GetString/GetInt クエリ、Set/Delete 変更、Marshal/Unmarshal、Processor、Schema 検証、Hook、セキュリティ設定を標準ライブラリ互換で網羅します。"
---

# API リファレンス

本セクションでは `github.com/cybergodev/json` ライブラリの完全な API リファレンスを提供します。

## モジュール索引

| モジュール | 説明 |
|------|------|
| [パッケージ関数](./functions) | パッケージレベル関数リファレンス（パスクエリ、型取得、エンコード・デコードなど） |
| [Processor](./processor/) | プロセッサメソッドと設定 |
| [Config](./config) | 設定オプション詳細 |
| [型定義](./types) | コア型定義（Encoder/Decoder 含む） |
| [ジェネリクス操作](./generics) | ジェネリック API リファレンス |
| [インターフェース定義](./interfaces) | 拡張インターフェース定義 |
| [ストリーミング処理](./large-file) | ストリーミングプロセッサリファレンス |
| [NDJSON 処理](./jsonl) | JSONL/NDJSON プロセッサ |
| [イテレータ](./iterator) | 反復走査 API |
| [ヘルパー関数](./helpers) | 型変換とユーティリティ関数 |
| [フォーマット出力](./print) | フォーマットと整形出力 |
| [セキュリティ検証](./security) | セキュリティ関連 API |
| [バリデータ](./validator) | Schema バリデータ |
| [フックシステム](./hooks) | 操作インターセプトフック |
| [カスタムエンコーダ](./custom-encoder) | カスタムエンコーダ |
| [定数とエラー](./constants) | 定数とエラー型 |

## クイック検索

### 機能別分類

#### パスクエリ

| 関数 | 説明 |
|------|------|
| `Get`, `GetWithContext`, `GetString`, `GetInt`, `GetFloat`, `GetBool`, `GetArray`, `GetObject` | 型安全な取得 |
| `GetTyped[T]` | ジェネリック取得 |
| `SafeGet` | セーフティ取得 AccessResult |
| `GetMultiple` | 一括取得 |

#### 変更操作

| 関数 | 説明 |
|------|------|
| `Set`, `SetMultiple` | 値の設定 |
| `SetCreate`, `SetMultipleCreate` | 値の設定とパス自動作成 |
| `Delete`, `DeleteClean` | 値の削除 |
| `ProcessBatch` | 一括操作 |

#### エンコード・デコード

| 関数 | 説明 |
|------|------|
| `Marshal`, `Unmarshal` | 標準エンコード・デコード |
| `MarshalIndent` | フォーマットエンコード |
| `Encode`, `EncodeWithConfig` | 文字列へのエンコード |
| `NewEncoder`, `NewDecoder` | ストリーミングエンコード・デコード |
| `Parse` | JSON のパース |

#### フォーマット

| 関数 | 説明 |
|------|------|
| `Prettify` | JSON のフォーマット |
| `Compact` | JSON の圧縮 |

#### ファイル操作

| 関数 | 説明 |
|------|------|
| `LoadFromFile`, `SaveToFile` | ファイル読み書き |
| `LoadFromReader` | Reader からの読み込み |
| `MarshalToFile`, `UnmarshalFromFile` | ファイルエンコード・デコード |

#### ストリーミング処理

| 型/メソッド | 説明 |
|------|------|
| `StreamLinesInto[T]` | Reader から JSONL をストリーミング読み込みし `[]T` に変換 |
| `ParseJSONL` | JSONL バイトを `[]any` にパース |
| `ToJSONL`, `ToJSONLString` | `[]any` を JSONL 形式に変換 |
| `JSONLWriter` | JSONL ライター（Write/WriteAll/WriteRaw） |
| `NDJSONProcessor` | NDJSON/JSONL プロセッサ |
| `ForeachFile` | ファイルストリーミング処理 |

#### 検証

| 関数 | 説明 |
|------|------|
| `Valid` | JSON 検証（`encoding/json.Valid` と互換） |
| `ValidWithConfig` | 設定付き JSON 検証 |
| `ValidateSchema` | Schema 検証（`Schema` 型と併用） |
| `CompareJSON` | JSON の等価性比較 |

## 命名規約

ライブラリは以下の命名規約に従います：

| パターン | 説明 | 例 |
|------|------|------|
| `Get{Type}` | 指定型の取得（defaultValue 対応） | `GetString`, `GetInt` |
| `GetTyped[T]` | ジェネリック取得、T を返す | `GetTyped[User]` |
| `New{Type}` | インスタンスの作成 | `New`（`*Processor` を返す）, `NewEncoder` |
| `Default{Type}` | デフォルト設定 | `DefaultConfig` |
| `{Type}Config` | 設定プリセット | `SecurityConfig`, `PrettyConfig` |

## 関連

- [クイックスタート](../getting-started) -- インストールと基本的な使い方
- [パス式の構文](../path-syntax) -- パスクエリ構文
- [使用例](../examples) -- 実践的なコード例
- [大規模ファイル処理](../large-files) -- ストリーミング処理ガイド

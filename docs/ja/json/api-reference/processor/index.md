---
title: "Processor プロセッサ - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor プロセッサ完全リファレンス：New によるインスタンス作成、GetString/Set/Delete によるデータ操作、Foreach 反復、Encode エンコード、Close ライフサイクル管理、Stats 統計、キャッシュ設定など、高頻度 JSON 操作やデータ処理の再利用に最適です。"
---

# Processor

Processor は高性能、カスタマイズ性、柔軟な再利用能力を提供し、同じデータソースに対する複数回の操作に適しています。

## 特徴

- **高性能**：内部キャッシュ機構により、繰り返し操作がより効率的
- **設定可能**：複数の設定オプションをサポート
- **メソッドチェーン**：メソッドは変更後の JSON を返し、連続操作をサポート
- **リソース管理**：明示的なライフサイクル制御

## Processor の作成

### New

シグネチャ：`func New(cfg ...Config) (*Processor, error)`

Processor インスタンスを作成します。オプションの Config パラメータでプロセッサを設定します。

```go
// デフォルト設定で使用
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// カスタム設定で使用
cfg := json.DefaultConfig()
cfg.StrictMode = true
processor, err := json.New(cfg)

// セキュリティ設定で使用
processor, err := json.New(json.SecurityConfig())
```

## メソッドチェーン

Processor のメソッドは変更後の JSON 文字列を返し、連続操作をサポートします：

```go
processor, _ := json.New()

// 複数の値を設定
result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## API 目次

| カテゴリ | 説明 |
|----------|------|
| [パスクエリ](./query) | GetString/Int/Float/Bool/Get/SafeGet/GetArray/GetObject |
| [データ変更](./modify) | Set/Delete/DeleteClean |
| [出力メソッド](./output) | Encode/EncodePretty/EncodeWithConfig/Buffer 操作 |
| [解析と読み込み](./parse) | ParseAny/Valid/LoadFromFile/LoadFromReader |
| [反復メソッド](./iterate) | Foreach/ForeachWithPath/ForeachNested |
| [バッチ操作](./batch) | ProcessBatch |
| [JSONL 処理](./jsonl) | StreamJSONL/Parallel/Chunked/Map/Reduce/Filter |
| [ライフサイクル](./lifecycle) | Close/キャッシュ/統計/ヘルスチェック |

---

## グローバルプロセッサ管理

パッケージレベル関数は内部グローバルプロセッサを使用します。以下の関数で管理できます：

### SetGlobalProcessor

シグネチャ：`func SetGlobalProcessor(processor *Processor)`

カスタムグローバルプロセッサを設定します。すべてのパッケージレベル関数（Get、Set、Marshal など）がこのプロセッサを使用します。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `processor` | `*Processor` | カスタムプロセッサインスタンス |

```go
package main

import (
    "github.com/cybergodev/json"
)

func main() {
    // カスタム設定のプロセッサを作成
    cfg := json.SecurityConfig()
    processor, err := json.New(cfg)
    if err != nil {
        panic(err)
    }

    // グローバルプロセッサとして設定
    json.SetGlobalProcessor(processor)

    // 以降のパッケージレベル関数はセキュリティ設定を使用
    data, err := json.Get(`{"name":"Alice"}`, "name")
    // SecurityConfig の制限が適用される
    _ = data
}
```

::: warning 注意
- `nil` を渡した場合、何も実行されません
- 前のグローバルプロセッサは自動的に閉じられます
- この関数はスレッドセーフです
:::

### ShutdownGlobalProcessor

シグネチャ：`func ShutdownGlobalProcessor()`

グローバルプロセッサを閉じて削除します。以降のパッケージレベル操作では新しいデフォルトプロセッサが作成されます。

```go
package main

import (
    "github.com/cybergodev/json"
)

func main() {
    // グローバルプロセッサを使用
    data, _ := json.Get(`{"key":"value"}`, "key")
    _ = data

    // アプリケーション終了時にクリーンアップ
    json.ShutdownGlobalProcessor()

    // 以降の操作は新しいデフォルトプロセッサを作成
    data2, _ := json.Get(`{"key":"value2"}`, "key")
    _ = data2
}
```

::: tip 使用例
- 長時間稼働するサービスの終了時にリソースをクリーンアップ
- プロセッサ設定をリセットする必要がある場合
- テスト環境で異なるテストケースを分離する場合
:::

---

## 関連

- [パッケージ関数](../functions) - トップレベル関数リファレンス
- [Config](../config) - 設定オプション
- [インターフェース定義](../interfaces) - Hook インターフェース
- [Hook フックシステム](../hooks) - フックの詳細な使用ガイド

---
sidebar_label: "大規模ファイルガイド"
title: "大ファイル処理 - CyberGo JSON | ガイド"
description: "CyberGo JSON 大ファイル処理：ForeachFile、ForeachFileChunked、ForeachFileWithPath、ForeachFileNested ストリームメソッドで、ログ分析や ETL に対応します。"
sidebar_position: 1
---

# 大ファイル処理

大きな JSON ファイル（ログ、設定、データエクスポートなど）をメモリに直接ロードすると、メモリ不足になる可能性があります。json ライブラリは複数の効率的な処理方法を提供しています。

::: warning
`ForeachFile` と `ForeachFileChunked` はイテレーション前にファイル全体をメモリにロードします。「チャンク」動作はメモリ内データのイテレーション方法にのみ影響し、ファイルの読み込み方法には影響しません。メモリを厳密に制御する必要がある超大ファイルの処理には、JSONL 形式と組み合わせて `NDJSONProcessor` を使用するか、`StreamIterator` を使用してください。
:::

## 選択肢

| 方法 | 適用シナリオ | メモリ使用量 |
|------|----------|----------|
| **Processor.ForeachFile** | 構造化イテレーションによるファイル処理 | ファイル全体をロードし、1件ずつイテレーション |
| **Processor.ForeachFileChunked** | バッチチャンクイテレーション処理 | ファイル全体をロードし、チャンクでイテレーション |
| **NDJSONProcessor** | JSONL ファイルの行単位処理 | メモリ制御可能、真のストリーム処理 |

## 統一 API：Processor

### 設定オプション

大ファイル処理の設定は `Config` に統合されています：

```go
type Config struct {
    // ... その他の設定 ...

    // 大ファイル処理設定
    ChunkSize       int64 // チャンクサイズ（デフォルト 1MB）
    MaxMemory       int64 // 最大メモリ使用量（デフォルト 100MB）
    BufferSize      int   // 読み取りバッファサイズ（デフォルト 64KB）
    SamplingEnabled bool  // サンプリングを有効にするか（デフォルト true）
    SampleSize      int   // サンプリング数（デフォルト 1000）
}
```

### 基本的な使用方法

```go
package main

import (
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // Processor の作成（デフォルト設定を使用）
    processor, err := json.New()
    if err != nil {
        log.Fatal(err)
    }
    defer processor.Close()

    // 方法 1：1 件ずつ処理（推奨）
    count := 0
    err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
        count++

        // IterableValue の便利なメソッドでフィールドにアクセス
        id := item.GetInt("id")
        name := item.GetString("name")
        email := item.GetString("email")

        // パスを使用してネストされたプロパティにアクセス
        city := item.GetString("profile.city")
        interests := item.GetArray("profile.interests")

        if count%10000 == 0 {
            log.Printf("処理済み %d件、サンプル: id=%d name=%s email=%s city=%s 興味数=%d",
                count, id, name, email, city, len(interests))
        }
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
    log.Printf("処理完了、合計 %d 件", count)
}
```

### バッチ処理

```go
// 方法 2：バッチ処理（データベースへの一括書き込みに適しています）
err := processor.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    log.Printf("バッチ処理: %d 件", len(chunk))

    // データベースへの一括書き込み
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... データ処理
    }
    return nil
})
```

### 中断制御付き
```go
// 方法 3：中断制御付き（特定のデータを見つけたら停止）
// item.Break() を返すとイテレーションを停止、nil を返すとイテレーションを継続
err := processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // ターゲットを発見、イテレーションを停止
        fmt.Printf("ターゲット発見: ID=%d, Name=%s\n", id, item.GetString("name"))
        return item.Break() // イテレーションを停止（中断シグナルを返す）
    }

    return nil // イテレーションを継続
})
```

### オブジェクトファイルの処理
```go
// 方法 4：JSON オブジェクトファイルの処理（キー・バリュー構造）
// ファイル形式: {"user1": {...}, "user2": {...}, ...}
err := processor.ForeachFile("config-map.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %s, Name: %s\n", key, item.GetString("name"))
    return nil
})
```

### カスタム設定
```go
// カスタム大ファイル処理設定
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB チャンク
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB メモリ制限
cfg.BufferSize = 128 * 1024        // 128KB バッファ

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## IterableValue の便利なメソッド

`ForeachFile*` シリーズのメソッドは `IterableValue` インターフェースを提供し、便利なデータアクセスをサポートします：

| メソッド | 説明 | 例 |
|------|------|------|
| `Get(path)` | 値の取得 | `item.Get("field")` |
| `GetString(path)` | 文字列の取得 | `item.GetString("name")` |
| `GetInt(path)` | 整数の取得 | `item.GetInt("id")` |
| `GetFloat64(path)` | 浮動小数点数の取得 | `item.GetFloat64("score")` |
| `GetBool(path)` | 真偽値の取得 | `item.GetBool("active")` |
| `GetArray(path)` | 配列の取得 | `item.GetArray("tags")` |
| `GetObject(path)` | オブジェクトの取得 | `item.GetObject("profile")` |
| `Exists(path)` | フィールドの存在確認 | `item.Exists("email")` |
| `IsNull(path)` | null かどうかの確認 | `item.IsNull("deleted_at")` |
| `IsEmpty(path)` | 空かどうかの確認 | `item.IsEmpty("notes")` |
| `Break()` | 中断シグナルの返却 | `return item.Break()` |

**パスナビゲーションをサポート**
```go
city := item.GetString("profile.address.city")      // ネストされたオブジェクト
firstTag := item.GetString("tags[0]")               // 配列インデックス
lastTag := item.GetString("tags[-1]")               // 負のインデックス（最後の要素）
nested := item.GetString("data.items[0].name")      // 複雑なパス
```

## ストリーム処理設定

`Config` を使用してストリーム処理パラメータを設定します：

```go
cfg := json.DefaultConfig()

// 大ファイル処理設定
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB チャンク
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB メモリ制限
cfg.BufferSize = 128 * 1024        // 128KB バッファ

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### StreamLinesInto ジェネリック関数の使用

```go
type User struct {
    Name string `json:"name"`
}

file, _ := os.Open("users.jsonl")
defer file.Close()

_, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("処理: %s\n", user.Name)
    return nil
})
```

### 並列処理

並列処理が可能なタスクには、複数の goroutine を使用できます：

```go
package main

import (
    "sync"
    "github.com/cybergodev/json"
)

func main() {
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // worker プールを使用
    workers := 4
    items := make(chan any, 100)
    var wg sync.WaitGroup

    // worker を起動
    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for item := range items {
                // item を処理
                _ = item
            }
        }(i)
    }

    // ストリーム読み込みして配信
    processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
        items <- item.Get("")
        return nil
    })

    close(items)
    wg.Wait()
}
```

## パフォーマンス最適化のヒント

### メモリ制御
```go
// 利用可能なメモリに基づいて設定
cfg := json.DefaultConfig()
cfg.MaxMemory = 500 * 1024 * 1024 // 500MB
cfg.ChunkSize = 10 * 1024 * 1024  // 10MB

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### ベストプラクティス
1. **ファイルサイズの事前確認**：処理前にファイルサイズを確認し、適切な戦略を選択
2. **メモリ制限の設定**：OOM を防ぐために `MaxMemory` を使用
3. **バッチコミット**：一定数蓄積してからデータベースに一括書き込み
4. **エラー処理**：`JSONLContinueOnErr` を実装するか、失敗したエントリを記録
5. **進捗の監視**：定期的に処理の進捗を出力

## 選択ガイド

| ファイルサイズ | 推奨方法 | 例 |
|---------|---------|------|
| < 10MB | 直接ロード | `json.ParseAny` + `Get` |
| 10-100MB | Processor.ForeachFile | 1 件ずつ処理 |
| 100MB-1GB | Processor.ForeachFileChunked | チャンクイテレーション処理 |
| > 1GB | NDJSONProcessor / JSONL 形式 | 真のストリーム処理、メモリ制御可能 |


## API リファレンス

このセクションでは、大ファイル処理 API の関数シグネチャとパラメータ表を要約し、すぐに参照できるようにします。

### Processor メソッド

**ForeachFile**

シグネチャ：`func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

大規模ファイル内の JSON 配列要素を1件ずつ処理します。[基本的な使用方法](#基本的な使用方法)と[中断制御付き](#中断制御付き)を参照してください。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `filePath` | `string` | JSON ファイルパス |
| `fn` | `func(key any, item *IterableValue) error` | 処理コールバック |

**コールバック戻り値**

| 戻り値 | 説明 |
|--------|------|
| `nil` | 次の要素の処理を継続 |
| `item.Break()` | イテレーションを停止、エラーは返さない |
| その他の `error` | イテレーションを停止し、エラーを返す |

**ForeachFileChunked**

シグネチャ：`func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) (err error)`

大規模ファイルをチャンク単位でバッチ処理します。[バッチ処理](#バッチ処理)を参照してください。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `filePath` | `string` | JSON ファイルパス |
| `chunkSize` | `int` | 1バッチあたりの要素数 |
| `fn` | `func(chunk []*IterableValue) error` | バッチ処理コールバック |

**ForeachFileWithPath**

シグネチャ：`func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

ファイル内の指定したパスの JSON 配列またはオブジェクトを処理します。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `filePath` | `string` | JSON ファイルパス |
| `path` | `string` | JSON パス式 |
| `fn` | `func(key any, item *IterableValue) error` | 処理コールバック |

```go
// ファイル内の users 配列の各要素を処理
err := p.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    fmt.Printf("Name: %s\n", item.GetString("name"))
    return nil
})
```

**ForeachFileNested**

シグネチャ：`func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

ファイル内のすべてのネストされた JSON 構造を再帰的に走査します。

```go
// すべてのネストされた要素を再帰的に走査
err := p.ForeachFileNested("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

## パッケージレベル関数

Processor メソッドとは別に、以下の関数は Processor インスタンスを作成せずに直接呼び出せます。これらは内部でグローバルプロセッサを使用します。

### ForeachFile（パッケージレベル関数）

シグネチャ：`func ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

ファイルから JSON を読み込み、イテレーションします。

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil
})
```

### ForeachFileWithPath（パッケージレベル関数）

シグネチャ：`func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

ファイルから JSON を読み込み、指定パスでイテレーションします。

```go
err := json.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("ユーザー: %s\n", name)
    return nil
})
```

### ForeachFileChunked（パッケージレベル関数）

シグネチャ：`func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

ファイル内の JSON 配列をチャンク単位でイテレーションします。

```go
err := json.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

### ForeachFileNested（パッケージレベル関数）

シグネチャ：`func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

ファイルから JSON を読み込み、すべてのネストされた構造を再帰的にイテレーションします。

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("パス: %v, 型: %T\n", key, item.GetData())
    return nil
})
```

## 関連

- [NDJSON プロセッサ](./jsonl) — JSONL/NDJSON ストリーミング処理
- [JSONLWriter](./jsonl#jsonlwriter) — JSONL ライター

## 次のステップ
- [API ドキュメント](../api-reference/) — 完全な API リファレンス

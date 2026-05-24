---
title: "大規模ファイル処理 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON 大規模ファイル処理 API 完全リファレンス：ForeachFile ストリーム処理、ForeachFileChunked バッチ処理、ForeachFileWithPath パス指定処理、ForeachFileNested ネストされたイテレーション、メモリ制御設定、パフォーマンス最適化のベストプラクティスガイドを含む。"
---

# 大規模ファイル処理


## 設定オプション

大規模ファイル処理の設定は `Config` 構体体に統合されています：

```go
type Config struct {
    // ... その他の設定 ...

    // 大規模ファイル処理設定
    ChunkSize       int64 // チャンクサイズ（デフォルト 1MB）
    MaxMemory       int64 // 最大メモリ使用量（デフォルト 100MB）
    BufferSize      int   // 読み取りバッファサイズ（デフォルト 64KB）
    SamplingEnabled bool  // サンプリングを有効にするか（デフォルト true）
    SampleSize      int   // サンプリング数（デフォルト 1000）
}
```

### カスタム設定

```go
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB チャンク
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB メモリ制限
cfg.BufferSize = 128 * 1024        // 128KB バッファ

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

---

## ForeachFile

シグネチャ：`func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

大規模ファイル内の JSON 配列要素を1件ずつ処理します。

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

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

count := 0
err = p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    count++

    // IterableValue の便利メソッドでフィールドにアクセス
    id := item.GetInt("id")
    name := item.GetString("name")

    if count%10000 == 0 {
        log.Printf("%d 件のレコードを処理しました", count)
    }
    return nil
})
```

**イテレーションの中断例**

```go
err := p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // ターゲットを発見、イテレーションを停止
        return item.Break() // エラーなく停止
    }
    return nil // イテレーションを継続
})
```

---

## ForeachFileChunked

シグネチャ：`func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

大規模ファイルをチャンク単位で処理し、指定した要素数ごとにバッチ処理を行います。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `filePath` | `string` | JSON ファイルパス |
| `chunkSize` | `int` | 1バッチあたりの要素数 |
| `fn` | `func(chunk []*IterableValue) error` | バッチ処理コールバック |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 1回あたり 1000 件のレコードを処理
err = p.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    // データベースへのバッチ書き込み
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... データ処理
    }
    return nil
})
```

---

## ForeachFileWithPath

シグネチャ：`func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

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

---

## ForeachFileNested

シグネチャ：`func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

ファイル内のすべてのネストされた JSON 構造を再帰的に走査します。

```go
// すべてのネストされた要素を再帰的に走査
err := p.ForeachFileNested("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

---

## IterableValue 便利メソッド

`ForeachFile*` シリーズメソッドは `IterableValue` インターフェースを提供し、便利なデータアクセスをサポートします：

| メソッド | 説明 | 例 |
|------|------|------|
| `GetInt(path)` | 整数を取得 | `item.GetInt("id")` |
| `GetString(path)` | 文字列を取得 | `item.GetString("name")` |
| `GetFloat64(path)` | 浮動小数点数を取得 | `item.GetFloat64("score")` |
| `GetBool(path)` | 真偽値を取得 | `item.GetBool("active")` |
| `GetArray(path)` | 配列を取得 | `item.GetArray("tags")` |
| `GetObject(path)` | オブジェクトを取得 | `item.GetObject("profile")` |
| `Exists(path)` | フィールドの存在確認 | `item.Exists("email")` |
| `IsNull(path)` | null かどうかを確認 | `item.IsNull("deleted_at")` |
| `GetData()` | 生データを取得 | `item.GetData()` |
| `Break()` | 中断シグナルを返す | `return item.Break()` |

**パスナビゲーション対応**

```go
city := item.GetString("profile.address.city")      // ネストされたオブジェクト
firstTag := item.GetString("tags[0]")               // 配列インデックス
lastTag := item.GetString("tags[-1]")               // 負のインデックス（最後の要素）
nested := item.GetString("data.items[0].name")      // 複雑なパス
```

---

## 完全な例

### 超大規模ログファイルの処理

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // プロセッサを作成
    cfg := json.DefaultConfig()
    cfg.ChunkSize = 10 * 1024 * 1024 // 10MB チャンク
    cfg.MaxMemory = 500 * 1024 * 1024 // 500MB メモリ制限

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // エラーログの集計
    errorCount := 0
    err = p.ForeachFile("logs.json", func(key any, item *json.IterableValue) error {
        level := item.GetString("level")
        if level == "error" {
            message := item.GetString("message")
            fmt.Printf("エラー: %s\n", message)
            errorCount++
        }
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("合計 %d 件のエラーを検出しました\n", errorCount)
}
```

### データベースへのバッチインポート

```go
package main

import (
    "log"
    "github.com/cybergodev/json"
)

func main() {
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 1バッチ 500 件をデータベースに書き込み
    err = p.ForeachFileChunked("users.json", 500, func(chunk []*json.IterableValue) error {
        // バッチ挿入
        for _, item := range chunk {
            user := User{
                ID:    item.GetInt("id"),
                Name:  item.GetString("name"),
                Email: item.GetString("email"),
            }
            // db.Create(&user)
            _ = user
        }
        log.Printf("%d 件のレコードをバッチ挿入しました", len(chunk))
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
}
```

---

## パッケージレベルのファイルイテレーション関数

Processor メソッドとは別に、以下の関数は Processor インスタンスを作成せずに直接呼び出せます。これらは内部でグローバルプロセッサを使用します。

### ForeachFile（パッケージレベル関数）

シグネチャ：`func ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

ファイルから JSON を読み込み、イテレーションします。

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil
})
```

### ForeachFileWithPath（パッケージレベル関数）

シグネチャ：`func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

ファイルから JSON を読み込み、指定パスでイテレーションします。

```go
err := json.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("ユーザー: %s\n", name)
    return nil
})
```

### ForeachFileChunked（パッケージレベル関数）

シグネチャ：`func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

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

シグネチャ：`func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

ファイルから JSON を読み込み、すべてのネストされた構造を再帰的にイテレーションします。

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("パス: %v, 型: %T\n", key, item.GetData())
    return nil
})
```

---

## 関連

- [大規模ファイル処理ガイド](../large-files) - 完全な使用ガイド
- [NDJSON プロセッサ](./jsonl) - JSONL/NDJSON 処理
- [JSONLWriter](./jsonl#jsonlwriter) - JSONL ライター

---
sidebar_label: "イテレータ型"
title: "イテレータ型 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON イテレータ型：Iterator 順次走査、IterableValue データアクセス、StreamIterator/StreamObjectIterator ストリーミング、BatchIterator バッチと ParallelIterator 並列イテレータの構築とメソッド。"
sidebar_position: 9
---

# イテレータ型

json パッケージは多様なイテレータ型を提供し、順次走査、ストリーミング処理、バッチ処理、並列処理の各シナリオをカバーします。反復**関数**（`Foreach`/`ForeachFile` など）は [パッケージレベル反復関数](./functions/iterate) と [Processor 反復メソッド](./processor/iterate) を参照してください。

## IteratorControl 定数

`IteratorControl` は反復制御フラグを表し、`ForeachWithPathAndControl` と `ForeachWithPathAndIterator` で反復フローを制御するために使用します。

| 定数 | 説明 |
|------|------|
| `IteratorNormal` | 通常通り反復を継続（デフォルト値） |
| `IteratorContinue` | 現在の要素をスキップして反復を継続 |
| `IteratorBreak` | 反復を停止 |

**使用シナリオ**

| シナリオ | 推奨戻り値 | 説明 |
|------|------------|------|
| 通常の要素処理 | `IteratorNormal` | 次の要素の処理を継続 |
| 無効データのフィルタリング | `IteratorContinue` | 現在の要素をスキップ、反復は中断しない |
| ターゲット発見後の終了 | `IteratorBreak` | 必要なデータが見つかったら即座に停止 |
| エラー発生時の中断 | `IteratorBreak` | 重大なエラーが発生したら反復を停止 |

---

## Iterator 型

Iterator は JSON 配列またはオブジェクトを走査するための低レベルイテレータです。

### NewIterator

シグネチャ：`func NewIterator(data any, cfg ...Config) *Iterator`

イテレータインスタンスを作成します。

```go
data := []any{"apple", "banana", "cherry"}
it := json.NewIterator(data)
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `HasNext` | `func (it *Iterator) HasNext() bool` | 次の要素があるかチェック |
| `Next` | `func (it *Iterator) Next() (any, bool)` | 次の要素を取得 |
| `Reset` | `func (it *Iterator) Reset()` | イテレータの状態とキャッシュをクリア、再利用の準備 |
| `ResetWith` | `func (it *Iterator) ResetWith(data any)` | 状態をクリアし、新しいデータで初期化 |

### Reset

イテレータの状態をクリアし、キャッシュされたキーを解放します。呼び出し後は `ResetWith` で再初期化できます。

```go
it := json.NewIterator(data1)
for it.HasNext() {
    it.Next()
}

it.Reset() // キャッシュをクリア
```

### ResetWith

イテレータの状態をクリアし、新しいデータで初期化して、イテレータの再利用を実現します。

```go
it := json.NewIterator(data1)
// ... data1 を走査 ...

it.ResetWith(data2) // イテレータを再利用して新しいデータを走査
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

---

## IterableValue 型

IterableValue は反復プロセス中の現在の要素をラップし、便利な値アクセスメソッドを提供します。`Foreach` 系関数のコールバックは `*IterableValue` を受け取ります。

### メソッド

#### GetData

シグネチャ：`func (iv *IterableValue) GetData() any`

内部データを返します。

#### Get

シグネチャ：`func (iv *IterableValue) Get(path string) any`

パスで値を取得（ドット記法と配列インデックスをサポート）。

```go
val := iv.Get("user.address.city")
val = iv.Get("users[0].name")
```

#### GetString

シグネチャ：`func (iv *IterableValue) GetString(key string) string`

文字列値を取得します。

```go
name := item.GetString("name")
```

#### GetInt

シグネチャ：`func (iv *IterableValue) GetInt(key string) int`

整数値を取得します。

```go
age := item.GetInt("age")
```

#### GetFloat64

シグネチャ：`func (iv *IterableValue) GetFloat64(key string) float64`

浮動小数点値を取得します。

```go
price := item.GetFloat64("price")
```

#### GetBool

シグネチャ：`func (iv *IterableValue) GetBool(key string) bool`

ブール値を取得します。

```go
enabled := item.GetBool("enabled")
```

#### GetArray

シグネチャ：`func (iv *IterableValue) GetArray(key string) []any`

配列値を取得します。

```go
items := item.GetArray("items")
```

#### GetObject

シグネチャ：`func (iv *IterableValue) GetObject(key string) map[string]any`

オブジェクト値を取得します。

```go
profile := item.GetObject("profile")
```

#### GetWithDefault

シグネチャ：`func (iv *IterableValue) GetWithDefault(key string, defaultValue any) any`

値を取得し、キーが存在しない場合はデフォルト値を返します。

```go
// オプションフィールドの取得、欠落時はデフォルト値を使用
timeout := item.GetWithDefault("timeout", 30)
mode := item.GetWithDefault("mode", "default")
```

#### GetStringWithDefault

シグネチャ：`func (iv *IterableValue) GetStringWithDefault(key string, defaultValue string) string`

文字列値を取得し、キーが存在しない場合はデフォルト値を返します。

```go
name := item.GetStringWithDefault("name", "不明")
```

#### GetIntWithDefault

シグネチャ：`func (iv *IterableValue) GetIntWithDefault(key string, defaultValue int) int`

整数値を取得し、キーが存在しない場合はデフォルト値を返します。

```go
age := item.GetIntWithDefault("age", 0)
port := item.GetIntWithDefault("port", 8080)
```

#### GetFloat64WithDefault

シグネチャ：`func (iv *IterableValue) GetFloat64WithDefault(key string, defaultValue float64) float64`

浮動小数点値を取得し、キーが存在しない場合はデフォルト値を返します。

```go
price := item.GetFloat64WithDefault("price", 0.0)
rate := item.GetFloat64WithDefault("rate", 1.0)
```

#### GetBoolWithDefault

シグネチャ：`func (iv *IterableValue) GetBoolWithDefault(key string, defaultValue bool) bool`

ブール値を取得し、キーが存在しない場合はデフォルト値を返します。

```go
enabled := item.GetBoolWithDefault("enabled", false)
debug := item.GetBoolWithDefault("debug", true)
```

#### Exists

シグネチャ：`func (iv *IterableValue) Exists(key string) bool`

指定されたキーが存在するかチェックします。

```go
if item.Exists("email") {
    email := item.GetString("email")
    fmt.Printf("メール: %s\n", email)
}
```

#### ForeachNested

シグネチャ：`func (iv *IterableValue) ForeachNested(path string, fn func(key any, item *IterableValue))`

指定パス配下のネスト構造を再帰的に走査します。

#### IsNullData

シグネチャ：`func (iv *IterableValue) IsNullData() bool`

値全体が null かチェックします。

```go
if item.IsNullData() {
    fmt.Println("値は null です")
}
```

#### IsNull

シグネチャ：`func (iv *IterableValue) IsNull(key string) bool`

指定されたキーの値が null かチェックします。

```go
if item.IsNull("optional_field") {
    fmt.Println("オプションフィールドは null です")
}
```

#### IsEmptyData

シグネチャ：`func (iv *IterableValue) IsEmptyData() bool`

値全体が空かチェックします（nil、空文字列、空配列、空オブジェクト）。

```go
if item.IsEmptyData() {
    fmt.Println("値は空です")
}
```

#### IsEmpty

シグネチャ：`func (iv *IterableValue) IsEmpty(key string) bool`

指定されたキーの値が空かチェックします。

```go
if item.IsEmpty("tags") {
    fmt.Println("タグリストは空です")
}
```

#### Break

シグネチャ：`func (iv *IterableValue) Break() error`

反復停止のシグナルを返します。反復コールバック内で呼び出すと走査を早期終了できます。

```go
// 注意: Break() は、コールバックが error を返す反復関数（ForeachWithError、
// ForeachNestedWithError など）でのみ有効です。通常の Foreach コールバックは
// error を返さないため、その中で item.Break() を呼び出しても反復は停止しません。
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "stop" {
        // ターゲットを見つけたら反復を停止
        return item.Break()
    }
    // 処理を継続
    return nil
})
```

#### Release

シグネチャ：`func (iv *IterableValue) Release()`

IterableValue をオブジェクトプールに返却し、内部データの参照を解放します。

```go
json.Foreach(data, func(key any, item *json.IterableValue) {
    // データ処理...
    fmt.Println(item.GetData())
    // 処理完了後に解放、GC 負荷を軽減
    item.Release()
})
```

---

## StreamIterator 型

StreamIterator はメモリ効率の良いストリーミング反復を提供し、大型 JSON 配列に適しています。要素ごとに処理し、配列全体をメモリにロードする必要はありません。

### NewStreamIterator

シグネチャ：`func NewStreamIterator(reader io.Reader, cfg ...Config) *StreamIterator`

ストリーミングイテレータを作成します。`Config.BufferSize` でバッファサイズを設定します。

```go
file, _ := os.Open("large-array.json")
defer file.Close()

// 設定なし
it := json.NewStreamIterator(file)
for it.Next() {
    val := it.Value()
    fmt.Printf("インデックス %d: %v\n", it.Index(), val)
}
if err := it.Err(); err != nil {
    panic(err)
}

// 設定あり
cfg := json.DefaultConfig()
cfg.BufferSize = 64 * 1024 // 64KB バッファ
it2 := json.NewStreamIterator(file, cfg)
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Next` | `func (si *StreamIterator) Next() bool` | 次の要素に進む |
| `Value` | `func (si *StreamIterator) Value() any` | 現在の要素を返す |
| `Index` | `func (si *StreamIterator) Index() int` | 現在のインデックスを返す |
| `Err` | `func (si *StreamIterator) Err() error` | 反復中のエラーを返す |

---

## StreamObjectIterator 型

StreamObjectIterator はメモリ効率の良いストリーミング反復を提供し、大型 JSON オブジェクトに適しています。

### NewStreamObjectIterator

シグネチャ：`func NewStreamObjectIterator(reader io.Reader, cfg ...Config) *StreamObjectIterator`

ストリーミングオブジェクトイテレータを作成します。

```go
file, _ := os.Open("large-object.json")
defer file.Close()

it := json.NewStreamObjectIterator(file)
for it.Next() {
    fmt.Printf("キー: %s, 値: %v\n", it.Key(), it.Value())
}
if err := it.Err(); err != nil {
    panic(err)
}
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Next` | `func (soi *StreamObjectIterator) Next() bool` | 次のキー・値ペアに進む |
| `Key` | `func (soi *StreamObjectIterator) Key() string` | 現在のキーを返す |
| `Value` | `func (soi *StreamObjectIterator) Value() any` | 現在の値を返す |
| `Err` | `func (soi *StreamObjectIterator) Err() error` | 反復中のエラーを返す |

---

## BatchIterator 型

BatchIterator は大型配列の効率的なバッチ処理に使用し、単一要素処理のオーバーヘッドを削減します。

### NewBatchIterator

シグネチャ：`func NewBatchIterator(data []any, cfg ...Config) *BatchIterator`

バッチイテレータを作成します。`Config.MaxBatchSize` でバッチサイズを設定します。

```go
data := make([]any, 10000)
// データの充填...

cfg := json.DefaultConfig()
cfg.MaxBatchSize = 100 // 1 バッチあたり 100 要素
it := json.NewBatchIterator(data, cfg)
for it.HasNext() {
    batch := it.NextBatch()
    // バッチ処理
    processBatch(batch)
    fmt.Printf("%d 個の要素を処理、残り %d\n", len(batch), it.Remaining())
}
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `NextBatch` | `func (it *BatchIterator) NextBatch() []any` | 次のバッチの要素を返す |
| `HasNext` | `func (it *BatchIterator) HasNext() bool` | 次のバッチがあるかチェック |
| `Reset` | `func (it *BatchIterator) Reset()` | イテレータを開始位置にリセット |
| `TotalBatches` | `func (it *BatchIterator) TotalBatches() int` | 総バッチ数を返す |
| `CurrentIndex` | `func (it *BatchIterator) CurrentIndex() int` | 現在の位置を返す |
| `Remaining` | `func (it *BatchIterator) Remaining() int` | 残りの要素数を返す |

---

## ParallelIterator 型

ParallelIterator は配列の並列処理に使用し、マルチコア CPU を活用して処理を高速化します。

### NewParallelIterator

シグネチャ：`func NewParallelIterator(data []any, cfg ...Config) *ParallelIterator`

並列イテレータを作成します。`Config.MaxConcurrency` でワーカーゴルーチン数を設定します。

```go
data := make([]any, 10000)
// データの充填...

cfg := json.DefaultConfig()
cfg.MaxConcurrency = 8 // 8 ワーカーゴルーチン
it := json.NewParallelIterator(data, cfg)
err := it.ForEach(func(idx int, val any) error {
    // 各要素を並列処理
    return processItem(idx, val)
})
if err != nil {
    panic(err)
}
```

### ForEach

シグネチャ：`func (it *ParallelIterator) ForEach(fn func(int, any) error) error`

各要素を並列処理し、最初に遭遇したエラーを返します。

```go
err := it.ForEach(func(idx int, val any) error {
    // この関数は複数のゴルーチンで並列実行される
    return nil
})
```

### ForEachWithContext

シグネチャ：`func (it *ParallelIterator) ForEachWithContext(ctx context.Context, fn func(int, any) error) error`

コンテキスト付きの並列処理。キャンセル操作をサポートします。

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err := it.ForEachWithContext(ctx, func(idx int, val any) error {
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
        return processItem(idx, val)
    }
})
```

### ForEachBatch

シグネチャ：`func (it *ParallelIterator) ForEachBatch(batchSize int, fn func(int, []any) error) error`

並列バッチ処理です。

```go
err := it.ForEachBatch(100, func(batchIdx int, batch []any) error {
    // 各バッチは1つのゴルーチンで処理
    return processBatch(batchIdx, batch)
})
```

### ForEachBatchWithContext

シグネチャ：`func (it *ParallelIterator) ForEachBatchWithContext(ctx context.Context, batchSize int, fn func(int, []any) error) error`

コンテキスト付きの並列バッチ処理です。

### Map

シグネチャ：`func (it *ParallelIterator) Map(transform func(int, any) (any, error)) ([]any, error)`

各要素を並列変換し、新しいスライスを返します。

```go
results, err := it.Map(func(idx int, val any) (any, error) {
    if num, ok := val.(float64); ok {
        return num * 2, nil
    }
    return nil, fmt.Errorf("unexpected type at index %d", idx)
})
```

### Filter

シグネチャ：`func (it *ParallelIterator) Filter(predicate func(int, any) bool) []any`

要素を並列フィルタリングし、条件を満たす要素のスライスを返します。

```go
even := it.Filter(func(idx int, val any) bool {
    if num, ok := val.(float64); ok {
        return int(num)%2 == 0
    }
    return false
})
```

### Close

シグネチャ：`func (it *ParallelIterator) Close()`

ParallelIterator のリソースを解放します。

```go
it := json.NewParallelIterator(data, cfg)
defer it.Close()
```

---

## 完全なサンプル

### 大ファイルのストリーミング処理

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Open("large-array.json")
    if err != nil {
        panic(err)
    }
    defer file.Close()

    it := json.NewStreamIterator(file)
    count := 0

    for it.Next() {
        val := it.Value()
        // 要素ごとに処理、メモリフレンドリー
        count++
        if count%1000 == 0 {
            fmt.Printf("%d 個の要素を処理済み、現在の値: %v\n", count, val)
        }
    }

    if err := it.Err(); err != nil {
        panic(err)
    }

    fmt.Printf("合計 %d 個の要素を処理\n", count)
}
```

### 並列処理

```go
package main

import (
    "fmt"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    // JSON 配列のパース
    data := `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`
    var arr []any
    json.Unmarshal([]byte(data), &arr)

    // 並列イテレータの作成（4 ワーカーゴルーチン）
    cfg := json.DefaultConfig()
    cfg.MaxConcurrency = 4
    it := json.NewParallelIterator(arr, cfg)

    var sum int64

    err := it.ForEach(func(idx int, val any) error {
        if num, ok := val.(float64); ok {
            atomic.AddInt64(&sum, int64(num))
        }
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("合計: %d\n", sum) // 出力: 合計: 55
}
```

### バッチ処理

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 大規模データセットの作成
    data := make([]any, 1000)
    for i := range data {
        data[i] = map[string]any{"id": i, "value": i * 10}
    }

    // 1 バッチあたり 100 要素
    cfg := json.DefaultConfig()
    cfg.MaxBatchSize = 100
    it := json.NewBatchIterator(data, cfg)
    batchNum := 0

    for it.HasNext() {
        batch := it.NextBatch()
        batchNum++

        // バッチ処理（データベースへの一括書き込みなど）
        fmt.Printf("バッチ %d: %d 個の要素を処理\n", batchNum, len(batch))
    }

    fmt.Printf("総バッチ数: %d\n", it.TotalBatches())
}
```

### Iterator の再利用

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 初回走査
    it := json.NewIterator([]any{"a", "b", "c"})
    for it.HasNext() {
        val, _ := it.Next()
        fmt.Println(val)
    }

    // 同一イテレータを再利用して新しいデータを走査、再割り当てを回避
    it.ResetWith([]any{1, 2, 3, 4})
    for it.HasNext() {
        val, _ := it.Next()
        fmt.Println(val)
    }
}
```

---

## パフォーマンスのアドバイス

1. **Iterator の再利用** - `Reset`/`ResetWith` で再割り当てを回避、複数回走査する場面に適しています
2. **大規模データセットにはストリーミングイテレータを使用** - `StreamIterator`/`StreamObjectIterator` は要素ごとに処理し、メモリフレンドリーです
3. **バッチ処理でオーバーヘッドを削減** - `BatchIterator` はバッチ単位で処理し、単一要素のオーバーヘッドを下げます
4. **CPU 集約的なタスクは並列処理** - `ParallelIterator` でマルチコアを活用して高速化します
5. **IterableValue を解放** - `Foreach` コールバック内で処理完了後に `Release()` を呼び出し、GC 負荷を軽減します

---

## 関連

- [パッケージレベル反復関数](./functions/iterate) - Foreach/ForeachFile などの反復関数
- [Processor 反復メソッド](./processor/iterate) - 対応するプロセッサ反復メソッド
- [大ファイル処理](../streaming/large-files) - 大ファイル処理ガイドと API リファレンス
- [NDJSON プロセッサ](../streaming/jsonl) - JSONL 処理

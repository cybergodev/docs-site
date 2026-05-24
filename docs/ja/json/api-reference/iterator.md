---
title: "イテレータ - CyberGo JSON | API リファレンス"
description: "CyberGo JSON 反復走査 API 完全リファレンス：Foreach 基本反復、ForeachWithPath パス付き反復、ForeachNested 再帰反復、IterableValue 反復可能値型、IteratorControl 反復制御、ParallelForeach 並列反復のベストプラクティス。"
---

# イテレータ

json パッケージは豊富なイテレータ機能を提供し、パッケージレベル関数、Processor メソッド、ストリーミング反復、一括処理、並列処理など多様な走査方式をサポートします。

## パッケージレベル反復関数

Processor インスタンスを作成せずに直接呼び出せる反復関数です。

### Foreach

シグネチャ：`func Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

JSON 配列またはオブジェクトを走査します。

```go
json.Foreach(`{"name": "Alice", "age": 30}`, func(key any, item *json.IterableValue) {
    fmt.Printf("キー: %v, 値: %v\n", key, item.GetData())
})
// 出力:
// キー: name, 値: Alice
// キー: age, 値: 30
```

### ForeachWithPath

シグネチャ：`func ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue), cfg ...Config) error`

パスに従って走査し、エラーを返します。

```go
err := json.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
if err != nil {
    panic(err)
}
```

### ForeachReturn

シグネチャ：`func ForeachReturn(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config) (string, error)`

走査して元の JSON 文字列を返します（読み取り専用操作）。

```go
result, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // 読み取り専用処理
    fmt.Printf("処理: %v\n", item.GetData())
})
```

### ForeachNested

シグネチャ：`func ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

すべてのネストレベルを再帰的に走査します。

```go
json.ForeachNested(data, func(key any, item *json.IterableValue) {
    fmt.Printf("型: %T, 値: %v\n", item.GetData(), item.GetData())
})
```

### ForeachWithPathAndControl

シグネチャ：`func ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl, cfg ...Config) error`

制御フロー付きの走査。戻り値で反復プロセスを制御できます。

```go
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    if value == nil {
        return json.IteratorBreak // 反復を停止
    }
    // 処理...
    return json.IteratorNormal // 反復を継続
})
```

**IteratorControl 定数**

| 定数 | 説明 |
|------|------|
| `IteratorNormal` | 通常通り反復を継続 |
| `IteratorContinue` | 現在の要素をスキップして反復を継続 |
| `IteratorBreak` | 反復を停止 |

**使用シナリオ**

| シナリオ | 推奨戻り値 | 説明 |
|------|------------|------|
| 通常の要素処理 | `IteratorNormal` | 次の要素の処理を継続 |
| 無効データのフィルタリング | `IteratorContinue` | 現在の要素をスキップ、反復は中断しない |
| ターゲット発見後の終了 | `IteratorBreak` | 必要なデータが見つかったら即座に停止 |
| エラー発生時の中断 | `IteratorBreak` | 重大なエラーが発生したら反復を停止 |

```go
// シナリオ1：無効データのフィルタリング
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    if value == nil {
        return json.IteratorContinue // null 値をスキップ
    }
    process(value)
    return json.IteratorNormal
})

// シナリオ2：最初の条件一致要素を見つけたら終了
var found any
err := json.ForeachWithPathAndControl(data, "users", func(key any, value any) json.IteratorControl {
    if obj, ok := value.(map[string]any); ok {
        if obj["admin"] == true {
            found = obj
            return json.IteratorBreak // 管理者を見つけたら停止
        }
    }
    return json.IteratorNormal
})

// シナリオ3：データ整合性の検証
var hasError bool
err := json.ForeachWithPathAndControl(data, "records", func(key any, value any) json.IteratorControl {
    if !validateRecord(value) {
        hasError = true
        return json.IteratorBreak // データが不完全、検証を停止
    }
    return json.IteratorNormal
})
```

### ForeachWithError

シグネチャ：`func ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

エラー処理付きのパス走査。コールバック関数が error を返すと、反復が中止され、そのエラーが返されます。

```go
err := json.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    val := item.GetData()
    if val == nil {
        return fmt.Errorf("項目 %v の値が null です", key)
    }
    return processItem(val)
})
if err != nil {
    log.Fatal(err)
}
```

### ForeachNestedWithError

シグネチャ：`func ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

すべてのネストレベルを再帰的に走査し、エラー処理付き。コールバック関数が error を返すと、反復が中止されます。

```go
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("キー: %v, 値: %v\n", key, item.GetData())
    return nil
})
```

### ForeachWithPathAndIterator

シグネチャ：`func ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

パス情報付きの反復。コールバック関数が現在の完全なパスを受け取ります。走査位置を追跡する必要がある深いネスト構造の処理に適しています。

```go
err := json.ForeachWithPathAndIterator(data, "users", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("パス: %s, キー: %v\n", currentPath, key)
    return json.IteratorNormal
})
```

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

IterableValue は反復プロセス中の現在の要素をラップし、便利な値アクセスメソッドを提供します。

### メソッド

#### GetData

シグネチャ：`func (iv *IterableValue) GetData() any`

内部データを返します。

#### Get

シグネチャ：`func (iv *IterableValue) Get(path string) any`

パスで値を取得（ドット記法と配列インデックスをサポート）。

```go
val := iv.Get("user.address.city")
val := iv.Get("users[0].name")
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
json.Foreach(data, func(key any, item *json.IterableValue) {
    if item.GetString("status") == "stop" {
        // ターゲットを見つけたら反復を停止
        item.Break()
        return
    }
    // 処理を継続
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

BatchIterator は大型配列の効率的な一括処理に使用し、単一要素処理のオーバーヘッドを削減します。

### NewBatchIterator

シグネチャ：`func NewBatchIterator(data []any, cfg ...Config) *BatchIterator`

一括イテレータを作成します。`Config.MaxBatchSize` でバッチサイズを設定します。

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

## Processor 反復メソッド

Processor も反復メソッドを提供し、プロセッサの再利用が必要な場面に適しています。

### Foreach

シグネチャ：`func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue))`

JSON 配列またはオブジェクトを反復します。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
p.Foreach(`{"name": "Alice", "age": 30}`, func(key any, item *json.IterableValue) {
    fmt.Printf("キー: %v, 値: %v\n", key, item.GetData())
})
```

### ForeachWithPath

シグネチャ：`func (p *Processor) ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue)) error`

パスに従って反復し、エラーを返します。

### ForeachNested

シグネチャ：`func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue))`

すべてのネストレベルを再帰的に反復します。

### ForeachReturn

シグネチャ：`func (p *Processor) ForeachReturn(jsonStr string, fn func(key any, item *IterableValue)) (string, error)`

反復して元の JSON を返します（読み取り専用操作）。

### ForeachWithPathAndControl

シグネチャ：`func (p *Processor) ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl) error`

制御フロー付きのパス走査。戻り値で反復プロセスを制御できます。

### ForeachWithPathAndIterator

シグネチャ：`func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

パス情報付きの反復。コールバック関数が現在の完全なパスを受け取ります。走査位置を追跡する必要がある深いネスト構造の処理に適しています。

```go
p.ForeachWithPathAndIterator(data, "users", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("パス: %s, キー: %v\n", currentPath, key)
    return json.IteratorNormal
})
```

### ForeachWithError

シグネチャ：`func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

エラー処理付きの反復。コールバック関数が error を返すと、反復が中止され、そのエラーが返されます。

```go
err := p.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    val := item.GetData()
    if val == nil {
        return fmt.Errorf("項目 %v の値が null です", key)
    }
    return processItem(val)
})
if err != nil {
    log.Fatal(err)
}
```

### ForeachNestedWithError

シグネチャ：`func (p *Processor) ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

すべてのネストレベルを再帰的に反復し、エラー処理付き。コールバック関数が error を返すと、反復が中止されます。

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("キー: %v, 値: %v\n", key, item.GetData())
    return nil
})
```

---

## 完全な例

### 配列の走査

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `[
        {"id": 1, "name": "Alice"},
        {"id": 2, "name": "Bob"},
        {"id": 3, "name": "Charlie"}
    ]`

    json.Foreach(data, func(key any, item *json.IterableValue) {
        id := item.GetInt("id")
        name := item.GetString("name")
        fmt.Printf("[%v] ID: %d, Name: %s\n", key, id, name)
    })
}
```

### オブジェクトの走査

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "server1": {"host": "192.168.1.1", "port": 8080},
        "server2": {"host": "192.168.1.2", "port": 8081}
    }`

    json.Foreach(data, func(key any, item *json.IterableValue) {
        fmt.Printf("サーバー: %s\n", key)
        host := item.GetString("host")
        port := item.GetInt("port")
        fmt.Printf("  ホスト: %s, ポート: %d\n", host, port)
    })
}
```

### ネスト構造の再帰走査

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "users": [
            {"name": "Alice", "profile": {"city": "Beijing"}},
            {"name": "Bob", "profile": {"city": "Shanghai"}}
        ]
    }`

    json.ForeachNested(data, func(key any, item *json.IterableValue) {
        // 文字列値のみ処理
        if str, ok := item.GetData().(string); ok {
            fmt.Printf("値: %s\n", str)
        }
    })
}
```

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
            fmt.Printf("%d 個の要素を処理済み\n", count)
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

---

## パフォーマンスのアドバイス

1. **反復中の時間のかかる操作を避ける** - 反復は同期的であり、時間のかかる操作は反復全体をブロックします
2. **ForeachWithPath で正確に位置を特定** - 不要なデータの走査を回避
3. **大規模データセットにはストリーミング処理を使用** - ForeachFile または NDJSONProcessor を使用
4. **バッチ処理でオーバーヘッドを削減** - ForeachFileChunked で一括操作
5. **CPU 集約的なタスクには並列処理を使用** - ForeachFileChunked または ParallelIterator でマルチコアを活用

---

## 関連

- [Processor](./processor/) - プロセッサメソッド
- [大ファイル処理](./large-file) - ストリーミングプロセッサ
- [NDJSON プロセッサ](./jsonl) - JSONL 処理
- [大ファイル処理ガイド](../large-files) - 大ファイル処理ガイド

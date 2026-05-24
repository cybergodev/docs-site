---
title: "Processor 反復メソッド - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor 反復メソッドリファレンス：Foreach/ForeachWithPath/ForeachWithError/ForeachNested 反復関数、IterableValue データアクセス、IteratorControl 制御とバッチ反復のベストプラクティス。柔軟な JSON データ構造の走査をサポート。"
---

# 反復メソッド

Processor は JSON 配列とオブジェクトを反復処理する複数のメソッドを提供します。

## Foreach

シグネチャ：`func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue))`

JSON 配列またはオブジェクトを反復処理します。

```go
p.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("キー: %v, 値: %v\n", key, item.GetData())
})
```

**配列の反復時**：key はインデックス（int）
**オブジェクトの反復時**：key はキー名（string）

## ForeachWithPath

シグネチャ：`func (p *Processor) ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue)) error`

パスを指定して反復処理し、エラーを返します。

```go
err := p.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

用途：
- ネストされた配列の反復
- 指定パスのオブジェクトの反復

## ForeachNested

シグネチャ：`func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue))`

すべてのネストレベルを再帰的に反復処理します。

```go
p.ForeachNested(data, func(key any, item *json.IterableValue) {
    fmt.Printf("キー: %v, 値: %v\n", key, item.GetData())
})
```

サンプルデータ：

```json
{
  "user": {
    "name": "test",
    "profile": {
      "age": 25,
      "tags": ["a", "b"]
    }
  }
}
```

出力：

```text
キー: user, 値: map[string]any{...}
キー: name, 値: test
キー: profile, 値: map[string]any{...}
キー: age, 値: 25
キー: tags, 値: []any{...}
...
```

## ForeachReturn

シグネチャ：`func (p *Processor) ForeachReturn(jsonStr string, fn func(key any, item *IterableValue)) (string, error)`

反復処理を行い、元の JSON を返します（読み取り専用操作）。

```go
result, err := p.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // 読み取り専用処理
})
```

反復後にメソッドチェーンを続ける必要がある場面に適しています。

## ForeachWithError

シグネチャ：`func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

パスを指定して反復処理し、コールバックがエラーを返すことをサポートします。

```go
err := p.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("インデックス %v のアイテムが無効です", key)
    }
    return nil // 反復を続行
})
```

## ForeachNestedWithError

シグネチャ：`func (p *Processor) ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

すべてのネストレベルを再帰的に反復処理し、コールバックがエラーを返すことをサポートします。

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("キー: %v, 値: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

シグネチャ：`func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

パスを指定して反復処理し、現在のパス情報を提供します。`IteratorControl` で反復フローを制御します。

```go
err := p.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("パス: %s, キー: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // 反復を停止
    }
    return json.IteratorNormal // 反復を続行
})
```

## ForeachWithPathAndControl

シグネチャ：`func (p *Processor) ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl) error`

パスを指定して生の値を反復処理し、`IteratorControl` でフローを制御します。

```go
err := p.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("キー: %v, 値: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

反復コールバックの `IterableValue` は以下の機能を提供します：

| メソッド | 説明 |
|----------|------|
| `GetData() any` | 現在の値を取得 |
| `Get(path string) any` | パス指定で値を取得 |
| `GetString(key string) string` | 文字列値を取得 |
| `GetInt(key string) int` | 整数値を取得 |
| `GetFloat64(key string) float64` | 浮動小数点値を取得 |
| `GetBool(key string) bool` | ブール値を取得 |
| `GetArray(key string) []any` | 配列値を取得 |
| `GetObject(key string) map[string]any` | オブジェクト値を取得 |
| `GetWithDefault(key string, defaultValue any) any` | デフォルト値付きで値を取得 |
| `GetStringWithDefault(key string, defaultValue string) string` | デフォルト値付きで文字列を取得 |
| `GetIntWithDefault(key string, defaultValue int) int` | デフォルト値付きで整数を取得 |
| `GetFloat64WithDefault(key string, defaultValue float64) float64` | デフォルト値付きで浮動小数点を取得 |
| `GetBoolWithDefault(key string, defaultValue bool) bool` | デフォルト値付きでブール値を取得 |
| `Exists(key string) bool` | フィールドが存在するか判定 |
| `IsNull(key string) bool` | フィールドが null か判定 |
| `IsNullData() bool` | 現在の値が null か判定 |
| `IsEmpty(key string) bool` | フィールドが空か判定 |
| `IsEmptyData() bool` | 現在の値が空か判定 |
| `Break() error` | 反復中断のエラーシグナルを返す |
| `Release()` | オブジェクトプールにリソースを返却 |
| `ForeachNested(path string, fn func(key any, item *IterableValue))` | ネストされた構造を再帰的に反復 |

## メソッド比較

| メソッド | パスパラメータ | 再帰 | 戻り値 | エラーコールバック |
|----------|:--------:|:----:|--------|:--------:|
| `Foreach` | なし | いいえ | なし | いいえ |
| `ForeachWithPath` | あり | いいえ | error | いいえ |
| `ForeachNested` | なし | はい | なし | いいえ |
| `ForeachReturn` | なし | いいえ | (string, error) | いいえ |
| `ForeachWithError` | あり | いいえ | error | はい |
| `ForeachNestedWithError` | なし | はい | error | はい |
| `ForeachWithPathAndIterator` | あり | いいえ | error | IteratorControl |
| `ForeachWithPathAndControl` | あり | いいえ | error | IteratorControl |

---

## ファイル反復メソッド

Processor はファイルから直接反復処理するメソッドを提供し、大きな JSON ファイルの処理に適しています。

### ForeachFile

シグネチャ：`func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

ファイルから JSON を読み込んで反復処理します。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `filePath` | `string` | JSON ファイルパス |
| `fn` | `func(key any, item *IterableValue) error` | 反復コールバック |

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // 反復を続行
})
```

---

### ForeachFileWithPath

シグネチャ：`func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

ファイルから JSON を読み込み、パスを指定して反復処理します。

```go
// users 配列のみ反復
err := p.ForeachFileWithPath("data.json", ".users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("ユーザー: %s\n", name)
    return nil
})
```

---

### ForeachFileChunked

シグネチャ：`func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

ファイル内の JSON 配列をチャンク単位で反復処理します。大規模データセットのバッチ処理に適しています。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `filePath` | `string` | JSON ファイルパス |
| `chunkSize` | `int` | 1 バッチあたりの処理数（0 以下の場合はデフォルト 100） |
| `fn` | `func(chunk []*IterableValue) error` | バッチ処理コールバック |

```go
// 100 件ずつバッチ処理
err := p.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    // データベースへバッチ挿入
    records := make([]Record, len(chunk))
    for i, item := range chunk {
        records[i] = Record{
            ID:   item.GetInt("id"),
            Name: item.GetString("name"),
        }
    }
    return db.BatchInsert(records)
})
```

::: tip 使用例
- データベースへのバッチ挿入
- バッチ API 呼び出し
- メモリ制約のある大ファイル処理
:::

---

### ForeachFileNested

シグネチャ：`func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

ファイルから JSON を読み込み、すべてのネストされた構造を再帰的に反復処理します。

```go
err := p.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    // すべてのレベルのすべてのキーと値を走査
    fmt.Printf("パス: %v, 型: %T\n", key, item.GetData())
    return nil
})
```

**サンプルデータ**：

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "pool": {
      "min": 5,
      "max": 20
    }
  }
}
```

**出力**：

```text
パス: database, 型: map[string]any
パス: host, 型: string
パス: port, 型: float64
パス: pool, 型: map[string]any
パス: min, 型: float64
パス: max, 型: float64
```

---

## ファイル反復メソッド比較

| メソッド | パスパラメータ | 再帰 | チャンク | 適したシナリオ |
|----------|:--------:|:----:|:----:|----------|
| `ForeachFile` | なし | いいえ | いいえ | シンプルなファイル走査 |
| `ForeachFileWithPath` | あり | いいえ | いいえ | 特定パスの走査 |
| `ForeachFileChunked` | なし | いいえ | **はい** | バッチ処理、メモリ制約 |
| `ForeachFileNested` | なし | **はい** | いいえ | すべてのノードの深さ優先走査 |

---

## 反復制御

### 反復の中断

コールバック関数内で `item.Break()` を返すと反復を中断できます：

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        // ターゲットを発見、反復を停止
        return item.Break()
    }
    return nil // 反復を続行
})
```

### エラー処理

その他のエラーを返すと反復が中断され、そのエラーが返されます：

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "error" {
        return fmt.Errorf("エラーレコードを発見: %v", key)
    }
    return nil
})
if err != nil {
    log.Printf("反復中断: %v", err)
}
```

---

## 関連

- [パスクエリ](./query) - Get シリーズメソッド
- [バッチ操作](./batch) - ProcessBatch バッチ処理
- [ファイル操作](../functions/file-io) - LoadFromFile/SaveToFile

---
sidebar_label: "変更操作"
title: "変更関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON 変更関数：Set/SetMultiple、MergeJSON/MergeMany で自動パス作成、アトミック操作、複数の MergeMode 戦略をサポートします。"
sidebar_position: 3
---

# 変更関数

json パッケージが提供する JSON 変更関数は、パスの設定、バッチ更新、マージ操作をサポートしています。

## 設定関数

### Set

シグネチャ：`func Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

指定されたパスに値を設定し、変更後の JSON 文字列を返します。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `jsonStr` | `string` | はい | JSON 文字列 |
| `path` | `string` | はい | パス式 |
| `value` | `any` | はい | 設定する値 |
| `cfg` | `Config` | いいえ | オプション設定 |

**例**

```go
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
if err != nil {
    panic(err)
}
fmt.Println(result) // {"user":{"name":"Alice"}}
```

**パスが存在しない場合の自動作成**

```go
// 中間パスを自動作成
result, err := json.Set(`{}`, "user.profile.name", "Bob")
// {"user":{"profile":{"name":"Bob"}}}
```

**異なる型の値の設定**

```go
data := `{}`

// 文字列の設定
json.Set(data, "user.name", "Alice")

// 数値の設定
json.Set(data, "user.age", 30)

// 真偽値の設定
json.Set(data, "user.active", true)

// null の設定
json.Set(data, "user.deleted", nil)

// ネストされたオブジェクトの設定
json.Set(data, "user.address", map[string]any{
    "city": "Beijing",
    "zip":  "100000",
})

// 配列の設定
json.Set(data, "user.tags", []string{"admin", "developer"})
```

### SetMultiple

シグネチャ：`func SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

複数のパスの値をバッチ設定します。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `jsonStr` | `string` | はい | JSON 文字列 |
| `updates` | `map[string]any` | はい | パスから値へのマッピング |
| `cfg` | `Config` | いいえ | オプション設定 |

**例**

```go
updates := map[string]any{
    "user.name": "Bob",
    "user.age":  25,
    "user.email": "bob@example.com",
}
result, err := json.SetMultiple(data, updates)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**パフォーマンス上の利点**

複数の変更操作を行う場合、`Set` を複数回呼び出すよりも `SetMultiple` の方が効率的です：

```go
// 推奨：1回の呼び出し
updates := map[string]any{"a": 1, "b": 2, "c": 3}
result, err := json.SetMultiple(data, updates)

// 非推奨：複数回の呼び出し
result, err = json.Set(data, "a", 1)
result, err = json.Set(result, "b", 2)
result, err = json.Set(result, "c", 3)
```

### SetCreate

シグネチャ：`func SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

値を設定し、存在しない中間パスを自動作成します。`Config.CreatePaths = true` を設定した `Set` と同等です。

```go
// 中間パスが存在しない場合、自動作成
result, err := json.SetCreate(`{}`, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

### SetMultipleCreate

シグネチャ：`func SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

複数の値をバッチ設定し、中間パスを自動作成します。

```go
result, err := json.SetMultipleCreate(`{}`, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## マージ関数

### MergeJSON

シグネチャ：`func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

ディープマージ戦略を使用して2つの JSON オブジェクトをマージします。ネストされたオブジェクトの場合、`Config.MergeMode` で指定されたモードに従ってキーを再帰的にマージします。プリミティブ値と配列の場合、patch 側の値が優先されます。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `json1` | `string` | はい | ベース JSON 文字列 |
| `json2` | `string` | はい | 上書き JSON 文字列 |
| `cfg` | `...Config` | いいえ | オプション設定（`MergeMode` でマージモードを設定） |

**マージモード**（`Config.MergeMode` で設定、デフォルトは `MergeUnion`）：

| モード | オブジェクトの動作 | 配列の動作 |
|------|----------|----------|
| `MergeUnion` | すべてのキーをマージ、競合時は patch の値を使用 | すべての要素をマージし重複を除去 |
| `MergeIntersection` | 共通のキーのみ保持、値は patch から取得 | 共通の要素のみ保持 |
| `MergeDifference` | ベース独自のキーのみ保持 | ベース独自の要素のみ保持 |

```go
base := `{"a": 1, "b": 2, "nested": {"x": 10, "y": 20}}`
override := `{"b": 3, "c": 4, "nested": {"y": 30, "z": 40}}`

// ユニオンマージ（デフォルト）
result, _ := json.MergeJSON(base, override)
// 結果: {"a":1,"b":3,"c":4,"nested":{"x":10,"y":30,"z":40}}

// インターセクションマージ - 共通キーのみ保持
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, _ = json.MergeJSON(base, override, cfg)
// 結果: {"b":3,"nested":{"y":30}}

// ディファレンスマージ - ベース独自のキーのみ保持
cfg = json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, _ = json.MergeJSON(base, override, cfg)
// 結果: {"a":1,"nested":{"x":10}}
```

### MergeMany

シグネチャ：`func MergeMany(jsons []string, cfg ...Config) (string, error)`

複数の JSON オブジェクトをマージします。2つ以上の JSON 文字列が必要です。`Config.MergeMode` でマージモードを設定できます。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `jsons` | `[]string` | はい | マージする JSON 文字列のスライス（2つ以上） |
| `cfg` | `...Config` | いいえ | オプション設定（`MergeMode` でマージモードを設定） |

```go
config1 := `{"api": "v1", "timeout": 30, "retries": 1}`
config2 := `{"timeout": 60, "retries": 3}`
config3 := `{"retries": 5, "debug": true}`

// デフォルトのユニオンマージ
result, err := json.MergeMany([]string{config1, config2, config3})
// 結果: {"api":"v1","timeout":60,"retries":5,"debug":true}
```

## Processor メソッド

Processor は対応する変更・マージメソッドを提供します。シグネチャはパッケージレベル関数と同一です：

```go
p, err := json.New()

result, err := p.Set(jsonStr, "user.name", "Alice")
result, err = p.Delete(jsonStr, "user.temp")
result, err = p.SetCreate(jsonStr, "user.email", "test@example.com")
```

`MergeJSON`、`MergeMany` にも対応する Processor メソッドがあり、シグネチャはパッケージレベル関数と同一で、設定済みの Processor を再利用しやすくなっています：

```go
result, err := p.MergeJSON(base, override)

merged, err := p.MergeMany([]string{config1, config2, config3})

// CompareJSON にも Processor メソッドがあります（注意：Processor.CompareJSON は常に
// セキュリティ検証を実行します。これはパッケージレベル関数の cfg なしパスとは異なります）
equal, err := p.CompareJSON(a, b)
```

詳しくは [Processor データ変更](../processor/modify#processor-マージメソッド) を参照してください。

## 関連

- [クエリと取得関数](./query) - Get、GetString などのクエリ操作
- [バッチ操作関数](./batch) - ProcessBatch バッチ処理
- [エンコード出力関数](./output) - Marshal、Unmarshal などのシリアライズ操作
- [ヘルパー関数](../helpers) - CompareJSON などのユーティリティ関数

---
sidebar_label: "変更操作"
title: "Processor データ変更 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor 変更メソッド：Set 設定、SetMultiple 一括、SetCreate 自動パス作成、SetMultipleCreate 一括作成、全メソッドがメソッドチェーンをサポートします。"
sidebar_position: 3
---

# データ変更メソッド

Processor はデータ変更メソッドを提供し、すべてのメソッドは変更後の JSON 文字列を返します。削除メソッドは[削除操作](./delete)を参照してください。

## Set

シグネチャ：`func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

指定したパスに値を設定し、変更後の JSON 文字列を返します。

```go
result, err := p.Set(data, "user.name", "NewName")
```

複数の型の値の設定をサポートします：

```go
// 文字列
result, _ := p.Set(data, "user.name", "CyberGo")

// 数値
result, _ = p.Set(data, "user.age", 25)

// ブール値
result, _ = p.Set(data, "user.active", true)

// オブジェクト
result, _ = p.Set(data, "user.profile", map[string]any{
    "bio": "Developer",
    "location": "China",
})

// 配列
result, _ = p.Set(data, "items", []any{"a", "b", "c"})
```

## SetMultiple

シグネチャ：`func (p *Processor) SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

複数のパスの値をバッチ設定し、変更後の JSON 文字列を返します。

```go
result, err := p.SetMultiple(data, map[string]any{
    "user.name": "CyberGo",
    "user.age":  25,
    "user.active": true,
})
```

## SetCreate

シグネチャ：`func (p *Processor) SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

値を設定し、存在しない中間パスを自動的に作成します。`Config.CreatePaths = true` を指定した `Set` と同等です。

```go
// 中間パス user.profile が存在しない場合は自動作成される
result, err := p.SetCreate(data, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

## SetMultipleCreate

シグネチャ：`func (p *Processor) SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

複数の値をバッチ設定し、中間パスを自動的に作成します。

```go
result, err := p.SetMultipleCreate(data, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## メソッドチェーンによる変更

変更メソッドはメソッドチェーンをサポートします：

```go
processor, _ := json.New()

result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## Processor マージメソッド

Processor はパッケージレベルの [MergeJSON](../functions/modify#mergejson)、[MergeMany](../functions/modify#mergemany)、[CompareJSON](../helpers#comparejson) に対応するインスタンスメソッドを提供します。

### Processor.MergeJSON

シグネチャ：`func (p *Processor) MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

cfg（省略時はプロセッサ自身の設定）からオプションを解析し、`Config.MergeMode` に従って2つのオブジェクトをディープマージした上で、このプロセッサで結果を再エンコードします。

パッケージレベル関数と同様に、`Processor.MergeJSON` はセキュリティ検証を実行しません——デコード、ディープマージ、再エンコードのみを行う構造的なツールです。セキュリティ検証が必要な場合は `CompareJSON`（cfg を渡すと検証を実行）を使用してください。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// ユニオンマージ（デフォルト）
result, err := p.MergeJSON(base, override)

// インターセクションマージ
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err = p.MergeJSON(base, override, cfg)
```

### Processor.MergeMany

シグネチャ：`func (p *Processor) MergeMany(jsons []string, cfg ...Config) (string, error)`

`MergeJSON` でスライスを左から右へ折りたたみ、マージ戦略は `Config.MergeMode`（デフォルト `MergeUnion`）で決まります。JSON 文字列が2つ未満の場合はエラーを返します。いずれかのマージステップが失敗した場合、失敗したインデックスを伴うエラーを返します。

```go
result, err := p.MergeMany([]string{config1, config2, config3})
```

### Processor.CompareJSON

シグネチャ：`func (p *Processor) CompareJSON(json1, json2 string, cfg ...Config) (bool, error)`

2つの JSON 文字列が等しいか比較します（数値の正規化、キー順序に依存しません）。

::: warning パッケージレベル CompareJSON との違い
パッケージレベルの `CompareJSON` は cfg なしの場合セキュリティ検証を実行せず、両側を `encoding/json` でマーシャルします。一方 Processor メソッドは**常に**セキュリティ検証を実行し（cfg を渡した場合は cfg に従い、そうでない場合はプロセッサ自身の設定に従います）、両側をライブラリのエンコーダで対称的にマーシャルするため、設定されたエンコード（`EscapeHTML` など）が対称的に適用されます。
:::

```go
equal, err := p.CompareJSON(a, b)
equal, err = p.CompareJSON(a, b, json.SecurityConfig())
```

## 関連

- [パスクエリ](./query) - Get シリーズメソッド
- [削除操作](./delete) - Delete/DeleteClean メソッド
- [バッチ操作](./batch) - ProcessBatch バッチ処理

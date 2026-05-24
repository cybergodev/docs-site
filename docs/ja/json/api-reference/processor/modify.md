---
title: "Processor データ変更 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor データ変更メソッド完全リファレンス：Set によるパス値の設定、SetMultiple バッチ設定、Delete パス削除、CreatePaths 自動中間パス作成。すべてのメソッドは変更後の JSON 文字列を返し、メソッドチェーンと CreatePaths 設定によるパス自動作成をサポート。"
---

# データ変更メソッド

Processor はデータ変更メソッドを提供し、すべてのメソッドは変更後の JSON 文字列を返します。

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
result, _ := p.Set(data, "user.age", 25)

// ブール値
result, _ := p.Set(data, "user.active", true)

// オブジェクト
result, _ := p.Set(data, "user.profile", map[string]any{
    "bio": "Developer",
    "location": "China",
})

// 配列
result, _ := p.Set(data, "items", []any{"a", "b", "c"})
```

## Delete

シグネチャ：`func (p *Processor) Delete(jsonStr, path string, cfg ...Config) (string, error)`

指定したパスの値を削除し、変更後の JSON 文字列を返します。

```go
result, err := p.Delete(data, "user.temporary")
```

## DeleteClean

シグネチャ：`func (p *Processor) DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

指定したパスを削除し、null 値と空配列を自動的にクリーンアップします。

```go
result, err := p.DeleteClean(data, "user.temporary")
// 削除後に生じた null と空配列をクリーンアップ
```

**Delete と DeleteClean の違い**：

```go
// 元のデータ: {"user": {"temp": "value", "name": "test"}}

// Delete 後: {"user": {"name": "test"}}
result, _ := p.Delete(data, "user.temp")

// 削除後に親オブジェクトが空になった場合、DeleteClean はさらにクリーンアップ
// {"user": {}} -> {}
result, _ := p.DeleteClean(data, "user.temp")
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

## 関連

- [パスクエリ](./query) - Get シリーズメソッド
- [バッチ操作](./batch) - ProcessBatch バッチ処理

---
sidebar_label: "削除操作"
title: "Processor 削除メソッド - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor 削除メソッド：Delete はパスベースで削除、DeleteClean は削除後に null 値や空配列を自動クリーンアップし、メソッドチェーンを維持します。"
sidebar_position: 4
---

# 削除メソッド

Processor は指定したパスの値を削除し、変更後の JSON 文字列を返すメソッドを提供します。

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

// DeleteClean も user.temp を削除します。ここでは user は依然 name を含むため、空にはなりません
// 結果: {"user": {"name": "test"}}
result, _ = p.DeleteClean(data, "user.temp")
```

## 関連

- [変更操作](./modify) - Set/SetCreate チェーン変更
- [削除関数](../functions/delete) - パッケージレベル Delete 関数

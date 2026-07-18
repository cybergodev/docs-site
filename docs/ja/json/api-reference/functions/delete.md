---
title: "削除関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON 削除関数：Delete でノードを削除、DeleteClean で空の親ノードを自動クリーンアップ、パス式と自動クリーンアップに対応します。"
sidebar_label: "削除操作"
sidebar_position: 4
---

# 削除関数

json パッケージが提供する JSON 削除関数は、指定されたパスのノードを削除し、削除によって生じた空の親ノードをオプションでクリーンアップします。

## Delete

シグネチャ：`func Delete(jsonStr, path string, cfg ...Config) (string, error)`

指定されたパスの値を削除します。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `jsonStr` | `string` | はい | JSON 文字列 |
| `path` | `string` | はい | パス式 |
| `cfg` | `Config` | いいえ | オプション設定 |

**例**

```go
result, err := json.Delete(data, "user.temporary")
if err != nil {
    panic(err)
}
```

**オブジェクトのプロパティの削除**

```go
// 単一プロパティの削除
result, err := json.Delete(`{"user":{"name":"Alice","temp":"value"}}`, "user.temp")
// {"user":{"name":"Alice"}}
```

**配列要素の削除**

```go
// 配列内の要素を削除（インデックスは0から開始）
result, err := json.Delete(`{"items":["a","b","c"]}`, "items[1]")
// {"items":["a","c"]}
```

**パスが存在しない場合**

```go
// パスが存在しない場合、元の JSON とエラーを返す
result, err := json.Delete(`{"a":1}`, "nonexistent.path")
if err != nil {
    // err には JsonsError が含まれ、ErrPathNotFound をラップしている
    fmt.Println("削除に失敗:", err)
}
// result は元の JSON のまま: {"a":1}
```

## DeleteClean

シグネチャ：`func DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

指定されたパスを削除し、結果として生じる空値や空配列を自動的にクリーンアップします。

```go
// 元のデータ: {"user": {"temp": "value", "name": "test"}}
result, err := json.DeleteClean(data, "user.temp")
// {"user":{"name":"test"}}

// 削除後に親オブジェクトが空になった場合、さらにクリーンアップ
// {"user": {}} -> {}
```

## 関連

- [変更操作](./modify) - 設定、マージなどの変更関数
- [クエリと取得関数](./query) - Get、GetString などのクエリ操作

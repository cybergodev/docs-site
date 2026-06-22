---
title: "Processor バッチ操作 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor バッチ操作：ProcessBatch、BatchOperation、BatchResult、ContinueOnError 設定とパフォーマンス最適化でバッチデータ処理に対応します。"
---

# バッチ操作メソッド

Processor はバッチ操作機能を提供し、複数の JSON 操作を一度に処理できます。

## ProcessBatch

シグネチャ：`func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

複数の JSON 操作をバッチ処理します。

```go
operations := []json.BatchOperation{
    {Type: "get", JSONStr: data, Path: "user.name", ID: "1"},
    {Type: "set", JSONStr: data, Path: "user.age", Value: 30, ID: "2"},
    {Type: "delete", JSONStr: data, Path: "user.temporary", ID: "3"},
}

results, err := processor.ProcessBatch(operations)
if err != nil {
    panic(err)
}

for _, result := range results {
    fmt.Printf("ID: %s, 結果: %v\n", result.ID, result.Result)
}
```

## BatchOperation 構造体

```go
type BatchOperation struct {
    Type    string `json:"type"`     // 操作タイプ: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // JSON 文字列
    Path    string `json:"path"`     // ターゲットパス
    Value   any    `json:"value"`    // Set 操作の値
    ID      string `json:"id"`       // 操作識別子
}
```

| フィールド | 型 | 説明 |
|------------|------|------|
| `Type` | `string` | 操作タイプ：`get`、`set`、`delete`、`validate` |
| `JSONStr` | `string` | 操作対象の JSON 文字列 |
| `Path` | `string` | ターゲットパス |
| `Value` | `any` | Set 操作時に設定する値 |
| `ID` | `string` | 操作識別子。結果の照合に使用 |

## BatchResult 構造体

```go
type BatchResult struct {
    ID     string `json:"id"`     // 対応する操作の ID
    Result any    `json:"result"` // 操作結果
    Error  error  `json:"error"`  // エラー（ある場合）
}
```

| フィールド | 型 | 説明 |
|------------|------|------|
| `ID` | `string` | 対応する BatchOperation の ID |
| `Result` | `any` | 操作結果（Get は値を返し、Set/Delete は新しい JSON を返す） |
| `Error` | `error` | 個別操作のエラー（他の操作には影響しない） |

## 使用例

### バッチ読み取り

```go
operations := []json.BatchOperation{
    {Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
    {Type: "get", JSONStr: data, Path: "user.email", ID: "email"},
    {Type: "get", JSONStr: data, Path: "user.age", ID: "age"},
}

results, _ := processor.ProcessBatch(operations)
for _, r := range results {
    fmt.Printf("%s: %v\n", r.ID, r.Result)
}
```

### バッチ変更

```go
operations := []json.BatchOperation{
    {Type: "set", JSONStr: data, Path: "status", Value: "active", ID: "1"},
    {Type: "set", JSONStr: data, Path: "updated_at", Value: time.Now().Unix(), ID: "2"},
    {Type: "delete", JSONStr: data, Path: "temp_field", ID: "3"},
}

results, _ := processor.ProcessBatch(operations)
```

### 混合操作

```go
operations := []json.BatchOperation{
    {Type: "validate", JSONStr: data, ID: "check"},
    {Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
    {Type: "set", JSONStr: data, Path: "processed", Value: true, ID: "mark"},
}

results, _ := processor.ProcessBatch(operations)

// 検証結果を確認
for _, r := range results {
    if r.ID == "check" {
        if m, ok := r.Result.(map[string]any); ok {
            fmt.Printf("検証結果: %v\n", m["valid"])
        }
    }
}
```

## 注意事項

1. 各操作は独立して実行され、1つの失敗が他の操作に影響しません
2. 結果の順序は操作の順序と一致します
3. ID を使用して操作と結果を照合します

## 関連

- [パスクエリ](./query) - Get シリーズメソッド
- [データ変更](./modify) - Set/Delete メソッド

---
sidebar_label: "バッチ操作"
title: "バッチ操作関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON バッチ操作関数：ProcessBatch で複数の JSON 操作を一度に処理し、BatchOperation 記述構造体と BatchResult 結果構造体を組み合わせます。"
sidebar_position: 7
---

# バッチ操作関数

json パッケージが提供するバッチ操作関数。複数の JSON 操作（get/set/delete/validate）を一度に処理でき、バッチデータ処理シナリオに適しています。

## バッチ操作

### ProcessBatch

シグネチャ：`func ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

複数の JSON 操作をバッチ処理します（パッケージレベル関数、Processor の作成不要）。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

    operations := []json.BatchOperation{
        {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
        {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
    }

    results, err := json.ProcessBatch(operations)
    if err != nil {
        panic(err)
    }
    for _, r := range results {
        if r.Error != nil {
            fmt.Printf("操作 %s 失敗: %v\n", r.ID, r.Error)
        } else {
            fmt.Printf("操作 %s 結果: %v\n", r.ID, r.Result)
        }
    }
}
```

### BatchOperation

バッチ操作の記述構造体。

```go
type BatchOperation struct {
    Type    string `json:"type"`     // 操作タイプ："get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // 対象 JSON 文字列
    Path    string `json:"path"`     // パス式
    Value   any    `json:"value"`    // 操作値（set 操作で使用）
    ID      string `json:"id"`       // 操作識別子
}
```

### BatchResult

バッチ操作の結果構造体。

```go
type BatchResult struct {
    ID     string `json:"id"`     // 操作識別子
    Result any    `json:"result"` // 操作結果
    Error  error  `json:"error"`  // エラー情報
}
```

::: tip Processor バッチメソッド
Processor インスタンスはパッケージレベル関数と同じシグネチャのバッチメソッド `p.ProcessBatch(operations)` を提供し、Processor を再利用するシナリオに適しています。詳しくは [Processor バッチ操作](../processor/batch) を参照してください。
:::

## 関連

- [変更関数](./modify) - Set、MergeJSON などの変更操作
- [Processor バッチ操作](../processor/batch) - Processor レベルのバッチ操作メソッドの詳細

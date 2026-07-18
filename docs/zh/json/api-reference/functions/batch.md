---
sidebar_label: "批量操作"
title: "批量操作函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 批量操作函数：ProcessBatch 一次性处理多个 JSON 操作，配合 BatchOperation 描述结构与 BatchResult 结果结构。"
sidebar_position: 7
---

# 批量操作函数

json 包提供的批量操作函数，支持一次性处理多个 JSON 操作（get/set/delete/validate），适合批量数据处理场景。

## 批量操作

### ProcessBatch

签名：`func ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

批量处理多个 JSON 操作（包级函数，无需创建 Processor）。

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
            fmt.Printf("操作 %s 失败: %v\n", r.ID, r.Error)
        } else {
            fmt.Printf("操作 %s 结果: %v\n", r.ID, r.Result)
        }
    }
}
```

### BatchOperation

批量操作描述结构。

```go
type BatchOperation struct {
    Type    string `json:"type"`     // 操作类型："get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // 目标 JSON 字符串
    Path    string `json:"path"`     // 路径表达式
    Value   any    `json:"value"`    // 操作值（set 操作使用）
    ID      string `json:"id"`       // 操作标识
}
```

### BatchResult

批量操作结果结构。

```go
type BatchResult struct {
    ID     string `json:"id"`     // 操作标识
    Result any    `json:"result"` // 操作结果
    Error  error  `json:"error"`  // 错误信息
}
```

::: tip Processor 批量方法
Processor 实例提供等价的批量方法 `p.ProcessBatch(operations)`，签名与包级函数一致，适合复用 Processor 的场景。详见 [Processor 批量操作](../processor/batch)。
:::

## 相关

- [修改函数](./modify) - Set, MergeJSON 等修改操作
- [Processor 批量操作](../processor/batch) - Processor 级批量操作方法详解

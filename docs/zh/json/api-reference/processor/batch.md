---
title: "Processor 批量操作 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 批量操作：ProcessBatch 多操作、BatchOperation 定义、BatchResult 类型、ContinueOnError 配置与性能优化策略，适合批量数据处理。"
---

# 批量操作方法

Processor 提供批量操作能力，一次处理多个 JSON 操作。

## ProcessBatch

签名：`func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

批量处理多个 JSON 操作。

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
    fmt.Printf("ID: %s, 结果: %v\n", result.ID, result.Result)
}
```

## BatchOperation 结构

```go
type BatchOperation struct {
    Type    string `json:"type"`     // 操作类型: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // JSON 字符串
    Path    string `json:"path"`     // 目标路径
    Value   any    `json:"value"`    // Set 操作的值
    ID      string `json:"id"`       // 操作标识符
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `Type` | `string` | 操作类型：`get`、`set`、`delete`、`validate` |
| `JSONStr` | `string` | 要操作的 JSON 字符串 |
| `Path` | `string` | 目标路径 |
| `Value` | `any` | Set 操作时设置的值 |
| `ID` | `string` | 操作标识符，用于匹配结果 |

## BatchResult 结构

```go
type BatchResult struct {
    ID     string `json:"id"`     // 对应的操作 ID
    Result any    `json:"result"` // 操作结果
    Error  error  `json:"error"`  // 错误（如有）
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `ID` | `string` | 对应 BatchOperation 的 ID |
| `Result` | `any` | 操作结果（Get 返回值，Set/Delete 返回新 JSON） |
| `Error` | `error` | 单个操作的错误（不影响其他操作） |

## 使用示例

### 批量读取

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

### 批量修改

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

// 检查验证结果
for _, r := range results {
    if r.ID == "check" {
        if m, ok := r.Result.(map[string]any); ok {
            fmt.Printf("验证结果: %v\n", m["valid"])
        }
    }
}
```

## 注意事项

1. 每个操作独立执行，一个失败不影响其他操作
2. 结果顺序与操作顺序一致
3. 通过 ID 匹配操作和结果

## 相关

- [路径查询](./query) - Get 系列方法
- [数据修改](./modify) - Set/Delete 方法

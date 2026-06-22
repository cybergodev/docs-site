---
title: "修改函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 修改函数：Set/SetMultiple 设置、Delete 删除、MergeJSON/MergeMany 合并，支持自动路径创建、原子操作与多种 MergeMode 策略。"
---

# 修改函数

json 包提供的 JSON 修改函数，支持路径设置、批量更新和删除操作。

## 设置函数

### Set

签名：`func Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

在指定路径设置值，返回修改后的 JSON 字符串。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `value` | `any` | 是 | 要设置的值 |
| `cfg` | `Config` | 否 | 可选配置 |

**示例**

```go
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
if err != nil {
    panic(err)
}
fmt.Println(result) // {"user":{"name":"Alice"}}
```

**路径不存在时自动创建**

```go
// 自动创建中间路径
result, err := json.Set(`{}`, "user.profile.name", "Bob")
// {"user":{"profile":{"name":"Bob"}}}
```

**设置不同类型值**

```go
data := `{}`

// 设置字符串
json.Set(data, "user.name", "Alice")

// 设置数字
json.Set(data, "user.age", 30)

// 设置布尔值
json.Set(data, "user.active", true)

// 设置 null
json.Set(data, "user.deleted", nil)

// 设置嵌套对象
json.Set(data, "user.address", map[string]any{
    "city": "Beijing",
    "zip":  "100000",
})

// 设置数组
json.Set(data, "user.tags", []string{"admin", "developer"})
```

### SetMultiple

签名：`func SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

批量设置多个路径的值。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `updates` | `map[string]any` | 是 | 路径到值的映射 |
| `cfg` | `Config` | 否 | 可选配置 |

**示例**

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

**性能优势**

对于多个修改操作，`SetMultiple` 比多次调用 `Set` 更高效：

```go
// 推荐：一次调用
updates := map[string]any{"a": 1, "b": 2, "c": 3}
result, err := json.SetMultiple(data, updates)

// 不推荐：多次调用
result, err = json.Set(data, "a", 1)
result, err = json.Set(result, "b", 2)
result, err = json.Set(result, "c", 3)
```

### SetCreate

签名：`func SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

设置值并自动创建不存在的中间路径。等同于 `Config.CreatePaths = true` 的 `Set`。

```go
// 中间路径不存在时自动创建
result, err := json.SetCreate(`{}`, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

### SetMultipleCreate

签名：`func SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

批量设置多个值并自动创建中间路径。

```go
result, err := json.SetMultipleCreate(`{}`, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## 删除函数

### Delete

签名：`func Delete(jsonStr, path string, cfg ...Config) (string, error)`

删除指定路径的值。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `cfg` | `Config` | 否 | 可选配置 |

**示例**

```go
result, err := json.Delete(data, "user.temporary")
if err != nil {
    panic(err)
}
```

**删除对象属性**

```go
// 删除单个属性
result, err := json.Delete(`{"user":{"name":"Alice","temp":"value"}}`, "user.temp")
// {"user":{"name":"Alice"}}
```

**删除数组元素**

```go
// 删除数组中的元素（索引从 0 开始）
result, err := json.Delete(`{"items":["a","b","c"]}`, "items[1]")
// {"items":["a","c"]}
```

**路径不存在**

```go
// 路径不存在时返回原 JSON 和错误
result, err := json.Delete(`{"a":1}`, "nonexistent.path")
if err != nil {
    // err 包含 JsonsError，包装了 ErrPathNotFound
    fmt.Println("删除失败:", err)
}
// result 仍为原始 JSON: {"a":1}
```

### DeleteClean

签名：`func DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

删除指定路径并自动清理产生的空值和空数组。

```go
// 原始数据: {"user": {"temp": "value", "name": "test"}}
result, err := json.DeleteClean(data, "user.temp")
// {"user":{"name":"test"}}

// 如果删除后父对象为空，会继续清理
// {"user": {}} -> {}
```

## 合并函数

### MergeJSON

签名：`func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

使用深度合并策略合并两个 JSON 对象。对于嵌套对象，根据 `Config.MergeMode` 指定模式递归合并键。对于原始值和数组，patch 的值优先。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `json1` | `string` | 是 | 基础 JSON 字符串 |
| `json2` | `string` | 是 | 覆盖 JSON 字符串 |
| `cfg` | `...Config` | 否 | 可选配置（通过 `MergeMode` 设置合并模式） |

**合并模式**（通过 `Config.MergeMode` 设置，默认为 `MergeUnion`）：

| 模式 | 对象行为 | 数组行为 |
|------|----------|----------|
| `MergeUnion` | 合并所有键，冲突时使用 patch 的值 | 合并所有元素并去重 |
| `MergeIntersection` | 仅保留共有的键，值来自 patch | 仅保留共有的元素 |
| `MergeDifference` | 仅保留 base 独有的键 | 仅保留 base 独有的元素 |

```go
base := `{"a": 1, "b": 2, "nested": {"x": 10, "y": 20}}`
override := `{"b": 3, "c": 4, "nested": {"y": 30, "z": 40}}`

// 联合合并（默认）
result, _ := json.MergeJSON(base, override)
// 结果: {"a":1,"b":3,"c":4,"nested":{"x":10,"y":30,"z":40}}

// 交集合并 - 仅保留共有键
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, _ = json.MergeJSON(base, override, cfg)
// 结果: {"b":3,"nested":{"y":30}}

// 差集合并 - 仅保留 base 独有的键
cfg = json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, _ = json.MergeJSON(base, override, cfg)
// 结果: {"a":1,"nested":{"x":10}}
```

### MergeMany

签名：`func MergeMany(jsons []string, cfg ...Config) (string, error)`

合并多个 JSON 对象。至少需要 2 个 JSON 字符串。支持通过 `Config.MergeMode` 设置合并模式。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsons` | `[]string` | 是 | 要合并的 JSON 字符串切片（至少 2 个） |
| `cfg` | `...Config` | 否 | 可选配置（通过 `MergeMode` 设置合并模式） |

```go
config1 := `{"api": "v1", "timeout": 30, "retries": 1}`
config2 := `{"timeout": 60, "retries": 3}`
config3 := `{"retries": 5, "debug": true}`

// 默认联合合并
result, err := json.MergeMany([]string{config1, config2, config3})
// 结果: {"api":"v1","timeout":60,"retries":5,"debug":true}
```

## 批量操作

### ProcessBatch

签名：`func ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

批量处理多个 JSON 操作（包级函数，无需创建 Processor）。

```go
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

## Processor 方法

Processor 提供了对应的修改方法，签名与包级函数一致：

```go
p, err := json.New()

result, err := p.Set(jsonStr, "user.name", "Alice")
result, err = p.Delete(jsonStr, "user.temp")
result, err = p.SetCreate(jsonStr, "user.email", "test@example.com")
```

## 相关

- [查询获取函数](./get) - Get, GetString 等查询操作
- [编码解码函数](./encode-decode) - Marshal, Unmarshal 等序列化操作
- [辅助函数](../helpers) - CompareJSON 等工具函数

---
title: "删除函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 删除函数：Delete 删除节点、DeleteClean 删除并清理空父节点，支持路径表达式与自动清理。"
sidebar_label: "删除操作"
sidebar_position: 4
---

# 删除函数

json 包提供的 JSON 删除函数，用于移除指定路径的节点，并可选地清理因删除产生的空父节点。

## Delete

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

## DeleteClean

签名：`func DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

删除指定路径并自动清理产生的空值和空数组。

```go
// 原始数据: {"user": {"temp": "value", "name": "test"}}
result, err := json.DeleteClean(data, "user.temp")
// {"user":{"name":"test"}}

// 如果删除后父对象为空，会继续清理
// {"user": {}} -> {}
```

## 相关

- [修改操作](./modify) - 设置、合并等修改函数
- [查询获取函数](./query) - Get, GetString 等查询操作

---
title: "Processor 数据修改 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 数据修改方法完整参考：Set 路径设置值、SetMultiple 批量设置、SetCreate 自动创建中间路径、Delete 删除路径和 DeleteClean 清理删除，所有方法支持链式调用。"
---

# 数据修改方法

Processor 提供数据修改方法，所有方法返回修改后的 JSON 字符串。

## Set

签名：`func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

设置指定路径的值，返回修改后的 JSON 字符串。

```go
result, err := p.Set(data, "user.name", "NewName")
```

支持设置多种类型的值：

```go
// 字符串
result, _ := p.Set(data, "user.name", "CyberGo")

// 数字
result, _ := p.Set(data, "user.age", 25)

// 布尔值
result, _ := p.Set(data, "user.active", true)

// 对象
result, _ := p.Set(data, "user.profile", map[string]any{
    "bio": "Developer",
    "location": "China",
})

// 数组
result, _ := p.Set(data, "items", []any{"a", "b", "c"})
```

## Delete

签名：`func (p *Processor) Delete(jsonStr, path string, cfg ...Config) (string, error)`

删除指定路径的值，返回修改后的 JSON 字符串。

```go
result, err := p.Delete(data, "user.temporary")
```

## DeleteClean

签名：`func (p *Processor) DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

删除指定路径并自动清理空值和空数组。

```go
result, err := p.DeleteClean(data, "user.temporary")
// 删除后会清理产生的 null 和空数组
```

**Delete 与 DeleteClean 区别**：

```go
// 原始数据: {"user": {"temp": "value", "name": "test"}}

// Delete 后: {"user": {"name": "test"}}
result, _ := p.Delete(data, "user.temp")

// 如果删除后父对象为空，DeleteClean 会继续清理
// {"user": {}} -> {}
result, _ := p.DeleteClean(data, "user.temp")
```

## SetMultiple

签名：`func (p *Processor) SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

批量设置多个路径的值，返回修改后的 JSON 字符串。

```go
result, err := p.SetMultiple(data, map[string]any{
    "user.name": "CyberGo",
    "user.age":  25,
    "user.active": true,
})
```

## SetCreate

签名：`func (p *Processor) SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

设置值并自动创建不存在的中间路径。等同于 `Config.CreatePaths = true` 的 `Set`。

```go
// 中间路径 user.profile 不存在时会自动创建
result, err := p.SetCreate(data, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

## SetMultipleCreate

签名：`func (p *Processor) SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

批量设置多个值并自动创建中间路径。

```go
result, err := p.SetMultipleCreate(data, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## 链式修改

修改方法支持链式调用：

```go
processor, _ := json.New()

result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## 相关

- [路径查询](./query) - Get 系列方法
- [批量操作](./batch) - ProcessBatch 批量处理

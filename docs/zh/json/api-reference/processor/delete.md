---
sidebar_label: "删除操作"
title: "Processor 删除方法 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 删除方法：Delete 按路径删除、DeleteClean 删除后自动清理空值与空数组，保留链式调用能力。"
sidebar_position: 4
---

# 删除方法

Processor 提供数据删除方法，删除指定路径的值并返回修改后的 JSON 字符串。

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

// DeleteClean 同样会删除 user.temp；此处 user 仍含 name，不会变空
// 结果: {"user": {"name": "test"}}
result, _ = p.DeleteClean(data, "user.temp")
```

## 相关

- [修改操作](./modify) - Set/SetCreate 链式修改
- [删除函数](../functions/delete) - 包级 Delete 函数

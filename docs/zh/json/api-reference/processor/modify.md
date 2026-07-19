---
sidebar_label: "修改操作"
title: "Processor 数据修改 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 修改方法：Set 设置、SetMultiple 批量、SetCreate 自动创建路径、SetMultipleCreate 批量创建，所有方法支持链式调用。"
sidebar_position: 3
---

# 数据修改方法

Processor 提供数据修改方法，所有方法返回修改后的 JSON 字符串。删除相关方法见[删除操作](./delete)。

## Set

签名：`func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (result string, err error)`

设置指定路径的值，返回修改后的 JSON 字符串。

```go
result, err := p.Set(data, "user.name", "NewName")
```

支持设置多种类型的值：

```go
// 字符串
result, _ := p.Set(data, "user.name", "CyberGo")

// 数字
result, _ = p.Set(data, "user.age", 25)

// 布尔值
result, _ = p.Set(data, "user.active", true)

// 对象
result, _ = p.Set(data, "user.profile", map[string]any{
    "bio": "Developer",
    "location": "China",
})

// 数组
result, _ = p.Set(data, "items", []any{"a", "b", "c"})
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

## Processor 合并方法

Processor 提供与包级 [MergeJSON](../functions/modify#mergejson)、[MergeMany](../functions/modify#mergemany)、[CompareJSON](../helpers#comparejson) 对应的实例方法。

### Processor.MergeJSON

签名：`func (p *Processor) MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

从 cfg 解析选项（**省略 cfg 时使用 DefaultConfig，而非处理器自身配置**——若处理器以自定义 MergeMode 创建，需显式传入 cfg 才能应用该模式），按 `Config.MergeMode` 深度合并两个对象，再用本处理器重新编码结果。

与包级函数一样，`Processor.MergeJSON` 不执行安全验证——它是仅做解码、深合并、再编码的结构性工具。需要安全验证时请使用 `CompareJSON`（始终执行安全验证；传入 cfg 时按 cfg，否则按处理器自身配置）。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 联合合并（默认）
result, err := p.MergeJSON(base, override)

// 交集合并
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err = p.MergeJSON(base, override, cfg)
```

### Processor.MergeMany

签名：`func (p *Processor) MergeMany(jsons []string, cfg ...Config) (string, error)`

通过 `MergeJSON` 从左到右折叠切片，合并策略由 `Config.MergeMode` 决定（默认 `MergeUnion`）。少于 2 个 JSON 字符串时返回错误；任一合并步骤失败时返回携带失败索引的错误。

```go
result, err := p.MergeMany([]string{config1, config2, config3})
```

### Processor.CompareJSON

签名：`func (p *Processor) CompareJSON(json1, json2 string, cfg ...Config) (bool, error)`

比较两个 JSON 字符串是否相等（数字归一化、键顺序无关）。

::: warning 与包级 CompareJSON 的差异
包级 `CompareJSON` 在无 cfg 时不执行安全验证、两侧用 `encoding/json` 编组；Processor 方法**始终**执行安全验证（传入 cfg 时按 cfg，否则按处理器自身配置），并用库编码器对两侧对称编组，使配置的编码（如 `EscapeHTML`）对称应用。
:::

```go
equal, err := p.CompareJSON(a, b)
equal, err = p.CompareJSON(a, b, json.SecurityConfig())
```

## 相关

- [路径查询](./query) - Get 系列方法
- [删除操作](./delete) - Delete/DeleteClean 方法
- [批量操作](./batch) - ProcessBatch 批量处理

---
sidebar_label: "修改操作"
title: "修改函数 - CyberGo JSON | Set 与 MergeJSON 用法"
description: "修改 JSON：Set/SetMultiple 按路径写入并自动创建节点，SetCreate 强制 CreatePaths，MergeJSON 按 MergeMode 深度合并。"
sidebar_position: 30
---

# 修改函数

json 包的 JSON 修改函数：路径设置、批量更新与合并。所有函数都返回新字符串，输入保持不变。

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

**返回值与错误**

成功返回修改后的 JSON 字符串与 `nil`；失败返回**原始未修改的** `jsonStr` 与错误（与 `Delete` 一致的契约，哨兵值可用 `errors.Is` 判定）：

| 错误 | 触发场景 |
|------|----------|
| `ErrInvalidJSON` | `jsonStr` 不是合法 JSON |
| `ErrInvalidPath` | 路径表达式语法非法 |
| `ErrPathNotFound` | 路径不存在且 `CreatePaths = false` |

目标位置类型冲突时（例如 `a` 是数字，却写 `a.b`），返回的是普通 `JsonsError`，`errors.Is(err, ErrTypeMismatch)` 为 `false`。这类失败只能按错误消息或 `JsonsError.Op` 判断，不要依赖哨兵。

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

**性能**：多个修改操作时，`SetMultiple` 只解析一次文档，再把每个路径依次写入同一棵树；逐次调用 `Set` 则是每步都解析一次。更新按路径字典序排序后应用，因此 `a` 与 `a.b` 这类重叠路径的结果是确定的（先写 `a`，再写 `a.b`）：

```go
// 一次调用
updates := map[string]any{"a": 1, "b": 2, "c": 3}
result, err := json.SetMultiple(data, updates)

// 逐次调用：每一步都会重新解析文档
result, err = json.Set(data, "a", 1)
result, err = json.Set(result, "b", 2)
result, err = json.Set(result, "c", 3)
```

### SetCreate

签名：`func SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

设置值并自动创建不存在的中间路径。等价于 `Set` **强制开启** `CreatePaths`：即使传入 `cfg`，其余字段照常合并，但 `CreatePaths` 一律为 `true`。默认 `Config.CreatePaths` 本身就是 `true`，所以无 cfg 时 `SetCreate` 与 `Set` 行为相同；它的价值在于向读者表明「这里允许创建路径」，且不受处理器上 `CreatePaths=false` 的影响。

```go
// 中间路径不存在时自动创建
result, err := json.SetCreate(`{}`, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

### SetMultipleCreate

签名：`func SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

批量设置多个值并自动创建中间路径。与 `SetMultiple` 的关系同上：`cfg` 其余字段照常生效，`CreatePaths` 强制为 `true`。

```go
result, err := json.SetMultipleCreate(`{}`, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## 数组路径的修改

`Set` 系列对数组路径有专门行为，路径语法详见[路径表达式语法](../../getting-started/path-syntax)：

```go
data := `{"items": ["a", "b", "c"]}`

// 索引替换（含负索引）
r1, _ := json.Set(data, "items[0]", "x")    // {"items":["x","b","c"]}
r2, _ := json.Set(data, "items[-1]", "z")   // {"items":["a","b","z"]}

// 追加元素
r3, _ := json.Set(data, "items[+]", "d")    // {"items":["a","b","c","d"]}

// 通配符：全部元素替换为同一值
r4, _ := json.Set(data, "items[*]", "-")    // {"items":["-","-","-"]}

// 嵌套：数组元素的字段（路径不存在时自动创建）
users := `{"users": [{"name": "Alice"}]}`
r5, _ := json.Set(users, "users[0].age", 30)
// {"users":[{"age":30,"name":"Alice"}]}

r6, _ := json.SetCreate(`{}`, "users[0].profile.bio", "Developer")
// {"users":[{"profile":{"bio":"Developer"}}]}
```

::: warning 切片段的限制
`items[1:3]` 这类**切片段**用于查询（返回子数组）没有问题，但作为 `Set`/`Delete` 的**最后一段**时当前版本返回错误（`distributed set ops on slices not yet supported`），即不支持「把范围内每个元素都改写」。需要这种效果时，改用 `ForeachReturn` 或通配符路径。
:::

## 合并函数

### MergeJSON

签名：`func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

使用深度合并策略合并两个 JSON 对象。嵌套对象按 `Config.MergeMode` 指定的模式递归合并键；原始值冲突时 patch 侧优先，数组则按模式合并元素（见下表），不按下标覆盖。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `json1` | `string` | 是 | 基础 JSON 字符串 |
| `json2` | `string` | 是 | 覆盖 JSON 字符串 |
| `cfg` | `...Config` | 否 | 可选配置（用 `MergeMode` 设置合并模式） |

**合并模式**（由 `Config.MergeMode` 设置，默认 `MergeUnion`）：

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
// 结果：{"a":1,"b":3,"c":4,"nested":{"x":10,"y":30,"z":40}}

// 交集合并 - 仅保留共有键
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, _ = json.MergeJSON(base, override, cfg)
// 结果：{"b":3,"nested":{"y":30}}

// 差集合并 - 仅保留 base 独有的键
cfg = json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, _ = json.MergeJSON(base, override, cfg)
// 结果：{"a":1,"nested":{"x":10}}
```

**数组字段的三模式对比**（数组按元素**去重合并**，而非按下标覆盖）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	base := `{"tags":[1,2,3],"roles":["dev"]}`
	override := `{"tags":[3,4]}`

	// 联合：base 元素在前，追加 override 的新元素并去重
	union, _ := json.MergeJSON(base, override)
	fmt.Println(union)
	// 输出：{"roles":["dev"],"tags":[1,2,3,4]}

	// 交集：仅保留两边都出现的元素（保持 base 顺序）
	cfg := json.DefaultConfig()
	cfg.MergeMode = json.MergeIntersection
	inter, _ := json.MergeJSON(base, override, cfg)
	fmt.Println(inter)
	// 输出：{"tags":[3]}

	// 差集：仅保留 base 独有的元素（roles 整个键只在 base 中，故保留）
	cfg.MergeMode = json.MergeDifference
	diff, _ := json.MergeJSON(base, override, cfg)
	fmt.Println(diff)
	// 输出：{"roles":["dev"],"tags":[1,2]}
}
```

::: warning 顶层入参必须是 JSON 对象
`MergeJSON` 要求两个顶层入参都是 JSON 对象（`{...}`）；任一侧是数组或标量时返回错误（`first JSON is not an object` / `second JSON is not an object`）。上表的「数组行为」作用于**对象字段里的数组**：两边同名字段都是数组时按元素去重、取交集或取差集（差集模式下结果即使为空数组也保留该键）。两边同名字段类型不一致时（如一边数组、一边标量）：union/intersection 取 override 的值，difference 直接丢弃该键。
:::

### MergeMany

签名：`func MergeMany(jsons []string, cfg ...Config) (string, error)`

合并多个 JSON 对象，至少需要 2 个输入。合并模式同样由 `Config.MergeMode` 设置。

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
// 结果：{"api":"v1","timeout":60,"retries":5,"debug":true}
```

**合并顺序与错误**：从左到右折叠，`MergeMany([a, b, c])` 等价于 `MergeJSON(MergeJSON(a, b), c)`，右侧（下标更大）的值在冲突时胜出。少于 2 个输入直接报错；任一步合并失败时返回带失败下标的错误（`merge failed at index i: ...`），不产出部分结果。

## Processor 方法

Processor 提供对应的修改与合并方法，签名与包级函数一致：

```go
p, err := json.New()

result, err := p.Set(jsonStr, "user.name", "Alice")
result, err = p.Delete(jsonStr, "user.temp")
result, err = p.SetCreate(jsonStr, "user.email", "test@example.com")
```

**预解析变体 SetFromParsed**：配合 `PreParse` 在同一份已解析数据上连续修改，跳过重复解析：

```go
parsed, err := p.PreParse(jsonStr) // 解析一次
if err != nil {
    panic(err)
}
defer parsed.Release()

// 第一次修改：返回新的 ParsedJSON，可继续链式修改
parsed2, err := p.SetFromParsed(parsed, "user.name", "Alice")
if err != nil {
    panic(err)
}
parsed3, err := p.SetFromParsed(parsed2, "user.age", 30)
if err != nil {
    panic(err)
}

// 取最终 JSON 文本
final := parsed3.Data() // any（map[string]any / []any）
```

::: tip
`SetFromParsed` 返回**新的** `*ParsedJSON`（中间结果互不影响），适合「同一份大 JSON 连续多处修改」的场景。与 `GetFromParsed` 配对，见 [Processor 解析方法](../processor/parse#setfromparsed)。
:::

`MergeJSON`、`MergeMany` 也有对应的 Processor 方法，签名与包级函数一致，便于复用已配置的 Processor：

```go
result, err := p.MergeJSON(base, override)

merged, err := p.MergeMany([]string{config1, config2, config3})

// CompareJSON 也有 Processor 方法；Processor.CompareJSON 始终执行
// 安全验证，与包级函数的无 cfg 路径不同
equal, err := p.CompareJSON(a, b)
```

详见 [Processor 数据修改](../processor/modify#processor-合并方法)。

## 相关

- [查询获取函数](./query) - Get, GetString 等查询操作
- [批量操作函数](./batch) - ProcessBatch 批量处理
- [编码输出函数](./output) - Marshal, Unmarshal 等序列化操作
- [辅助函数](../helpers) - CompareJSON 等工具函数

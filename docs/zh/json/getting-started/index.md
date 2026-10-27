---
sidebar_label: "快速开始"
title: "快速开始 - CyberGo JSON | 5 分钟上手指南"
description: "CyberGo JSON 快速开始：安装、GetString/GetInt 路径查询、Set/Delete 修改与 Marshal/Unmarshal 编解码。"
sidebar_position: 10
---

# 快速开始

`github.com/cybergodev/json` 是兼容 `encoding/json` 签名、额外提供路径查询与修改能力的 Go JSON 库。本页按「安装 → 读写 → 编解码 → 迭代 → 错误处理」的顺序给出最小可用示例。

## 安装

```bash
go get github.com/cybergodev/json
```

**要求 Go 1.25+**（源码 `go.mod` 声明 `go 1.25.0`）。

## 基本用法

### 包级函数

包级函数直接调用，不需要创建处理器：

#### 获取值

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{
        "name": "CyberGo",
        "version": 1,
        "active": true,
        "price": 99.99,
        "tags": ["json", "go", "fast"],
        "meta": {"author": "dev"}
    }`

	// 通用获取
	val, err := json.Get(data, "name")
	if err != nil {
		panic(err)
	}
	fmt.Println(val) // CyberGo

	// 类型安全获取
	name := json.GetString(data, "name")
	version := json.GetInt(data, "version")
	active := json.GetBool(data, "active")
	price := json.GetFloat(data, "price")
	tags := json.GetArray(data, "tags")
	meta := json.GetObject(data, "meta")

	fmt.Println(name, version, active, price)
	fmt.Println(tags) // [json go fast]
	fmt.Println(meta) // map[author:dev]

	// 带默认值获取
	desc := json.GetString(data, "description", "N/A")
	count := json.GetInt(data, "count", 0)
	fmt.Println(desc, count) // N/A 0
}
```

#### 嵌套路径

支持点号分隔的嵌套路径：

```go
data := `{"user": {"profile": {"name": "Alice"}}}`

name := json.GetString(data, "user.profile.name")
fmt.Println(name) // Alice
```

#### 数组索引

支持数组索引访问：

```go
data := `{"items": ["a", "b", "c"]}`

// 两种语法都支持
item0 := json.GetString(data, "items.0")   // "a"
item1 := json.GetString(data, "items.1")   // "b"
last := json.GetString(data, "items.-1")   // "c"

// 方括号语法
first := json.GetString(data, "items[0]")  // "a"
last2 := json.GetString(data, "items[-1]") // "c"

// 范围取值（返回数组）
arr := json.GetArray(data, "items[0:2]")   // ["a", "b"]
```

::: tip 更多路径语法
除了基本的属性和数组索引，还支持 **数组切片** `[1:5]`、**通配符** `[*]`、**字段提取** `{name,email}` 等高级语法。详见 [路径表达式语法](./path-syntax)。
:::

#### 设置值

```go
data := `{"name": "old"}`

// 设置新值
updated, err := json.Set(data, "name", "new")
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"name":"new"}

// 添加新字段
updated, err = json.Set(data, "version", 1)
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"name":"old","version":1}

// 连续修改：每次返回新 JSON，需逐次接收并检查 err
updated, err = json.Set(updated, "name", "updated")
if err != nil {
    panic(err)
}
updated, err = json.Set(updated, "version", 2)
if err != nil {
    panic(err)
}
updated, err = json.Set(updated, "active", true)
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"active":true,"name":"updated","version":2}
```

#### 删除值

```go
data := `{"name": "test", "temp": "remove"}`

// 删除字段
updated, err := json.Delete(data, "temp")
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"name":"test"}
```

### 编码与解码

`Marshal`/`Unmarshal`/`MarshalIndent` 与 `encoding/json` 签名一致，核心结构体标签用法相同。差异在于默认输入会做安全校验（超 `MaxJSONSize`、危险模式、非法 UTF-8 会被拒绝），明细见[从标准库迁移](./migration#与标准库有哪些行为差异)。

```go
type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

// 编码
user := User{Name: "Alice", Age: 30}
bytes, err := json.Marshal(user)
if err != nil {
    panic(err)
}
fmt.Println(string(bytes)) // {"name":"Alice","age":30}

// 格式化编码
pretty, err := json.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(pretty))
// {
//   "name": "Alice",
//   "age": 30
// }

// 解码
var u User
if err := json.Unmarshal(bytes, &u); err != nil {
    panic(err)
}
fmt.Println(u.Name, u.Age) // Alice 30
```

### 验证

```go
valid := `{"key": "value"}`
invalid := `{key: value}`

fmt.Println(json.Valid([]byte(valid)))   // true
fmt.Println(json.Valid([]byte(invalid))) // false
```

### 格式化

```go
// 本节片段依赖以下 import（其余小节的片段同理，按需补齐）
import (
    "bytes"
    "fmt"

    "github.com/cybergodev/json"
)

compact := `{"name":"test","nested":{"key":"value"}}`

// 格式化输出
pretty, err := json.Prettify(compact)
if err != nil {
    panic(err)
}
fmt.Println(pretty)
// {
//   "name": "test",
//   "nested": {
//     "key": "value"
//   }
// }

// 压缩输出
jsonStr := `{
  "name": "test"
}`
var buf bytes.Buffer
err = json.Compact(&buf, []byte(jsonStr))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

## 使用 Processor

对同一份数据反复操作时用 `Processor`：它持有独立缓存、可携带配置，并支持预解析与路径预编译。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// 使用默认配置创建处理器
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close() // 释放缓存与后台 goroutine

	data := `{"name": "test", "value": 42}`

	// 使用处理器操作
	name := p.GetString(data, "name")
	value := p.GetInt(data, "value")

	fmt.Println(name, value)
}
```

## 配置选项

```go
// 默认配置
cfg := json.DefaultConfig()

// 安全增强配置（处理不可信输入）
// cfg = json.SecurityConfig()

// 格式化输出配置
// cfg = json.PrettyConfig()

// 自定义配置
cfg = json.DefaultConfig()
cfg.MaxJSONSize = 50 * 1024 * 1024 // 50MB
cfg.EnableCache = true
cfg.CacheTTL = 5 * time.Minute

// 使用自定义配置创建处理器
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 迭代遍历

遍历数组元素并访问其字段，不必为每个元素拼完整路径：

```go
data := `{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}`

err := json.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("User %v: %s (age %d)\n", key, name, age)
})
if err != nil {
    panic(err)
}
// User 0: Alice (age 30)
// User 1: Bob (age 25)
```

::: tip
`Foreach*` 函数族共 12 个（含 4 个文件变体 `ForeachFile*`，不含 JSONL 专用的 `ForeachJSONL`；完整清单见[速查表·迭代函数族](./cheatsheet#迭代函数族)）：需要**提前终止**时用 `ForeachWithError`（回调返回 `error`，返回 `item.Break()` 即中断）；深度嵌套遍历、携带当前路径等变体见速查表同节。
:::

## 错误处理

路径操作的常见错误是**哨兵错误**，用 `errors.Is` 精确区分：

```go
val, err := json.Get(data, "user.profile.email")
if err != nil {
    switch {
    case errors.Is(err, json.ErrPathNotFound):
        // 键不存在或数组下标越界 — 业务上常见，可用默认值兜底
    case errors.Is(err, json.ErrInvalidJSON):
        // JSON 本身格式错误
    default:
        // 其余错误（超限、类型冲突等）：JsonsError 已携带操作名与路径，
        // 记录日志即可，无需逐类枚举
        fmt.Println(err)
    }
}
```

不想逐个判断时，带默认值的类型化函数（`GetString`/`GetInt` 等）会静默返回零值或默认值，适合非关键读取。

::: tip ErrTypeMismatch 用在哪里？
普通 `Get` 遇到类型冲突（如对字符串路径用数组索引）返回的是携带上下文的描述性错误，**不是** `ErrTypeMismatch` 哨兵。`ErrTypeMismatch` 的触发点如下：

- `SafeGet(...).AsString()` 在值不是字符串时返回包裹 `ErrTypeMismatch` 的错误；`AsInt`/`AsFloat64`/`AsBool` 转换失败返回的是普通 error，不命中该哨兵
- `GetCompiled` 的预编译路径导航中途类型不符
- `EncodeFields` 传入非对象、`ForeachFileChunked` 的根不是数组
- `ForeachWithPathAndControl` / `ForeachWithPathAndIterator` 的目标值不可迭代

另需注意：对不可迭代值调用 `ForeachWithError`、`ForeachWithPath` 不会返回 `ErrTypeMismatch`——回调零次执行、返回 `nil`。
:::

## 常见第一小时问题

上手初期最常见的问题集中在本节；路径语法细节见[路径表达式语法](./path-syntax)。

**Q：路径找不到时到底返回什么？**

「对象键不存在」与「数组下标越界」都返回 `ErrPathNotFound`，区别只在错误消息：

| 调用 | 对象键不存在 | 数组下标越界 |
|------|--------------|--------------|
| `json.Get` | `(nil, ErrPathNotFound)` | `(nil, ErrPathNotFound)`，消息含 `array index 10 out of bounds (length 3)` |
| `json.GetString` 等类型化函数 | 零值或传入的默认值 | 零值或传入的默认值 |
| `json.SafeGet` | `Exists: false` | `Exists: false` |

判断元素是否存在可以直接看 `err`：`errors.Is(err, json.ErrPathNotFound)` 同时覆盖「键不存在」与「下标越界」。需要「缺失即默认值」时，改用类型化函数或 `SafeGet`，不要用 `Get` 的 err 分支兜底。切片越界是例外：`items[10:20]` 自动裁剪为空数组，不报错。完整规则见[语法陷阱](./path-syntax#有哪些语法陷阱)。

**Q：取出来的数字为什么是 float64？**

`Get` 返回 `any`；默认配置下 JSON 数字解码为 `float64`：

```go
data := `{"version": 1}`

val, _ := json.Get(data, "version") // val 是 float64(1)，不是 int
i := json.GetInt(data, "version")   // 需要 int 时用类型化函数
```

超出 `float64` 精度的大整数（如雪花 ID）会被舍入。此时用 `Config.PreserveNumbers` 保留原始数字文本，或 `Decoder.UseNumber()` 取 `json.Number`。

**Q：调用 `Set` 之后，原 JSON 怎么没变？**

`Set`/`Delete` 是纯函数风格：返回修改后的**新字符串**，原串不动。丢弃返回值是最常见的新手 bug：

```go
data := `{"name": "old"}`

// ✗ 结果被丢弃，data 不变
_, _ = json.Set(data, "name", "new")

// ✓ 接收返回值
updated, err := json.Set(data, "name", "new")
if err != nil {
    panic(err)
}
```

连续修改多处时用 `SetMultiple` 一次完成，比链式 `Set` 更直接。

**Q：`Set` 用越界下标会发生什么？**

与查询侧返回 `ErrPathNotFound` 不同——默认配置（`CreatePaths: true`）下，`Set` 会把数组用 `null` 填充扩展到目标下标：

```go
updated, err := json.Set(`{"items":[1,2,3]}`, "items[5]", "x")
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"items":[1,2,3,null,null,"x"]}
```

只想在末尾追加时用 `items[+]`，不要依赖越界下标。

**Q：为什么到处都要 `defer p.Close()`？**

`Processor` 内部持有缓存与后台清理 goroutine，`Close` 负责排空在途操作并释放这些资源。高频创建却不关闭会持续累积。包级函数使用全局处理器托管生命周期，不需要也不应手动 `Close`。详见 [Processor 入门](./processor-guide#生命周期管理)。

## 下一步

- [路径表达式语法](./path-syntax) — 学习完整的路径查询语法
- [Processor 入门](./processor-guide) — 何时使用处理器、预解析优化
- [格式化输出](./print) — 美化与压缩 JSON
- [从标准库迁移](./migration) — 签名替换与默认安全校验差异
- [速查表](./cheatsheet) — API 快速参考
- [大文件处理](../streaming/large-files) — 处理大型 JSON 文件
- [API 文档](../api-reference/) — 查看完整 API 参考
- [使用示例](../examples/) — 浏览更多实战示例

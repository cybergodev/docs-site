---
title: "删除函数 - CyberGo JSON | Delete 用法与示例"
description: "CyberGo JSON 是支持节点删除的 Go 库，Delete 按路径移除节点、DeleteClean 级联清理空对象与空数组，并支持通配符、切片范围、多字段与 JSON Pointer 删除，数组元素自动前移重排，帮助开发者不可变地删除字段并保持结构整洁。"
sidebar_label: "删除操作"
sidebar_position: 40
---

# 删除函数

json 包提供的 JSON 删除函数，用于移除指定路径的节点，并可选地清理因删除产生的空父节点。所有删除函数都是**不可变**的——返回修改后的新 JSON 字符串，原字符串保持不变；出错时返回原输入。

## Delete

签名：`func Delete(jsonStr, path string, cfg ...Config) (string, error)`

删除指定路径的值，返回修改后的 JSON 字符串。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式（点号、索引、通配符、切片、多字段） |
| `cfg` | `Config` | 否 | 可选配置（影响清理与校验行为） |

**返回值**

| 返回值 | 说明 |
|--------|------|
| `result string` | 修改后的 JSON 字符串（成功）；出错时为原 `jsonStr` |
| `err error` | 成功为 `nil`；失败为包装了底层哨兵错误的 `*JsonsError` |

### 删除对象属性

删除单个嵌套属性，返回不包含该键的新对象。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"Alice","temp":"value","age":30}}`

	result, err := json.Delete(data, "user.temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"user":{"age":30,"name":"Alice"}}
}
```

### 删除数组元素

删除数组中的元素（索引从 0 开始）。元素被**移除**而非置空，后续元素自动前移、索引重排，不留空洞。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"items":["a","b","c","d"]}`

	// 删除索引 1 的元素 "b"，"c"/"d" 自动前移
	result, err := json.Delete(data, "items[1]")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"items":["a","c","d"]}
}
```

支持负数索引（从末尾倒数，`-1` 为最后一个）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"items":["a","b","c","d"]}`

	// -1 指向最后一个元素 "d"
	result, err := json.Delete(data, "items[-1]")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"items":["a","b","c"]}
}
```

### 嵌套路径删除

通过点号路径深入嵌套结构，删除任意层级的节点。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"config":{"database":{"host":"localhost","port":5432,"password":"secret"}}}`

	result, err := json.Delete(data, "config.database.password")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"config":{"database":{"host":"localhost","port":5432}}}
}
```

### 不可变语义

`Delete` 返回新字符串，**原 `jsonStr` 不会被修改**。你可以安全地在多处复用同一份输入：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"a":1,"b":2,"c":3}`

	r1, _ := json.Delete(data, "a")
	r2, _ := json.Delete(data, "b")

	fmt.Println(data) // 原数据不变：{"a":1,"b":2,"c":3}
	fmt.Println(r1)   // 输出：{"b":2,"c":3}
	fmt.Println(r2)   // 输出：{"a":1,"c":3}
}
```

## 高级路径删除

`Delete` 复用与 Get/Set 相同的递归路径引擎，支持通配符、切片范围、多字段提取等批量语义。**批量路径（含 `*`、`{}`、`:`）对缺失目标采用容错策略——命中即删，缺失静默跳过，不返回错误**。

### 通配符删除

`items[*]` 删除数组全部元素；`[*].field` 删除每个元素的指定属性。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"users":[{"name":"Alice","temp":"x"},{"name":"Bob","temp":"y"}]}`

	// 删除每个用户对象的 temp 属性
	result, err := json.Delete(data, "users[*].temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"users":[{"name":"Alice"},{"name":"Bob"}]}
}
```

某些元素缺少目标属性时也不会报错（幂等语义，与 Go 原生 `delete()` 对 absent key 的行为一致）：

<!-- check-code: skip -->
```go
// data = `[{"a":1},{"b":2}]` — 第二个元素没有 a，仍正常返回
result, err := json.Delete(data, "[*].a")
// err == nil，result：[{"b":2}]
```

### 切片范围删除

`items[0:2]` 删除一段连续区间的元素（左闭右开）。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"items":["a","b","c","d","e"]}`

	// 删除索引 0、1（不含 2）的 "a"、"b"
	result, err := json.Delete(data, "items[0:2]")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"items":["c","d","e"]}
}
```

### 多字段提取删除

`[*].{a,b}` 一次性删除每个元素的多个指定属性。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `[{"name":"Alice","pwd":"x","token":"y"},{"name":"Bob","pwd":"z"}]`

	// 同时删除 pwd 和 token 两个字段
	result, err := json.Delete(data, "[*].{pwd,token}")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：[{"name":"Alice"},{"name":"Bob"}]
}
```

### JSON Pointer 路径删除

路径以 `/` 开头时，`Delete` 按 **RFC 6901 JSON Pointer** 语义解析（不再走点号语法）：段与段用 `/` 分隔，`~0`/`~1` 分别转义 `~` 与 `/`。这为删除**键名本身含点号等特殊字符**的键提供了出口（点号语法无法表达这类键名）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// 键名 "a.b" 本身含点号，点号路径 "a.b" 会被解析成两级而无法命中
	data := `{"a.b": 1, "user": {"name": "Alice"}}`

	r1, err := json.Delete(data, "/a.b")
	if err != nil {
		panic(err)
	}
	fmt.Println(r1) // 输出：{"user":{"name":"Alice"}}

	// /user/name 等价于点号路径 user.name
	r2, err := json.Delete(data, "/user/name")
	if err != nil {
		panic(err)
	}
	fmt.Println(r2) // 输出：{"a.b":1}
}
```

::: warning 根节点不可删除
JSON Pointer `/` 指向文档根，删除根没有意义——返回错误（`cannot delete root`）。指针路径中的缺失段与点号精确路径一样返回 `ErrPathNotFound`。
:::

::: tip 精确路径 vs 批量路径
- **精确路径**（仅含属性名/索引，如 `user.temp`、`items[1]`）：目标不存在时返回 `ErrPathNotFound` 错误。
- **批量路径**（含 `*`、`{}`、`:`，如 `items[*]`、`[*].{a,b}`、`items[0:2]`）：目标缺失时静默跳过，不报错。需要严格校验时用精确路径；需要"尽力删除"时用批量路径。
:::

## 错误处理

精确路径的目标不存在时，`Delete` 返回包装了 `ErrPathNotFound` 的 `*JsonsError`，且返回的原输入不变。用 `errors.Is` 判定具体错误类型：

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"a":1}`

	result, err := json.Delete(data, "nonexistent.path")
	if err != nil {
		if errors.Is(err, json.ErrPathNotFound) {
			fmt.Println("路径不存在，已跳过")
		} else {
			fmt.Println("其他错误：", err)
		}
	}
	// result 仍为原始 JSON：{"a":1}
	fmt.Println(result)
	// 输出：
	// 路径不存在，已跳过
	// {"a":1}
}
```

常见的删除错误哨兵值：

| 错误 | 触发场景 |
|------|----------|
| `ErrPathNotFound` | 精确路径的某个中间段或目标键/索引不存在 |
| `ErrInvalidJSON` | `jsonStr` 不是合法 JSON |
| `ErrInvalidPath` | 路径表达式语法非法（如未闭合的方括号） |

## DeleteClean

签名：`func DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

删除指定路径，并**递归清理**因删除产生的 `null` 值与空对象/空数组。等价于 `Delete(jsonStr, path, cfg)` 且强制开启 `CleanupNulls: true` + `CompactArrays: true`。

### 级联清理示例

当删除后父对象变为空，`DeleteClean` 会继续把空父对象一并移除，逐层向上级联：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// temp 是 user 唯一的属性
	data := `{"user":{"temp":"value"}}`

	// 普通删除：user 变成空对象 {}，但保留
	r1, _ := json.Delete(data, "user.temp")
	fmt.Println(r1) // 输出：{"user":{}}

	// DeleteClean：user 变空后连同 user 键一起清理
	r2, err := json.DeleteClean(data, "user.temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(r2) // 输出：{}
}
```

### 清理 API 响应中的临时字段

`DeleteClean` 适合清理 API 响应：删除目标字段的同时，连带扫除其他 `null` 值与残留的空容器，避免把"空壳"对象暴露给前端。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	apiResp := `{"data":{"id":1,"name":"Product","desc":null,"price":29.99,"note":null}}`

	// 一次 DeleteClean 删除 desc，并扫除整棵树中其他的 null（note）
	cleaned, err := json.DeleteClean(apiResp, "data.desc")
	if err != nil {
		panic(err)
	}
	fmt.Println(cleaned)
	// 输出：{"data":{"id":1,"name":"Product","price":29.99}}
}
```

::: warning DeleteClean 会清扫整棵树的 null
`DeleteClean` 的清理是**全局**的：它对整个 JSON 树递归清理 null 值与空容器，因此会移除文档中**所有**预先存在的 `null` 值与空容器，而不仅仅是删除点产生的那个。如果你只想移除指定字段、保留其余 `null`，请用普通 `Delete`。
:::

## DeleteClean 与 Config 的关系

`DeleteClean` 本质是 `Delete` + 两个配置项的语法糖。你也可以在普通 `Delete` 上显式传入同样的配置，效果完全等价：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"temp":"value"}}`

	// 方式一：DeleteClean
	r1, _ := json.DeleteClean(data, "user.temp")

	// 方式二：Delete + 显式配置（完全等价）
	cfg := json.DefaultConfig()
	cfg.CleanupNulls = true
	cfg.CompactArrays = true
	r2, _ := json.Delete(data, "user.temp", cfg)

	fmt.Println(r1) // 输出：{}
	fmt.Println(r2) // 输出：{}
}
```

影响删除行为的 `Config` 字段：

| 字段 | 默认 | 对删除的影响 |
|------|------|--------------|
| `CleanupNulls` | `false` | 递归移除结果中的 `null` 值与空对象/空数组（级联清理） |
| `CompactArrays` | `false` | 移除数组中的 `null`/空元素；开启时隐含 `CleanupNulls` |
| `CreatePaths` | `true` | **不影响删除**（删除从不创建路径，此处仅为对比说明） |

## Delete 与 DeleteClean 对比

| 特性 | Delete | DeleteClean |
|------|--------|-------------|
| 删除目标节点 | 是 | 是 |
| 数组元素移除后重排（无空洞） | 是 | 是 |
| 精确路径缺失时报错 | 是（`ErrPathNotFound`） | 是（`ErrPathNotFound`） |
| 清理删除产生的 `null` | 否 | 是 |
| 清理空对象/空数组（级联） | 否 | 是（逐层向上） |
| 扫除整棵树预存的 `null` | 否 | 是（全局清理） |
| 等价配置 | 默认 | `CleanupNulls+CompactArrays` |
| 相对开销 | 较低 | 略高（额外一次全树清理遍历） |

## 常见陷阱

::: warning 数组删除不留空洞
`Delete` 删除数组元素时，元素被**整体移除**、后续元素自动前移，不会留下 `null` 占位或空洞。如果你期望删除后索引保持不变（留下空位），CyberGo 的删除语义不满足该需求——应改用 `Set` 将该位置设为 `null`。
:::

::: warning DeleteClean 可能误删"恰好为空"的合法数据
`DeleteClean` 的级联清理会把所有空对象 `{}`、空数组 `[]` 视为需要清理的对象。如果你的业务语义中"空数组"或"空对象"是有意义的状态（例如 `"tags":[]` 表示"无标签"而非"字段缺失"），`DeleteClean` 会将其连同键一起移除。需要保留这类字段时，请使用普通 `Delete`。
:::

::: warning 批量删除是容错的
通配符/切片/多字段路径对缺失目标**静默跳过**，不返回错误。如果你依赖"目标必须存在"的强校验语义，请改用精确路径（如 `items[1]` 而非 `items[*]`）。
:::

## 批量删除多个字段

需要一次性删除多个不相关字段时，对普通 `Delete` 循环调用即可（每次基于上一次的结果）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"id":1,"name":"Alice","password":"secret","ssn":"123-45-6789"}}`

	sensitive := []string{"user.password", "user.ssn"}
	result := data
	for _, field := range sensitive {
		var err error
		result, err = json.Delete(result, field)
		if err != nil {
			fmt.Printf("删除 %s 失败：%v\n", field, err)
		}
	}
	fmt.Println(result)
	// 输出：{"user":{"id":1,"name":"Alice"}}
}
```

## 相关

- [修改操作](./modify) - 设置、合并等修改函数
- [查询获取函数](./query) - Get, GetString 等查询操作
- [Processor 删除方法](../processor/delete) - 实例方法版本，支持链式调用
- [配置参考](../config) - CleanupNulls / CompactArrays 等字段详情

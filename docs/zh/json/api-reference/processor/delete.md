---
sidebar_label: "删除操作"
title: "Processor 删除方法 - CyberGo JSON | Delete 方法与示例"
description: "CyberGo JSON 的 Processor 提供 Delete 按路径删除与 DeleteClean 清理空值，支持通配符、数组切片与多字段路径，缺失目标静默跳过，不可变地返回新字符串，适合清理配置冗余字段与修剪日志数据的开发场景。"
sidebar_position: 40
---

# 删除方法

Processor 提供数据删除方法，删除指定路径的值并返回修改后的 JSON 字符串。所有方法都是**不可变**的——返回新字符串，原输入不变；出错时返回原输入。与[包级删除函数](../functions/delete)行为一致，区别在于实例方法可与处理器的自身配置、缓存、钩子协同。

## Delete

签名：`func (p *Processor) Delete(jsonStr, path string, cfg ...Config) (result string, err error)`

删除指定路径的值，返回修改后的 JSON 字符串。

<!-- check-code: skip -->
```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

result, err := p.Delete(data, "user.temporary")
```

### 完整示例：对象属性、数组元素与嵌套路径

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 删除对象属性
	r1, err := p.Delete(`{"user":{"name":"Alice","temp":"x"}}`, "user.temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(r1)
	// 输出：{"user":{"name":"Alice"}}

	// 删除数组元素（移除并重排，不留空洞）
	r2, err := p.Delete(`{"items":["a","b","c"]}`, "items[1]")
	if err != nil {
		panic(err)
	}
	fmt.Println(r2)
	// 输出：{"items":["a","c"]}

	// 嵌套路径删除
	r3, err := p.Delete(`{"a":{"b":{"c":1,"d":2}}}`, "a.b.c")
	if err != nil {
		panic(err)
	}
	fmt.Println(r3)
	// 输出：{"a":{"b":{"d":2}}}
}
```

### 高级路径：通配符与切片

`Delete` 复用与 Get/Set 相同的路径引擎，支持通配符、切片范围、多字段提取。批量路径（含 `*`、`{}`、`:`）对缺失目标静默跳过，不报错。路径语法的完整说明——通配符、切片、多字段以及 **JSON Pointer**（`/` 开头的 RFC 6901 路径，可删除键名本身含点号等特殊字符的键）——见[删除函数·高级路径删除](../functions/delete#高级路径删除)。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"users":[{"name":"Alice","pwd":"x"},{"name":"Bob","pwd":"y"}],"tags":[1,2,3,4]}`

	// 通配符：删除每个用户的 pwd
	r1, err := p.Delete(data, "users[*].pwd")
	if err != nil {
		panic(err)
	}
	fmt.Println(r1)
	// 输出：{"tags":[1,2,3,4],"users":[{"name":"Alice"},{"name":"Bob"}]}

	// 切片范围：删除 tags[0:2]（左闭右开）
	r2, err := p.Delete(data, "tags[0:2]")
	if err != nil {
		panic(err)
	}
	fmt.Println(r2)
	// 输出：{"tags":[3,4],"users":[{"name":"Alice","pwd":"x"},{"name":"Bob","pwd":"y"}]}
}
```

### 错误处理

精确路径的目标不存在时返回包装了 `ErrPathNotFound` 的错误，且原输入不变。用 `errors.Is` 判定：

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, _ := json.New()
	defer p.Close()

	result, err := p.Delete(`{"a":1}`, "nonexistent.path")
	if err != nil {
		if errors.Is(err, json.ErrPathNotFound) {
			fmt.Println("路径不存在，已跳过")
		}
	}
	fmt.Println(result) // 原数据不变：{"a":1}
	// 输出：
	// 路径不存在，已跳过
	// {"a":1}
}
```

## DeleteClean

签名：`func (p *Processor) DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

删除指定路径并**递归清理**因删除产生的 `null` 值与空对象/空数组。等价于 `Delete` 强制开启 `CleanupNulls: true` + `CompactArrays: true`。

### 级联清理：父对象变空后自动移除

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, _ := json.New()
	defer p.Close()

	// temp 是 user 唯一的属性
	data := `{"user":{"temp":"value"}}`

	// 普通删除：user 变成 {}，但保留
	r1, _ := p.Delete(data, "user.temp")
	fmt.Println(r1) // 输出：{"user":{}}

	// DeleteClean：user 变空后连同 user 键一起清理，逐层向上
	r2, err := p.DeleteClean(data, "user.temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(r2) // 输出：{}
}
```

### 清理 API 响应

删除目标字段的同时，连带扫除整棵树中其他的 `null` 与残留空容器：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, _ := json.New()
	defer p.Close()

	apiResp := `{"data":{"id":1,"name":"Product","desc":null,"price":29.99}}`

	cleaned, err := p.DeleteClean(apiResp, "data.desc")
	if err != nil {
		panic(err)
	}
	fmt.Println(cleaned)
	// 输出：{"data":{"id":1,"name":"Product","price":29.99}}
}
```

::: warning DeleteClean 会清扫整棵树的 null
`DeleteClean` 的清理是**全局**的：它对整个 JSON 树递归执行清理，因此会移除文档中**所有**预先存在的 `null` 与空容器，而不仅是删除点产生的那个。只想移除指定字段、保留其余 `null` 时，请用普通 `Delete`。
:::

## Delete 与 DeleteClean 对比

两者的行为对照表（清理范围、级联语义、等价配置与开销对比）与包级函数页完全一致，见[删除函数·Delete 与 DeleteClean 对比](../functions/delete#delete-与-deleteclean-对比)。Processor 侧的差异仅在配置生效方式：清理行为由「调用参数 `cfg` 与处理器自身配置取并集」决定（见下节）。

## Config 对删除行为的影响

删除方法的清理行为由「**调用参数 `cfg` 与处理器自身配置取并集**」决定。也就是说，若创建处理器时已开启 `CleanupNulls`，则后续普通 `p.Delete(...)` 也会自动清理：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// 创建一个默认开启清理的处理器
	cfg := json.DefaultConfig()
	cfg.CleanupNulls = true
	cfg.CompactArrays = true
	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"temp":"value"}}`

	// 普通 Delete 也会清理，因为处理器自身配置已开启
	result, err := p.Delete(data, "user.temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(result) // 输出：{}
}
```

影响删除行为的 `Config` 字段：

| 字段 | 默认 | 对删除的影响 |
|------|------|--------------|
| `CleanupNulls` | `false` | 递归移除结果中的 `null` 与空对象/空数组（级联） |
| `CompactArrays` | `false` | 移除数组中的 `null`/空元素；开启时隐含 `CleanupNulls` |
| `CreatePaths` | `true` | **不影响删除**（删除从不创建路径） |

> 因此 `DeleteClean(s, p)` 与在 `CleanupNulls+CompactArrays` 处理器上调用 `Delete(s, p)` 效果相同——选择语义更清晰的写法即可。

## 链式删除

删除方法返回新字符串，可直接喂给下一次调用，组合成链式修改流程：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, _ := json.New()
	defer p.Close()

	data := `{"user":{"name":"Alice","temp":"x","version":"1.0.0"}}`

	// 链式：先设置，再删除，每步基于上一步结果
	r1, _ := p.Set(data, "user.name", "CyberGo")
	r2, _ := p.Delete(r1, "user.temp")
	final, _ := p.Delete(r2, "user.version")

	fmt.Println(final)
	// 输出：{"user":{"name":"CyberGo"}}
}
```

## 常见陷阱

三条注意事项（数组删除不留空洞、`DeleteClean` 可能误删「恰好为空」的合法数据、批量删除对缺失目标容错跳过）同样适用于 Processor 方法，完整说明与示例见[删除函数·常见陷阱](../functions/delete#常见陷阱)。

## 相关

- [修改操作](./modify) - Set/SetCreate 链式修改
- [删除函数](../functions/delete) - 包级 Delete/DeleteClean 函数（含完整路径语法参考）
- [配置参考](../config) - CleanupNulls / CompactArrays 等字段详情

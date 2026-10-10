---
sidebar_label: "API 响应解析"
title: "API 响应解析 - CyberGo JSON | 分页与结构体反序列化"
description: "CyberGo JSON 解析 HTTP API 响应：ParseAny 解析任意值、GetString/GetInt 提取状态与分页元信息、Get/GetArray 提取嵌套数据、路径切片处理分页数组、GetTyped 反序列化到结构体，并以 ForeachWithPath 逐元素遍历条目，单次解析、高效提取。"
sidebar_position: 30
---

# API 响应解析

本文演示如何用 CyberGo JSON 解析典型的 HTTP API JSON 响应：提取响应状态与分页元信息、用路径切片处理数组、反序列化到结构体。

## 解析分页 API 响应

模拟一个 REST API 的分页响应，提取状态字段、分页元信息，用路径切片 `items[0:2]` 取子集，再逐元素提取字段。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// 模拟一个分页 API 响应
	apiResponse := `{
        "status": "success",
        "data": {
            "page": 2,
            "per_page": 5,
            "total": 48,
            "items": [
                {"id": 6, "name": "项目六", "stars": 120},
                {"id": 7, "name": "项目七", "stars": 89},
                {"id": 8, "name": "项目八", "stars": 245},
                {"id": 9, "name": "项目九", "stars": 56},
                {"id": 10, "name": "项目十", "stars": 312}
            ]
        }
    }`

	// 1. 提取响应状态与分页元信息
	status := json.GetString(apiResponse, "status")
	page := json.GetInt(apiResponse, "data.page")
	total := json.GetInt(apiResponse, "data.total")
	fmt.Printf("状态: %s, 第 %d 页, 共 %d 条\n", status, page, total)

	// 2. 获取整个数据数组
	items := json.GetArray(apiResponse, "data.items")
	fmt.Printf("本页条目数: %d\n", len(items))

	// 3. 使用路径切片获取子集（取前 2 条）
	firstTwo, err := json.Get(apiResponse, "data.items[0:2]")
	if err != nil {
		panic(err)
	}
	fmt.Printf("前两条: %v\n", firstTwo)

	// 4. 遍历数组提取每个元素的字段（推荐 ForeachWithPath：一次解析，逐元素访问）
	err = json.ForeachWithPath(apiResponse, "data.items", func(key any, item *json.IterableValue) {
		fmt.Printf("  - %s (%d stars)\n", item.GetString("name"), item.GetInt("stars"))
	})
	if err != nil {
		panic(err)
	}
}

// 输出：
// 状态: success, 第 2 页, 共 48 条
// 本页条目数: 5
// 前两条: [map[id:6 name:项目六 stars:120] map[id:7 name:项目七 stars:89]]
//   - 项目六 (120 stars)
//   - 项目七 (89 stars)
//   - 项目八 (245 stars)
//   - 项目九 (56 stars)
//   - 项目十 (312 stars)
```

:::tip 提示
路径切片语法 `[start:end]` 返回数组子集，也可用 `[start:end:step]` 带步长切片、`[-1]` 取末尾元素、`[*]` 通配符遍历所有元素。完整语法见[路径表达式](../getting-started/path-syntax)。

遍历数组时**优先 `ForeachWithPath`** 而非循环拼路径（`fmt.Sprintf("data.items.%d.name", i)` 逐条查询）：前者只解析一次、每个元素内直接按字段名取值，代码也更简洁；后者每条路径都是一次独立查询。
:::

## 一次获取多个字段

响应里要提取的字段较多时，`GetMultiple` 只解析一次就取回所有路径的值（结果 map 以路径为键），比逐个 `Get` 更省：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	apiResponse := `{
        "status": "success",
        "data": {
            "page": 2,
            "per_page": 5,
            "total": 48,
            "items": [
                {"id": 6, "name": "项目六", "stars": 120},
                {"id": 7, "name": "项目七", "stars": 89}
            ]
        }
    }`

	values, err := json.GetMultiple(apiResponse, []string{
		"status",
		"data.page",
		"data.per_page",
		"data.total",
		"data.items.0.name",
	})
	if err != nil {
		panic(err)
	}

	fmt.Printf("%s | 第 %v/%v 页，共 %v 条，首条：%v\n",
		values["status"], values["data.page"], values["data.per_page"],
		values["data.total"], values["data.items.0.name"])
}

// 输出：success | 第 2/5 页，共 48 条，首条：项目六
```

:::tip 注意
任一路径失败（不存在或非法）时 `GetMultiple` 返回**首个**错误，该路径在结果 map 中为 `nil`。因此它适合「字段必定存在」的响应提取；可选字段请改用带默认值的 `GetString(apiResponse, "path", "默认值")` 或下文的 `SafeGet`。
:::

## SafeGet 安全访问

`SafeGet` 不返回 error，而是返回 `AccessResult`：`Ok()` 判断存在性、`AsInt`/`AsString` 等方法按需转换、`UnwrapOr` 提供默认值——适合字段类型不稳定或可选的第三方响应，全程不会 panic：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	apiResponse := `{
        "status": 200,
        "message": "ok",
        "retry_after": "30",
        "trace_id": "abc-123"
    }`

	// status 是数字（JSON 数字解析为 float64），Type 字段报告运行时类型
	status := json.SafeGet(apiResponse, "status")
	fmt.Println("status 类型:", status.Type)
	if code, err := status.AsInt(); err == nil {
		fmt.Println("状态码:", code)
	}

	// retry_after 是字符串形式的秒数
	retry := json.SafeGet(apiResponse, "retry_after")
	if secs, err := retry.AsString(); err == nil {
		fmt.Println("重试等待(秒):", secs)
	}

	// 不存在的路径：Ok() 为 false，UnwrapOr 兜底
	deprecated := json.SafeGet(apiResponse, "deprecated_field")
	fmt.Println("废弃字段存在:", deprecated.Ok())
	fmt.Println("废弃字段兜底:", deprecated.UnwrapOr("none"))
}

// 输出：
// status 类型: float64
// 状态码: 200
// 重试等待(秒): 30
// 废弃字段存在: false
// 废弃字段兜底: none
```

严格转换失败时 `As*` 方法返回错误而非静默零值，避免把「字段缺失」与「值为 0」混为一谈；需要宽松转换（如任意类型转字符串表示）时用 `AsStringConverted`。

## 反序列化到结构体

用 `GetTyped[T]` 将整个响应或任意嵌套子对象反序列化为强类型结构体；用 `ParseAny` 获取 `any` 类型值（适合结构未知的场景）。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

// Repository 表示 API 响应中的仓库结构
type Repository struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Stars int    `json:"stars"`
}

// APIResponse 表示整个 API 响应
type APIResponse struct {
	Status string `json:"status"`
	Data   struct {
		Page  int          `json:"page"`
		Total int          `json:"total"`
		Items []Repository `json:"items"`
	} `json:"data"`
}

func main() {
	apiResponse := `{
        "status": "success",
        "data": {
            "page": 1,
            "total": 3,
            "items": [
                {"id": 1, "name": "cybergo-json", "stars": 500},
                {"id": 2, "name": "cybergo-jwt", "stars": 320},
                {"id": 3, "name": "cybergo-httpc", "stars": 280}
            ]
        }
    }`

	// 1. 将整个响应反序列化为结构体（路径 "." 表示根对象）
	resp := json.GetTyped[APIResponse](apiResponse, ".")
	fmt.Printf("状态: %s, 共 %d 个仓库\n", resp.Status, resp.Data.Total)
	for _, repo := range resp.Data.Items {
		fmt.Printf("  #%d %s (%d stars)\n", repo.ID, repo.Name, repo.Stars)
	}

	// 2. 对单个嵌套对象使用 GetTyped（解码子对象到结构体）
	firstRepo := json.GetTyped[Repository](apiResponse, "data.items.0")
	fmt.Printf("第一个仓库: %+v\n", firstRepo)

	// 3. 使用 ParseAny 获取任意值（响应结构未知时适用）
	parsed, err := json.ParseAny(apiResponse)
	if err != nil {
		panic(err)
	}
	fmt.Printf("解析类型: %T\n", parsed)
}

// 输出：
// 状态: success, 共 3 个仓库
//   #1 cybergo-json (500 stars)
//   #2 cybergo-jwt (320 stars)
//   #3 cybergo-httpc (280 stars)
// 第一个仓库: {ID:1 Name:cybergo-json Stars:500}
// 解析类型: map[string]interface {}
```

## 下一步

- [基础示例](./index) — 路径查询、结构体编解码基础用法
- [高级示例](./examples-advanced) — SafeGet、批量操作等进阶用法
- [速查表](../getting-started/cheatsheet) — API 快速参考
- [路径表达式语法](../getting-started/path-syntax) — 切片、通配符、字段提取

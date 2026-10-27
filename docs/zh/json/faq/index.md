---
sidebar_label: "常见问题"
title: "常见问题 - CyberGo JSON | 高频疑问速查"
description: "CyberGo JSON 常见问题：包函数与 Processor 选型、路径未命中与越界语义、数字变 float64、Set 纯函数风格、标准库迁移差异。"
sidebar_position: 1
---

# 常见问题

## 包级函数和 Processor 怎么选？

**答：** 偶尔操作 JSON、脚本工具、不想管理生命周期 → 用包级函数（`json.GetString` 等，背后是全局处理器）。需要自定义配置（安全模式、缓存参数）、钩子/审计/运行统计，或高频查询 → 用 Processor（`p, err := json.New(cfg)`）。

| 维度 | 包级函数 | Processor |
|------|----------|-----------|
| 创建方式 | 无需创建 | `json.New(cfg)` |
| 配置方式 | 尾参 `cfg ...Config` | 创建时统一配置 |
| 预解析 / 路径预编译 | 不支持 | `PreParse` / `CompilePath` |
| 资源管理 | 全局托管 | 手动 `Close()` |

完整对比与选择决策树见 [Processor 入门](../getting-started/processor-guide#包函数-vs-processor)。

## 路径找不到时到底返回什么？

**答：** 取决于调用方式。对象键不存在与数组下标越界对 `Get` 都返回 `ErrPathNotFound`，类型化函数与 `SafeGet` 则落零值/默认值：

| 调用 | 对象键不存在 | 数组下标越界 |
|------|--------------|--------------|
| `json.Get` | `(nil, ErrPathNotFound)` | `(nil, ErrPathNotFound)` |
| `json.GetString` 等类型化函数 | 零值或传入的默认值 | 零值或传入的默认值 |
| `json.SafeGet` | `Exists: false` | `Exists: false` |

`items[10]` 在长度为 3 的数组上返回的错误消息含 `array index 10 out of bounds (length 3)`，其 `errors.Is(err, json.ErrPathNotFound)` 为 `true`。需要「缺失即默认值」时用类型化函数或 `SafeGet`，不要用 `Get` 的 err 分支兜底。完整规则见[语法陷阱](../getting-started/path-syntax#有哪些语法陷阱)。

## 取出来的数字为什么是 float64？

**答：** `Get` 返回 `any`，JSON 数字经标准解码一律是 `float64`：

```go
data := `{"version": 1}`

val, _ := json.Get(data, "version") // val 是 float64(1)，不是 int
i := json.GetInt(data, "version")   // 需要 int 时用类型化函数
```

超出 `float64` 精度的大整数（如雪花 ID）会被舍入——此时用 `Config.PreserveNumbers` 保留原始数字文本，或 `Decoder.UseNumber()` 取 `json.Number`。

## 调用 Set 之后，原 JSON 为什么没变？

**答：** `Set`/`Delete` 是纯函数风格：返回修改后的**新字符串**，原串不动。最常见的错误是丢弃返回值：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"name": "old"}`

	updated, err := json.Set(data, "name", "new")
	if err != nil {
		panic(err)
	}
	fmt.Println(data)    // {"name": "old"} — 原串不变
	fmt.Println(updated) // {"name":"new"}
}
```

连续修改多处时用 `SetMultiple` 一次完成，比链式 `Set` 更清晰。

## 用越界下标 Set 会发生什么？

**答：** 查询侧越界返回 `ErrPathNotFound`，修改侧不同——默认配置（`CreatePaths: true`）下，`Set` 会把数组用 `null` 填充扩展到目标下标：

```go
updated, _ := json.Set(`{"items":[1,2,3]}`, "items[5]", "x")
// {"items":[1,2,3,null,null,"x"]}
```

只想在末尾追加时用 `items[+]`（前置路径必须是已存在的数组），不要依赖越界下标。索引、切片、修改三者的越界语义对比见[语法陷阱](../getting-started/path-syntax#有哪些语法陷阱)。

## 字段提取未命中为什么不报错？

**答：** 字段提取 `{name,email}` 的「未命中」是静默的——`Get` 返回 `(nil, nil)`，既无值也无错误。多字段提取只要有一个字段存在，就返回只含命中字段的对象。因此不能用 `err != nil` 判断提取是否命中，要检查返回值本身。另注意单字段与多字段提取的返回形状不同：`user{name}` 返回裸值，`user{id,name}` 返回对象。详见[语法陷阱](../getting-started/path-syntax#有哪些语法陷阱)。

## 键名包含点号或方括号怎么访问？

**答：** 点号可用反斜杠转义，也可改用 JSON Pointer；成对的花括号与方括号只能用 Pointer（`/` 开头的路径里，括号与点号都是键名的一部分）：

```go
data := `{"a.b": 1, "c[0]": 2, "e{f}": 3}`

json.GetInt(data, "a\\.b") // 1 — Go 字面量消费一层，路径解析器收到 a\.b
json.GetInt(data, "/a.b")  // 1 — Pointer 模式下点号是键名的一部分
json.GetInt(data, "/c[0]") // 2 — 成对方括号只能走 Pointer
json.GetInt(data, "/e{f}") // 3 — 成对花括号同理
```

`a[b]` 这类**括号内非数字**的键名任何路径语法都无法命中，只能遍历对象按键名取值。注意 Pointer 与点号语法不能混用；Pointer 的负索引语义与点号语法一致（`-1` 为末元素）；`Set` 经 Pointer 也不能扩容数组。详见[路径转义](../getting-started/path-syntax#路径转义)与 [JSON Pointer](../getting-started/path-syntax#json-pointer-rfc-6901)。

## 从标准库迁移要改多少代码？

**答：** 只需替换 import 路径：`"encoding/json"` → `"github.com/cybergodev/json"`，现有代码即可编译运行。`Marshal`/`Unmarshal`/`Compact` 等函数、`Encoder`/`Decoder` 方法与错误类型（`SyntaxError`、`UnmarshalTypeError` 等）一一兼容；额外的 `cfg ...Config` 参数都是可选的。需要留意的是默认输入安全校验带来的少量边界差异（见下一问）。迁移步骤与兼容清单见[从标准库迁移](../getting-started/migration)。

## Unmarshal 为什么拒绝了含 onload、eval( 的数据？

**答：** 这是默认输入校验在拦截注入模式：28 个内置危险模式（`<script`、`javascript:`、`eval(`、`onload` 等）默认拦截。确认输入可信后可以关闭默认模式集：

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true
err := json.Unmarshal(data, &v, cfg)
```

注意 `__proto__`、`constructor[`、`prototype.` 三个关键模式**始终拦截**。只想增补规则时用 `AdditionalDangerousPatterns`，不必关默认集。详见[与标准库的行为差异](../getting-started/migration#与标准库有哪些行为差异)。

## 超过 100MB 的文档被拒绝了怎么办？

**答：** 默认 `MaxJSONSize` 为 100MB，超出返回 `ErrSizeLimit`。两种途径：确实需要整体处理时调大 `cfg.MaxJSONSize`；更推荐改用流式处理——`NewStreamIterator` / `NewStreamObjectIterator` 逐元素读取，或 JSONL 系列逐行处理，避免整块载入内存。详见[大文件处理](../streaming/large-files)。

## 为什么到处都要 defer p.Close()？

**答：** `Processor` 内部持有缓存与后台清理 goroutine，`Close` 负责排空在途操作并释放这些资源；高频创建却不关闭会持续累积（缓存内存不释放、goroutine 泄漏）。包级函数使用全局处理器托管生命周期，无需也不应手动 `Close`。做法是**创建一次、全组共享、最后 Close 一次**，详见[生命周期管理](../getting-started/processor-guide#生命周期管理)。

## Processor 可以跨 goroutine 共享吗？

**答：** 可以。`Processor` 是线程安全的，所有公开方法内部已做并发保护；`PreParse` 返回的 `*ParsedJSON` 也可被并发读取。注意两点：`MaxConcurrency`（默认 50）是软并发上限，在途操作超限时新操作**立即失败**并返回 `ErrConcurrencyLimit`（可重试），高并发服务按需调大；不要跨 goroutine 共享改写 `Get` 返回的可变容器。详见[并发与并行处理](../advanced/concurrency)。

## 缓存什么时候需要手动清理？

**答：** 几乎不用。`Set`/`Delete` 等写操作会**自动失效**关联缓存条目（按文档哈希清除该文档的全部条目）。只有两种情况需要手动 `ClearCache`：外部数据源变化（同一 JSON 内容被原地替换），或内存压力大。监控命中率用 `GetStats()`——低于 0.5 时检查工作负载或调整 `CacheTTL`/`MaxCacheSize`。详见[缓存与预解析](../advanced/caching)。

## PreParse 和 CompilePath 有什么区别？

**答：** 两者是独立的优化维度：`PreParse` + `GetFromParsed` 省去**重复解析 JSON 文档**的开销，适合「同一份 JSON 查询多个不同路径」；`CompilePath` + `GetCompiled` 省去**重复解析路径表达式**的开销，适合「同一路径作用于大量不同 JSON」的热路径。注意 `GetCompiled` 目前只有查询变体，`Set`/`Delete` 暂不支持预编译路径；预解析侧的修改可走 `SetFromParsed`。详见[Processor 入门](../getting-started/processor-guide#什么时候用-processor)。

## 更多资源

- [快速开始](../getting-started/) — 5 分钟上手核心功能
- [常见第一小时问题](../getting-started/#常见第一小时问题) — 高频疑问集中解答
- [路径表达式语法](../getting-started/path-syntax) — 完整路径语法与陷阱
- [错误处理](../advanced/error-handling) — 哨兵错误分类与定位
- [性能优化](../advanced/performance) — 基准测试与优化决策路径

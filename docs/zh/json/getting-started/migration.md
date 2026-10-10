---
title: "从标准库迁移 - CyberGo JSON | encoding/json 兼容指南"
description: "从标准库 encoding/json 迁移到 CyberGo JSON：三步完成、只改 import 即可编译，Marshal/Encoder/Decoder 方法与错误类型兼容清单逐项核对，附默认安全校验行为差异表、迁移 FAQ 与增量能力使用指南。"
sidebar_label: "从标准库迁移"
sidebar_position: 60
---

# 从标准库迁移

`cybergodev/json` 与标准库 `encoding/json` **100% 兼容**——只需替换 import 路径，现有代码无需任何改动即可编译运行（默认输入安全校验带来的少量边界差异见下文[行为差异](#行为差异)）。本页帮助你完成迁移，并了解迁移后可用的增量能力。

## 三步迁移

1. **安装**：

   ```bash
   go get github.com/cybergodev/json
   ```

2. **替换 import**：将 `"encoding/json"` 替换为 `"github.com/cybergodev/json"`。

   ```go
   // 迁移前
   import "encoding/json"

   // 迁移后
   import "github.com/cybergodev/json"
   ```

3. **完成**：编译通过，所有现有代码无需修改。

## 完全兼容的 API

下表列出 `encoding/json` 与 `cybergodev/json` 的对应关系：

| encoding/json | cybergodev/json | 说明 |
|---|---|---|
| `Marshal(v)` | `Marshal(v, cfg...)` | 签名兼容，额外可选 cfg 参数 |
| `Unmarshal(data, &v)` | `Unmarshal(data, &v, cfg...)` | 同上 |
| `MarshalIndent(v, prefix, indent)` | 同名 | 完全兼容 |
| `Compact(dst, src)` | 同名 | 完全兼容 |
| `Indent(dst, src, prefix, indent)` | 同名 | 完全兼容 |
| `HTMLEscape(dst, src)` | 同名 | 完全兼容 |
| `Valid(data)` | `Valid(data, cfg...)` | 签名兼容 |
| `NewEncoder(w)` | `NewEncoder(w, cfg...)` | 签名兼容 |
| `NewDecoder(r)` | `NewDecoder(r, cfg...)` | 签名兼容 |
| `Number` | `Number` | 类型兼容（`String`/`Int64`/`Float64`/`MarshalJSON` 全保留） |
| `Delim` | `Delim` | 类型兼容（`String()` 保留） |
| `Token` | `Token` | 类型兼容 |

`Encoder` 与 `Decoder` 的**方法级**兼容同样完整——迁移后流式代码无需任何修改：

| 方法 | 所属 | 兼容性 |
|---|---|---|
| `Encode(v)` / `SetIndent(prefix, indent)` / `SetEscapeHTML(on)` | `*Encoder` | 完全兼容 |
| `Decode(v)` / `Token()` / `More()` / `Buffered()` / `InputOffset()` | `*Decoder` | 完全兼容 |
| `UseNumber()` / `DisallowUnknownFields()` | `*Decoder` | 完全兼容 |

错误类型也一一对应，依赖 `errors.As` / 类型断言的代码可直接工作：`SyntaxError`、`UnmarshalTypeError`、`InvalidUnmarshalError`、`MarshalerError`、`UnsupportedTypeError`、`UnsupportedValueError` 均存在且行为一致（详见[错误类型](../api-reference/constants#错误变量)）。

错误结构体的**定位字段**也逐一保留，依赖字段做出错定位或分类统计的代码无需修改：

| 类型 | 字段 | 类型 | 说明 |
|------|------|------|------|
| `SyntaxError` | `Offset` | `int64` | 发生错误前已读取的字节数 |
| `UnmarshalTypeError` | `Offset` | `int64` | 发生错误前已读取的字节数 |
| `UnmarshalTypeError` | `Struct` | `string` | 包含出错字段的根类型名 |
| `UnmarshalTypeError` | `Field` | `string` | 从根节点到出错值的完整路径 |
| `UnsupportedValueError` | `Str` | `string` | 不支持值的文本表示（如 NaN、+Inf） |

`UnmarshalTypeError` 的 `Struct` / `Field` 非空时，`Error()` 输出 `json: cannot unmarshal <value> into Go struct field <Struct>.<Field> of type <type>`，与标准库逐字一致。

::: tip 可选的 cfg 参数
所有额外的 `cfg ...Config` 参数都是**可选的**（variadic）。不传时，对常规数据的行为与标准库一致（默认输入校验的边界差异见下文[行为差异](#行为差异)）；需要启用安全模式、缓存等增强能力时才传入。

关于 cfg 的三个**有意例外**（源自库的设计约定）：

- **类型化读取函数**（`GetTyped`、`GetString`、`GetInt` 等）的可变参是**默认值**而非 cfg——Go 只允许一个可变参。需要配置化的类型读取时，改用 `SafeGet` 或 `New(cfg)` 创建的 Processor 上的类型化读取方法（如 `GetString`、`GetInt`）。
- **便捷变体**（`SetCreate`、`SetMultipleCreate`、`DeleteClean`）等价于强制开启 `CreatePaths`（或 `CleanupNulls` + `CompactArrays`）标志的普通版本。
- `Valid` 返回单个 `bool`（标准库签名）；需要失败原因时用 `ValidWithConfig`（返回 `bool, error`）。
:::

## 代码示例：只改 import

下面的示例展示「只改 import」的替换效果，编码、解码与结构体标签（struct tag）用法与 `encoding/json` 完全相同：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	type User struct {
		Name string   `json:"name"`
		Age  int      `json:"age"`
		Tags []string `json:"tags"`
	}

	// 编码 — 与 encoding/json 完全相同
	user := User{Name: "Alice", Age: 30, Tags: []string{"go", "json"}}
	b, err := json.Marshal(user)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b))
	// 输出：{"name":"Alice","age":30,"tags":["go","json"]}

	// 解码 — 与 encoding/json 完全相同
	var u User
	if err := json.Unmarshal(b, &u); err != nil {
		panic(err)
	}
	fmt.Printf("%+v\n", u)
	// 输出：{Name:Alice Age:30 Tags:[go json]}
}
```

## 增量能力

迁移后，你在保持标准库兼容的同时，还能按需使用以下标准库做不到的能力：

| 能力 | 示例 | 了解更多 |
|---|---|---|
| 路径查询 | `json.GetString(data, "user.name")` | [路径表达式语法](./path-syntax) |
| 带默认值获取 | `json.GetInt(data, "timeout", 30)` | [查询获取](../api-reference/functions/query) |
| 泛型获取 | `json.GetTyped[User](data, "user")` | [泛型操作](../api-reference/generics) |
| 路径修改 | `json.Set(data, "user.name", "Bob")` | [修改操作](../api-reference/functions/modify) |
| Schema 验证 | `json.ValidateSchema(data, schema)` | [Schema 校验](../api-reference/schema) |
| 流式 JSONL | `json.StreamLinesInto[T](r, fn)` | [JSONL 处理](../streaming/jsonl) |
| 高性能处理器 | `p, _ := json.New()` | [Processor 入门](./processor-guide) |
| 预解析/路径预编译 | `p.PreParse` / `p.CompilePath` | [Processor 入门](./processor-guide) |
| 并发迭代 | `json.NewParallelIterator(items).ForEach(fn)` | [并发处理](../advanced/concurrency) |
| 上下文取消 | `json.GetWithContext(ctx, data, path)` | [查询获取](../api-reference/functions/query) |
| JSON 深度比较 | `json.CompareJSON(a, b)` | [辅助工具](../api-reference/helpers) |
| 钩子/审计/计时 | `p.AddHook(json.LoggingHook(logger))` | [Hook 钩子系统](../extensions/hooks) |
| 安全模式 | `json.SecurityConfig()` | [安全模式](../security/security-mode) |
| 运行统计/健康检查 | `json.GetStats()` / `json.GetHealthStatus()` | [Processor 入门](./processor-guide#监控与诊断) |

## 行为差异

对**常规数据**，默认配置下的行为与 `encoding/json` 一致。需要留意的是：`cybergodev/json` 默认就带一层**输入安全校验**（这是它作为安全 JSON 库的定位），对超限或含危险模式的输入会拒绝，而标准库照单全收。差异集中在下表：

| 差异点 | encoding/json | CyberGo 默认行为 | 需要不同行为时 |
|---|---|---|---|
| 输入大小 | 无限制 | 超过 100MB（`MaxJSONSize`）返回 `ErrSizeLimit` | 调大 `cfg.MaxJSONSize` |
| 嵌套深度 | 无显式限制 | 超过 200 层返回 `ErrDepthLimit` | 调整 `MaxNestingDepthSecurity` |
| 危险内容模式 | 不检查 | 28 个内置模式默认拦截（`__proto__`、`<script`、`javascript:`、`eval(`、`onload` 等），返回 `ErrSecurityViolation` | 确认可信后设 `cfg.DisableDefaultPatterns = true`（`__proto__` 等关键模式仍拦截） |
| 容器宽度 | 无限制 | 单对象 ≤ 10 万键、单数组 ≤ 10 万元素 | 调整 `MaxObjectKeys` / `MaxArrayElements` |
| 无效 UTF-8 | 解码时替换为 U+FFFD | 直接拒绝（`ErrInvalidJSON`） | 预先修复输入编码 |
| BOM 前缀 | 语法错误 | 拒绝（`ErrInvalidJSON`） | 预处理去掉 BOM |

两类容易误解的点：

1. **错误信息更丰富**：路径操作失败时返回的 `JsonsError` 会携带操作名、路径与底层原因（支持 `errors.Is`/`errors.As` 与 `Unwrap`），但**不会**改变标准库兼容函数（`Unmarshal`/`Decode` 等）的错误类型——它们仍返回 `SyntaxError`、`UnmarshalTypeError` 等标准形态。
2. **校验只作用于输入**：上述限制针对 JSON 文本输入（`Unmarshal`、`Get`、`Parse`、`Valid` 等）；`Marshal`/`Encode` 编码 Go 值不做内容校验。

处理不可信输入时，建议直接用 `json.SecurityConfig()` 预设（更紧的限制 + 完整扫描），详见[安全模式](../security/security-mode)。

## 迁移 FAQ

**Q：`json.Number` 的大数精度行为有变化吗？**

没有。`Decoder.UseNumber()` 与标准库一致；`Number.Int64()`/`Float64()` 行为不变。需要保留原始数字文本时照常用 `json.Number`。

**Q：HTML 转义默认行为一致吗？**

一致。`Marshal`/`Encode` 默认转义 `<`、`>`、`&`（与标准库相同），`Encoder.SetEscapeHTML(false)` 可关闭——行为与签名均兼容。

**Q：现有代码用 `json.Marshaler`/`json.Unmarshaler` 自定义类型呢？**

完全兼容。两个接口照常生效，实现它们的自定义类型在编码/解码路径上行为一致。

**Q：可以只在新代码里用增量能力、旧代码保持不动吗？**

可以，这正是设计目标。包级函数按「尾参 cfg」缓存对应的 Processor（见上文 cfg 约定），不传 cfg 的调用走默认配置的全局处理器——对常规数据与标准库一致，默认输入校验的差异见上文[行为差异](#行为差异)表。

**Q：`Unmarshal` 拒绝了含 `onload`、`eval(` 等字样的合法数据，怎么办？**

这是默认输入校验在拦截注入模式。确认输入可信后可以关闭默认模式集：

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true
err := json.Unmarshal(data, &v, cfg)
```

注意 `__proto__`、`constructor[`、`prototype.` 三个关键模式**始终拦截**，不受该开关影响。只想增补规则时，用 `AdditionalDangerousPatterns` 添加自定义模式即可，不必关默认集。

**Q：大于 100MB 的文档被 `ErrSizeLimit` 拒绝了，怎么处理？**

两种途径：确实需要整体处理时调大 `cfg.MaxJSONSize`；更推荐改用流式处理（`NewStreamIterator` / `NewStreamObjectIterator` 逐元素读取，或 JSONL 系列逐行处理），避免整块载入内存，详见[大文件处理](../streaming/large-files)。

## 下一步

- [快速开始](./) — 5 分钟上手核心功能
- [路径表达式语法](./path-syntax) — 学习路径查询语法
- [速查表](./cheatsheet) — API 快速参考

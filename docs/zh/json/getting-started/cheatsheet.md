---
sidebar_label: "速查表"
title: "速查表 - CyberGo JSON | 常用函数与代码示例"
description: "CyberGo JSON API 速查表：包级函数全覆盖——路径查询、Set/Delete 修改、批量操作、序列化与格式化、文件读写、验证、迭代流式 JSONL、缓存安全扩展，附读文件改字段写回等高频组合模式与 Processor 用法，一页快速查阅。"
sidebar_position: 50
---

# 速查表

快速查找常用 API 和代码片段。

## 路径查询

| 操作 | 函数 | 示例 |
|------|------|------|
| 获取字符串 | `GetString` | `json.GetString(data, "user.name")` |
| 获取整数 | `GetInt` | `json.GetInt(data, "count")` |
| 获取浮点数 | `GetFloat` | `json.GetFloat(data, "price")` |
| 获取布尔值 | `GetBool` | `json.GetBool(data, "enabled")` |
| 获取数组 | `GetArray` | `json.GetArray(data, "items")` |
| 获取对象 | `GetObject` | `json.GetObject(data, "user")` |
| 获取任意值 | `Get` | `json.Get(data, "items[0].id")` |
| 泛型获取 | `GetTyped[T]` | `json.GetTyped[User](data, "user")` |
| 安全获取（无 panic） | `SafeGet` | `json.SafeGet(data, "user.age")` |
| 批量获取 | `GetMultiple` | `json.GetMultiple(data, []string{"a", "b"})` |
| 带取消的获取 | `GetWithContext` | `json.GetWithContext(ctx, data, "user.name")` |

### 带默认值

`GetString`、`GetInt`、`GetFloat`、`GetBool` 等函数支持传入可选的默认值参数：

| 操作 | 函数 | 示例 |
|------|------|------|
| 字符串 | `GetString` | `json.GetString(data, "name", "unknown")` |
| 整数 | `GetInt` | `json.GetInt(data, "count", 0)` |
| 浮点数 | `GetFloat` | `json.GetFloat(data, "rate", 0.5)` |
| 布尔值 | `GetBool` | `json.GetBool(data, "debug", false)` |

## 修改操作

| 操作 | 函数 | 示例 |
|------|------|------|
| 设置值 | `Set` | `json.Set(data, "user.name", "Alice")` |
| 批量设置 | `SetMultiple` | `json.SetMultiple(data, map[string]any{"a": 1, "b": 2})` |
| 创建路径设置 | `SetCreate` | `json.SetCreate(data, "a.b.c", 1)` |
| 批量创建路径设置 | `SetMultipleCreate` | `json.SetMultipleCreate(data, updates)` |
| 删除值 | `Delete` | `json.Delete(data, "user.temporary")` |
| 删除并清理 | `DeleteClean` | `json.DeleteClean(data, "user.temporary")` |

```go
// 设置值
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
// {"user":{"name":"Alice"}}

// 逐个设置多个字段
result, err = json.Set(data, "user.name", "Bob")
result, err = json.Set(result, "user.age", 25)

// 删除
result, err = json.Delete(data, "user.temporary")
```

### 批量操作（一次调用多种操作）

```go
data := `{"user":{"name":"Alice","temp":true}}`

results, err := json.ProcessBatch([]json.BatchOperation{
    {ID: "n", Type: "get", JSONStr: data, Path: "user.name"},
    {ID: "a", Type: "set", JSONStr: data, Path: "user.age", Value: 30},
    {ID: "d", Type: "delete", JSONStr: data, Path: "user.temp"},
    {ID: "v", Type: "validate", JSONStr: data},
})
if err != nil {
    panic(err)
}
for _, r := range results {
    fmt.Println(r.ID, r.Result, r.Error)
}
```

::: tip
`BatchOperation.Type` 支持 `get` / `set` / `delete` / `validate` 四种，每条操作通过 `JSONStr` 携带数据；`BatchResult` 按 `ID` 对应返回 `Result` 与 `Error`。详见[批量操作](../api-reference/functions/batch)。
:::

## 序列化与编码

| 操作 | 函数 | 示例 |
|------|------|------|
| 编码（`[]byte` 输出） | `Marshal` | `json.Marshal(data)` |
| 编码（`string` 输出） | `Encode` | `json.Encode(data)` |
| 格式化编码（`[]byte`） | `MarshalIndent` | `json.MarshalIndent(data, "", "  ")` |
| 格式化编码（`string`） | `EncodePretty` | `json.EncodePretty(data)` |
| 解码 | `Unmarshal` | `json.Unmarshal(bytes, &v)` |
| 解析 | `Parse` | `var v T; json.Parse(jsonStr, &v)` |
| 解析到 any | `ParseAny` | `json.ParseAny(jsonStr)` |
| 美化 JSON 文本 | `Prettify` | `json.Prettify(jsonStr)` |
| 压缩 JSON 文本（buffer） | `Compact` | `json.Compact(&buf, []byte(data))` |
| 压缩 JSON 文本（string） | `CompactString` | `json.CompactString(jsonStr)` |
| 重排缩进 | `Indent` | `json.Indent(&buf, src, "", "  ")` |
| HTML 转义 | `HTMLEscape` | `json.HTMLEscape(&buf, src)` |
| 键值对编码为对象 | `EncodeBatch` | `json.EncodeBatch(map[string]any{"a": 1})` |
| 提取字段编码 | `EncodeFields` | `json.EncodeFields(user, []string{"name"})` |
| 值列表编码为数组 | `EncodeStream` | `json.EncodeStream([]any{1, 2})` |

`json.EncodeWithConfig` 已废弃（与 `Encode` 等价，v1 生命周期内保留），新代码请改用 `Encode` 或 `Marshal`。格式化函数的详细选型见[格式化输出](./print)。

```go
// 编码
b, err := json.Marshal(map[string]any{"name": "test"})

// 格式化输出
pretty, err := json.MarshalIndent(data, "", "  ")

// 解析到结构体
var result map[string]any
err = json.Parse(`{"name": "test"}`, &result)

// 解析到 any
parsed, err := json.ParseAny(`{"name": "test"}`)

// 格式化 JSON 字符串
pretty, err = json.Prettify(`{"name":"Alice","age":30}`)
```

## 文件读写

| 操作 | 函数 | 示例 |
|------|------|------|
| 读 JSON 文件为文本 | `LoadFromFile` | `json.LoadFromFile("config.json")` |
| 读任意 Reader | `LoadFromReader` | `json.LoadFromReader(resp.Body)` |
| 写值到文件 | `SaveToFile` | `json.SaveToFile("out.json", data)` |
| 编码并写文件 | `MarshalToFile` | `json.MarshalToFile("out.json", v)` |
| 读文件并解码 | `UnmarshalFromFile` | `json.UnmarshalFromFile("in.json", &v)` |
| 写值到 Writer | `SaveToWriter` | `json.SaveToWriter(w, data)` |

```go
// 读取并查询
data, err := json.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
env := json.GetString(data, "env", "dev")

// 结构体一步到位
var cfg Config
if err := json.UnmarshalFromFile("config.json", &cfg); err != nil {
    panic(err)
}
```

::: tip
文件路径经过安全校验（拒绝目录穿越与符号链接攻击），不可信路径也会被拦截。详见[文件操作](../api-reference/functions/file-io)。
:::

## 验证

| 操作 | 函数 | 示例 |
|------|------|------|
| 快速验证 | `Valid` | `json.Valid([]byte(data))` |
| 验证并取原因 | `ValidWithConfig` | `json.ValidWithConfig(data)` |
| Schema 验证 | `ValidateSchema` | `json.ValidateSchema(data, schema)` |

```go
// 快速验证
if json.Valid([]byte(data)) {
    // 有效 JSON
}

// 需要失败原因时
ok, err := json.ValidWithConfig(data)
if !ok {
    fmt.Println("无效 JSON:", err)
}

// Schema 验证
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name"},
    Properties: map[string]*json.Schema{
        "name": {Type: "string"},
        "age":  {Type: "number"},
    },
}
p, err := json.New()
if err != nil {
    panic(err)
}
errors, _ := p.ValidateSchema(data, schema)
```

## 工具函数

| 操作 | 函数 | 示例 |
|------|------|------|
| 比较 | `CompareJSON` | `json.CompareJSON(a, b)` |
| 合并 | `MergeJSON` | `json.MergeJSON(a, b)` |
| 多个合并 | `MergeMany` | `json.MergeMany([]string{s1, s2, s3})` |

```go
// 比较（忽略键顺序和数字精度）
equal, _ := json.CompareJSON(`{"a":1.0,"b":2}`, `{"b":2,"a":1}`)
fmt.Println("Equal:", equal) // true（忽略顺序和精度）

// 合并 JSON
base := `{"database":{"host":"localhost","port":5432},"debug":false}`
override := `{"database":{"host":"prod-server","ssl":true},"monitoring":true}`

// 合并
merged, _ := json.MergeJSON(base, override)
// 结果：{"database":{"host":"prod-server","port":5432,"ssl":true},"debug":false,"monitoring":true}

// 多个合并
result, _ := json.MergeMany([]string{
    `{"a":1}`,
    `{"b":2}`,
    `{"c":3}`,
})
```

## Processor 方法

```go
// 创建处理器
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// 获取值
result := processor.GetString(data, "user.profile.name")

// 安全获取（返回 AccessResult）
accessResult := processor.SafeGet(data, "user.age")
age, err := accessResult.AsInt()
```

### 带配置创建

```go
// 默认配置
processor, err := json.New(json.DefaultConfig())

// 安全配置（处理不可信输入）
processor, err = json.New(json.SecurityConfig())

// 自定义配置
cfg := json.DefaultConfig()
cfg.CreatePaths = true
processor, err = json.New(cfg)
```

## 流式处理

### 迭代函数族

| 操作 | 函数 | 特点 |
|------|------|------|
| 遍历数组/对象 | `ForeachWithError` | 推荐：回调返回 `error` / `item.Break()`（`Foreach` 已废弃：静默丢弃错误） |
| 遍历并可中断 | `ForeachWithError` | 回调返回 `error` / `item.Break()` |
| 指定路径遍历 | `ForeachWithPath` | 显式路径版（返回 `error`） |
| 深度遍历嵌套 | `ForeachNestedWithError` | 推荐：递归所有层级并返回 `error`（`ForeachNested` 已废弃：静默丢弃错误） |
| 深度遍历并可中断 | `ForeachNestedWithError` | `ForeachNested` 的错误返回版 |
| 遍历并改写 | `ForeachReturn` | 返回修改后的新 JSON |
| 携带当前路径 | `ForeachWithPathAndIterator` | 回调含 `currentPath`，可控制中断 |
| 原始值遍历控制 | `ForeachWithPathAndControl` | 回调收到原始值，用 `IteratorControl` 控制流程 |
| 遍历大文件 | `ForeachFile` | 整载内存后逐条遍历（恒定内存用 StreamIterator） |
| 按路径遍历文件 | `ForeachFileWithPath` | 遍历文件内指定路径的集合（文件仍整载内存） |
| 分块遍历文件 | `ForeachFileChunked` | 按 `chunkSize` 批量回调（文件仍整载内存） |
| 递归遍历文件 | `ForeachFileNested` | 递归文件内所有嵌套结构（文件仍整载内存） |

以上共 12 个迭代函数（含已废弃的 `Foreach`/`ForeachNested` 两个 void 变体）：前 8 个作用于内存中的 JSON 字符串，后 4 个（`ForeachFile*`）作用于文件（先整载再迭代，受 `MaxJSONSize` 上限约束）。

```go
data := `{"users":[{"name":"Alice"},{"name":"Bob"}]}`

// 简单遍历
err := json.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
    fmt.Println(key, item.GetString("name"))
})

// 需要提前终止时用 WithError 变体（返回 item.Break() 即中断）
err = json.ForeachWithError(data, "users", func(key any, item *json.IterableValue) error {
    if item.GetString("name") == "Bob" {
        return item.Break() // 停止迭代
    }
    return nil
})
```

### 并发处理（ParallelIterator）

```go
items, _ := json.GetArray(`[1,2,3,4,5,6]`, ".")
it := json.NewParallelIterator(items)

// 并行映射
doubled, err := it.Map(func(i int, v any) (any, error) {
    return v.(float64) * 2, nil
})

// 并行过滤 / 遍历（自动分批）
_ = it.Filter(func(i int, v any) bool { return v.(float64) > 2 })
_ = it.ForEach(func(i int, v any) error { return nil })
```

### 流式迭代器（StreamIterator / StreamObjectIterator）

```go
f, _ := os.Open("huge.json")
defer f.Close()

// 大数组流式逐元素处理
it, err := json.NewStreamIterator(f)
if err != nil {
    panic(err)
}
for it.Next() {
    val := it.Value() // 逐元素处理，内存占用恒定
    _ = val
    _ = it.Index()
}
if err := it.Err(); err != nil {
    panic(err) // 流中出现的解析错误
}

// 大对象流式逐键处理
oit, err := json.NewStreamObjectIterator(f)
for oit.Next() {
    fmt.Println(oit.Key(), oit.Value())
}
```

### Processor.ForeachFile（大文件）

```go
// 处理大文件
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    // 处理数据项
    id := item.GetInt("id")
    name := item.GetString("name")
    return nil // 返回 item.Break() 可中断
})
```

### NDJSON/JSONL

```go
// 解析 JSONL
results, err := json.ParseJSONL(jsonlBytes)

// 泛型解析（使用 StreamLinesInto）
file, _ := os.Open("data.jsonl")
defer file.Close()
users, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
})

// 流式写入
outputFile, _ := os.Create("output.jsonl")
defer outputFile.Close()
writer := json.NewJSONLWriter(outputFile)
_ = writer.Write(map[string]any{"name": "Alice"})
_ = writer.Write(map[string]any{"name": "Bob"})

// 多 worker 并行逐行处理
err = json.StreamJSONLParallel(file, 4, func(lineNum int, item *json.IterableValue) error {
    return nil
})

// 流式逐行处理文件（带行号，item.GetData() 取该行解析值）
err = json.StreamJSONLFile("events.ndjson", func(lineNum int, item *json.IterableValue) error {
    row, _ := item.GetData().(map[string]any)
    _ = row // 逐行处理
    return nil
})
```

## 配置选项

```go
// 推荐方式：基于默认配置修改
cfg := json.DefaultConfig()
cfg.MaxJSONSize = 50 * 1024 * 1024 // 自定义大小限制（校验范围 1MB–100MB，超出会被钳回 100MB）
cfg.FullSecurityScan = true        // 启用完整安全扫描
```

### 配置预设

```go
// 默认配置
cfg := json.DefaultConfig()

// 安全配置（处理不可信输入）
// cfg = json.SecurityConfig()

// 格式化配置
// cfg = json.PrettyConfig()
```

## 路径语法

| 语法 | 说明 | 示例 |
|------|------|------|
| `.property` | 属性访问 | `user.name` |
| `[n]` | 数组索引 | `items[0]` |
| `[*]` | 通配符 | `items[*].id` |
| `[start:end]` | 切片 | `items[0:5]` |
| `[start:end:step]` | 带步长切片 | `items[0:10:2]` |
| `{field1,field2}` | 字段提取 | `user{name,email}` |
| `{flat:field}` | 扁平化提取 | `groups{flat:tags}` |
| `[+]` | 追加 | `items[+]` |
| `[-1]` | 负索引（末尾） | `items[-1]` |
| `/key/key` | JSON Pointer（RFC 6901） | `/user/name` |

## 常见模式

### 安全获取嵌套值

```go
// 使用带默认值的获取函数
name := json.GetString(data, "user.profile.name", "unknown")

// 需要区分错误类型时使用 Get
val, err := json.Get(data, "user.profile.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // 键不存在
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // JSON 格式错误
    }
    // 其余错误（类型冲突、超限）为携带上下文的 JsonsError，直接记录即可
}
```

### 带默认值获取

```go
// GetString/GetInt 等函数支持可选默认值参数
timeout := json.GetInt(data, "timeout", 30)
debug := json.GetBool(data, "debug", false)
name := json.GetString(data, "user.nickname", "unknown")
```

### 类型断言

```go
val, _ := json.Get(data, "value")
switch v := val.(type) {
case string:
    fmt.Println("字符串：", v)
case float64:
    fmt.Println("数字：", v)
case bool:
    fmt.Println("布尔：", v)
case []any:
    fmt.Println("数组：", len(v), "个元素")
case map[string]any:
    fmt.Println("对象：", len(v), "个键")
}
```

### 读文件 → 改字段 → 写回

`Set` 返回新字符串，`SaveToFile` 收到 JSON 字符串会先解析再编码（不会二次加引号），配合 `PrettyConfig` 可以保持文件可读：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data, err := json.LoadFromFile("config.json")
	if err != nil {
		panic(err)
	}

	updated, err := json.Set(data, "server.port", 8080)
	if err != nil {
		panic(err)
	}

	if err := json.SaveToFile("config.json", updated, json.PrettyConfig()); err != nil {
		panic(err)
	}
	fmt.Println("已更新")
}
```

### API 响应批量取字段

只要一个字段用通配符收集，多个不同路径用 `GetMultiple`（只解析一次）：

```go
resp := `{"code":0,"data":{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}}`

// 只要一个字段：通配符收集
names, _ := json.GetArray(resp, "data.users[*].name") // ["Alice", "Bob"]

// 多个不同路径：一次解析、批量取值
vals, err := json.GetMultiple(resp, []string{"code", "data.users[0].id"})
if err != nil {
	panic(err)
}
fmt.Println(names, vals["data.users[0].id"]) // [Alice Bob] 1
```

### 逐元素改写（ForeachReturn）

回调里通过 `item.GetData()` 拿到工作副本的引用，改 map/slice 的内容会反映到返回的新 JSON（`ForeachReturn` 迭代的是根容器）：

```go
data := `[{"name":"Alice","active":false},{"name":"Bob","active":false}]`

updated, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
	m, ok := item.GetData().(map[string]any)
	if !ok {
		return
	}
	m["active"] = true
})
if err != nil {
	panic(err)
}
// 两个元素的 active 都变为 true（输出字段顺序可能与原文不同）
```

::: tip 标量不能就地替换
`GetData()` 引用替换适合改 map 字段、数组元素；整元素是标量时无法通过 IterableValue 就地替换，改用 `Set(data, "items[*]", v)` 或逐条 `Set`。
:::

### 配置合并

```go
// 默认配置 + 用户配置
defaults := `{"timeout": 30, "retries": 3}`
userConfig := `{"timeout": 60, "debug": true}`

merged, _ := json.MergeJSON(defaults, userConfig)
// {"timeout": 60, "retries": 3, "debug": true}
```

### 错误处理

```go
val, err := json.Get(data, path)
if err != nil {
    // 常见哨兵：键不存在 / JSON 格式错误 / 超大小限 / 超嵌套深度
    //（类型冲突返回描述性 JsonsError，不匹配 ErrTypeMismatch 哨兵）
    switch {
    case errors.Is(err, json.ErrPathNotFound):
    case errors.Is(err, json.ErrInvalidJSON):
    case errors.Is(err, json.ErrSizeLimit):
    case errors.Is(err, json.ErrDepthLimit):
    default:
        // 记录完整错误（含操作名与路径）
        fmt.Println(err)
    }

    // 面向客户端返回时用 SafeError 脱敏，避免泄露路径与内部细节
    _ = json.SafeError(err)
}
```

## 缓存管理

```go
// 预热缓存
paths := []string{"user.name", "user.email", "items[*].id"}
result, _ := json.WarmupCache(data, paths)
fmt.Printf("预热成功：%d/%d\n", result.Successful, result.TotalPaths)

// 清除缓存
json.ClearCache()

// 获取统计
stats := json.GetStats()
fmt.Printf("缓存命中率：%.2f%%\n", stats.HitRatio * 100)

// 健康检查（逐项检查缓存、内存等）
health := json.GetHealthStatus()
fmt.Println("健康：", health.Healthy)
```

## 全局处理器

```go
// 设置自定义全局处理器
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
json.SetGlobalProcessor(p)

// 之后所有包级函数都使用这个处理器
name := json.GetString(data, "user.name")

// 应用退出时清理
defer json.ShutdownGlobalProcessor()
```

## 安全与扩展

```go
// 危险模式管理（默认拦截 <script>、javascript: 等）
for _, p := range json.ListDangerousPatterns() {
    fmt.Println(p.Pattern, p.Level) // Pattern 为子串匹配，Level 为级别
}

// 注册自定义模式（子串匹配，三级处理策略）：
//   PatternLevelCritical 总是阻断 / Warning 严格模式阻断 / Info 仅记录
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "禁用 eval 调用",
    Level:   json.PatternLevelCritical,
})

// 按 Pattern 字符串注销
json.UnregisterDangerousPattern("eval(")

// 钩子工厂：日志 / 计时 / 错误转换 / 输入校验
p, _ := json.New()
p.AddHook(json.LoggingHook(slog.Default()))
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    return fmt.Errorf("op %s: %w", ctx.Operation, err)
}))
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    return nil // 返回非 nil 拒绝本次输入
}))

// Config 链式方法
cfg := json.SecurityConfig()
cfg.AddHook(json.LoggingHook(slog.Default()))
cfg.AddDangerousPattern(json.DangerousPattern{Pattern: "exec("})
if err := cfg.Validate(); err != nil {
    panic(err) // 配置自检，越界值提前暴露
}
clone := cfg.Clone() // 深拷贝，安全共享
```

## 相关

- [包函数](../api-reference/functions/) - 完整 API 参考
- [辅助函数](../api-reference/helpers) - 类型转换工具
- [Processor](../api-reference/processor/) - 处理器方法
- [配置](../api-reference/config) - 配置选项
- [类型定义](../api-reference/types) - AccessResult、Schema 等

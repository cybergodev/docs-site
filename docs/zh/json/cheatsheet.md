---
title: "速查表 - CyberGo JSON | API 快速参考"
description: "CyberGo JSON API 速查表：覆盖 GetString/GetInt 路径查询、Set/Delete 修改、Marshal/Unmarshal 序列化、配置选项、迭代器与安全函数，便于 Go 开发者快速查阅。"
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

## 序列化

| 操作 | 函数 | 示例 |
|------|------|------|
| 编码 | `Marshal` | `json.Marshal(data)` |
| 格式化编码 | `MarshalIndent` | `json.MarshalIndent(data, "", "  ")` |
| 解码 | `Unmarshal` | `json.Unmarshal(bytes, &v)` |
| 解析 | `Parse` | `var v T; json.Parse(jsonStr, &v)` |
| 解析到any | `ParseAny` | `json.ParseAny(jsonStr)` |
| 格式化 | `Prettify` | `json.Prettify(jsonStr)` |
| 压缩 | `Compact` | `json.Compact(&buf, []byte(data))` |

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

## 验证

| 操作 | 函数 | 示例 |
|------|------|------|
| 快速验证 | `Valid` | `json.Valid([]byte(data))` |

```go
// 快速验证
if json.Valid([]byte(data)) {
    // 有效 JSON
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
// 结果: {"database":{"host":"prod-server","port":5432,"ssl":true},"debug":false,"monitoring":true}

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
```

## 配置选项

```go
// 推荐方式：基于默认配置修改
cfg := json.DefaultConfig()
cfg.MaxJSONSize = 200 * 1024 * 1024 // 自定义大小限制
cfg.FullSecurityScan = true          // 启用完整安全扫描
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
| `[+]` | 追加 | `items[+]` |
| `[-1]` | 负索引（末尾） | `items[-1]` |

## 常见模式

### 安全获取嵌套值

```go
// 使用带默认值的获取函数
name := json.GetString(data, "user.profile.name", "unknown")

// 需要区分错误类型时使用 Get
val, err := json.Get(data, "user.profile.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // 路径不存在
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // 类型不匹配
    }
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
    fmt.Println("字符串:", v)
case float64:
    fmt.Println("数字:", v)
case bool:
    fmt.Println("布尔:", v)
case []any:
    fmt.Println("数组:", len(v), "个元素")
case map[string]any:
    fmt.Println("对象:", len(v), "个键")
}
```

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
    // 检查错误类型
    if errors.Is(err, json.ErrPathNotFound) {
        // 路径不存在
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // JSON 格式错误
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // 类型不匹配
    }
}
```

## 缓存管理

```go
// 预热缓存
paths := []string{"user.name", "user.email", "items[*].id"}
result, _ := json.WarmupCache(data, paths)
fmt.Printf("预热成功: %d/%d\n", result.Successful, result.TotalPaths)

// 清除缓存
json.ClearCache()

// 获取统计
stats := json.GetStats()
fmt.Printf("缓存命中率: %.2f%%\n", stats.HitRatio * 100)
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

## 相关

- [包函数](./api-reference/functions) - 完整 API 参考
- [辅助函数](./api-reference/helpers) - 类型转换工具
- [Processor](./api-reference/processor/) - 处理器方法
- [配置](./api-reference/config) - 配置选项
- [类型定义](./api-reference/types) - AccessResult、Schema 等

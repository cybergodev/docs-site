---
title: "辅助函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 辅助工具函数完整参考：包括 CompareJSON 比较验证两个 JSON 是否等价、ClearCache/GetStats 缓存管理与统计、全局处理器管理和安全模式辅助函数，提供日常开发中便捷的 JSON 工具函数集合，有效简化常见操作。"
---

# 辅助函数

json 包提供丰富的辅助函数，用于 JSON 比较、缓存管理和工具处理。

## JSON 比较函数

### CompareJSON

签名：`func CompareJSON(json1, json2 string) (bool, error)`

比较两个 JSON 字符串是否相等。处理数字精度差异和键顺序差异。

```go
// 键顺序不同但内容相同
equal, _ := json.CompareJSON(`{"a":1,"b":2}`, `{"b":2,"a":1}`)
fmt.Println(equal) // true

// 数字精度不同但值相同
equal, _ := json.CompareJSON(`{"num":1}`, `{"num":1.0}`)
fmt.Println(equal) // true

// 内容不同
equal, _ := json.CompareJSON(`{"a":1}`, `{"a":2}`)
fmt.Println(equal) // false
```

---

## JSON 合并函数

### MergeJSON

签名：`func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

合并两个 JSON 对象，支持通过 Config 配置合并模式。详见 [修改函数](./functions/modify#mergejson)。

---

### MergeMany

签名：`func MergeMany(jsons []string, cfg ...Config) (string, error)`

合并多个 JSON 对象。详见 [修改函数](./functions/modify#mergemany)。

---

## 缓存和统计

### ClearCache（包级函数）

签名：`func ClearCache()`

清除全局处理器的内部缓存。

```go
json.ClearCache()
```

---

### GetStats（包级函数）

签名：`func GetStats() Stats`

获取全局处理器的统计信息。

```go
stats := json.GetStats()
fmt.Printf("缓存命中率: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("缓存大小: %d\n", stats.CacheSize)
```

---

### GetHealthStatus（包级函数）

签名：`func GetHealthStatus() HealthStatus`

获取全局处理器的健康状态。

```go
status := json.GetHealthStatus()
if status.Healthy {
    fmt.Println("处理器健康")
}
```

---

### Processor.ClearCache

签名：`func (p *Processor) ClearCache()`

清除处理器的内部缓存。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

p.ClearCache()
```

### Processor.GetStats

签名：`func (p *Processor) GetStats() Stats`

获取处理器的统计信息。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

stats := p.GetStats()
fmt.Printf("缓存命中率: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("缓存大小: %d\n", stats.CacheSize)
```

### Processor.GetHealthStatus

签名：`func (p *Processor) GetHealthStatus() HealthStatus`

获取处理器的健康状态。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

status := p.GetHealthStatus()
if status.Healthy {
    fmt.Println("处理器健康")
}
```

### WarmupCache

签名：`func WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

预热缓存以提高后续操作性能。

```go
data := `{"user": {"name": "Alice", "email": "alice@example.com"}, "items": [{"id": 1}]}`
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := json.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("成功预热 %d 个路径\n", result.Successful)
```

---

## 全局处理器管理

全局处理器用于所有包级函数（如 `Get`、`GetString` 等）。

### SetGlobalProcessor

签名：`func SetGlobalProcessor(processor *Processor)`

设置自定义全局处理器。

```go
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}

json.SetGlobalProcessor(p)

// 之后所有包级函数都使用这个处理器
val := json.GetString(data, "user.name")
```

---

### ShutdownGlobalProcessor

签名：`func ShutdownGlobalProcessor()`

关闭全局处理器并释放资源。

```go
func main() {
    cfg := json.DefaultConfig()
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    json.SetGlobalProcessor(p)

    defer json.ShutdownGlobalProcessor()

    // 应用逻辑...
}
```

---

## 输出函数

::: warning API 变更说明
`Print`、`PrintPretty`、`PrintE`、`PrintPrettyE` 已转为内部函数（小写命名），不再作为公开 API 导出。请使用 [Encode](./functions/encode-decode#encode)、[EncodePretty](./functions/encode-decode#encodepretty) 或 [Prettify](./functions/encode-decode#prettify) 配合 `fmt.Println` 代替。详见 [打印函数](./print)。
:::

---

## Buffer 兼容函数

::: tip 说明
以下函数与 `encoding/json` 标准库完全兼容，同时通过 `cfg` 参数支持额外配置。
:::

### Compact

签名：`func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error`

将 JSON 压缩后写入 Buffer。100% 兼容 `encoding/json.Compact`。

```go
var buf bytes.Buffer
err := json.Compact(&buf, []byte(`{"name": "test"}`))
```

### Indent

签名：`func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

将 JSON 格式化后写入 Buffer。100% 兼容 `encoding/json.Indent`。

```go
var buf bytes.Buffer
err := json.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

---

### HTMLEscape

签名：`func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

将 JSON 进行 HTML 转义后写入 Buffer。100% 兼容 `encoding/json.HTMLEscape`。

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

---

## 安全模式函数

### Config.AddDangerousPattern

通过 Config 的 `AddDangerousPattern` 方法或 `AdditionalDangerousPatterns` 字段注册自定义危险模式。

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "自定义恶意关键字",
    Level:   json.PatternLevelCritical,
})
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

也可以在创建 Config 后设置 `AdditionalDangerousPatterns` 字段：

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "malicious_keyword", Name: "自定义恶意关键字", Level: json.PatternLevelCritical},
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

**DangerousPattern 结构体**

| 字段 | 类型 | 说明 |
|------|------|------|
| `Pattern` | `string` | 要检测的子字符串 |
| `Name` | `string` | 人类可读的风险描述 |
| `Level` | `PatternLevel` | 严重级别 |

**PatternLevel 级别**

| 级别 | 说明 |
|------|------|
| `PatternLevelCritical` | 始终阻止操作 |
| `PatternLevelWarning` | 严格模式下阻止，宽松模式下记录警告 |
| `PatternLevelInfo` | 仅记录，永不阻止 |

---

## 错误处理函数

### SafeError

签名：`func SafeError(err error) string`

返回客户端安全的错误消息，不包含内部详细信息。适合在 API 响应中使用。

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // 返回安全的错误消息（不含路径、内部状态等敏感信息）
    fmt.Println(json.SafeError(err))
}
```

---

### RedactedPath

签名：`func RedactedPath(path string) string`

返回已编辑的路径，用于安全日志记录。隐藏路径中的敏感部分。

```go
path := "users[0].ssn"
fmt.Println(json.RedactedPath(path)) // 安全的路径表示
```

---

## AccessResult 类型转换方法

`AccessResult` 是 `Processor.SafeGet()` 和包级 `SafeGet()` 的返回类型，提供类型安全的转换方法。

### AccessResult.AsString

签名：`func (r AccessResult) AsString() (string, error)`

安全转换为字符串类型。仅当值本身是字符串时成功。

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    return
}
fmt.Println(name)
```

---

### AccessResult.AsStringConverted

签名：`func (r AccessResult) AsStringConverted() (string, error)`

将任意值转换为字符串（使用 fmt.Sprintf 格式化）。

```go
result := json.SafeGet(data, "user.age")
ageStr, err := result.AsStringConverted()
// "30" (字符串格式)
```

---

### AccessResult.AsInt

签名：`func (r AccessResult) AsInt() (int, error)`

安全转换为整数。不支持 bool 到 int 的转换。

```go
result := json.SafeGet(data, "user.age")
age, err := result.AsInt()
```

---

### AccessResult.AsFloat64

签名：`func (r AccessResult) AsFloat64() (float64, error)`

安全转换为 float64。不支持 bool 到 float64 的转换。

```go
result := json.SafeGet(data, "item.price")
price, err := result.AsFloat64()
```

---

### AccessResult.AsBool

签名：`func (r AccessResult) AsBool() (bool, error)`

安全转换为布尔值。仅支持 bool 和 string 类型。

```go
result := json.SafeGet(data, "feature.enabled")
enabled, err := result.AsBool()
```

---

## 相关

- [查询获取函数](./functions/get) - Get, GetString 等查询操作
- [修改函数](./functions/modify) - Set, Delete 等修改操作
- [类型定义](./types) - AccessResult 等类型
- [配置选项](./config) - Config 配置详解

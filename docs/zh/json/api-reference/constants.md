---
sidebar_label: "常量与错误"
title: "常量与错误 - CyberGo JSON | 错误变量与预定义常量"
description: "CyberGo JSON 常量与错误参考：ErrPathNotFound、ErrTypeMismatch 等哨兵错误附触发场景速查，JsonsError 支持 errors.Is/As 链上溯，DefaultMaxJSONSize 等默认常量与 Config 字段对照，并含 DefaultConfig 配置预设与 MergeMode 合并模式，帮助开发者编写精确的错误处理分支。"
sidebar_position: 80
---

# 常量与错误

## 错误变量

### 主要错误

```go
var (
    // 基础错误
    ErrInvalidJSON     = errors.New("invalid JSON format")
    ErrPathNotFound    = errors.New("path not found")
    ErrTypeMismatch    = errors.New("type mismatch")
    ErrInvalidPath     = errors.New("invalid path format")
    ErrProcessorClosed = errors.New("processor is closed")

    // 限制错误
    ErrSizeLimit        = errors.New("size limit exceeded")
    ErrDepthLimit       = errors.New("depth limit exceeded")
    ErrConcurrencyLimit = errors.New("concurrency limit exceeded") // 受控操作（Get/Set/Delete 等）达到 MaxConcurrency 时返回

    // 安全和验证错误
    ErrSecurityViolation = errors.New("security violation detected")
    ErrDuplicateKey      = errors.New("duplicate object key")
    ErrUnsupportedPath   = errors.New("unsupported path operation") // 已废弃：当前无操作返回，预留

    // 资源和性能错误（均 Deprecated：当前未被任何操作返回，保留供未来使用）
    ErrOperationTimeout  = errors.New("operation timeout")
    ErrResourceExhausted = errors.New("system resources exhausted")
)
```

### 触发场景速查

每个哨兵错误的典型触发场景，便于按错误分支编写恢复逻辑：

| 错误 | 典型触发场景 | 建议处理 |
|------|--------------|----------|
| `ErrInvalidJSON` | 输入不是合法 JSON（多余字符、未闭合等） | 拒绝输入，检查来源 |
| `ErrPathNotFound` | `Get` 的路径在数据中不存在 | 业务常见，用默认值兜底 |
| `ErrTypeMismatch` | 路径存在但类型不符（如对字符串路径用 `[0]`） | 检查数据结构假设 |
| `ErrInvalidPath` | 路径语法错误（`CompilePath` / 路径解析失败） | 修正路径表达式 |
| `ErrProcessorClosed` | `Close()`（或关闭中）之后继续调用方法 | 检查生命周期，`IsClosed` 预判 |
| `ErrSizeLimit` | 输入超过 `MaxJSONSize` / `MaxSecurityValidationSize` | 调大限制或拒绝超大输入 |
| `ErrDepthLimit` | 嵌套超过 `MaxNestingDepthSecurity` | 拒绝深嵌套输入（可能是攻击） |
| `ErrConcurrencyLimit` | 受控操作并发超过 `MaxConcurrency` | 降低并发或调大限制 |
| `ErrSecurityViolation` | 命中危险模式、超 `MaxObjectKeys`/`MaxArrayElements` | 记录审计日志并拒绝 |
| `ErrDuplicateKey` | `Config.DetectDuplicateKeys` 开启时，输入对象中存在重复键 | 拒绝输入（默认关闭时重复键后者胜出，与 `encoding/json` 一致） |
| `ErrUnsupportedPath` | 预留，当前无操作返回（已废弃；不支持的路径段以 `ErrInvalidPath` 或 `ErrTypeMismatch` 形式出现） | 错误分支无需处理 |
| `ErrOperationTimeout` | 预留，当前无操作返回（已废弃） | 错误分支无需处理 |
| `ErrResourceExhausted` | 预留，当前无操作返回（已废弃） | 错误分支无需处理 |

::: tip 三个 Deprecated 哨兵
`ErrOperationTimeout`、`ErrResourceExhausted` 与 `ErrUnsupportedPath` 当前**没有任何操作会返回**，仅为未来版本保留——错误分支中不必处理它们。
:::

### 错误检查

使用 `errors.Is` 检查错误类型：

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // 路径不存在
        fmt.Println("路径未找到")
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // 类型不匹配
        fmt.Println("类型不匹配")
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // JSON 格式错误
        fmt.Println("无效的 JSON")
    }
}
```

## JsonsError 类型

### 结构定义

```go
type JsonsError struct {
    Op      string `json:"op"`      // 操作名称
    Path    string `json:"path"`    // 错误发生的路径
    Message string `json:"message"` // 人类可读的错误消息
    Err     error  `json:"err"`     // 底层错误
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| `Op` | `string` | 失败的操作名称 |
| `Path` | `string` | 错误发生的 JSON 路径 |
| `Message` | `string` | 人类可读的错误消息 |
| `Err` | `error` | 底层错误（可为 `nil`），经 `Unwrap` 支持 `errors.Is` / `errors.As` 链上溯 |

### 方法

```go
func (e *JsonsError) Error() string   // "JSON <op> failed at path '<path>': <msg> (caused by: ...)"
func (e *JsonsError) Unwrap() error   // 返回底层错误（支持 errors.As/Is 链）
func (e *JsonsError) Is(target error) bool
```

`Is` 的匹配规则：

- 目标是 `*JsonsError` 时，逐字段比较 `Op`、`Path`、`Err` 三者（`Message` 为派生信息，**有意排除**在比较之外）
- 目标是其他错误（如哨兵错误）时，退化为对底层 `Err` 做 `errors.Is`——因此 `errors.Is(err, json.ErrPathNotFound)` 对包装后的 `JsonsError` 依然成立

### 使用示例

```go
val, err := json.Get(data, "complex.path[0]")
if err != nil {
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("操作: %s\n", jsonErr.Op)
        fmt.Printf("路径: %s\n", jsonErr.Path)
        fmt.Printf("消息: %s\n", jsonErr.Message)
        if jsonErr.Err != nil {
            fmt.Printf("原因: %v\n", jsonErr.Err)
        }
    }
}
```

## 错误辅助函数

除上述错误类型外，库还提供两个错误处理辅助函数（完整说明见 [辅助工具](./helpers#safeerror)）：

| 函数 | 签名 | 说明 |
|------|------|------|
| `SafeError` | `func SafeError(err error) string` | 返回对客户端安全的错误消息，省略路径名等内部细节（CWE-209） |
| `RedactedPath` | `func RedactedPath(path string) string` | 返回脱敏后的路径（非空路径掩码为 `"***"`），用于日志和错误响应 |

## 配置预设

### 默认值常量

```go
const (
    // 大小限制
    DefaultMaxJSONSize     = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth = 200
    DefaultMaxPathDepth    = 50
    DefaultMaxDepth        = 100                 // 编解码默认嵌套深度（Config.MaxDepth）
    DefaultMaxConcurrency  = 50

    // 安全限制
    DefaultMaxSecuritySize   = 10 * 1024 * 1024  // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultMaxBatchSize      = 2000
    DefaultParallelThreshold = 10

    // 缓存
    DefaultCacheTTL = 5 * time.Minute
)
```

### 常量与 Config 字段对照

| 常量 | 默认值 | 对应 Config 字段 | 说明 |
|------|--------|------------------|------|
| `DefaultMaxJSONSize` | 100MB | `MaxJSONSize` | 单个 JSON 输入的大小上限 |
| `DefaultMaxNestingDepth` | 200 | `MaxNestingDepthSecurity` | JSON 嵌套深度上限 |
| `DefaultMaxPathDepth` | 50 | `MaxPathDepth` | 路径段数量上限（如 `a.b.c.d...` 的层数） |
| `DefaultMaxDepth` | 100 | `MaxDepth` | 编解码（Marshal/Unmarshal）默认嵌套深度 |
| `DefaultMaxConcurrency` | 50 | `MaxConcurrency` | 并发操作数上限 |
| `DefaultMaxSecuritySize` | 10MB | `MaxSecurityValidationSize` | 超过该大小的文档改用采样式安全检查 |
| `DefaultMaxObjectKeys` | 100000 | `MaxObjectKeys` | 对象键数量上限 |
| `DefaultMaxArrayElements` | 100000 | `MaxArrayElements` | 数组元素数量上限 |
| `DefaultMaxBatchSize` | 2000 | `MaxBatchSize` | 单次 `ProcessBatch` 的操作数上限，超出返回 `ErrSizeLimit` |
| `DefaultParallelThreshold` | 10 | `ParallelThreshold` | 并行处理阈值：操作数低于该值时使用顺序处理 |
| `DefaultCacheTTL` | 5 分钟 | `CacheTTL` | 缓存条目存活时间 |

## 配置预设函数

### DefaultConfig

签名：`func DefaultConfig() Config`

返回默认配置。

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### SecurityConfig

签名：`func SecurityConfig() Config`

返回安全配置，适用于处理不可信输入。

```go
// 推荐用于：
// - 公共 API 和 Web 服务
// - 用户提交的数据
// - 外部 Webhook
// - 认证端点
// - 金融数据处理
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**安全配置特点**：

- 完整安全扫描
- 严格模式
- 保守的限制值
- 启用缓存

### PrettyConfig

签名：`func PrettyConfig() Config`

返回格式化输出配置。

```go
result, err := json.Encode(data, json.PrettyConfig())
```

## 合并模式常量

```go
// MergeMode 是合并模式类型（从 internal 包导出）
type MergeMode = internal.MergeMode

const (
    // MergeUnion - 联合合并（默认）
    // 对象：合并所有键，冲突值取覆盖值
    // 数组：合并所有元素并去重
    MergeUnion = internal.MergeUnion

    // MergeIntersection - 交集合并
    // 对象：只保留共同键
    // 数组：只保留共同元素
    MergeIntersection = internal.MergeIntersection

    // MergeDifference - 差集合并
    // 对象：只保留基础中存在但覆盖中不存在的键
    // 数组：只保留基础中存在但覆盖中不存在的元素
    MergeDifference = internal.MergeDifference
)
```

## 路径段类型

`PathSegment` 是从 `internal` 包导出的路径段类型，用于表示解析后的路径组成部分。

```go
type PathSegment = internal.PathSegment
```

::: warning 内部实现别名
`PathSegment` 是 `internal.PathSegment` 的类型别名。其具体字段、字段类型（如 PathSegmentType、PathSegmentFlags）及方法均属于 `internal` 包，**未作为公开 API 导出**，可能随版本变化，请勿在业务代码中直接依赖其内部结构。

- 实现自定义路径语法时，通过 [`PathParser`](./interfaces#pathparser) 接口的 `ParsePath` 方法返回 `[]PathSegment`。
- 预编译路径请使用 [`Processor.CompilePath`](./processor/query#compilepath)，返回 `*CompiledPath`。
:::

## 安全模式级别

```go
type PatternLevel int

const (
    // PatternLevelCritical - 严重风险，始终阻止操作
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - 警告级别，严格模式下阻止
    PatternLevelWarning

    // PatternLevelInfo - 信息级别，仅记录日志
    PatternLevelInfo
)
```

### DangerousPattern 结构

```go
type DangerousPattern struct {
    Pattern string       // 要检测的子字符串
    Name    string       // 人类可读的安全风险描述
    Level   PatternLevel // 处理级别
}
```

## 错误处理最佳实践

### 使用 errors.Is 检查类型

```go
result, err := json.Get(data, path)
if errors.Is(err, json.ErrPathNotFound) {
    return defaultValue
}
if errors.Is(err, json.ErrTypeMismatch) {
    return defaultValue
}
```

### 使用 errors.As 获取详情

```go
var jsonErr *json.JsonsError
if errors.As(err, &jsonErr) {
    log.Printf("操作 %s 在路径 %s 失败: %s",
        jsonErr.Op, jsonErr.Path, jsonErr.Message)
}
```

### 错误包装

```go
val := json.GetString(data, path)
if val == "" {
    return fmt.Errorf("获取配置 %s 返回空值", path)
}
```

## 相关

- [错误处理](../advanced/error-handling) - 高级错误处理指南
- [Config](./config) - 配置选项
- [安全概述](../security/) - 安全最佳实践

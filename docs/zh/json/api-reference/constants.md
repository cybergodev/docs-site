---
title: "常量与错误 - CyberGo JSON | API 参考"
description: "CyberGo JSON 常量与错误定义完整参考：包括 DefaultMaxJSONSize/DefaultMaxNestingDepth 默认限制常量、ErrPathNotFound/ErrTypeMismatch 等错误变量和 MergeMode 合并模式枚举，提供配置预设和错误处理支持。"
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
    ErrConcurrencyLimit = errors.New("concurrency limit exceeded")

    // 安全和验证错误
    ErrSecurityViolation = errors.New("security violation detected")
    ErrUnsupportedPath   = errors.New("unsupported path operation")

    // 资源和性能错误
    ErrOperationTimeout  = errors.New("operation timeout")
    ErrResourceExhausted = errors.New("system resources exhausted")
)
```

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

### 方法

```go
func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

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

## 配置预设

### 默认值常量

```go
const (
    // 大小限制
    DefaultMaxJSONSize     = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth = 200
    DefaultMaxPathDepth    = 50
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
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
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

### PathSegment 结构

```go
type PathSegment struct {
    Type  PathSegmentType  // 段类型

    // 根据类型使用不同字段
    Key   string // 属性名（Property/Extract 类型）
    Index int    // 数组索引（ArrayIndex 类型）或切片起始
    End   int    // 切片结束（ArraySlice 类型）
    Step  int    // 切片步长（ArraySlice 类型）
    Flags PathSegmentFlags // 段标志
}
```

### PathSegment 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `HasStart` | `func (s *PathSegment) HasStart() bool` | 切片是否有起始值 |
| `HasEnd` | `func (s *PathSegment) HasEnd() bool` | 切片是否有结束值 |
| `HasStep` | `func (s *PathSegment) HasStep() bool` | 切片是否有步长值 |
| `IsNegativeIndex` | `func (s *PathSegment) IsNegativeIndex() bool` | 是否为负索引 |
| `IsWildcardSegment` | `func (s *PathSegment) IsWildcardSegment() bool` | 是否为通配符 |
| `IsFlatExtract` | `func (s *PathSegment) IsFlatExtract() bool` | 是否为扁平模式 |

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

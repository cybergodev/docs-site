---
title: "Config 配置 - CyberGo JSON | API 参考"
description: "CyberGo JSON Config 配置参考：DefaultConfig 默认配置、SecurityConfig 安全、PrettyConfig 格式化、缓存、大小限制与编码选项，自定义 Go 应用的全部 JSON 行为。"
---

# Config

Config 用于自定义 Processor 和所有 JSON 操作的行为。

## Config 结构体

```go
type Config struct {
    // ===== 缓存设置 =====
    MaxCacheSize int           `json:"max_cache_size"` // 最大缓存条目数
    CacheTTL     time.Duration `json:"cache_ttl"`      // 缓存过期时间
    EnableCache  bool          `json:"enable_cache"`   // 是否启用缓存
    CacheResults bool          `json:"cache_results"`  // 是否缓存操作结果

    // ===== 大小限制 =====
    MaxJSONSize  int64 `json:"max_json_size"`  // 最大 JSON 大小（字节）
    MaxPathDepth int   `json:"max_path_depth"` // 最大路径深度
    MaxBatchSize int   `json:"max_batch_size"` // 最大批量操作数

    // ===== 安全限制 =====
    MaxNestingDepthSecurity   int   `json:"max_nesting_depth"`           // 最大嵌套深度
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"` // 安全验证最大大小
    MaxObjectKeys             int   `json:"max_object_keys"`             // 对象最大键数
    MaxArrayElements          int   `json:"max_array_elements"`          // 数组最大元素数
    FullSecurityScan          bool  `json:"full_security_scan"`          // 启用完整安全扫描

    // ===== 并发 =====
    MaxConcurrency    int `json:"max_concurrency"`    // 最大并发数
    ParallelThreshold int `json:"parallel_threshold"` // 并行处理阈值

    // ===== 处理选项 =====
    EnableValidation bool `json:"enable_validation"` // 启用验证
    StrictMode       bool `json:"strict_mode"`       // 严格模式
    CreatePaths      bool `json:"create_paths"`      // 自动创建路径
    CleanupNulls     bool `json:"cleanup_nulls"`     // 清理 null 值
    CompactArrays    bool `json:"compact_arrays"`    // 压缩数组
    ContinueOnError  bool `json:"continue_on_error"` // 批量操作出错时继续

    // ===== 输入/输出选项 =====
    AllowComments    bool `json:"allow_comments"`     // 允许注释
    PreserveNumbers  bool `json:"preserve_numbers"`   // 保留数字精度
    ValidateInput    bool `json:"validate_input"`     // 验证输入
    ValidateFilePath bool `json:"validate_file_path"` // 验证文件路径
    SkipValidation   bool `json:"skip_validation"`    // 跳过验证（受信任输入）

    // ===== 编码选项 =====
    Pretty          bool            `json:"pretty"`           // 格式化输出
    Indent          string          `json:"indent"`           // 缩进字符串
    Prefix          string          `json:"prefix"`           // 前缀
    EscapeHTML      bool            `json:"escape_html"`      // HTML 转义
    SortKeys        bool            `json:"sort_keys"`        // 键排序
    ValidateUTF8    bool            `json:"validate_utf8"`    // UTF-8 验证
    MaxDepth        int             `json:"max_depth"`        // 最大编码深度
    DisallowUnknown bool            `json:"disallow_unknown"` // 禁止未知字段
    FloatPrecision  int             `json:"float_precision"`  // 浮点精度（-1 为自动）
    FloatTruncate   bool            `json:"float_truncate"`   // 截断浮点数
    DisableEscaping bool            `json:"disable_escaping"` // 禁用转义
    EscapeUnicode   bool            `json:"escape_unicode"`   // Unicode 转义
    EscapeSlash     bool            `json:"escape_slash"`     // 斜杠转义
    EscapeNewlines  bool            `json:"escape_newlines"`  // 换行符转义
    EscapeTabs      bool            `json:"escape_tabs"`      // 制表符转义
    IncludeNulls    bool            `json:"include_nulls"`    // 包含 null 值
    CustomEscapes   map[rune]string `json:"custom_escapes,omitempty"` // 自定义转义映射

    // ===== 可观测性 =====
    EnableMetrics     bool `json:"enable_metrics"`      // 启用指标收集
    EnableHealthCheck bool `json:"enable_health_check"` // 启用健康检查

    // ===== 大文件处理 =====
    ChunkSize       int64 `json:"chunk_size"`       // 分块大小
    MaxMemory       int64 `json:"max_memory"`       // 最大内存使用
    BufferSize      int   `json:"buffer_size"`      // 缓冲区大小
    SamplingEnabled bool  `json:"sampling_enabled"` // 启用采样
    SampleSize      int   `json:"sample_size"`      // 采样数量

    // ===== JSONL 配置 =====
    JSONLBufferSize    int   `json:"jsonl_buffer_size"`     // JSONL 缓冲区大小
    JSONLMaxLineSize   int   `json:"jsonl_max_line_size"`   // JSONL 最大行大小
    JSONLSkipEmpty     bool  `json:"jsonl_skip_empty"`      // 跳过空行
    JSONLSkipComments  bool  `json:"jsonl_skip_comments"`   // 跳过注释行
    JSONLContinueOnErr bool  `json:"jsonl_continue_on_err"` // 出错时继续
    JSONLWorkers       int   `json:"jsonl_workers"`         // JSONL 并行工作数
    JSONLChunkSize     int   `json:"jsonl_chunk_size"`      // JSONL 分块大小
    JSONLMaxMemory     int64 `json:"jsonl_max_memory"`      // JSONL 最大内存

    // ===== 合并选项 =====
    MergeMode MergeMode `json:"merge_mode"` // 合并策略

    // ===== 扩展点（无 JSON tag，不参与序列化） =====
    CustomEncoder               CustomEncoder                // 自定义编码器
    CustomTypeEncoders          map[reflect.Type]TypeEncoder // 自定义类型编码器
    CustomValidators            []Validator                  // 自定义验证器
    AdditionalDangerousPatterns []DangerousPattern           // 额外危险模式
    DisableDefaultPatterns      bool                         // 禁用默认警告级模式
    Hooks                       []Hook                       // 操作钩子
    CustomPathParser            PathParser                   // 自定义路径解析器
}
```

## 配置预设

### DefaultConfig

签名：`func DefaultConfig() Config`

返回默认配置，适合大多数场景。

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**默认值**

| 字段 | 值 | 说明 |
|------|-----|------|
| MaxJSONSize | 100MB | JSON 大小限制 |
| MaxNestingDepthSecurity | 200 | 嵌套深度 |
| MaxPathDepth | 50 | 路径深度 |
| MaxSecurityValidationSize | 10MB | 安全验证大小上限 |
| MaxObjectKeys | 100000 | 对象最大键数 |
| MaxArrayElements | 100000 | 数组最大元素数 |
| MaxConcurrency | 50 | 并发数 |
| MaxBatchSize | 2000 | 批量操作数 |
| CacheTTL | 5 分钟 | 缓存过期 |
| MaxCacheSize | 128 | 最大缓存条目数 |
| EnableCache | true | 启用缓存 |
| CacheResults | true | 缓存操作结果 |
| EnableValidation | true | 启用验证 |
| StrictMode | false | 非严格模式 |
| FullSecurityScan | false | 采样安全扫描（非全量） |
| ValidateInput | true | 验证输入 |
| ValidateFilePath | true | 验证文件路径 |
| CreatePaths | true | 自动创建路径 |
| Pretty | false | 不格式化输出 |
| EscapeHTML | true | HTML 转义 |
| ValidateUTF8 | true | UTF-8 验证 |
| IncludeNulls | true | 包含 null |
| EscapeNewlines | true | 换行符转义 |
| EscapeTabs | true | 制表符转义 |
| FloatPrecision | -1 | 自动精度 |
| MaxDepth | 100 | 编码深度 |
| Indent | "  " | 默认缩进 |
| ChunkSize | 1MB | 分块大小 |
| MaxMemory | 100MB | 最大内存 |
| BufferSize | 64KB | 缓冲区大小 |
| SamplingEnabled | true | 启用采样 |
| SampleSize | 1000 | 采样数量 |
| JSONLBufferSize | 64KB | JSONL 缓冲区大小 |
| JSONLMaxLineSize | 1MB | JSONL 最大行大小 |
| JSONLSkipEmpty | true | 跳过空行 |
| JSONLSkipComments | false | 不跳过注释 |
| JSONLContinueOnErr | false | 出错时停止 |
| JSONLWorkers | 4 | 并行工作数 |
| JSONLChunkSize | 1000 | JSONL 分块大小 |
| JSONLMaxMemory | 100MB | JSONL 最大内存 |
| MergeMode | MergeUnion | 联合合并 |

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

**安全配置特点**

| 字段 | 值 | 说明 |
|------|-----|------|
| MaxNestingDepthSecurity | 30 | 保守嵌套深度 |
| MaxSecurityValidationSize | 10MB | 安全验证大小 |
| MaxObjectKeys | 5000 | 保守键数限制 |
| MaxArrayElements | 5000 | 保守元素限制 |
| MaxJSONSize | 10MB | 保守大小限制 |
| MaxPathDepth | 30 | 保守路径深度 |
| FullSecurityScan | true | 完整安全扫描 |
| StrictMode | true | 严格模式 |
| EnableValidation | true | 启用验证 |
| EnableCache | true | 启用缓存 |
| MaxCacheSize | 256 | 缓存大小 |
| CacheTTL | 3 分钟 | 较短 TTL |

### PrettyConfig

签名：`func PrettyConfig() Config`

返回格式化输出配置。

```go
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

## 配置方法

### Clone

签名：`func (c *Config) Clone() *Config`

深拷贝配置。

```go
cfg := json.DefaultConfig()
cfgCopy := cfg.Clone()
cfgCopy.EnableValidation = true // 不影响原配置
```

### Validate

签名：`func (c *Config) Validate() error`

验证配置并自动修正无效值。此方法会**原地修改** Config，将不合法的字段修正为对应的最小有效值。

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1 // 无效值
if err := cfg.Validate(); err != nil {
    panic(err)
}
// MaxJSONSize 会被原地修正为最小值
```

### ValidateWithWarnings

签名：`func (c *Config) ValidateWithWarnings() []ConfigWarning`

验证配置并返回修正警告列表。

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1
warnings := cfg.ValidateWithWarnings()
for _, w := range warnings {
    fmt.Printf("%s: %s\n", w.Field, w.Reason)
}
```

### ConfigWarning 类型

`ConfigWarning` 表示配置验证期间自动修正的信息。

```go
type ConfigWarning struct {
    Field    string // 被修正的字段名
    OldValue any    // 原始值（无效值可能为 nil）
    NewValue any    // 修正后的值
    Reason   string // 修正原因
}
```

### SecurityLimits 类型

`SecurityLimits` 汇总 Config 中的安全相关限制字段。

```go
type SecurityLimits struct {
    MaxNestingDepth           int   `json:"max_nesting_depth"`
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"`
    MaxObjectKeys             int   `json:"max_object_keys"`
    MaxArrayElements          int   `json:"max_array_elements"`
    MaxJSONSize               int64 `json:"max_json_size"`
    MaxPathDepth              int   `json:"max_path_depth"`
}
```

### AddHook

签名：`func (c *Config) AddHook(hook Hook)`

添加操作钩子。

```go
cfg := json.DefaultConfig()
cfg.AddHook(json.LoggingHook(slog.Default()))
```

### AddValidator

签名：`func (c *Config) AddValidator(validator Validator)`

添加自定义验证器。

```go
cfg := json.DefaultConfig()
cfg.AddValidator(&MyValidator{})
```

### AddDangerousPattern

签名：`func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

添加额外安全模式。

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

## 使用示例

### 基础使用

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 安全配置

```go
// 处理不可信输入
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 格式化输出

```go
// 格式化 JSON
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

### 自定义配置

```go
cfg := json.DefaultConfig()

// 安全设置
cfg.MaxJSONSize = 10 * 1024 * 1024 // 10MB
cfg.MaxNestingDepthSecurity = 50
cfg.EnableValidation = true

// 钩子
cfg.Hooks = []json.Hook{json.LoggingHook(slog.Default())}

// 验证器
cfg.CustomValidators = []json.Validator{&MyValidator{}}

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 克隆和修改

```go
// 基于默认配置创建变体
base := json.DefaultConfig()

// 变体 1：开发配置
devCfg := base.Clone()
devCfg.EnableMetrics = true

// 变体 2：生产配置
prodCfg := base.Clone()
prodCfg.EnableValidation = true
```

## 配置常量

```go
const (
    // 大小限制
    DefaultMaxJSONSize       = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth   = 200
    DefaultMaxPathDepth      = 50
    DefaultMaxDepth          = 100                 // 编解码默认嵌套深度（Config.MaxDepth）
    DefaultMaxConcurrency    = 50
    DefaultMaxBatchSize      = 2000
    DefaultMaxSecuritySize   = 10 * 1024 * 1024   // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultParallelThreshold = 10

    // 缓存
    DefaultCacheTTL = 5 * time.Minute
)
```

::: info 内部常量
路径验证长度限制（`maxPathLength`）等常量已转为内部实现，不再作为公开 API 导出。相关默认值通过 `Config` 结构体的字段默认值体现。
:::

---

## 合并模式

`MergeMode` 控制 `MergeJSON` 和 `MergeMany` 函数的合并策略。

### MergeUnion（默认）

合并所有键/元素，冲突时使用覆盖值。

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeUnion
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 结果: {"a": 1, "b": 3, "c": 4}
```

### MergeIntersection

只保留两个对象中都存在的键。

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 结果: {"b": 3}
```

### MergeDifference

只保留基础对象中存在但覆盖对象中不存在的键。

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 结果: {"a": 1}
```

---

## 安全建议

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| MaxJSONSize | 10-100MB | 根据服务器内存调整 |
| MaxNestingDepthSecurity | 30-50 | 防止深度嵌套攻击 |
| MaxPathDepth | 30-50 | 限制路径复杂度 |
| EnableValidation | true | 始终启用 |
| FullSecurityScan | true（不可信输入） | 完整安全扫描 |

## 相关

- [Processor](./processor/) - 处理器方法
- [常量与错误](./constants) - 配置常量
- [安全概述](../security/) - 安全最佳实践
- [接口定义](./interfaces) - 扩展接口

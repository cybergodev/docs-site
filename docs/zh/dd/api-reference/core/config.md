---
sidebar_label: "配置"
title: "配置 - CyberGo DD | Config 详解"
description: "CyberGo DD Config 结构体完整 API 文档，包含 DefaultConfig/DevelopmentConfig/JSONConfig 预设配置函数、OutputTarget 输出目标配置、字段验证规则、采样控制、格式化选项和 Validate 验证方法，提供灵活且类型安全的日志记录器行为定制能力。"
sidebar_position: 4
---

# 配置

DD 通过 `Config` 结构体配置日志记录器的行为，并提供多个预设配置工厂函数。

## 预设配置工厂

```go
// 默认配置：INFO 级别，文本格式
cfg := dd.DefaultConfig()
```

```go
// 开发配置：DEBUG 级别，动态 caller 检测
cfgDev := dd.DevelopmentConfig()
```

```go
// JSON 配置：JSON 格式输出
cfgJSON := dd.JSONConfig()
```

| 工厂函数 | 返回类型 | 级别 | 格式 | 适用场景 |
|----------|----------|------|------|----------|
| `DefaultConfig()` | `Config` | Info | Text | 生产环境 |
| `DevelopmentConfig()` | `Config` | Debug | Text | 开发环境 |
| `JSONConfig()` | `Config` | Debug | JSON | 日志采集 |

:::tip 安全过滤默认启用
所有预设配置（`DefaultConfig`、`DevelopmentConfig`、`JSONConfig`）均默认启用安全过滤，自动对密码、API Key、信用卡号等敏感数据进行脱敏。
:::

## Config 结构体

```go
type Config struct {
    // 日志级别
    Level          LogLevel         // 日志级别（默认 LevelInfo）
    Format         LogFormat        // 输出格式（FormatText / FormatJSON）

    // 时间配置
    TimeFormat     string           // 时间格式（默认 ISO 8601）
    IncludeTime    bool             // 是否包含时间（默认 true）
    IncludeLevel   bool             // 是否包含级别（默认 true）

    // 调用者信息
    DynamicCaller  bool             // 动态调用者检测（默认 true）
    FullPath       bool             // 是否显示完整路径（默认 false）

    // 输出目标
    Targets        []OutputTarget   // 输出目标列表

    // JSON 配置
    JSON           *JSONOptions     // JSON 输出选项

    // 安全配置
    Security       *SecurityConfig  // 安全配置

    // 字段验证
    FieldValidation *FieldValidationConfig

    // 生命周期处理器
    FatalHandler      FatalHandler       // Fatal 级别自定义处理函数
    WriteErrorHandler WriteErrorHandler  // 写入错误回调

    // 扩展性
    ContextExtractors []ContextExtractor // 上下文提取器列表
    Hooks             *HookRegistry      // 钩子注册表
    Sampling          *SamplingConfig    // 采样配置

    // 审计配置
    Audit             *AuditConfig       // 审计日志配置（安全事件记录）
}
```

:::tip Audit 字段
设置 `Audit` 后，敏感数据脱敏、速率限制和违规事件会通过 [AuditLogger](../security-audit/audit) 记录为审计事件。详见 [审计日志](../security-audit/audit)。
:::

### Clone

```go
func (c *Config) Clone() Config
```

创建配置的副本，可安全修改而不影响原始配置。对 nil 接收者返回零值 `Config{}`。

拷贝策略（与源码 `Clone` 注释一致）：

- **深拷贝**：`Targets`（切片）、`JSON`（含 `JSONFieldNames`）、`Security`、`Hooks`、`Sampling`、`Audit`
- **浅拷贝**：`FatalHandler`、`WriteErrorHandler`、`FieldValidation`（函数/指针共享）
- **混合**：`ContextExtractors` 切片被复制，但提取器实例本身共享

```go
base := dd.DefaultConfig()
custom := base.Clone()
custom.Level = dd.LevelDebug
```

### Validate

```go
func (c Config) Validate() error
```

验证配置的合法性，返回遇到的第一个错误。`dd.New(cfg)` 内部会自动调用此方法；也可在传入 `New` 前手动调用以提前发现问题。

校验项：

- `Level` 必须落在 `[LevelDebug, LevelFatal]` 范围内
- `Format` 必须为 `FormatText` 或 `FormatJSON`
- 当 `IncludeTime=true` 且 `TimeFormat` 非空时，校验 Go 时间参考布局（如 `time.RFC3339`）
- `Targets` 总数不超过 100（超出返回 `ErrMaxWritersExceeded`）
- 每个 `Targets` 元素：`OutputCustom` 必须有非 nil 的 `Writer`，`OutputFile` 必须有非空的 `Path`

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
if err := cfg.Validate(); err != nil {
    log.Fatal(err)
}
```

## 输出目标

### OutputType

输出目标类型枚举。

```go
type OutputType int
```

| 常量 | 值 | 说明 |
|------|----|------|
| `OutputConsole` | `0` | 控制台输出（stdout） |
| `OutputFile` | `1` | 文件输出 |
| `OutputCustom` | `2` | 自定义 Writer |

### OutputTarget

输出目标配置，描述单个输出目标。

```go
type OutputTarget struct {
    Type       OutputType     // 输出类型
    Path       string         // 文件路径（OutputFile 时有效）
    MaxSizeMB  int            // 文件大小上限 MB（OutputFile 时有效）
    MaxBackups int            // 保留备份数量（OutputFile 时有效）
    MaxAge     time.Duration  // 旧文件保留时长（OutputFile 时有效）
    Compress   bool           // 是否 gzip 压缩（OutputFile 时有效）
    Writer     io.Writer      // 自定义 Writer（OutputCustom 时有效）
}
```

### 输出目标构造器

```go
func ConsoleOutput() OutputTarget
func FileOutput(path string) OutputTarget
func CustomOutput(w io.Writer) OutputTarget
```

:::tip FileOutput 默认轮转参数
`FileOutput` 返回的 `OutputTarget` 已预填默认轮转值：`MaxSizeMB=100`、`MaxBackups=10`、`MaxAge=30 * 24 * time.Hour`（30 天）、`Compress=false`。如需自定义，直接修改返回值的对应字段：

```go
target := dd.FileOutput("logs/app.log")
target.MaxSizeMB = 50               // 50 MB 切割
target.MaxBackups = 5               // 保留 5 个备份
target.MaxAge = 7 * 24 * time.Hour  // 保留 7 天
target.Compress = true              // gzip 压缩旧日志
```

:::

```go
// 控制台输出
cfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// 文件输出
cfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/app.log")}

// 自定义 Writer
cfg.Targets = []dd.OutputTarget{dd.CustomOutput(customWriter)}

// 多目标输出
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
}
```

## JSON 配置选项

### JSONOptions

JSON 输出格式配置。

```go
type JSONOptions struct {
    PrettyPrint bool           // 是否美化输出（默认 false）
    Indent      string         // 缩进字符串（默认 "  "）
    FieldNames  *JSONFieldNames // 自定义 JSON 字段名
}
```

### JSONFieldNames

自定义 JSON 输出中的字段名称。用于适配不同的日志采集系统。

```go
type JSONFieldNames struct {
    Timestamp string  // 时间戳字段名（默认 "timestamp"）
    Level     string  // 级别字段名（默认 "level"）
    Caller    string  // 调用者字段名（默认 "caller"）
    Message   string  // 消息字段名（默认 "message"）
    Fields    string  // 字段容器名（默认 "fields"）
}
```

实现了指针接收者方法 `(*JSONFieldNames).IsComplete() bool`：当 5 个字段名均非空时返回 `true`，可用于校验是否已完整自定义全部字段名。

使用示例：

```go
cfg := dd.DefaultJSONOptions()
cfg.FieldNames = &dd.JSONFieldNames{
    Timestamp: "ts",
    Level:     "lvl",
    Message:   "msg",
}
```

### DefaultJSONOptions

```go
func DefaultJSONOptions() *JSONOptions
```

返回默认的 `JSONOptions` 输出选项：默认不美化输出（缩进为两个空格），字段名采用默认值。

```go
opts := dd.DefaultJSONOptions()
opts.PrettyPrint = true

logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    JSON:   opts,
})
```

## SamplingConfig

采样配置，用于高吞吐场景下减少日志量。

```go
type SamplingConfig struct {
    Enabled    bool          // 是否启用采样
    Initial    int           // 采样前始终记录的消息数
    Thereafter int           // 采样率（值为 10 表示每 10 条记录 1 条）
    Tick       time.Duration // 计数器重置间隔（0 表示不重置）
}
```

```go
cfg := dd.DefaultConfig()
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,
    Thereafter: 10,
    Tick:       time.Minute,
}
logger, _ := dd.New(cfg)
```

## FieldValidationConfig

字段验证配置，控制字段键名的命名规范。

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode      // 验证模式
    Convention               FieldNamingConvention    // 命名规范
    AllowCommonAbbreviations bool                      // 允许常见缩写（ID、URL 等）
    EnableSecurityValidation bool                      // 启用安全验证（Log4Shell、同形字攻击等）
}
```

### FieldValidationMode

| 常量 | 说明 |
|------|------|
| `FieldValidationNone` | 禁用验证（默认） |
| `FieldValidationWarn` | 警告不规范字段，但仍接受 |
| `FieldValidationStrict` | 命名不匹配时向 stderr 输出错误（日志条目仍正常写入，不拒绝） |

实现了 `String()` 方法，返回模式名称。

### FieldNamingConvention

| 常量 | 说明 | 示例 |
|------|------|------|
| `NamingConventionAny` | 接受任何格式（默认） | - |
| `NamingConventionSnakeCase` | snake_case | `user_id`, `created_at` |
| `NamingConventionCamelCase` | camelCase | `userId`, `createdAt` |
| `NamingConventionPascalCase` | PascalCase | UserId, CreatedAt |
| `NamingConventionKebabCase` | kebab-case | `user-id`, `created-at` |

实现了 `String()` 方法，返回命名规范名称。

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

验证字段键名是否符合配置的命名规范。

## 字段验证配置

### DefaultFieldValidationConfig

```go
func DefaultFieldValidationConfig() *FieldValidationConfig
```

默认配置：验证禁用。

### StrictSnakeCaseConfig

```go
func StrictSnakeCaseConfig() *FieldValidationConfig
```

严格 snake_case 验证，字段名必须为 `snake_case` 格式。

### StrictCamelCaseConfig

```go
func StrictCamelCaseConfig() *FieldValidationConfig
```

严格 camelCase 验证，字段名必须为 `camelCase` 格式。

### 使用方式

```go
logger, _ := dd.New(dd.Config{
    Level:           dd.LevelInfo,
    FieldValidation: dd.StrictSnakeCaseConfig(),
})

// 有效
logger.InfoWith("ok", dd.String("user_name", "admin"))

// 命名不规范（非 snake_case，日志仍写入，错误发到 stderr）
logger.InfoWith("fail", dd.String("userName", "admin"))
```

## 配置示例

### 生产环境

```go
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
    Security: dd.DefaultSecurityConfig(),
})
```

### 开发环境

```go
logger, _ := dd.New(dd.DevelopmentConfig())
```

### 多输出目标

```go
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## 下一步

- [Logger](./logger) -- 使用配置创建日志记录器
- [输出目标](../output-integration/writers) -- FileWriter、BufferedWriter、MultiWriter
- [安全过滤](../security-audit/security) -- SecurityConfig 详解
- [钩子系统](../security-audit/hooks) -- HooksConfig 详解
- [审计日志](../security-audit/audit) -- AuditConfig 详解

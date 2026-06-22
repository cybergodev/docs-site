---
title: "配置 - CyberGo DD | Config 详解"
description: "CyberGo DD Config 结构体完整 API 文档，包含 DefaultConfig/DevelopmentConfig/JSONConfig 预设配置函数、OutputTarget 输出目标配置、字段验证规则、采样控制、格式化选项和 Validate 验证方法，提供灵活且类型安全的日志记录器行为定制能力。"
---

# 配置

DD 通过 `Config` 结构体配置日志记录器的行为，并提供多个预设配置工厂函数。

## 预设配置工厂

```go
// 默认配置：INFO 级别，文本格式
cfg := dd.DefaultConfig()

// 开发配置：DEBUG 级别，动态 caller 检测
cfg := dd.DevelopmentConfig()

// JSON 配置：JSON 格式输出
cfg := dd.JSONConfig()
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
设置 `Audit` 后，敏感数据脱敏、速率限制和违规事件会通过 [AuditLogger](./audit) 记录为审计事件。详见 [审计日志](./audit)。
:::

### Clone

```go
func (c *Config) Clone() Config
```

创建配置的深拷贝，可安全修改而不影响原始配置。

```go
base := dd.DefaultConfig()
custom := base.Clone()
custom.Level = dd.LevelDebug
```

### Validate

```go
func (c Config) Validate() error
```

验证配置的合法性，检查输出目标、级别、格式等是否有效。

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

返回默认的 JSON 输出选项：`PrettyPrint` 为 `false`，缩进为两个空格，字段名采用默认值。

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
| `FieldValidationStrict` | 拒绝不规范字段，输出错误 |

实现了 `String()` 方法，返回模式名称。

### FieldNamingConvention

| 常量 | 说明 | 示例 |
|------|------|------|
| `NamingConventionAny` | 接受任何格式（默认） | - |
| `NamingConventionSnakeCase` | snake_case | `user_id`, `created_at` |
| `NamingConventionCamelCase` | camelCase | `userId`, `createdAt` |
| `NamingConventionPascalCase` | PascalCase | `UserId`, `CreatedAt` |
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

// 无效（非 snake_case）
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
- [输出目标](./writers) -- FileWriter、BufferedWriter、MultiWriter
- [安全过滤](./security) -- SecurityConfig 详解
- [钩子系统](./hooks) -- HooksConfig 详解
- [审计日志](./audit) -- AuditConfig 详解

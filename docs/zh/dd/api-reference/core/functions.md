---
sidebar_label: "包函数"
title: "包函数 - CyberGo DD | 全局函数和构造器"
description: "CyberGo DD 包级函数完整 API 文档，包括 New 日志记录器创建函数、Default/SetDefault/InitDefault 全局日志管理函数、DefaultConfig/DevelopmentConfig/JSONConfig 配置预设函数以及所有构造器工厂函数，支持通过 dd. 前缀直接调用。"
sidebar_position: 1
---

# 包函数

DD 提供丰富的包级函数，可直接通过 `dd.` 前缀调用。这些函数均通过全局日志记录器（`Default()`）执行。

## 日志记录器创建

### New

```go
func New(cfg ...Config) (*Logger, error)
```

创建新的 Logger 实例。不传配置时使用默认设置。

```go
// 默认配置
logger, _ := dd.New()

// 自定义配置
logger, _ := dd.New(dd.DefaultConfig())

// 注意：仅接受 0 或 1 个配置，传入多个会返回错误
// logger, _ := dd.New(cfg1, cfg2)  // 错误！
```

## 全局日志记录器

### 获取和设置

| 函数 | 签名 | 说明 |
|------|------|------|
| `Default` | `func Default() *Logger` | 获取全局日志记录器（懒初始化） |
| `SetDefault` | `func SetDefault(logger *Logger)` | 设置全局日志记录器 |
| `InitDefault` | `func InitDefault(cfg ...Config) error` | 用配置初始化全局日志记录器 |
| `DefaultWithErr` | `func DefaultWithErr() (*Logger, error)` | 获取全局日志记录器和初始化错误 |
| `DefaultInitError` | `func DefaultInitError() error` | 获取初始化错误 |

### 初始化全局日志记录器

```go
// 方式一：自动初始化（首次调用时创建）
dd.Default().Info("全局日志记录器自动创建")

// 方式二：显式初始化
err := dd.InitDefault(dd.JSONConfig())
if err != nil {
    log.Fatal(err)
}
dd.Default().Info("使用 JSON 配置的全局日志记录器")

// 方式三：替换全局日志记录器
custom, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
})
dd.SetDefault(custom)

// 方式四：检查初始化错误
logger, err := dd.DefaultWithErr()
if err != nil {
    log.Printf("全局日志记录器初始化失败: %v", err)
}
```

## 配置预设

| 函数 | 签名 | 说明 |
|------|------|------|
| `DefaultConfig` | `func DefaultConfig() Config` | 默认配置（Info 级别、文本格式） |
| `DevelopmentConfig` | `func DevelopmentConfig() Config` | 开发配置（Debug 级别） |
| `JSONConfig` | `func JSONConfig() Config` | JSON 输出配置 |

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
logger, _ := dd.New(cfg)
```

## 输出目标构造器

| 函数 | 签名 | 说明 |
|------|------|------|
| `ConsoleOutput` | `func ConsoleOutput() OutputTarget` | 控制台输出 |
| `FileOutput` | `func FileOutput(path string) OutputTarget` | 文件输出（支持轮换） |
| `CustomOutput` | `func CustomOutput(w io.Writer) OutputTarget` | 自定义 Writer 输出 |

```go
cfg := dd.DefaultConfig()
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
    dd.CustomOutput(customWriter),
}
logger, _ := dd.New(cfg)
```

## 基本日志（包级）

以下函数通过全局日志记录器输出日志：

| 函数 | 签名 | 说明 |
|------|------|------|
| `Debug` | `func Debug(args ...any)` | Debug 级别日志 |
| `Info` | `func Info(args ...any)` | Info 级别日志 |
| `Warn` | `func Warn(args ...any)` | Warn 级别日志 |
| `Error` | `func Error(args ...any)` | Error 级别日志 |
| `Fatal` | `func Fatal(args ...any)` | Fatal 级别日志（默认调用 os.Exit(1)，**defer 不会执行**；可通过 FatalHandler 自定义） |

```go
dd.Info("应用启动完成")
dd.Errorf("用户 %s 登录失败", username)
dd.Warn("磁盘空间不足")
```

## 格式化日志（包级）

| 函数 | 签名 | 说明 |
|------|------|------|
| `Debugf` | `func Debugf(format string, args ...any)` | Debug 级别格式化日志 |
| `Infof` | `func Infof(format string, args ...any)` | Info 级别格式化日志 |
| `Warnf` | `func Warnf(format string, args ...any)` | Warn 级别格式化日志 |
| `Errorf` | `func Errorf(format string, args ...any)` | Error 级别格式化日志 |
| `Fatalf` | `func Fatalf(format string, args ...any)` | Fatal 级别格式化日志（默认调用 os.Exit(1)，**defer 不会执行**；可通过 FatalHandler 自定义） |

## 通用级别日志（包级）

| 函数 | 签名 | 说明 |
|------|------|------|
| `Log` | `func Log(level LogLevel, args ...any)` | 指定级别日志 |
| `Logf` | `func Logf(level LogLevel, format string, args ...any)` | 指定级别格式化日志 |
| `LogWith` | `func LogWith(level LogLevel, msg string, fields ...Field)` | 指定级别结构化日志 |

```go
dd.Log(dd.LevelDebug, "调试信息")
dd.Logf(dd.LevelWarn, "警告: %s", reason)
dd.LogWith(dd.LevelError, "请求失败",
    dd.String("path", "/api/users"),
    dd.Int("status", 500),
)
```

## 结构化日志（包级）

以下函数通过全局日志记录器输出结构化日志：

| 函数 | 签名 | 说明 |
|------|------|------|
| `DebugWith` | `func DebugWith(msg string, fields ...Field)` | Debug 级别结构化日志 |
| `InfoWith` | `func InfoWith(msg string, fields ...Field)` | Info 级别结构化日志 |
| `WarnWith` | `func WarnWith(msg string, fields ...Field)` | Warn 级别结构化日志 |
| `ErrorWith` | `func ErrorWith(msg string, fields ...Field)` | Error 级别结构化日志 |
| `FatalWith` | `func FatalWith(msg string, fields ...Field)` | Fatal 级别结构化日志（默认调用 os.Exit(1)，**defer 不会执行**；可通过 FatalHandler 自定义） |

```go
dd.InfoWith("请求完成",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)

dd.ErrorWith("数据库错误",
    dd.Err(err),
    dd.String("query", sql),
)
```

## 级别管理（包级）

| 函数 | 签名 | 说明 |
|------|------|------|
| `SetLevel` | `func SetLevel(level LogLevel) error` | 设置全局日志级别 |
| `GetLevel` | `func GetLevel() LogLevel` | 获取全局日志级别 |
| `IsLevelEnabled` | `func IsLevelEnabled(level LogLevel) bool` | 检查指定级别是否启用 |
| `IsDebugEnabled` | `func IsDebugEnabled() bool` | 检查 Debug 级别是否启用 |
| `IsInfoEnabled` | `func IsInfoEnabled() bool` | 检查 Info 级别是否启用 |
| `IsWarnEnabled` | `func IsWarnEnabled() bool` | 检查 Warn 级别是否启用 |
| `IsErrorEnabled` | `func IsErrorEnabled() bool` | 检查 Error 级别是否启用 |
| `IsFatalEnabled` | `func IsFatalEnabled() bool` | 检查 Fatal 级别是否启用 |

```go
// 动态调整日志级别
dd.SetLevel(dd.LevelDebug)

// 条件日志（避免不必要的计算）
if dd.IsDebugEnabled() {
    dd.Debug(computeExpensiveDebugInfo())
}
```

## 字段链（包级）

| 函数 | 签名 | 说明 |
|------|------|------|
| `WithFields` | `func WithFields(fields ...Field) *LoggerEntry` | 创建带预设字段的 Entry |
| `WithField` | `func WithField(key string, value any) *LoggerEntry` | 创建带单个预设字段的 Entry |

```go
dd.WithFields(dd.String("service", "api"), dd.String("version", "1.0")).
    Info("请求处理完成")

dd.WithField("request_id", "abc123").Info("处理请求")
```

## 生命周期（包级）

| 函数 | 签名 | 说明 |
|------|------|------|
| `Flush` | `func Flush() error` | 刷新全局日志缓冲 |

## Writer 管理（包级）

| 函数 | 签名 | 说明 |
|------|------|------|
| `AddWriter` | `func AddWriter(writer io.Writer) error` | 添加输出写入器 |
| `RemoveWriter` | `func RemoveWriter(writer io.Writer) error` | 移除输出写入器 |
| `WriterCount` | `func WriterCount() int` | 获取写入器数量 |

## 采样控制（包级）

| 函数 | 签名 | 说明 |
|------|------|------|
| `SetSampling` | `func SetSampling(config *SamplingConfig)` | 设置采样配置 |
| `GetSampling` | `func GetSampling() *SamplingConfig` | 获取采样配置 |

## Writer 构造器

| 函数 | 签名 | 说明 |
|------|------|------|
| `NewFileWriter` | `func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)` | 创建文件写入器 |
| `DefaultFileWriterConfig` | `func DefaultFileWriterConfig() FileWriterConfig` | 默认文件写入器配置 |
| `NewBufferedWriter` | `func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)` | 创建缓冲写入器 |
| `DefaultBufferedWriterConfig` | `func DefaultBufferedWriterConfig() BufferedWriterConfig` | 默认缓冲写入器配置 |
| `NewMultiWriter` | `func NewMultiWriter(writers ...io.Writer) *MultiWriter` | 创建多输出写入器 |

## 安全配置构造器

| 函数 | 签名 | 说明 |
|------|------|------|
| `DefaultSecurityConfig` | `func DefaultSecurityConfig() *SecurityConfig` | 默认安全配置（基础过滤） |
| `DefaultSecureConfig` | `func DefaultSecureConfig() *SecurityConfig` | 完整安全配置 |
| `HealthcareConfig` | `func HealthcareConfig() *SecurityConfig` | HIPAA 合规配置 |
| `FinancialConfig` | `func FinancialConfig() *SecurityConfig` | PCI-DSS 合规配置 |
| `GovernmentConfig` | `func GovernmentConfig() *SecurityConfig` | 政府标准配置 |
| `SecurityConfigForLevel` | `func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig` | 按级别获取安全配置 |

## 敏感数据过滤构造器

| 函数 | 签名 | 说明 |
|------|------|------|
| `NewSensitiveDataFilter` | `func NewSensitiveDataFilter() *SensitiveDataFilter` | 完整模式集过滤器 |
| `NewEmptySensitiveDataFilter` | `func NewEmptySensitiveDataFilter() *SensitiveDataFilter` | 空过滤器 |
| `NewCustomSensitiveDataFilter` | `func NewCustomSensitiveDataFilter(patterns ...string) (*SensitiveDataFilter, error)` | 自定义模式过滤器 |

## 钩子构造器

| 函数 | 签名 | 说明 |
|------|------|------|
| `NewHookRegistry` | `func NewHookRegistry() *HookRegistry` | 创建钩子注册表 |
| `NewHooksFromConfig` | `func NewHooksFromConfig(cfg HooksConfig) *HookRegistry` | 从配置创建钩子注册表 |

## 审计日志构造器

| 函数 | 签名 | 说明 |
|------|------|------|
| `NewAuditLogger` | `func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)` | 创建审计日志记录器 |
| `DefaultAuditConfig` | `func DefaultAuditConfig() AuditConfig` | 默认审计配置 |
| `VerifyAuditEvent` | `func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult` | 验证审计事件完整性 |

## 完整性签名构造器

| 函数 | 签名 | 说明 |
|------|------|------|
| `NewIntegritySigner` | `func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)` | 创建完整性签名器 |
| `DefaultIntegrityConfigSafe` | `func DefaultIntegrityConfigSafe() (IntegrityConfig, error)` | 安全随机密钥配置 |

## 测试辅助构造器

| 函数 | 签名 | 说明 |
|------|------|------|
| `NewLoggerRecorder` | `func NewLoggerRecorder() *LoggerRecorder` | 创建日志记录器（测试用） |

## 上下文函数

| 函数 | 签名 | 说明 |
|------|------|------|
| `WithTraceID` | `func WithTraceID(ctx context.Context, traceID string) context.Context` | 设置 Trace ID |
| `WithSpanID` | `func WithSpanID(ctx context.Context, spanID string) context.Context` | 设置 Span ID |
| `WithRequestID` | `func WithRequestID(ctx context.Context, requestID string) context.Context` | 设置 Request ID |
| `GetTraceID` | `func GetTraceID(ctx context.Context) string` | 获取 Trace ID |
| `GetSpanID` | `func GetSpanID(ctx context.Context) string` | 获取 Span ID |
| `GetRequestID` | `func GetRequestID(ctx context.Context) string` | 获取 Request ID |

## JSON 配置

| 函数 | 签名 | 说明 |
|------|------|------|
| `DefaultJSONOptions` | `func DefaultJSONOptions() *JSONOptions` | 默认 JSON 输出选项 |

## 字段构造器

用于创建结构化日志字段（`Field`），配合 `*With` 系列方法或 `WithFields` 使用。

| 函数 | 签名 | 说明 |
|------|------|------|
| `Any` | `func Any(key string, value any) Field` | 任意类型字段 |
| `String` | `func String(key, value string) Field` | 字符串字段 |
| `Bool` | `func Bool(key string, value bool) Field` | 布尔字段 |
| `Int` | `func Int(key string, value int) Field` | int 字段 |
| `Int8` | `func Int8(key string, value int8) Field` | int8 字段 |
| `Int16` | `func Int16(key string, value int16) Field` | int16 字段 |
| `Int32` | `func Int32(key string, value int32) Field` | int32 字段 |
| `Int64` | `func Int64(key string, value int64) Field` | int64 字段 |
| `Uint` | `func Uint(key string, value uint) Field` | uint 字段 |
| `Uint8` | `func Uint8(key string, value uint8) Field` | uint8 字段 |
| `Uint16` | `func Uint16(key string, value uint16) Field` | uint16 字段 |
| `Uint32` | `func Uint32(key string, value uint32) Field` | uint32 字段 |
| `Uint64` | `func Uint64(key string, value uint64) Field` | uint64 字段 |
| `Float32` | `func Float32(key string, value float32) Field` | float32 字段 |
| `Float64` | `func Float64(key string, value float64) Field` | float64 字段 |
| `Duration` | `func Duration(key string, value time.Duration) Field` | 时间段字段 |
| `Time` | `func Time(key string, value time.Time) Field` | 时间字段 |
| `Err` | `func Err(err error) Field` | 错误字段（key 为 "error"） |
| `ErrWithKey` | `func ErrWithKey(key string, err error) Field` | 自定义 key 的错误字段 |
| `ErrWithStack` | `func ErrWithStack(err error) Field` | 含堆栈跟踪的错误字段 |

```go
dd.InfoWith("请求完成",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
    dd.Err(err),
)
```

:::tip 类型安全建议
优先使用类型明确的构造器（如 `Int`、`String`），而非 `Any`，可在编译期捕获类型错误，避免运行时因类型不符产生问题。
:::

## 字段验证配置

| 函数 | 签名 | 说明 |
|------|------|------|
| `DefaultFieldValidationConfig` | `func DefaultFieldValidationConfig() *FieldValidationConfig` | 默认字段验证（无验证） |
| `StrictSnakeCaseConfig` | `func StrictSnakeCaseConfig() *FieldValidationConfig` | 严格 snake_case 验证 |
| `StrictCamelCaseConfig` | `func StrictCamelCaseConfig() *FieldValidationConfig` | 严格 camelCase 验证 |

## 调试输出函数

| 函数 | 签名 | 说明 |
|------|------|------|
| `Print` | `func Print(args ...any)` | 输出到全局日志 Writer（LevelInfo，受安全过滤） |
| `Println` | `func Println(args ...any)` | 同 Print（底层 Log() 已自动换行，受安全过滤） |
| `Printf` | `func Printf(format string, args ...any)` | 格式化输出（LevelInfo，受安全过滤） |
| `JSON` | `func JSON(data ...any)` | 紧凑 JSON 格式输出到 stdout（含调用者信息，不经过安全过滤） |
| `JSONF` | `func JSONF(format string, args ...any)` | 格式化字符串作为紧凑 JSON 输出到 stdout（含调用者信息，不经过安全过滤） |
| `Text` | `func Text(data ...any)` | 美化打印格式输出到 stdout（不经过安全过滤） |
| `Textf` | `func Textf(format string, args ...any)` | 格式化文本输出到 stdout（不经过安全过滤） |
| `Exit` | `func Exit(data ...any)` | 带调用者信息的文本输出后退出（exit code 0），复杂类型自动美化打印，不经过安全过滤 |
| `Exitf` | `func Exitf(format string, args ...any)` | 带调用者信息的格式化输出后退出（exit code 0，不经过安全过滤） |

:::warning 调试函数安全提示
`Print`/`Println`/`Printf` 经过安全过滤，但 `JSON`/`JSONF`/`Text`/`Textf`/`Exit`/`Exitf` 直接输出原始数据，**不经过安全过滤**。
:::

## 下一步

- [Logger](./logger) -- Logger 实例方法详解
- [LoggerEntry](./entry) -- 预设字段的日志 Entry
- [配置](./config) -- Config 结构体
- [调试输出](../dev-tools/debug-visual) -- 调试可视化函数

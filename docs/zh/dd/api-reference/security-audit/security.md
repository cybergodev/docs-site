---
sidebar_label: "安全过滤"
title: "安全过滤 - CyberGo DD | 敏感数据过滤"
description: "CyberGo DD 敏感数据过滤 API 文档：SensitiveDataFilter 过滤规则、SecurityConfig 安全策略与预设方案，自动脱敏日志中的密码、API 密钥、Token 等敏感信息，防止日志泄露。"
sidebar_position: 2
---

# 安全过滤

> 🔧 **API 参考** · 使用教程见 [敏感数据过滤](../../guides/security/sensitive-filtering)

DD 内置敏感数据过滤功能，可自动检测和脱敏日志中的密码、密钥、Token 等敏感信息。

## SensitiveDataFilter

基于正则的敏感数据过滤器，支持动态模式和缓存。

### 创建

| 函数 | 签名 | 说明 |
|------|------|------|
| `NewSensitiveDataFilter` | `() *SensitiveDataFilter` | 完整模式集 |
| `NewEmptySensitiveDataFilter` | `() *SensitiveDataFilter` | 空过滤器 |
| `NewCustomSensitiveDataFilter` | `(patterns ...string) (*SensitiveDataFilter, error)` | 自定义模式 |

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `AddPattern` | `(pattern string) error` | 添加正则模式 |
| `AddPatterns` | `(patterns ...string) error` | 批量添加模式 |
| `ClearPatterns` | `()` | 清除所有模式 |
| `PatternCount` | `() int` | 模式数量 |
| `Enable` | `()` | 启用过滤 |
| `Disable` | `()` | 禁用过滤 |
| `IsEnabled` | `() bool` | 是否启用 |
| `Filter` | `(input string) string` | 过滤字符串 |
| `FilterFieldValue` | `(key string, value any) any` | 过滤单个字段值 |
| `FilterString` | `(key, value string) string` | 过滤字符串值（基于字段 key 上下文） |
| `FilterValueRecursive` | `(key string, value any) any` | 递归过滤嵌套结构 |
| `GetFilterStats` | `() FilterStats` | 获取过滤统计 |
| `ActiveGoroutineCount` | `() int32` | 活跃过滤协程数 |
| `WaitForGoroutines` | `(timeout time.Duration) bool` | 等待过滤协程完成 |
| `Close` | `() bool` | 关闭过滤器并释放缓存 |

### 自定义模式

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,     // 密码
    `(?i)api[_-]?key\s*[:=]\s*\S+`,  // API Key
    `\b\d{16,19}\b`,                  // 信用卡号
)
```

#### 错误

模式注册类 API（`NewCustomSensitiveDataFilter` / `AddPattern` / `AddPatterns`）可能返回以下错误：

| 错误 | 触发条件 |
|------|----------|
| `ErrEmptyPattern` | 模式为空字符串（`AddPatterns` 会跳过空模式而不报错） |
| `ErrPatternTooLong` | 模式超过 1000 字符 |
| `ErrInvalidPattern` | 正则编译失败（包装底层 `regexp.Compile` 错误） |
| `ErrReDoSPattern` | 模式含危险嵌套量词（ReDoS 防护） |
| `ErrNilFilter` | 方法接收者为 `nil` |
| `ErrPatternFailed` | `AddPatterns` 失败时的外层包装错误，内层为具体原因（`errors.Is` 均可匹配） |

## SecurityConfig

安全配置结构体，控制过滤行为和安全级别。

```go
type SecurityConfig struct {
    MaxMessageSize  int               // 消息大小上限（字节，0 表示不限制，预设配置默认 5MB）
    MaxWriters      int               // 最大 Writer 数量（预设配置默认 100；当前为提示性字段，上限固定为 100，由 Logger.AddWriter 按 ErrMaxWritersExceeded 强制，与此值无关）
    SensitiveFilter *SensitiveDataFilter // 敏感数据过滤器
    RateLimitConfig *RateLimitConfig  // 速率限制配置（dd 包导出的类型别名，nil 表示禁用限流；预设配置均不填充该字段）
}
```

### RateLimitConfig

速率限制配置，用于防止日志洪泛（DoS）并维持系统在高负载下的稳定性。`dd` 包导出的是类型别名 `type RateLimitConfig = internal.RateLimitConfig`，可直接构造与修改，挂在 [`SecurityConfig.RateLimitConfig`](#securityconfig) 上生效。

```go
type RateLimitConfig struct {
    MaxMessagesPerSecond int               // 每秒最大消息数（0 表示不限制）
    MaxBytesPerSecond    int64             // 每秒最大字节数（0 表示不限制）
    BurstSize            int               // 突发容量（允许瞬时超出每秒消息配额）
    Strategy             RateLimitStrategy // 超限处理策略
    SamplingRate         int               // 采样保留率（Sample 策略下每 N 条保留 1 条）
}
```

#### 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `MaxMessagesPerSecond` | `int` | `10000` | 每秒最大消息数，`0` 表示不限制 |
| `MaxBytesPerSecond` | `int64` | `10MB` | 每秒最大写入字节数，`0` 表示不限制 |
| `BurstSize` | `int` | `1000` | 突发容量，容忍日志量瞬时尖峰 |
| `Strategy` | `RateLimitStrategy` | `RateLimitStrategyDrop` | 超限处理策略（见下节） |
| `SamplingRate` | `int` | `100` | `RateLimitStrategySample` 时每 100 条保留 1 条 |

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Clone` | `func (c *RateLimitConfig) Clone() *RateLimitConfig` | 复制配置（nil 接收者返回 `nil`） |

:::info 默认不启用限流
所有预设配置（`DefaultSecurityConfig`、`SecurityConfigForLevel` 等）均**不填充** `RateLimitConfig` 字段，即默认不启用限流；仅当显式设置后，Logger 才会据此初始化限流器。如需启用，从工厂函数 `DefaultRateLimitConfig()` 出发按需调整字段；如需关闭，将其置为 `nil` 即可。超限消息被丢弃或采样时，若配置了审计（`Config.Audit`），会发出 `RATE_LIMIT_EXCEEDED` 审计事件。
:::

### RateLimitStrategy

限流策略枚举，决定超出速率限制的消息如何处理（`dd` 包导出的类型别名 `type RateLimitStrategy = internal.RateLimitStrategy`），通过 `RateLimitConfig.Strategy` 字段设置：

| 常量 | 说明 |
|------|------|
| `RateLimitStrategyDrop` | 超限时直接丢弃消息（默认策略） |
| `RateLimitStrategySample` | 超限时按 `SamplingRate` 采样保留（每 N 条保留 1 条） |
| `RateLimitStrategyThrottle` | 为 API 完整性保留，当前实际行为与 `RateLimitStrategyDrop` 相同（见下方提示） |

:::warning 限流策略 Throttle 的现状
`RateLimitStrategyThrottle` 当前为非阻塞实现，实际行为与 `RateLimitStrategyDrop` 相同——超额消息即被丢弃，而非延迟或背压。Logger 热路径不允许阻塞，内部处理超限时该策略直接落入丢弃分支；该常量仅为未来的非阻塞限流策略保留，勿依赖它提供真正的背压。
:::

### FilterStats

过滤统计数据结构，用于监控和可观测性。

```go
type FilterStats struct {
    ActiveGoroutines  int32         // 当前活跃的过滤协程数
    PatternCount      int32         // 已注册的敏感数据模式数
    SemaphoreCapacity int           // 最大并发过滤操作数
    MaxInputLength    int           // 输入长度截断阈值
    Enabled           bool          // 是否启用过滤
    TotalFiltered     int64         // 总过滤操作数
    TotalRedactions   int64         // 总脱敏次数
    TotalTimeouts     int64         // 总超时次数
    AverageLatency    time.Duration // 平均过滤延迟
    CacheHits         int64         // 缓存命中次数
    CacheMiss         int64         // 缓存未命中次数
}
```

### SecurityLevel

安全级别枚举，用于通过 `SecurityConfigForLevel` 快速获取预设配置。

```go
type SecurityLevel int
```

实现了 `String()` 方法，返回可读的级别名称。

| 常量 | 说明 |
|------|------|
| `SecurityLevelDevelopment` | 开发环境（无敏感过滤、无限流） |
| `SecurityLevelBasic` | 基础过滤（密码、令牌、API Key、信用卡、SSN、电话、SWIFT/CVV 等 38 类常见敏感数据；完整模式库 69 类） |
| `SecurityLevelStandard` | 标准过滤（推荐生产环境） |
| `SecurityLevelStrict` | 严格过滤（PII/金融数据环境） |
| `SecurityLevelParanoid` | 极致过滤（高风险环境） |

### 预设配置

| 函数 | 说明 | 适用场景 |
|------|------|----------|
| `DefaultSecurityConfig()` | 基础敏感数据过滤 | 生产环境（推荐） |
| `DefaultSecureConfig()` <Badge type="warning" text="已弃用" /> | 完整敏感数据过滤（与 `DefaultSecurityConfig` 近义但过滤强度不同，易混淆；**改用 `SecurityConfigForLevel(dd.SecurityLevelStandard)`**） | 高安全需求 |
| `HealthcareConfig()` | HIPAA 合规 | 医疗行业 |
| `FinancialConfig()` | PCI-DSS 合规 | 金融行业 |
| `GovernmentConfig()` | 政府标准 | 公共部门 |

### 按级别配置

```go
func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig
```

| 级别 | 常量 | 说明 |
|------|------|------|
| Development | `SecurityLevelDevelopment` | 开发环境，最宽松 |
| Basic | `SecurityLevelBasic` | 基础过滤 |
| Standard | `SecurityLevelStandard` | 标准过滤 |
| Strict | `SecurityLevelStrict` | 严格过滤 |
| Paranoid | `SecurityLevelParanoid` | 极致过滤 |

:::tip 级别预设只选择过滤器
安全级别仅决定 `SensitiveFilter` 的过滤强度：限流（`RateLimitConfig`）、审计日志（`Config.Audit`）与完整性签名（`Config.Audit.IntegritySigner`）均为独立设置，任何级别预设都不会启用，需要时须显式配置。
:::

### Clone

```go
func (sc *SecurityConfig) Clone() *SecurityConfig
```

创建安全配置的深拷贝：`SensitiveFilter` 与 `RateLimitConfig` 均复制为独立实例；nil 接收者返回 `nil`。

## 使用方式

### 通过 Config 配置

```go
// DefaultConfig 已内置 DefaultSecurityConfig()，通常无需显式赋值
cfg := dd.DefaultConfig()
logger, _ := dd.New(cfg)

// 如需替换为更高安全级别配置，则显式覆盖
// cfg.Security = dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
```

### 运行时修改

```go
// 更新安全配置
logger.SetSecurityConfig(dd.SecurityConfigForLevel(dd.SecurityLevelStandard))

// 读取当前配置
sec := logger.GetSecurityConfig()
```

### 过滤嵌套结构

```go
filter := dd.NewSensitiveDataFilter()

// 字符串过滤
filtered := filter.Filter("password=s3cr3t")
// → "password=[REDACTED]"

// 嵌套结构（自动递归，支持循环引用检测）
data := map[string]any{
    "user": map[string]any{
        "name":     "admin",
        "password": "s3cr3t",
        "token":    "eyJhbGciOi...",
    },
}
filteredData := filter.FilterValueRecursive("data", data)
```

### 监控过滤统计

```go
filter := dd.NewSensitiveDataFilter()
// ... 使用过滤 ...
stats := filter.GetFilterStats()
fmt.Printf("总过滤: %d, 脱敏: %d, 平均延迟: %v\n",
    stats.TotalFiltered, stats.TotalRedactions, stats.AverageLatency)
```

## 下一步

- [配置](../core/config) -- SecurityConfig 配置
- [Logger](../core/logger) -- SetSecurityConfig 方法
- [审计日志](./audit) -- 安全事件审计

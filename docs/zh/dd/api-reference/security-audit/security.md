---
sidebar_label: "安全过滤"
title: "安全过滤 - CyberGo DD | 敏感数据过滤"
description: "CyberGo DD 敏感数据过滤完整 API 文档，包括 SensitiveDataFilter 过滤规则配置、SecurityConfig 安全策略选项和预设安全配置方案，自动检测和脱敏日志中的密码、API 密钥、Token、手机号和身份证号等敏感信息，有效防止日志泄露风险。"
sidebar_position: 2
---

# 安全过滤

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

## SecurityConfig

安全配置结构体，控制过滤行为和安全级别。

```go
type SecurityConfig struct {
    MaxMessageSize  int                       // 消息大小上限（字节，0 表示不限制，预设配置默认 5MB）
    MaxWriters      int                       // 最大 Writer 数量（预设配置默认 100）
    SensitiveFilter *SensitiveDataFilter      // 敏感数据过滤器
    RateLimitConfig *internal.RateLimitConfig // 速率限制配置（内部类型，nil 表示禁用限流；预设配置均不填充该字段）
}
```

:::info 关于 RateLimitConfig
`RateLimitConfig` 控制日志速率限制，用于防止日志洪泛（DoS）并维持系统在高负载下的稳定性。该字段为内部类型（`*internal.RateLimitConfig`），无法直接构造。所有预设配置（`DefaultSecurityConfig`、`DefaultSecureConfig`、`SecurityConfigForLevel` 等）均**不填充**该字段，即默认不启用限流；仅当显式设置后，Logger 才会据此初始化限流器。如需关闭限流，将其置为 `nil` 即可。
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
| `SecurityLevelBasic` | 基础过滤（密码、令牌、API Key、信用卡、SSN、电话、SWIFT/CVV 等约 40 类常见敏感数据） |
| `SecurityLevelStandard` | 标准过滤（推荐生产环境） |
| `SecurityLevelStrict` | 严格过滤（PII/金融数据环境） |
| `SecurityLevelParanoid` | 极致过滤（高风险环境） |

### 预设配置

| 函数 | 说明 | 适用场景 |
|------|------|----------|
| `DefaultSecurityConfig()` | 基础敏感数据过滤 | 生产环境（推荐） |
| `DefaultSecureConfig()` | 完整敏感数据过滤 | 高安全需求 |
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

### Clone

```go
func (c *SecurityConfig) Clone() *SecurityConfig
```

创建安全配置的深拷贝。

## 使用方式

### 通过 Config 配置

```go
// DefaultConfig 已内置 DefaultSecurityConfig()，通常无需显式赋值
cfg := dd.DefaultConfig()
logger, _ := dd.New(cfg)

// 如需替换为更高安全级别配置，则显式覆盖
// cfg.Security = dd.DefaultSecureConfig()
```

### 运行时修改

```go
// 更新安全配置
logger.SetSecurityConfig(dd.DefaultSecureConfig())

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

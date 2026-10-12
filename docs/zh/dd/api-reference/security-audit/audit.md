---
sidebar_label: "AuditLogger"
title: "审计日志 - CyberGo DD | AuditLogger"
description: "CyberGo DD 审计日志 API 文档：AuditLogger 异步审计事件记录器、AuditConfig 配置选项（输出目标、格式、签名）与审计条目结构化格式化，支持安全事件追踪与合规审计，满足数据安全监管需求。"
sidebar_position: 3
---

# 审计日志

> 🔧 **API 参考** · 使用教程见 [审计日志](../../guides/security/audit-logging)

DD 提供异步审计日志功能，记录安全相关事件，支持完整性签名和条目序列号追踪。

## AuditLogger

异步安全审计事件记录器。

### 创建

```go
func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)
```

使用传入的 `AuditConfig` 创建异步审计记录器。可用 `DefaultAuditConfig()` 获取带合理默认值的配置。

返回错误的情况：配置校验失败（如 `BufferSize` 为负数）。

```go
// 使用默认配置
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())

// 自定义配置
cfg := dd.DefaultAuditConfig()
cfg.JSONFormat = true
cfg.MinimumSeverity = dd.AuditSeverityWarning
auditLogger, _ := dd.NewAuditLogger(cfg)
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Log` | `(event AuditEvent)` | 记录审计事件（异步；低于 `MinimumSeverity` 不记录，缓冲区满时丢弃并计入 `Dropped`，`Timestamp` 为零值时自动填充） |
| `LogSensitiveDataRedaction` | `(pattern, field, message string)` | 敏感数据脱敏事件 |
| `LogRateLimitExceeded` | `(message string, metadata map[string]any)` | 速率限制事件 |
| `LogSecurityViolation` | `(violationType, message string, metadata map[string]any)` | 安全违规事件 |
| `LogReDoSAttempt` | `(pattern, message string)` | ReDoS 攻击事件 |
| `LogIntegrityViolation` | `(message string, metadata map[string]any)` | 完整性违规事件 |
| `LogPathTraversalAttempt` | `(path, message string)` | 路径遍历事件 |
| `Stats` | `() AuditStats` | 审计统计 |
| `Close` | `() error` | 关闭并刷新剩余事件（可安全重复调用，幂等） |

### 使用示例

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

// 记录敏感数据脱敏
audit.LogSensitiveDataRedaction("password", "login_form", "检测到密码字段明文")

// 记录速率限制
audit.LogRateLimitExceeded("API 请求超过限制", map[string]any{
    "client_ip": "192.168.1.100",
    "limit":     100,
    "current":   150,
})

// 记录安全违规
audit.LogSecurityViolation("sql_injection", "SQL 注入尝试", map[string]any{
    "input": "' OR 1=1 --",
})
```

## AuditConfig

审计日志配置。

```go
type AuditConfig struct {
    Enabled          bool             // 是否启用审计（默认 true；false 时 Log 为静默 no-op，事件不计入统计）
    Output           *os.File         // 输出文件（默认 os.Stderr）；为 nil 时不产生输出，事件仅计入统计
    BufferSize       int              // 异步事件缓冲区大小（默认 1000；启用且留 0 时自动取 1000，负数校验失败）
    IncludeTimestamp bool             // 文本输出是否包含时间戳（默认 true；JSON 输出始终包含时间戳字段）
    JSONFormat       bool             // JSON 格式输出（默认 true）
    MinimumSeverity  AuditSeverity    // 最低记录严重级别（默认 AuditSeverityInfo）
    IntegritySigner  *IntegritySigner // 完整性签名器（可选；配置后每条审计事件被签名）
}
```

### 默认配置

```go
func DefaultAuditConfig() AuditConfig
```

返回默认审计配置，审计日志默认启用。

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Validate` | `() error` | 验证配置合法性（`BufferSize` 为负数则返回错误） |
| `Clone` | `() AuditConfig` | 复制配置（`IntegritySigner` 为共享引用，不深拷贝） |

## AuditEvent

审计事件结构体。

```go
type AuditEvent struct {
    Type      AuditEventType `json:"type"`
    Timestamp time.Time      `json:"timestamp"`
    Message   string         `json:"message"`
    Pattern   string         `json:"pattern,omitempty"`
    Field     string         `json:"field,omitempty"`
    Metadata  map[string]any `json:"metadata,omitempty"`
    Severity  AuditSeverity  `json:"severity"`
}
```

## AuditStats

审计统计数据结构。

```go
type AuditStats struct {
    TotalEvents int64                    // 总事件数
    Dropped     int64                    // 丢弃事件数（缓冲区满时累加）
    ByType      map[AuditEventType]int64 // 按类型统计
    BufferSize  int                      // 缓冲区大小
    BufferUsage int                      // 当前缓冲区使用量
}
```

## AuditVerificationResult

审计验证结果。

```go
type AuditVerificationResult struct {
    Valid    bool         // 验证是否通过
    Event    *AuditEvent  // 解析出的事件
    RawEvent string       // 原始事件字符串
    Error    error        // 验证错误
}
```

## 审计事件类型

| 常量 | String() | 说明 |
|------|----------|------|
| `AuditEventSensitiveDataRedacted` | `"SENSITIVE_DATA_REDACTED"` | 敏感数据已脱敏 |
| `AuditEventRateLimitExceeded` | `"RATE_LIMIT_EXCEEDED"` | 速率限制超出 |
| `AuditEventReDoSAttempt` | `"REDOS_ATTEMPT"` | ReDoS 攻击尝试 |
| `AuditEventSecurityViolation` | `"SECURITY_VIOLATION"` | 安全违规 |
| `AuditEventIntegrityViolation` | `"INTEGRITY_VIOLATION"` | 完整性违规 |
| `AuditEventInputSanitized` | `"INPUT_SANITIZED"` | 输入已清洗 |
| `AuditEventPathTraversalAttempt` | `"PATH_TRAVERSAL_ATTEMPT"` | 路径遍历尝试 |
| `AuditEventLog4ShellAttempt` | `"LOG4SHELL_ATTEMPT"` | Log4Shell 攻击尝试 |
| `AuditEventNullByteInjection` | `"NULL_BYTE_INJECTION"` | Null 字节注入 |
| `AuditEventOverlongEncoding` | `"OVERLONG_ENCODING"` | 超长编码攻击 |
| `AuditEventHomographAttack` | `"HOMOGRAPH_ATTACK"` | 同形字攻击 |

## 审计严重级别

| 常量 | String() | 说明 |
|------|----------|------|
| `AuditSeverityInfo` | `"INFO"` | 信息 |
| `AuditSeverityWarning` | `"WARNING"` | 警告 |
| `AuditSeverityError` | `"ERROR"` | 错误 |
| `AuditSeverityCritical` | `"CRITICAL"` | 严重 |

### MarshalJSON

```go
func (s AuditSeverity) MarshalJSON() ([]byte, error)
```

`AuditSeverity` 实现了 `json.Marshaler` 接口，JSON 序列化时输出字符串而非整数：

```go
event := dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Severity: dd.AuditSeverityCritical,
}
data, _ := json.Marshal(event)
// Severity 序列化为 "CRITICAL"，而非 3
```

### UnmarshalJSON

```go
func (s *AuditSeverity) UnmarshalJSON(data []byte) error
```

`*AuditSeverity` 实现了 `json.Unmarshaler` 接口，接受 `MarshalJSON` 输出的字符串形式（`"INFO"`、`"WARNING"`、`"ERROR"`、`"CRITICAL"`）并反序列化为对应常量；传入其他字符串返回 `unknown audit severity` 错误，传入非字符串 JSON 值同样报错。没有该方法时，`json.Unmarshal` 无法把 JSON 字符串解码进 `AuditSeverity` 的 int 底层类型，`VerifyAuditEvent` 解析出的 `Event` 字段将始终为 `nil`。

```go
var sev dd.AuditSeverity
err := json.Unmarshal([]byte(`"CRITICAL"`), &sev)
// err == nil，sev == dd.AuditSeverityCritical

err = json.Unmarshal([]byte(`"FATAL"`), &sev)
// err != nil：unknown audit severity "FATAL"
```

:::warning 序列化格式不对称
`AuditEvent.Type` 序列化为**裸数字**，而 `AuditSeverity` 序列化为**字符串**（仅 Severity 有自定义字符串 Marshal/Unmarshal）。该行为是有意设计且被测试锁定；解析审计 JSON 时注意区分，人类可读的事件类型名需经 `AuditEventType.String()` 获取。
:::

## 验证审计条目

```go
func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult
```

验证审计日志条目的完整性。返回值恒非 `nil`：`signer` 为 `nil` 或内部验证出错时 `Valid=false` 且 `Error` 非空；签名不匹配时 `Valid=false`、`Error` 为 `nil`，`RawEvent` 为去除签名后的消息文本；验证通过且消息可解析为 JSON 时 `Event` 非空。

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
result := dd.VerifyAuditEvent(logEntry, signer)
if result != nil && result.Valid {
    fmt.Println("审计条目验证通过")
}
```

## 下一步

- [完整性签名](./integrity) -- IntegritySigner 详解
- [安全过滤](./security) -- 敏感数据过滤
- [钩子系统](../core/hooks) -- OnError 钩子

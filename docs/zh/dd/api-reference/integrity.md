---
title: "完整性签名 - CyberGo DD | IntegritySigner"
description: "CyberGo DD 完整性签名完整 API 文档，支持 HMAC-SHA256 算法签名和序列号递增追踪机制，确保每条日志条目未被篡改，提供 IntegritySigner 签名器和 Verify 验证器，满足安全审计和日志防篡改等各类合规要求。"
---

# 完整性签名

DD 提供基于 HMAC 的日志完整性签名机制，可验证日志条目未被篡改。

## IntegritySigner

日志条目签名器，支持 HMAC 签名和链式验证。

### 创建

```go
func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)
```

```go
// 安全创建（推荐用于生产）
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// 自定义配置
cfg := dd.IntegrityConfig{
    SecretKey:      []byte("my-secret-key-that-is-at-least-32b!"),
    HashAlgorithm:  dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,
    IncludeSequence:  true,
}
signer, err = dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}
```

### 签名方法

#### Sign

```go
func (s *IntegritySigner) Sign(message string) string
```

为日志消息生成 HMAC 签名。线程安全，可并发调用。

```go
sig := signer.Sign("用户登录 admin 192.168.1.1")
// → "[SIG:1713456789000000000:1:base64signature...]"
```

#### SignFields

```go
func (s *IntegritySigner) SignFields(message string, fields []Field) string
```

为带字段的消息生成签名，签名包含消息和所有字段值。线程安全，可并发调用。

```go
sig := signer.SignFields("用户登录", []dd.Field{
    dd.String("user", "admin"),
    dd.String("ip", "192.168.1.1"),
})
```

### 验证方法

#### Verify

```go
func (s *IntegritySigner) Verify(entry string) (*LogIntegrity, error)
```

验证日志条目的完整性。线程安全，可并发调用。

```go
integrity, err := signer.Verify(signedEntry)
if err != nil {
    // 验证出错（如 signer 为 nil）
}
if !integrity.Valid {
    // 签名无效：签名不匹配或格式错误
}
if integrity.Sequence != expectedSeq {
    // 序列号不连续：可能有条目被删除
}
```

### 其他方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `GetSequence` | `() uint64` | 当前序列号 |
| `ResetSequence` | `()` | 重置序列号 |
| `Stats` | `() IntegrityStats` | 签名统计 |

## IntegrityConfig

签名配置。

```go
type IntegrityConfig struct {
    SecretKey       []byte         // HMAC 密钥
    HashAlgorithm   HashAlgorithm  // 哈希算法
    IncludeTimestamp bool           // 签名包含时间戳
    IncludeSequence  bool           // 签名包含序列号
    SignaturePrefix  string        // 签名前缀
}
```

### 安全创建

```go
func DefaultIntegrityConfigSafe() (IntegrityConfig, error)
```

安全创建默认配置（自动生成密钥）。推荐生产使用。

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Validate` | `() error` | 验证配置合法性 |
| `Clone` | `() IntegrityConfig` | 复制配置 |
| `MarshalJSON` | `() ([]byte, error)` | JSON 序列化（密钥不参与序列化，仅输出长度） |

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}
```

## LogIntegrity

日志完整性验证结果。

```go
type LogIntegrity struct {
    Valid     bool       // 签名是否有效
    Timestamp time.Time  // 签名时间戳
    Sequence  uint64     // 序列号
    Message   string     // 原始消息
}
```

## IntegrityStats

签名统计数据。

```go
type IntegrityStats struct {
    Sequence         uint64 // 当前序列号
    Algorithm        string // 算法名称
    IncludeTimestamp bool   // 是否包含时间戳
    IncludeSequence  bool   // 是否包含序列号
}
```

## HashAlgorithm

| 常量 | 说明 |
|------|------|
| `HashAlgorithmSHA256` | SHA-256 算法 |

实现了 `String()` 方法，返回算法名称。

## 完整示例

### 日志签名流程

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// 签名日志
message := "用户登录"
signature := signer.Sign(message)

// 存储带签名的日志条目
logEntry := message + signature

// 验证日志
result, err := signer.Verify(logEntry)
if err != nil {
    fmt.Println("完整性验证失败:", err)
} else if result.Valid {
    fmt.Printf("验证通过 - 序列号: %d\n", result.Sequence)
}
```

### 审计集成

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

auditCfg := dd.DefaultAuditConfig()
auditCfg.IntegritySigner = signer
audit, _ := dd.NewAuditLogger(auditCfg)
defer audit.Close()

// 审计日志自动签名
audit.Log(dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Message:  "SQL 注入尝试",
    Severity: dd.AuditSeverityCritical,
    Metadata: map[string]any{"input": "' OR 1=1"},
})

// 验证审计日志
stats := signer.Stats()
fmt.Printf("算法: %s, 序列号: %d\n", stats.Algorithm, stats.Sequence)
```

## 下一步

- [审计日志](./audit) -- AuditLogger 详解
- [安全过滤](./security) -- 敏感数据过滤
- [常量与错误](./constants) -- 错误码

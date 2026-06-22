---
title: "审计日志 - CyberGo env | 安全审计配置"
description: "CyberGo env 审计日志配置指南，涵盖 JSON 文件、标准日志与 Channel 处理器，及自定义 AuditHandler 记录变量加载、读取、修改与删除操作。"
---

# 审计日志

审计日志功能记录所有环境变量操作，用于安全审计、合规检查和问题排查。

## 启用审计

### 配置启用

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, _ := env.New(cfg)
```

### 配置预设

| 预设 | 审计状态 |
|------|----------|
| `DefaultConfig()` | 禁用 |
| `DevelopmentConfig()` | 禁用 |
| `TestingConfig()` | 禁用 |
| `ProductionConfig()` | 启用 |

---

## 审计处理器

### JSONAuditHandler

输出 JSON 格式日志：

```go
import (
    "os"
    "github.com/cybergodev/env"
)

cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**输出示例：**

```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration_ns":1234567}
{"timestamp":"2024-01-15T10:30:01Z","action":"get","key":"API_KEY","success":true,"masked":true}
{"timestamp":"2024-01-15T10:30:02Z","action":"set","key":"CUSTOM_VAR","success":true}
```

---

### LogAuditHandler

使用标准 log 包输出：

```go
import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**输出示例：**

```text
[AUDIT] 2024/01/15 10:30:00 action=load success=true reason="" file=.env duration=1.23ms
[AUDIT] 2024/01/15 10:30:01 action=get key=API_KEY success=true reason=""
[AUDIT] 2024/01/15 10:30:02 action=set key=CUSTOM_VAR success=true reason=""
```

---

### ChannelAuditHandler

发送到通道进行异步处理：

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// 异步处理审计事件
go func() {
    for event := range ch {
        processAuditEvent(event)
    }
}()
```

**使用场景：**
- 发送到远程日志服务
- 写入数据库
- 实时监控告警

---

### NopAuditHandler

空操作处理器，丢弃所有事件：

```go
cfg.AuditHandler = env.NewNopAuditHandler()
```

**使用场景：**
- 临时禁用审计
- 测试环境

---

## 审计事件

### AuditEvent 结构

```go
type AuditEvent struct {
    Timestamp time.Time   // 时间戳
    Action    AuditAction // 操作类型
    Key       string      // 键名
    File      string      // 文件名
    Reason    string      // 原因
    Success   bool        // 是否成功
    Masked    bool        // 是否掩码
    Details   string      // 详情
    Duration  int64       // 耗时（纳秒）
}
```

### AuditAction 操作类型

| 常量 | 值 | 说明 |
|------|---|------|
| `ActionLoad` | `load` | 文件加载 |
| `ActionParse` | `parse` | 解析操作 |
| `ActionGet` | `get` | 变量读取 |
| `ActionSet` | `set` | 变量设置 |
| `ActionDelete` | `delete` | 变量删除 |
| `ActionValidate` | `validate` | 验证操作 |
| `ActionExpand` | `expand` | 变量展开 |
| `ActionSecurity` | `security` | 安全事件 |
| `ActionError` | `error` | 错误事件 |
| `ActionFileAccess` | `file_access` | 文件访问 |

---

## 自定义处理器

### 实现 FullAuditLogger 接口

`FullAuditLogger` 是完整的审计日志接口，扩展了最小接口 `AuditLogger`（仅包含 `LogError` 方法）：

```go
type FullAuditLogger interface {
    AuditLogger  // 嵌入最小接口（LogError）
    Log(action AuditAction, key, reason string, success bool) error
    LogWithFile(action AuditAction, key, file, reason string, success bool) error
    LogWithDuration(action AuditAction, key, reason string, success bool, duration time.Duration) error
    Close() error
}
```

### 示例：数据库审计处理器

```go
package myhandler

import (
    "database/sql"
    "time"
    "github.com/cybergodev/env"
)

type DatabaseAuditHandler struct {
    db *sql.DB
}

func NewDatabaseAuditHandler(db *sql.DB) *DatabaseAuditHandler {
    return &DatabaseAuditHandler{db: db}
}

func (h *DatabaseAuditHandler) Log(action env.AuditAction, key, reason string, success bool) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, reason, success)
        VALUES (?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, reason, success)
    return err
}

func (h *DatabaseAuditHandler) LogError(action env.AuditAction, key, errMsg string) error {
    return h.Log(action, key, errMsg, false)
}

func (h *DatabaseAuditHandler) LogWithFile(action env.AuditAction, key, file, reason string, success bool) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, file, reason, success)
        VALUES (?, ?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, file, reason, success)
    return err
}

func (h *DatabaseAuditHandler) LogWithDuration(action env.AuditAction, key, reason string, success bool, duration time.Duration) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, reason, success, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, reason, success, duration.Milliseconds())
    return err
}

func (h *DatabaseAuditHandler) Close() error {
    return nil
}
```

---

## 完整示例

### 生产环境配置

```go
package main

import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // 创建审计日志文件
    auditFile, err := os.OpenFile("/var/log/app/env-audit.log",
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
    if err != nil {
        log.Fatal(err)
    }
    defer auditFile.Close()

    // 配置
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    // 创建加载器
    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // 加载配置
    err = loader.LoadFiles(".env")
    if err != nil {
        log.Fatal(err)
    }

    // 验证
    err = loader.Validate()
    if err != nil {
        log.Fatal(err)
    }

    // 使用配置
    log.Println("Configuration loaded successfully")
}
```

### 异步审计处理

```go
package main

import (
    "encoding/json"
    "log"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // 创建审计事件通道
    auditChan := make(chan env.AuditEvent, 1000)

    // 启动异步处理器
    go processAuditEvents(auditChan)

    // 配置
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    cfg.AuditHandler = env.NewChannelAuditHandler(auditChan)

    loader, _ := env.New(cfg)
    defer loader.Close()

    // 正常使用...
}

func processAuditEvents(ch chan env.AuditEvent) {
    file, _ := os.OpenFile("/var/log/app/audit.log",
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
    defer file.Close()

    encoder := json.NewEncoder(file)

    for event := range ch {
        // 可添加过滤、聚合等逻辑
        if event.Action == env.ActionError {
            log.Printf("Audit error: %+v", event)
        }

        encoder.Encode(event)
    }
}
```

---

## 安全注意事项

### 敏感值自动掩码

审计日志自动掩码敏感键的值：

```go
// 获取敏感值时自动掩码
secret := loader.GetSecure("API_KEY")
// 审计记录: {"action":"get","key":"API_KEY","masked":true}
```

### 审计日志权限

```bash
# 设置审计日志文件权限
chmod 600 /var/log/app/env-audit.log

# 确保只有应用用户可读写
chown app:app /var/log/app/env-audit.log
```

### 日志轮转

建议使用 logrotate 管理审计日志：

```bash
# /etc/logrotate.d/app-env-audit
/var/log/app/env-audit.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0600 app app
}
```

---

## 相关文档

- [安全概述](/zh/env/security/) - 安全架构与核心特性
- [生产检查清单](/zh/env/security/production-checklist) - 审计配置检查
- [接口定义](/zh/env/api-reference/interfaces) - AuditLogger 接口
- [组件工厂](/zh/env/api-reference/factory) - 审计处理器工厂

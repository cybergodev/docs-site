---
sidebar_label: "审计日志"
title: "审计日志 - CyberGo env | 安全审计配置"
description: "CyberGo env 审计日志配置指南：JSONAuditHandler、LogAuditHandler、ChannelAuditHandler 三种内置处理器与自定义处理器的实现方式，记录变量加载、修改与删除操作，附掩码规则、fail-closed 语义与日志权限配置。"
sidebar_position: 6
---

# 审计日志

审计日志记录配置的加载、修改与删除，以及解析、校验、安全拦截与文件访问事件，用于安全审计、合规检查和问题排查。正常读取不产生事件，细节见[安全注意事项](#安全注意事项)。

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

**输出示例**（节选，省略 `reason` 字段与逐键 `ActionSet` 事件）：

```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration_ns":1234567}
{"timestamp":"2024-01-15T10:30:01Z","action":"set","key":"[MASKED]","success":true,"masked":true}
{"timestamp":"2024-01-15T10:30:02Z","action":"set","key":"CUSTOM_VAR","success":true}
```

敏感键（如 `API_KEY`）的 `key` 字段自动掩码为 `[MASKED]`，非敏感键（如 `CUSTOM_VAR`）原样显示。

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
[AUDIT] 2024/01/15 10:30:01 action=set key=[MASKED] success=true reason=""
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

**适用场景：**
- 发送到远程日志服务
- 写入数据库
- 实时监控告警

---

### NopAuditHandler

空操作处理器，丢弃所有事件：

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewNopAuditHandler()
```

**适用场景：**
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

操作类型常量共 10 个，完整清单（含字符串值与各动作语义）见页末[审计动作](#审计动作)。

---

## 自定义处理器

### 实现 FullAuditLogger 接口

`FullAuditLogger` 是完整的审计日志接口，扩展了最小接口 `AuditLogger`（仅包含 LogError 方法）：

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
	"github.com/cybergodev/env"
	"time"
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
	"github.com/cybergodev/env"
	"log"
	"os"
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
	"github.com/cybergodev/env"
	"log"
	"os"
)

func main() {
	// 创建审计事件通道
	auditChan := make(chan env.AuditEvent, 1000)

	// 启动异步处理器；done 在消费 goroutine 退出时关闭
	done := make(chan struct{})
	go func() {
		defer close(done)
		processAuditEvents(auditChan)
	}()

	// 配置
	cfg := env.ProductionConfig()
	cfg.AuditEnabled = true
	cfg.AuditHandler = env.NewChannelAuditHandler(auditChan)

	loader, _ := env.New(cfg)

	// 正常使用...

	// ChannelAuditHandler 不拥有通道：loader.Close() 不会关闭 auditChan，
	// 必须由调用方 close，向消费 goroutine 发送 EOF
	loader.Close()
	close(auditChan)

	// 等待消费 goroutine 处理完剩余事件后退出
	<-done
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

`ChannelAuditHandler` **不拥有通道**：`Close()` 是空操作，必须由调用方 `close(auditChan)`，`for range` 消费的 goroutine 才能收到 EOF；缓冲满时发送会阻塞。需要处理器自管通道生命周期（`Close()` 即关闭通道，消费方经 `Channel()` 接收）时，改用下文「更多内置处理器」中的 `CloseableChannelHandler`。

---

## 安全注意事项

### 审计记录与掩码

审计日志对敏感键的 `key` 字段自动掩码（默认显示 `[MASKED]`，非敏感键原样显示）。**写路径记录审计事件**：`Set` / `Delete` / `LoadFiles` 分别触发 `ActionSet` / `ActionDelete` / `ActionLoad`，事件中记录掩码后的键名。

读路径不产审计：`Get` / `GetString` / `GetInt` / `GetSecure` 等正常读取不记录日志。`ActionGet` 只在类型转换**解析失败**的错误路径触发（`success=false`），例如：

```go
// 写操作：会记录审计事件（敏感键掩码后记录）
_ = loader.Set("API_KEY", "sk-1234567890")
// 审计记录：{"action":"set","key":"[MASKED]","success":true,"masked":true}

// 读操作：正常读取不产审计
secret := loader.GetSecure("API_KEY") // 不产生审计日志
_ = loader.GetInt("PORT")             // 解析成功，不产生审计日志
_ = loader.GetInt("API_KEY")          // 解析失败时产生 ActionGet 事件（success=false）
```

默认 `AuditFailClosed = false`（fail-open）：审计管线出问题不影响业务操作的结果。设为 `true` 后，处理器报错、panic 或通道满导致事件丢失，都会让产生该事件的操作（`LoadFiles` / `Apply` / `Set` / `Delete`）返回匹配 `ErrAuditFailed` 的错误。

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

## 更多内置处理器

除 JSON / Log / Channel 三类处理器外，库另提供两个实现：`CloseableChannelHandler`（自管理通道）与 `NopAuditHandler`（丢弃事件）。

### CloseableChannelHandler（自管理通道）

与 `ChannelAuditHandler` 接收外部 channel 不同，`CloseableChannelHandler` 自建并持有带缓冲的 channel，提供完整的生命周期管理：`Close()` 关闭处理器并关闭通道，消费方通过 `Channel()` 接收事件：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	handler := env.NewCloseableChannelHandler(64)

	done := make(chan struct{})
	go func() {
		defer close(done)
		for event := range handler.Channel() {
			fmt.Printf("%+v\n", event)
		}
	}()

	cfg := env.ProductionConfig()
	cfg.AuditHandler = handler
	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}
	_ = loader.Set("CUSTOM_VAR", "value")

	loader.Close()
	handler.Close()
	<-done
}
```

### NopAuditHandler（空操作）

丢弃所有审计事件，适用于测试或临时静默审计输出，用法见[上文 NopAuditHandler](#nopaudithandler)。

## 审计动作

审计事件按动作分类（类型为 `AuditAction`）。自定义处理器可按这些常量过滤关注的事件类型：

| 常量 | 值 | 含义 |
|------|---|------|
| `ActionLoad` | `load` | 文件加载 |
| `ActionParse` | `parse` | env/JSON/YAML 文件解析 |
| `ActionGet` | `get` | 变量读取（含类型解析失败记录） |
| `ActionSet` | `set` | 变量设置、应用到进程环境或按策略跳过 |
| `ActionDelete` | `delete` | 变量删除 |
| `ActionValidate` | `validate` | 校验操作 |
| `ActionExpand` | `expand` | 变量展开 |
| `ActionSecurity` | `security` | 安全事件（路径校验失败、禁止键等） |
| `ActionError` | `error` | 错误条件 |
| `ActionFileAccess` | `file_access` | 文件系统访问 |

`AuditEvent` 为结构化事件，含时间戳、动作、键、原因、成败与耗时等字段。敏感键在进入事件前已被替换为 `[MASKED]`，非敏感键原样保留。

## 相关文档

- [安全概述](../security/) - 安全架构与核心特性
- [生产检查清单](../security/production-checklist) - 审计配置检查
- [接口定义](../api-reference/interfaces) - AuditLogger 接口
- [组件工厂](../api-reference/factory) - 审计处理器工厂

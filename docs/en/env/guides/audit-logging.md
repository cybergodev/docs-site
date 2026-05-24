---
title: "Audit Logging - CyberGo env | Security Audit Configuration"
description: "Complete configuration guide for CyberGo env audit logging, covering JSON file handler, standard log handler, and Channel handler creation and configuration, custom AuditHandler interface implementation, recording all environment variable load, read, modify, and delete operations for security compliance checks and production troubleshooting."
---

# Audit Logging

The audit logging feature records all environment variable operations for security auditing, compliance checks, and troubleshooting.

## Enabling Audit

### Configuration

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, _ := env.New(cfg)
```

### Configuration Presets

| Preset | Audit Status |
|--------|-------------|
| `DefaultConfig()` | Disabled |
| `DevelopmentConfig()` | Disabled |
| `TestingConfig()` | Disabled |
| `ProductionConfig()` | Enabled |

---

## Audit Handlers

### JSONAuditHandler

Outputs JSON formatted logs:

```go
import (
    "os"
    "github.com/cybergodev/env"
)

cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**Output Example:**

```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration":1234567}
{"timestamp":"2024-01-15T10:30:01Z","action":"get","key":"API_KEY","success":true,"masked":true}
{"timestamp":"2024-01-15T10:30:02Z","action":"set","key":"CUSTOM_VAR","success":true}
```

---

### LogAuditHandler

Outputs using the standard log package:

```go
import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**Output Example:**

```text
[AUDIT] 2024/01/15 10:30:00 load .env (1.23ms)
[AUDIT] 2024/01/15 10:30:01 get API_KEY (masked)
[AUDIT] 2024/01/15 10:30:02 set CUSTOM_VAR
```

---

### ChannelAuditHandler

Sends to a channel for async processing:

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// Process audit events asynchronously
go func() {
    for event := range ch {
        processAuditEvent(event)
    }
}()
```

**Use cases:**
- Send to remote logging services
- Write to databases
- Real-time monitoring and alerting

---

### NopAuditHandler

A no-op handler that discards all events:

```go
cfg.AuditHandler = env.NewNopAuditHandler()
```

**Use cases:**
- Temporarily disable auditing
- Testing environments

---

## Audit Events

### AuditEvent Structure

```go
type AuditEvent struct {
    Timestamp time.Time   // Timestamp
    Action    AuditAction // Action type
    Key       string      // Key name
    File      string      // File name
    Reason    string      // Reason
    Success   bool        // Whether successful
    Masked    bool        // Whether masked
    Details   string      // Details
    Duration  int64       // Duration (nanoseconds)
}
```

### AuditAction Types

| Constant | Value | Description |
|----------|-------|-------------|
| `ActionLoad` | `load` | File loading |
| `ActionParse` | `parse` | Parse operation |
| `ActionGet` | `get` | Variable read |
| `ActionSet` | `set` | Variable set |
| `ActionDelete` | `delete` | Variable delete |
| `ActionValidate` | `validate` | Validation operation |
| `ActionExpand` | `expand` | Variable expansion |
| `ActionSecurity` | `security` | Security event |
| `ActionError` | `error` | Error event |
| `ActionFileAccess` | `file_access` | File access |

---

## Custom Handlers

### Implementing the FullAuditLogger Interface

`FullAuditLogger` is the complete audit logging interface, extending the minimal `AuditLogger` interface (which only contains the `LogError` method):

```go
type FullAuditLogger interface {
    AuditLogger  // Embeds minimal interface (LogError)
    Log(action AuditAction, key, reason string, success bool) error
    LogWithFile(action AuditAction, key, file, reason string, success bool) error
    LogWithDuration(action AuditAction, key, reason string, success bool, duration time.Duration) error
    Close() error
}
```

### Example: Database Audit Handler

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

## Complete Examples

### Production Configuration

```go
package main

import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // Create audit log file
    auditFile, err := os.OpenFile("/var/log/app/env-audit.log",
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
    if err != nil {
        log.Fatal(err)
    }
    defer auditFile.Close()

    // Configuration
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    // Create loader
    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // Load configuration
    err = loader.LoadFiles(".env")
    if err != nil {
        log.Fatal(err)
    }

    // Validate
    err = loader.Validate()
    if err != nil {
        log.Fatal(err)
    }

    // Use configuration
    log.Println("Configuration loaded successfully")
}
```

### Async Audit Processing

```go
package main

import (
    "encoding/json"
    "log"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // Create audit event channel
    auditChan := make(chan env.AuditEvent, 1000)

    // Start async processor
    go processAuditEvents(auditChan)

    // Configuration
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    cfg.AuditHandler = env.NewChannelAuditHandler(auditChan)

    loader, _ := env.New(cfg)
    defer loader.Close()

    // Normal usage...
}

func processAuditEvents(ch chan env.AuditEvent) {
    file, _ := os.OpenFile("/var/log/app/audit.log",
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
    defer file.Close()

    encoder := json.NewEncoder(file)

    for event := range ch {
        // Add filtering, aggregation, etc.
        if event.Action == env.ActionError {
            log.Printf("Audit error: %+v", event)
        }

        encoder.Encode(event)
    }
}
```

---

## Security Considerations

### Automatic Sensitive Value Masking

Audit logs automatically mask values of sensitive keys:

```go
// Sensitive values are automatically masked when retrieved
secret := loader.GetSecure("API_KEY")
// Audit record: {"action":"get","key":"API_KEY","masked":true}
```

### Audit Log Permissions

```bash
# Set audit log file permissions
chmod 600 /var/log/app/env-audit.log

# Ensure only the application user can read/write
chown app:app /var/log/app/env-audit.log
```

### Log Rotation

Using logrotate to manage audit logs is recommended:

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

## Related Documentation

- [Security Overview](/en/env/security/) - Security architecture and core features
- [Production Checklist](/en/env/security/production-checklist) - Audit configuration checklist
- [Interfaces](/en/env/api-reference/interfaces) - AuditLogger interface
- [Component Factory](/en/env/api-reference/factory) - Audit handler factory

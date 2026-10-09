---
sidebar_label: "Audit Logging"
title: "Audit Logging - CyberGo env | Security Audit Configuration"
description: "Audit logging guide for CyberGo env: JSONAuditHandler, LogAuditHandler, and ChannelAuditHandler record variable loads, reads, and changes for auditing."
sidebar_position: 6
---

# Audit Logging

The audit logging feature records all environment variable operations for security auditing, compliance checking, and troubleshooting.

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

Outputs JSON format logs:

```go
import (
    "os"
    "github.com/cybergodev/env"
)

cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**Output example:**

```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration_ns":1234567}
{"timestamp":"2024-01-15T10:30:01Z","action":"set","key":"[MASKED:7 chars]","success":true,"masked":true}
{"timestamp":"2024-01-15T10:30:02Z","action":"set","key":"CUSTOM_VAR","success":true}
```

Sensitive keys (e.g., `API_KEY`) are automatically masked as `[MASKED:N chars]` (N = key length) in the audit log's `key` field; non-sensitive keys (e.g., `CUSTOM_VAR`) are shown as-is.

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

**Output example:**

```text
[AUDIT] 2024/01/15 10:30:00 action=load success=true reason="" file=.env duration=1.23ms
[AUDIT] 2024/01/15 10:30:01 action=set key=[MASKED:7 chars] success=true reason=""
[AUDIT] 2024/01/15 10:30:02 action=set key=CUSTOM_VAR success=true reason=""
```

---

### ChannelAuditHandler

Sends to a channel for asynchronous processing:

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
- Send to remote logging service
- Write to database
- Real-time monitoring alerts

---

### NopAuditHandler

No-op handler, discards all events:

```go
cfg.AuditHandler = env.NewNopAuditHandler()
```

**Use cases:**
- Temporarily disable auditing
- Test environments

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
| `ActionParse` | `parse` | Parsing operation |
| `ActionGet` | `get` | Variable reading |
| `ActionSet` | `set` | Variable setting |
| `ActionDelete` | `delete` | Variable deletion |
| `ActionValidate` | `validate` | Validation operation |
| `ActionExpand` | `expand` | Variable expansion |
| `ActionSecurity` | `security` | Security event |
| `ActionError` | `error` | Error event |
| `ActionFileAccess` | `file_access` | File access |

---

## Custom Handler

### Implementing the FullAuditLogger Interface

`FullAuditLogger` is the complete audit logging interface, extending the minimal `AuditLogger` interface (which only contains the LogError method):

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

## Complete Example

### Production Configuration

```go
package main

import (
	"github.com/cybergodev/env"
	"log"
	"os"
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

### Asynchronous Audit Processing

```go
package main

import (
	"encoding/json"
	"github.com/cybergodev/env"
	"log"
	"os"
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
		// Can add filtering, aggregation, etc.
		if event.Action == env.ActionError {
			log.Printf("Audit error: %+v", event)
		}

		encoder.Encode(event)
	}
}
```

---

## Security Considerations

### Audit Recording and Masking

The audit log automatically masks the `key` field for sensitive keys (shown as `[MASKED:N chars]` by default, where N is the number of characters in the key name; non-sensitive keys are shown as-is). **Only write operations record audit events**: `Set` / `Delete` / `LoadFiles` etc. trigger `ActionSet` / `ActionDelete` / `ActionLoad` events, recording the masked key name.

Read operations do not produce audit entries: `Get` / `GetString` / `GetInt` / `GetSecure` etc. **do not record audit logs during normal reads**. `ActionGet` events are only triggered in the error path when type conversion **parsing fails** (e.g., in `GetInt` / `GetBool` / `GetFloat64`), with `success=false`. For example:

```go
// Write operation: records audit event (sensitive key recorded after masking)
_ = loader.Set("API_KEY", "sk-1234567890")
// Audit record: {"action":"set","key":"[MASKED:7 chars]","success":true,"masked":true}

// Read operation: normal reads don't produce audit
secret := loader.GetSecure("API_KEY") // No audit log produced
_ = loader.GetInt("PORT")             // Parse succeeds, no audit log produced
_ = loader.GetInt("API_KEY")          // Produces ActionGet event when parsing fails (success=false)
```

### Audit Log Permissions

```bash
# Set audit log file permissions
chmod 600 /var/log/app/env-audit.log

# Ensure only the application user can read/write
chown app:app /var/log/app/env-audit.log
```

### Log Rotation

Recommend using logrotate to manage audit logs:

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

## More Built-in Handlers

Beyond the three common handlers (JSON/Log/Channel), the library ships two additional ready-to-use implementations.

### CloseableChannelHandler (self-managed channel)

Unlike `ChannelAuditHandler`, which accepts an external channel, `CloseableChannelHandler` creates and owns a buffered channel with full lifecycle management — `Close()` shuts the handler down and closes the channel; consumers receive events via `Channel()`:

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

### NopAuditHandler (no-op)

Discards all audit events — useful for tests or temporarily silencing audit output:

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewNopAuditHandler()
```

## Audit Actions (AuditAction)

Audit events are categorized by action. Custom handlers can filter the event types they care about using the `AuditAction` constants:

| Constant | Meaning |
|----------|---------|
| `ActionLoad` | File loading |
| `ActionParse` | env/JSON/YAML file parsing |
| `ActionGet` | Variable retrieval (including type parse-failure records) |
| `ActionSet` | Variable set, applied to process environment, or skipped by policy |
| `ActionDelete` | Variable deletion |
| `ActionValidate` | Validation operations |
| `ActionExpand` | Variable expansion |
| `ActionSecurity` | Security events (path validation failures, forbidden keys, etc.) |
| `ActionError` | Error conditions |
| `ActionFileAccess` | File system access |

`AuditEvent` is a structured event (timestamp, action, key, reason, success/failure, duration, and more). Sensitive keys are masked by `MaskKey` into `[MASKED:N chars]` (N = key length) before entering the event; non-sensitive keys are kept as-is.

## Related Documentation

- [Security Overview](/en/env/security/) - Security architecture and core features
- [Production Checklist](/en/env/security/production-checklist) - Audit configuration checks
- [Interfaces](/en/env/api-reference/interfaces) - AuditLogger interface
- [Component Factory](/en/env/api-reference/factory) - Audit handler factories

---
sidebar_label: "Audit Logging"
title: "Audit Logging - CyberGo env | Security Audit Configuration"
description: "CyberGo env audit logging: JSONAuditHandler, LogAuditHandler, ChannelAuditHandler and custom handlers record variable operations for security and compliance."
sidebar_position: 6
---

# Audit Logging

Audit logging records variable operations — loads, sets, deletes, parsing, validation, security, and file access — as structured events. Use it for security auditing, compliance, and troubleshooting. Normal reads produce no events; see [Security Considerations](#security-considerations).

## Enabling Audit

### Configuration

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true

auditFile, err := os.OpenFile("audit.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
if err != nil {
    log.Fatal(err)
}
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)

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

`loader.Close()` closes the handler, and `JSONAuditHandler` also closes the underlying writer (for example an `os.File`, which implements `io.Closer`). Do not pass `os.Stdout` or a writer shared with other components, or `loader.Close()` will close it too. When writing to a file, open the `os.File` yourself with mode `0600`; the handler closes it. If `env.New()` fails during config validation the handler has not taken ownership yet, so close the file yourself; later failures (parser creation, auto-loading) close the handler and the file on the way out, and a second `auditFile.Close()` only returns an ignorable already-closed error.

### JSONAuditHandler

Outputs logs in JSON format:

```go
import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

auditFile, err := os.OpenFile("audit.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
if err != nil {
    log.Fatal(err)
}

cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
```

**Output example** (excerpt: the `reason` field and per-key `ActionSet` events are omitted):

```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","success":true,"duration_ns":1234567}
{"timestamp":"2024-01-15T10:30:01Z","action":"set","key":"[MASKED]","success":true,"masked":true}
{"timestamp":"2024-01-15T10:30:02Z","action":"set","key":"CUSTOM_VAR","success":true}
```

Sensitive keys (for example `API_KEY`) appear as `[MASKED]` in the `key` field of the audit log; non-sensitive keys (for example `CUSTOM_VAR`) appear as-is.

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
[AUDIT] 2024/01/15 10:30:00 action=load success=true reason="" duration=1.23ms
[AUDIT] 2024/01/15 10:30:01 action=set key=[MASKED] success=true reason=""
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

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
cfg.AuditEnabled = true
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

There are 10 action constants. The full list with string values and per-action semantics is in [Audit Actions](#audit-actions) at the end of this page.

---

## Custom Handler

### Implementing the FullAuditLogger Interface

`FullAuditLogger` is the complete audit logging interface. It extends the minimal `AuditLogger` interface, which contains only the `LogError` method:

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

	// Configuration (clear Filenames and load explicitly below; otherwise
	// New auto-loads first and validates the required keys itself)
	cfg := env.ProductionConfig()
	cfg.Filenames = nil
	cfg.AuditEnabled = true
	cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
	cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

	// Create loader (a validation-stage failure leaves the file untaken,
	// so close it here; later failures already closed it)
	loader, err := env.New(cfg)
	if err != nil {
		auditFile.Close()
		log.Fatal(err)
	}
	defer loader.Close() // closes the handler, which closes auditFile

	// Load configuration
	err = loader.LoadFiles(".env")
	if err != nil {
		log.Fatal(err)
	}

	// Validate (required keys were already checked at load time;
	// this confirms against the current store)
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

	// Start async processor; done is closed when the consumer goroutine exits
	done := make(chan struct{})
	go func() {
		defer close(done)
		processAuditEvents(auditChan)
	}()

	// Configuration
	cfg := env.ProductionConfig()
	cfg.AuditEnabled = true
	cfg.AuditHandler = env.NewChannelAuditHandler(auditChan)

	loader, _ := env.New(cfg)

	// Normal usage...

	// ChannelAuditHandler does not own the channel: loader.Close() does not
	// close auditChan — the caller must close it to send EOF to the consumer
	loader.Close()
	close(auditChan)

	// Wait for the consumer goroutine to drain remaining events
	<-done
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

The shutdown sequence matters: `ChannelAuditHandler` does **not** own the channel. Its `Close()` is a no-op, so the caller must call `close(auditChan)` for the `for range` consumer to see EOF. Sends block when the buffer is full, and a blocked send also freezes `loader.Close()`, so keep the consumer draining until shutdown; close `auditChan` only after `loader.Close()` returns — closing it while a send is still in flight panics (send on closed channel). If you prefer a handler that manages the channel lifecycle itself (`Close()` closes the channel; consumers read from `Channel()`), see `CloseableChannelHandler` under [More Built-in Handlers](#more-built-in-handlers).

---

## Security Considerations

### Audit Recording and Masking

Audit events mask a sensitive `key` as `[MASKED]` and keep a non-sensitive key as-is. Key-level events come from write operations: `Set`, `Delete`, and `LoadFiles` record `ActionSet`, `ActionDelete`, and `ActionLoad` with the masked key name. Parse, validation, expansion, security, and file-access events pass through the same masking.

Read operations do not produce audit entries. `Get`, `GetString`, `GetInt`, and `GetSecure` record nothing on a successful read. An `ActionGet` event appears only when type conversion **parsing fails** (in `GetInt`, `GetBool`, `GetFloat64`, and so on), and it carries `success=false`. For example:

```go
// Write operation: records audit event (sensitive key recorded after masking)
_ = loader.Set("API_KEY", "sk-1234567890")
// Audit record: {"action":"set","key":"[MASKED]","success":true,"masked":true}

// Read operation: normal reads don't produce audit
secret := loader.GetSecure("API_KEY") // No audit log produced
_ = loader.GetInt("PORT")             // Parse succeeds, no audit log produced
_ = loader.GetInt("API_KEY")          // Produces ActionGet event when parsing fails (success=false)
```

By default `AuditFailClosed = false` (fail-open): a broken audit pipeline does not affect the outcome of business operations. With `AuditFailClosed = true`, a lost event — handler error, panic, or full channel — makes the operation that produced it (`LoadFiles` / `Apply` / `Set` / `Delete`) return an error matching `ErrAuditFailed`. When concurrent operations race, the latched error is delivered to whichever operation checks first (best-effort, not exactly once).

### Audit Log Permissions

```bash
# Set audit log file permissions
chmod 600 /var/log/app/env-audit.log

# Ensure only the application user can read/write
chown app:app /var/log/app/env-audit.log
```

### Log Rotation

Recommend logrotate for audit log management:

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

Beyond the three common handlers (JSON, Log, Channel), env ships two more ready-to-use implementations.

### CloseableChannelHandler (self-managed channel)

`ChannelAuditHandler` accepts an external channel; `CloseableChannelHandler` creates and owns a buffered channel instead. `Close()` shuts the handler down and closes the channel, and consumers receive events via `Channel()`. Unlike `ChannelAuditHandler`, a full buffer does not block here — the event is dropped with an error, and the running drop count is available through `DroppedEvents()` (the counter never resets):

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

Discards all audit events. Use it for tests or to silence audit output temporarily. See [NopAuditHandler above](#nopaudithandler) for usage.

## Audit Actions

Audit events are categorized by action (type `AuditAction`). A custom handler can filter the event types it cares about using the `AuditAction` constants:

| Constant | Value | Meaning |
|----------|-------|---------|
| `ActionLoad` | `load` | File loading |
| `ActionParse` | `parse` | env/JSON/YAML file parsing |
| `ActionGet` | `get` | Variable retrieval (including type parse-failure records) |
| `ActionSet` | `set` | Variable set, applied to process environment, or skipped by policy |
| `ActionDelete` | `delete` | Variable deletion |
| `ActionValidate` | `validate` | Validation operations |
| `ActionExpand` | `expand` | Variable expansion |
| `ActionSecurity` | `security` | Security events (path validation failures, forbidden keys, etc.) |
| `ActionError` | `error` | Error conditions |
| `ActionFileAccess` | `file_access` | File system access |

`AuditEvent` carries the timestamp, action, key, reason, success flag, duration, and other fields. Sensitive keys are masked to `[MASKED]` before entering the event; non-sensitive keys are kept as-is.

## Related Documentation

- [Security Overview](../security/) - security architecture and core features
- [Production Checklist](../security/production-checklist) - audit configuration checks
- [Interfaces](../api-reference/interfaces) - AuditLogger interface
- [Component Factory](../api-reference/factory) - audit handler factories

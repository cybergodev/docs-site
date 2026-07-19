---
sidebar_label: "Audit Pipeline"
title: "Audit Pipeline - CyberGo html | Pipeline Guide"
description: "CyberGo html audit pipeline in practice: from basic enablement to multi-layer pipelines, event types, built-in Sinks, level filtering, and monitoring."
sidebar_position: 2
---

# Audit Pipeline

The audit system records security events during HTML processing, helping you monitor and investigate potential risks.

## Quick Enable

Enable auditing with just 3 lines of code:

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

p, _ := html.New(cfg)
defer p.Close()
```

Once enabled, security events are output to stderr in `[AUDIT] JSON` format.

## Audit Event Types

| Event | Constant | Level | Trigger Condition |
|-------|----------|-------|-------------------|
| Blocked tag | `blocked_tag` | warning | Dangerous tag removed (e.g., `<script>`) |
| Blocked attribute | `blocked_attr` | warning | Dangerous attribute removed (e.g., `onclick`) |
| Blocked URL | `blocked_url` | warning | Dangerous URL intercepted |
| Input violation | `input_violation` | critical | Input exceeds size limit |
| Depth violation | `depth_violation` | warning | DOM nesting exceeds limit |
| Processing timeout | `timeout` | warning | Single processing timeout |
| Encoding issue | `encoding_issue` | info | Encoding detection failure |
| Path traversal | `path_traversal` | critical | The path contains `..`, or in `AllowedBaseDir` mode the path escapes the base after OS-handle resolution (symlink/junction protection) |

## Audit Levels

```text
info < warning < critical
```

- **info**: Informational events (encoding issues), no alerting needed
- **warning**: Anomalies requiring attention (timeouts, depth violations)
- **critical**: Security threats (input violations, path traversal)

## Built-in Sink Types

### LoggerAuditSink (Default)

Outputs to stderr with `[AUDIT]` prefix:

```go
// Default output to stderr
sink := html.NewLoggerAuditSink()

// Output to custom Writer
sink := html.NewLoggerAuditSinkWithWriter(os.Stdout)
```

### WriterAuditSink

Writes JSON Lines to an `io.Writer`, suitable for file persistence:

```go
file, _ := os.Create("audit.jsonl")
defer file.Close()

sink := html.NewWriterAuditSink(file)
```

Output format (one JSON per line):

```json
{"timestamp":"2026-04-30T10:00:00Z","event_type":"blocked_tag","level":"warning","message":"Blocked dangerous HTML tag: script","tag":"script"}
```

### ChannelAuditSink

Pushes events non-blockingly into a buffered channel; a consumer goroutine processes them asynchronously — suitable for external system integration:

```go
sink := html.NewChannelAuditSink(100)

// Consume audit events
go func() {
    for entry := range sink.Channel() {
        sendToSIEM(entry)
    }
}()

// Check dropped events (auto-dropped when channel is full)
fmt.Printf("Dropped: %d\n", sink.DroppedCount())
```

### MultiSink

Fans out to multiple Sinks:

```go
sink := html.NewMultiSink(
    html.NewWriterAuditSink(file),
    html.NewLoggerAuditSink(),
)
```

### FilteredSink

Filter events by condition:

```go
// Only record critical events
sink := html.NewFilteredSink(
    fileSink,
    func(e html.AuditEntry) bool {
        return e.Level == html.AuditLevelCritical
    },
)
```

### LevelFilteredSink

Filter by minimum level:

```go
// Only record warning and above
sink := html.NewLevelFilteredSink(fileSink, html.AuditLevelWarning)
```

## Building Audit Pipelines

### Scenario 1: File Persistence

```go
func newAuditPipeline() html.AuditSink {
    file, _ := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
    return html.NewWriterAuditSink(file)
}

cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = newAuditPipeline()
```

### Scenario 2: Tiered Routing

Send critical events to an alerting system, write all other events to a file:

```go
func newTieredPipeline() html.AuditSink {
    file, _ := os.Create("audit.jsonl")

    return html.NewMultiSink(
        // All events to file
        html.NewWriterAuditSink(file),
        // Critical events also send alerts
        html.NewFilteredSink(
            html.NewChannelAuditSink(50),
            func(e html.AuditEntry) bool {
                return e.Level == html.AuditLevelCritical
            },
        ),
    )
}
```

### Scenario 3: High-Security Mode

Use `HighSecurityConfig` and `HighSecurityAuditConfig`:

```go
cfg := html.HighSecurityConfig()
cfg.Audit = html.HighSecurityAuditConfig()
cfg.Audit.Sink = html.NewMultiSink(
    html.NewWriterAuditSink(file),
    html.NewLoggerAuditSink(),
)

p, _ := html.New(cfg)
```

High-security audit features:
- Audit automatically enabled
- All event types logged
- Raw values included (`IncludeRawValues = true`) for forensic analysis
- Max raw value length 500 characters

## Querying Audit Logs

Query collected events via Processor methods:

```go
p, _ := html.New(cfg)
defer p.Close()

// Process content
p.Extract(data)

// Get audit log
entries := p.GetAuditLog()
for _, entry := range entries {
    fmt.Printf("[%s] %s: %s\n", entry.Level, entry.EventType, entry.Message)
}

// Clear log
p.ClearAuditLog()
```

:::tip In-Memory Logs Are Processor-Scoped
`GetAuditLog()` returns events collected in the Processor's memory. For persistence, configure a Sink.
:::

## Custom Sinks

Implement the `AuditSink` interface to send audit events to any destination:

```go
type slackSink struct {
    webhook string
}

func (s *slackSink) Write(entry html.AuditEntry) {
    if entry.Level != html.AuditLevelCritical {
        return // Only send critical
    }
    msg := fmt.Sprintf("[AUDIT] %s: %s", entry.EventType, entry.Message)
    http.Post(s.webhook, "text/plain", strings.NewReader(msg))
}

func (s *slackSink) Close() error {
    return nil
}
```

## Next Steps

- [API Reference: Audit System](../../api-reference/modules/audit) - Complete API signatures
- [Security](../../security/) - Security feature overview
- [Production Checklist](../../security/production-checklist) - Pre-deployment checks

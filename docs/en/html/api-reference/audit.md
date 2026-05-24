---
title: "Audit System - HTML"
description: "Pluggable audit system API reference for CyberGo HTML, including AuditConfig, event types, audit levels, AuditEntry logs, and built-in Sink implementations."
---

# Audit System

The HTML library includes a pluggable audit pipeline that records security events and processing anomalies.

## AuditConfig

```go
type AuditConfig struct {
    Enabled            bool       `json:"enabled"`              // Enable audit
    LogBlockedTags     bool       `json:"log_blocked_tags"`     // Log blocked tags
    LogBlockedAttrs    bool       `json:"log_blocked_attrs"`    // Log blocked attributes
    LogBlockedURLs     bool       `json:"log_blocked_urls"`     // Log blocked URLs
    LogInputViolations bool       `json:"log_input_violations"` // Log input violations
    LogDepthViolations bool       `json:"log_depth_violations"` // Log depth violations
    LogTimeouts        bool       `json:"log_timeouts"`         // Log timeouts
    LogEncodingIssues  bool       `json:"log_encoding_issues"`  // Log encoding issues
    LogPathTraversal   bool       `json:"log_path_traversal"`   // Log path traversal attempts
    Sink               AuditSink  `json:"-"`                    // Audit output destination (excluded from JSON serialization)
    IncludeRawValues   bool       `json:"include_raw_values"`   // Include raw values
    MaxRawValueLength  int        `json:"max_raw_value_length"` // Max raw value length
}
```

## Preset Audit Configs

### DefaultAuditConfig

Default audit configuration (disabled by default, all log flags set to true).

```go
func DefaultAuditConfig() AuditConfig
```

| Field | Default |
|-------|---------|
| `Enabled` | `false` |
| `LogBlockedTags` | `true` |
| `LogBlockedAttrs` | `true` |
| `LogBlockedURLs` | `true` |
| `LogInputViolations` | `true` |
| `LogDepthViolations` | `true` |
| `LogTimeouts` | `true` |
| `LogEncodingIssues` | `true` |
| `LogPathTraversal` | `true` |
| `IncludeRawValues` | `false` |
| `MaxRawValueLength` | `200` |

### HighSecurityAuditConfig

High-security audit configuration with all logging and raw value recording enabled.

```go
func HighSecurityAuditConfig() AuditConfig
```

| Field | Default |
|-------|---------|
| `Enabled` | `true` |
| `LogBlockedTags` | `true` |
| `LogBlockedAttrs` | `true` |
| `LogBlockedURLs` | `true` |
| `LogInputViolations` | `true` |
| `LogDepthViolations` | `true` |
| `LogTimeouts` | `true` |
| `LogEncodingIssues` | `true` |
| `LogPathTraversal` | `true` |
| `IncludeRawValues` | `true` |
| `MaxRawValueLength` | `500` |

## Type Definitions

```go
type AuditEventType string  // Audit event type
type AuditLevel string      // Audit severity level
```

## Audit Event Types

| Constant | Value | Description |
|----------|-------|-------------|
| `AuditEventBlockedTag` | `"blocked_tag"` | Blocked tag |
| `AuditEventBlockedAttr` | `"blocked_attr"` | Blocked attribute |
| `AuditEventBlockedURL` | `"blocked_url"` | Blocked URL |
| `AuditEventInputViolation` | `"input_violation"` | Input violation |
| `AuditEventDepthViolation` | `"depth_violation"` | Depth violation |
| `AuditEventTimeout` | `"timeout"` | Processing timeout |
| `AuditEventEncodingIssue` | `"encoding_issue"` | Encoding issue |
| `AuditEventPathTraversal` | `"path_traversal"` | Path traversal attempt |

## Audit Levels

| Constant | Value | Description |
|----------|-------|-------------|
| `AuditLevelInfo` | `"info"` | Information level |
| `AuditLevelWarning` | `"warning"` | Warning level |
| `AuditLevelCritical` | `"critical"` | Critical level |

## AuditEntry

Audit log entry.

```go
type AuditEntry struct {
    Timestamp time.Time      `json:"timestamp"`           // Event time
    EventType AuditEventType `json:"event_type"`          // Event type
    Level     AuditLevel     `json:"level"`               // Audit level
    Message   string         `json:"message"`             // Event description
    Tag       string         `json:"tag,omitempty"`       // Related tag
    Attribute string         `json:"attribute,omitempty"` // Related attribute
    URL       string         `json:"url,omitempty"`       // Related URL
    InputSize int            `json:"input_size,omitempty"` // Input size
    MaxSize   int            `json:"max_size,omitempty"`  // Size limit
    Depth     int            `json:"depth,omitempty"`     // DOM depth
    MaxDepth  int            `json:"max_depth,omitempty"` // Depth limit
    Path      string         `json:"path,omitempty"`      // File path
    RawValue  string         `json:"raw_value,omitempty"` // Raw value
    Metadata  map[string]any `json:"metadata,omitempty"`  // Additional metadata
}
```

## AuditSink Interface

All Sink types implement this interface.

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

## Sink Types

### LoggerAuditSink

Outputs to stderr with `[AUDIT]` prefix.

```go
func NewLoggerAuditSink() *LoggerAuditSink
func NewLoggerAuditSinkWithWriter(w io.Writer) *LoggerAuditSink
```

### ChannelAuditSink

Sends to a buffered channel, suitable for async processing.

```go
func NewChannelAuditSink(bufferSize int) *ChannelAuditSink

func (s *ChannelAuditSink) Channel() <-chan AuditEntry
func (s *ChannelAuditSink) DroppedCount() int64
```

```go
sink := html.NewChannelAuditSink(100)
go func() {
    for entry := range sink.Channel() {
        log.Println(entry.Message)
    }
}()
```

### WriterAuditSink

Writes in JSON Lines format to an `io.Writer`.

```go
func NewWriterAuditSink(w io.Writer) *WriterAuditSink
```

### MultiSink

Fans out to multiple Sinks.

```go
func NewMultiSink(sinks ...AuditSink) *MultiSink
```

### FilteredSink

Filters entries using a predicate function.

```go
func NewFilteredSink(sink AuditSink, filter func(AuditEntry) bool) *FilteredSink
```

### LevelFilteredSink

Filters by minimum level.

```go
func NewLevelFilteredSink(sink AuditSink, minLevel AuditLevel) *LevelFilteredSink
```

## Example

```go
// Create a multi-layer audit pipeline
writerSink := html.NewWriterAuditSink(auditFile)
levelSink := html.NewLevelFilteredSink(writerSink, html.AuditLevelWarning)
multiSink := html.NewMultiSink(levelSink, html.NewLoggerAuditSink())

cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = multiSink

p, _ := html.New(cfg)
defer p.Close()

// Get audit log after processing
entries := p.GetAuditLog()
for _, e := range entries {
    fmt.Printf("[%s] %s: %s\n", e.Level, e.EventType, e.Message)
}
```

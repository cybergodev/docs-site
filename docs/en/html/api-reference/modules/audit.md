---
sidebar_label: "Audit System"
title: "Audit System - CyberGo html | Pluggable Audit API"
description: "CyberGo html audit API: AuditConfig, 8 event types, info/warning/critical levels, AuditEntry, six sinks (Logger/Writer/Channel/Filtered/LevelFiltered/Multi)."
sidebar_position: 40
---

# Audit System

The HTML library ships a pluggable audit pipeline that records security events and processing anomalies: behavior is configured by `AuditConfig`, events are recorded as `AuditEntry`, and output is delivered to one or more destinations through a pluggable `Sink`.

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
    MaxEntries         int        `json:"max_entries"`          // In-memory audit entry cap
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `AuditConfig.Enabled` | `bool` | Whether audit is enabled |
| `AuditConfig.LogBlockedTags` | `bool` | Log removed dangerous tags |
| `AuditConfig.LogBlockedAttrs` | `bool` | Log removed dangerous attributes |
| `AuditConfig.LogBlockedURLs` | `bool` | Log blocked dangerous URLs |
| `AuditConfig.LogInputViolations` | `bool` | Log input-size and validation violations |
| `AuditConfig.LogDepthViolations` | `bool` | Log nesting-depth violations |
| `AuditConfig.LogTimeouts` | `bool` | Log processing timeout events |
| `AuditConfig.LogEncodingIssues` | `bool` | Log encoding-detection issues |
| `AuditConfig.LogPathTraversal` | `bool` | Log path traversal attempts |
| `AuditConfig.Sink` | `AuditSink` | Audit output destination; when audit is enabled and this is `nil`, `LoggerAuditSink` is used by default |
| `AuditConfig.IncludeRawValues` | `bool` | Include raw attribute/URL values in logs (may contain malicious content; enable with care) |
| `AuditConfig.MaxRawValueLength` | `int` | Maximum recorded length of raw values; truncated beyond this |
| `AuditConfig.MaxEntries` | `int` | Cap on entries retained in memory by `GetAuditLog` (`0` uses the default 10000) |

## Preset Audit Configs

### DefaultAuditConfig

`DefaultAuditConfig` returns the default audit configuration (disabled by default, all log flags `true`).

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
| `MaxEntries` | `10000` (`DefaultMaxAuditEntries`) |

### HighSecurityAuditConfig

`HighSecurityAuditConfig` returns a high-security audit configuration with all logging and raw value recording enabled.

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
| `MaxEntries` | `10000` (`DefaultMaxAuditEntries`) |

:::info MaxEntries behavior
`MaxEntries` caps how many audit entries `GetAuditLog` retains in memory: setting it to `0` uses the default `DefaultMaxAuditEntries` (10000); negative values and values above 100000 (`maxConfigAuditEntries`) are rejected by `Config.Validate`; when the cap is reached, the oldest half of the retained entries are dropped, always keeping the most recent events. For retention unbounded by the in-memory cap, feed an `AuditSink`.
:::

## Type Definitions

```go
type AuditEventType string  // Audit event type
type AuditLevel string      // Audit severity level
```

`AuditEventType` identifies the category of an audit event (values in the constants table below) and `AuditLevel` identifies its severity; both are `string` type aliases.

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

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `AuditEntry.Timestamp` | `time.Time` | When the event was recorded (UTC) |
| `AuditEntry.EventType` | `AuditEventType` | Event category (e.g. `blocked_tag`, `timeout`) |
| `AuditEntry.Level` | `AuditLevel` | Severity level (`info` / `warning` / `critical`) |
| `AuditEntry.Message` | `string` | Human-readable event description |
| `AuditEntry.Tag` | `string` | HTML tag name that triggered the event (when applicable) |
| `AuditEntry.Attribute` | `string` | Attribute name that triggered the event (when applicable) |
| `AuditEntry.URL` | `string` | Resource URL that triggered the event (when applicable) |
| `AuditEntry.InputSize` | `int` | Actual input size for input-violation events |
| `AuditEntry.MaxSize` | `int` | Configured size limit for input-violation events |
| `AuditEntry.Depth` | `int` | Actual nesting depth for depth-violation events |
| `AuditEntry.MaxDepth` | `int` | Configured depth limit for depth-violation events |
| `AuditEntry.Path` | `string` | File path for path-traversal events (sanitized to the filename) |
| `AuditEntry.RawValue` | `string` | Raw attribute/URL value that triggered the event (populated only when `IncludeRawValues=true`) |
| `AuditEntry.Metadata` | `map[string]any` | Additional event-specific key-value pairs |

:::tip Field population conventions
`Timestamp`, `EventType`, `Level`, and `Message` are always populated on every entry; `Tag`, `Attribute`, and `URL` are filled only for the corresponding events (blocked tag/attribute/URL); `InputSize`/`MaxSize` and `Depth`/`MaxDepth` are filled with input-violation and depth-violation events respectively; `RawValue` is retained only when `IncludeRawValues=true`; `Metadata` carries event-specific extra key-value pairs.
:::

## AuditSink Interface

All Sink types implement this interface.

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

Implementations only need to provide two methods: `AuditSink.Write` writes a single `AuditEntry` (by convention **non-blocking and concurrency-safe**), and `AuditSink.Close` releases resources.

## Sink Types

### LoggerAuditSink

`LoggerAuditSink` outputs via the standard library `log.Logger` with an `[AUDIT]` prefix. Instances created by `NewLoggerAuditSink` **default to standard error** (`os.Stderr`); to redirect to a file, network connection, etc., use `NewLoggerAuditSinkWithWriter(w)` to specify any `io.Writer` — the constructor `NewLoggerAuditSinkWithWriter` falls back to standard error when `w` is `nil`.

```go
func NewLoggerAuditSink() *LoggerAuditSink
func NewLoggerAuditSinkWithWriter(w io.Writer) *LoggerAuditSink
```

| Method | Description |
|--------|-------------|
| `LoggerAuditSink.Write` | Serializes the entry to JSON and writes it to the logger (`[AUDIT]` prefix) |
| `LoggerAuditSink.Close` | No-op; always returns `nil` |

### ChannelAuditSink

`ChannelAuditSink` sends to a buffered channel, suitable for async processing or integration with external logging systems. Create it with `NewChannelAuditSink(bufferSize)`; consumers receive entries from the read-only channel returned by `Channel`. The constructor `NewChannelAuditSink` clamps a negative bufferSize to `0` (i.e., an unbuffered channel). `ChannelAuditSink.Write` is **non-blocking**: when the buffer is full, the entry is **dropped** and the drop count is incremented (no blocking, no error); the caller can query the number of dropped entries via `DroppedCount` and trigger alerts or scale-up in monitoring.

```go
func NewChannelAuditSink(bufferSize int) *ChannelAuditSink
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `ChannelAuditSink.Channel` | `func (s *ChannelAuditSink) Channel() <-chan AuditEntry` | Returns the read-only receive channel |
| `ChannelAuditSink.DroppedCount` | `func (s *ChannelAuditSink) DroppedCount() int64` | Returns the number of entries dropped due to a full buffer |
| `ChannelAuditSink.Write` | `func (s *ChannelAuditSink) Write(entry AuditEntry)` | Non-blocking write; drops and counts when the buffer is full |
| `ChannelAuditSink.Close` | `func (s *ChannelAuditSink) Close() error` | Closes the channel (idempotent: safe to call multiple times; only the first call actually closes it) |

```go
sink := html.NewChannelAuditSink(100)
go func() {
    for entry := range sink.Channel() {
        log.Println(entry.Message)
    }
}()
```

### WriterAuditSink

`WriterAuditSink` writes in JSON Lines format to an `io.Writer`; create it with `NewWriterAuditSink(w)`. The constructor `NewWriterAuditSink` returns a Sink instance bound to that writer.

```go
func NewWriterAuditSink(w io.Writer) *WriterAuditSink
```

| Method | Description |
|--------|-------------|
| `WriterAuditSink.Write` | Serializes the entry to JSON and writes it to the underlying writer |
| `WriterAuditSink.Close` | No-op; always returns `nil` |

### MultiSink

`MultiSink` fans out to multiple Sinks; create it with `NewMultiSink(sinks...)`. The constructor `NewMultiSink` returns an instance aggregating all child Sinks. `MultiSink.Close` uses Go 1.20+'s `errors.Join` to **aggregate close errors from all child Sinks** (rather than keeping only the last one) — for an audit subsystem, discarding an earlier Sink's delivery failure would mask real problems.

```go
func NewMultiSink(sinks ...AuditSink) *MultiSink
```

| Method | Description |
|--------|-------------|
| `MultiSink.Write` | Writes the entry to all child Sinks (skipping `nil`) |
| `MultiSink.Close` | Closes all child Sinks, aggregating errors with `errors.Join` |

### FilteredSink

`FilteredSink` filters entries with a predicate function; create it with `NewFilteredSink(sink, filter)`. The constructor `NewFilteredSink` returns a filtering instance wrapping the underlying Sink.

```go
func NewFilteredSink(sink AuditSink, filter func(AuditEntry) bool) *FilteredSink
```

| Method | Description |
|--------|-------------|
| `FilteredSink.Write` | Writes to the underlying Sink when the predicate returns `true` (or when the predicate is `nil`) |
| `FilteredSink.Close` | Closes the underlying Sink |

### LevelFilteredSink

`LevelFilteredSink` filters by minimum level; create it with `NewLevelFilteredSink(sink, minLevel)`. The constructor `NewLevelFilteredSink` returns an instance filtering at the `minLevel` threshold.

```go
func NewLevelFilteredSink(sink AuditSink, minLevel AuditLevel) *LevelFilteredSink
```

| Method | Description |
|--------|-------------|
| `LevelFilteredSink.Write` | Writes to the underlying Sink when the entry level is at or above `minLevel` |
| `LevelFilteredSink.Close` | Closes the underlying Sink |

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

## Related Documentation

- [Audit Pipeline](../../guides/security/audit-pipeline) — Guide to building audit pipelines
- [Security Overview](../../guides/security/) — Conceptual introduction and best practices
- [Production Checklist](../../guides/security/production-checklist) — Pre-launch security checklist

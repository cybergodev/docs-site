---
sidebar_label: "Audit System"
title: "Audit System - CyberGo html | Pluggable Audit API"
description: "CyberGo html audit API: AuditConfig fields and presets, 8 event types, three levels, AuditEntry, and six Sink types with their 7 constructors."
sidebar_position: 40
---

# Audit System

The audit system records security events — blocked tags, attributes, and URLs, plus timeouts and path traversal — as `AuditEntry` values, then ships them through a pluggable `Sink` to one or more destinations. `AuditConfig` controls the behavior.

## AuditConfig

```go
type AuditConfig struct {
	Enabled            bool      `json:"enabled"`              // Enable audit
	LogBlockedTags     bool      `json:"log_blocked_tags"`     // Log blocked tags
	LogBlockedAttrs    bool      `json:"log_blocked_attrs"`    // Log blocked attributes
	LogBlockedURLs     bool      `json:"log_blocked_urls"`     // Log blocked URLs
	LogInputViolations bool      `json:"log_input_violations"` // Log input violations
	LogDepthViolations bool      `json:"log_depth_violations"` // Log depth violations
	LogTimeouts        bool      `json:"log_timeouts"`         // Log timeouts
	LogEncodingIssues  bool      `json:"log_encoding_issues"`  // Log encoding issues
	LogPathTraversal   bool      `json:"log_path_traversal"`   // Log path traversal attempts
	Sink               AuditSink `json:"-"`                    // Audit output destination (excluded from JSON serialization)
	IncludeRawValues   bool      `json:"include_raw_values"`   // Include raw values
	MaxRawValueLength  int       `json:"max_raw_value_length"` // Max raw value length
	MaxEntries         int       `json:"max_entries"`          // In-memory audit entry cap
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
| `AuditConfig.Sink` | `AuditSink` | Audit output destination; when audit is enabled and this is `nil`, `LoggerAuditSink` is used |
| `AuditConfig.IncludeRawValues` | `bool` | Include raw attribute/URL values (may contain malicious content; enable with care) |
| `AuditConfig.MaxRawValueLength` | `int` | Maximum recorded length of raw values, truncated beyond it; `0` uses `DefaultMaxRawValueLength` (200) |
| `AuditConfig.MaxEntries` | `int` | Cap on entries retained in memory by `GetAuditLog` (`0` uses the default 10000) |

### Validate

`AuditConfig.Validate` checks the audit configuration for validity (value receiver, callable as `cfg.Audit.Validate()`); `Config.Validate` delegates to `Validate` internally for the audit fields.

```go
func (c AuditConfig) Validate() error
```

The constraints match the audit rows of [`Config.Validate`](../core/config#validation-constraints): `MaxRawValueLength` ≥ 0 and `MaxEntries` between 0 and 100000. Violations return a `*ConfigError` wrapping `ErrInvalidConfig`, with the field name carrying the Audit. prefix (for example Audit.MaxEntries).

```go
err := cfg.Audit.Validate()
```

## Preset Audit Configs

### DefaultAuditConfig

Returns the default audit configuration: `Enabled=false` (audit is off by default), with all 8 log switches `true`.

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

Returns a high-security audit configuration with all logging and raw value recording enabled.

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

:::info How MaxEntries behaves
`MaxEntries` caps how many audit entries `GetAuditLog` retains in memory. Setting it to `0` uses the default `DefaultMaxAuditEntries` (10000); negative values and values above `100000` (`maxConfigAuditEntries`) are rejected by `Config.Validate`. When the cap is reached, the oldest half of the entries is dropped, so the most recent events always survive. For retention beyond that in-memory cap, feed an `AuditSink`.
:::

## Type Definitions

```go
type AuditEventType string  // Audit event type
type AuditLevel string      // Audit severity level
```

`AuditEventType` identifies the category of an audit event and `AuditLevel` its severity; both are `string` type aliases. Their constant values are listed in the next section.

## Event Types and Levels

`AuditEventType` has 8 event kinds: `AuditEventBlockedTag`, `AuditEventBlockedAttr`, `AuditEventBlockedURL`, `AuditEventInputViolation`, `AuditEventDepthViolation`, `AuditEventTimeout`, `AuditEventEncodingIssue`, `AuditEventPathTraversal`. `AuditLevel` has 3 levels: `AuditLevelInfo`, `AuditLevelWarning`, `AuditLevelCritical`.

Constant values and per-item descriptions are authoritative in [Constants & Errors](../types/constants#audit-constants) (single source of truth; this page does not duplicate that table).

## AuditEntry

An audit log entry.

```go
type AuditEntry struct {
	Timestamp time.Time      `json:"timestamp"`            // Event time
	EventType AuditEventType `json:"event_type"`           // Event type
	Level     AuditLevel     `json:"level"`                // Audit level
	Message   string         `json:"message"`              // Event description
	Tag       string         `json:"tag,omitempty"`        // Related tag
	Attribute string         `json:"attribute,omitempty"`  // Related attribute
	URL       string         `json:"url,omitempty"`        // Related URL
	InputSize int            `json:"input_size,omitempty"` // Input size
	MaxSize   int            `json:"max_size,omitempty"`   // Size limit
	Depth     int            `json:"depth,omitempty"`      // DOM depth
	MaxDepth  int            `json:"max_depth,omitempty"`  // Depth limit
	Path      string         `json:"path,omitempty"`       // File path
	RawValue  string         `json:"raw_value,omitempty"`  // Raw value
	Metadata  map[string]any `json:"metadata,omitempty"`   // Additional metadata
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `AuditEntry.Timestamp` | `time.Time` | When the event was recorded (UTC) |
| `AuditEntry.EventType` | `AuditEventType` | Event category (e.g. `blocked_tag`, `timeout`) |
| `AuditEntry.Level` | `AuditLevel` | Severity (`info` / `warning` / `critical`) |
| `AuditEntry.Message` | `string` | Human-readable description |
| `AuditEntry.Tag` | `string` | HTML tag that triggered the event (when applicable) |
| `AuditEntry.Attribute` | `string` | Attribute that triggered the event (when applicable) |
| `AuditEntry.URL` | `string` | Resource URL that triggered the event (when applicable) |
| `AuditEntry.InputSize` | `int` | Actual input size for input-violation events |
| `AuditEntry.MaxSize` | `int` | Configured size limit for input-violation events |
| `AuditEntry.Depth` | `int` | Actual nesting depth for depth-violation events |
| `AuditEntry.MaxDepth` | `int` | Configured depth limit for depth-violation events |
| `AuditEntry.Path` | `string` | File path for path traversal events (reduced to the filename) |
| `AuditEntry.RawValue` | `string` | Raw attribute/URL value (populated only when `IncludeRawValues=true`) |
| `AuditEntry.Metadata` | `map[string]any` | Additional event-specific key-value pairs |

:::tip Which fields get populated
`Timestamp`, `EventType`, `Level`, and `Message` are set on every entry. `Tag`, `Attribute`, and `URL` are filled only for the matching events (blocked tag/attribute/URL); a blocked URL fills both the `URL` and `RawValue` fields. `InputSize`/`MaxSize` and `Depth`/`MaxDepth` accompany input-violation and depth-violation events respectively. `RawValue` is kept only when `IncludeRawValues=true`; before recording it is HTML-escaped and truncated to `MaxRawValueLength`. An `encoding_issue` event writes the declared encoding name into `Metadata["encoding"]`; for other events `Metadata` carries event-specific extras. Overly long attacker-controlled fields are truncated on record: `URL` beyond 256 bytes is cut and suffixed with `...[truncated]`, and `Tag`/`Attribute`/`Path`/`Message` beyond 256 bytes are cut rune-safely and suffixed with `...`.
:::

## AuditSink Interface

```go
type AuditSink interface {
	Write(entry AuditEntry)
	Close() error
}
```

An implementation supplies two methods: `AuditSink.Write` takes one `AuditEntry` (by convention **non-blocking and concurrency-safe**) and `AuditSink.Close` releases resources. The built-in sinks come from 7 constructors covering 6 sink types.

## Sink Types

### LoggerAuditSink

`LoggerAuditSink` writes through a standard library `log.Logger` with an `[AUDIT]` prefix. `NewLoggerAuditSink` writes to standard error (`os.Stderr`); to redirect to a file or a network connection, pass any `io.Writer` to `NewLoggerAuditSinkWithWriter` (a `nil` writer falls back to standard error, so the constructor never returns a sink that panics on use).

```go
func NewLoggerAuditSink() *LoggerAuditSink
func NewLoggerAuditSinkWithWriter(w io.Writer) *LoggerAuditSink
```

| Method | Description |
|--------|-------------|
| `LoggerAuditSink.Write` | Serializes the entry to JSON and logs it (`[AUDIT]` prefix) |
| `LoggerAuditSink.Close` | No-op; always returns `nil` |

### ChannelAuditSink

`ChannelAuditSink` sends entries to a buffered channel, for asynchronous handling or integration with external logging systems. Create it with `NewChannelAuditSink` (the parameter is the buffer size); consumers receive from the read-only channel returned by `Channel`. `Write` is **non-blocking**: when the buffer is full the entry is dropped and the drop counter increments (no blocking, no error). Query `DroppedCount` to alert or scale.

```go
func NewChannelAuditSink(bufferSize int) *ChannelAuditSink
```

A negative `bufferSize` becomes `0` (unbuffered channel); a value above `100000` is clamped to `100000`, avoiding one oversized allocation.

| Method | Signature | Description |
|--------|-----------|-------------|
| `ChannelAuditSink.Channel` | `func (s *ChannelAuditSink) Channel() <-chan AuditEntry` | Returns the read-only receive channel |
| `ChannelAuditSink.DroppedCount` | `func (s *ChannelAuditSink) DroppedCount() int64` | Number of entries dropped because the buffer was full |
| `ChannelAuditSink.Write` | `func (s *ChannelAuditSink) Write(entry AuditEntry)` | Non-blocking write; drops and counts when full; a write after `Close` is a no-op |
| `ChannelAuditSink.Close` | `func (s *ChannelAuditSink) Close() error` | Closes the channel (idempotent: only the first call closes it) |

```go
sink := html.NewChannelAuditSink(100)
go func() {
	for entry := range sink.Channel() {
		log.Println(entry.Message)
	}
}()
```

### WriterAuditSink

`WriterAuditSink` writes JSON Lines to an `io.Writer`; create it with `NewWriterAuditSink` (the parameter is the target writer).

```go
func NewWriterAuditSink(w io.Writer) *WriterAuditSink
```

| Method | Description |
|--------|-------------|
| `WriterAuditSink.Write` | Serializes the entry to JSON and writes it to the underlying writer |
| `WriterAuditSink.Close` | No-op; always returns `nil` |

### MultiSink

`MultiSink` fans entries out to several sinks; create it with `NewMultiSink` (the variadic parameter is the list of child sinks to fan out to). On write it calls each child sink in turn, and **a panic in one child is isolated** so it cannot affect the other children or the main extraction flow (the audit subsystem is best-effort). `Close` uses `errors.Join` to **aggregate the close errors of every child sink** rather than keeping only the last one — discarding an earlier sink's delivery failure would hide a real problem.

```go
func NewMultiSink(sinks ...AuditSink) *MultiSink
```

| Method | Description |
|--------|-------------|
| `MultiSink.Write` | Writes the entry to every child sink (skipping `nil`; a child panic is recovered) |
| `MultiSink.Close` | Closes every child sink, aggregating errors with `errors.Join` |

### FilteredSink

`FilteredSink` filters entries with a predicate; create it with `NewFilteredSink` (the parameters are the underlying sink and a `func(AuditEntry) bool` predicate).

```go
func NewFilteredSink(sink AuditSink, filter func(AuditEntry) bool) *FilteredSink
```

| Method | Description |
|--------|-------------|
| `FilteredSink.Write` | Writes to the underlying sink when the predicate returns `true` (or when the predicate is `nil`) |
| `FilteredSink.Close` | Closes the underlying sink |

### LevelFilteredSink

`LevelFilteredSink` filters by minimum level; create it with `NewLevelFilteredSink(sink, minLevel)`.

```go
func NewLevelFilteredSink(sink AuditSink, minLevel AuditLevel) *LevelFilteredSink
```

The `minLevel` you pass is lowercased before comparison. An unrecognized level string (say a hand-typed `"warn"`) **disables filtering** — every entry is forwarded to the underlying sink (fail-open) — so pass the `AuditLevelInfo` / `AuditLevelWarning` / `AuditLevelCritical` constants.

| Method | Description |
|--------|-------------|
| `LevelFilteredSink.Write` | Writes to the underlying sink when the entry level is at or above `minLevel` |
| `LevelFilteredSink.Close` | Closes the underlying sink |

## Example

```go
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/cybergodev/html"
)

func main() {
	auditFile, err := os.Create("audit.jsonl")
	if err != nil {
		log.Fatal(err)
	}
	defer auditFile.Close()

	// Multi-layer pipeline: warning and above go to the file, all events also go to stderr
	writerSink := html.NewWriterAuditSink(auditFile)
	levelSink := html.NewLevelFilteredSink(writerSink, html.AuditLevelWarning)
	multiSink := html.NewMultiSink(levelSink, html.NewLoggerAuditSink())

	cfg := html.DefaultConfig()
	cfg.Audit.Enabled = true
	cfg.Audit.Sink = multiSink

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	data := []byte(`<html><body><script>alert(1)</script><p>Body</p></body></html>`)
	if _, err := p.Extract(data); err != nil {
		log.Fatal(err)
	}

	// Entries retained in memory
	for _, e := range p.GetAuditLog() {
		fmt.Printf("[%s] %s: %s\n", e.Level, e.EventType, e.Message)
	}
	// Output (excerpt): [warning] blocked_tag: Blocked dangerous HTML tag: script
}
```

## Related Documentation

- [Audit Pipeline](../../guides/security/audit-pipeline) — Guide to building audit pipelines
- [Security Overview](../../guides/security/) — Security concepts and best practices
- [Production Checklist](../../guides/security/production-checklist) — Pre-launch security checks

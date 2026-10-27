---
sidebar_label: "Audit System"
title: "Audit Pipeline - CyberGo html | Pipeline Guide"
description: "CyberGo html audit pipeline: 8 event types, info/warning/critical filtering, and the 7 built-in Sink constructors for file, channel, and tiered routing."
sidebar_position: 20
---

# Audit Pipeline

The audit system writes security events — blocked tags, attributes, and URLs, plus input violations, depth violations, timeouts, encoding issues, and path traversal — to a pluggable Sink. This page goes from the smallest configuration to a tiered routing pipeline; event constant values are in [Constants & Errors](../../api-reference/types/constants#audit-constants), and full Sink signatures are in the [Audit System reference](../../api-reference/modules/audit).

## Minimal Configuration

`DefaultConfig()` already carries `DefaultAuditConfig()`, so you only flip the switch:

```go
cfg := html.DefaultConfig()
cfg.Audit.Enabled = true // Enabled is false in the default config
```

With `Sink` left `nil`, events go to the default `LoggerAuditSink`, which writes `[AUDIT] <timestamp> JSON` lines to standard error (the date-time prefix of the standard `log` library's LstdFlags). The audit configuration can also be validated on its own with `cfg.Audit.Validate()` — `Config.Validate` delegates to it internally.

## Event Types and Levels

Three levels increase in severity; `LevelFilteredSink` and alert routing both build on them:

```text
info < warning < critical
```

| Event | Constant value | Level | Trigger |
|-------|----------------|-------|---------|
| Blocked tag | `blocked_tag` | warning | A dangerous tag was removed (e.g. `<script>`) |
| Blocked attribute | `blocked_attr` | warning | A dangerous attribute was removed (e.g. `onclick`) |
| Blocked URL | `blocked_url` | warning | A dangerous URL was rejected |
| Input violation | `input_violation` | critical | Input exceeded the size limit |
| Depth violation | `depth_violation` | warning | DOM nesting exceeded `MaxDepth` |
| Processing timeout | `timeout` | warning | The library's `ProcessingTimeout` expired |
| Encoding issue | `encoding_issue` | info | Encoding detection or conversion failed |
| Path traversal | `path_traversal` | critical | The path contains a `..` component, or in `AllowedBaseDir` mode the OS-handle-resolved path falls outside the base |

`info` needs no alerting; watch `warning` for trends; `critical` marks attack signatures (input violations, path traversal) and should page directly.

## Built-in Sinks

Seven constructors cover six Sink types:

| Constructor | Destination | Behavior |
|-------------|-------------|----------|
| `NewLoggerAuditSink()` | Standard error | `[AUDIT]` prefix; the default Sink |
| `NewLoggerAuditSinkWithWriter(w)` | Any `io.Writer` | Falls back to standard error when `w` is `nil` |
| `NewWriterAuditSink(w)` | Any `io.Writer` | JSON Lines, suited to file persistence |
| `NewChannelAuditSink(size)` | Buffered channel | Drops and counts on a full buffer instead of blocking |
| `NewMultiSink(sinks...)` | Multiple Sinks | `Close` joins child errors with `errors.Join`; each child's writes isolate panics independently |
| `NewFilteredSink(sink, filter)` | Predicate filter | Writes downstream only when `filter` returns `true`; a `nil` filter passes everything |
| `NewLevelFilteredSink(sink, minLevel)` | Level filter | Writes downstream only at or above `minLevel` |

`WriterAuditSink` emits one JSON object per line:

```json
{"timestamp":"2026-04-30T10:00:00Z","event_type":"blocked_tag","level":"warning","message":"Blocked dangerous HTML tag: script","tag":"script"}
```

`ChannelAuditSink` is drained by a consumer goroutine, which makes it the natural bridge to an external system:

```go
sink := html.NewChannelAuditSink(100)

go func() {
	for entry := range sink.Channel() {
		sendToSIEM(entry)
	}
}()

// entries are dropped rather than blocking when the channel is full
fmt.Printf("dropped: %d\n", sink.DroppedCount())
```

## Building Pipelines

### Scenario 1: File Persistence

```go
file, err := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
if err != nil {
	log.Fatal(err)
}
defer file.Close()

cfg := html.DefaultConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewWriterAuditSink(file)
```

`WriterAuditSink.Close` is a no-op and does not close the underlying file; the caller owns the handle, so open the file outside the Sink.

### Scenario 2: Tiered Routing

Every event lands in the file, and `critical` events also enter an alert channel:

```go
file, err := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
if err != nil {
	log.Fatal(err)
}
defer file.Close()

alertSink := html.NewChannelAuditSink(50)
go func() {
	for entry := range alertSink.Channel() {
		sendAlert(entry) // wire to PagerDuty / Slack / SMS
	}
}()

cfg := html.DefaultConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewMultiSink(
	html.NewWriterAuditSink(file),
	html.NewFilteredSink(alertSink, func(e html.AuditEntry) bool {
		return e.Level == html.AuditLevelCritical
	}),
)
```

`MultiSink` writes to its children synchronously and in order on the extraction call stack: a child whose `Write` is slow delays the children after it and slows the extraction itself. `ChannelAuditSink`'s `Write` never blocks; when slow destinations such as files or the network must not slow extraction, bridge them through a `ChannelAuditSink`. Writes to each child isolate panics separately: when one child panics, the remaining children still receive that event.

### Scenario 3: High-Security Mode

`HighSecurityConfig()` already sets `Audit` to `HighSecurityAuditConfig()`, so you only replace the Sink:

```go
file, err := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
if err != nil {
	log.Fatal(err)
}
defer file.Close()

cfg := html.HighSecurityConfig()
cfg.Audit.Sink = html.NewMultiSink(
	html.NewWriterAuditSink(file),
	html.NewLoggerAuditSink(),
)

p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()
```

The high-security audit preset sets `Enabled = true`, records all 8 event types, sets `IncludeRawValues = true` and `MaxRawValueLength = 500`. Raw values serve forensics, but they also put attack payloads verbatim into your logs — enable them only when the downstream escapes or isolates log content.

## ChannelAuditSink Async Consumption and Drop Alerts

`ChannelAuditSink` is designed for asynchronous consumption: `Write` pushes events into a buffered channel non-blockingly on the extraction path — a full buffer drops and counts the entry instead — while a consumer drains the channel in its own goroutine. Full signatures are in the [ChannelAuditSink API reference](../../api-reference/modules/audit#channelauditsink). Two points in time shape how the consumer side is written:

- By the time `Extract` returns, every event is already enqueued (or already counted as dropped), so `DroppedCount()` is exact at that moment — no need to wait for the consumer to drain;
- `Processor.Close()` closes the channel, and the consumer's `range` loop exits with it — a natural shutdown signal.

In production, sample `DroppedCount()` periodically: a value persistently above 0 means consumption cannot keep up with event production (typically a downstream SIEM or alerting endpoint slowing down or becoming unavailable). What gets dropped in that state are the new events; extraction throughput is unaffected. The remediation order is to speed up consumption first (batched writes, asynchronous I/O) and only then consider a larger buffer — a negative argument to `NewChannelAuditSink` is clamped to 0 and anything above 100000 is clamped to 100000, and a buffer only buys time to drain; it does not fix a slow consumer.

```go
package main

import (
	"fmt"
	"log"
	"sync/atomic"

	"github.com/cybergodev/html"
)

func main() {
	// Buffer of 100 entries; a negative argument clamps to 0, values above 100000 clamp to 100000
	sink := html.NewChannelAuditSink(100)

	// A separate goroutine consumes asynchronously, simulating forwarding to a SIEM / alerting system
	var consumed, critical atomic.Int64
	done := make(chan struct{})
	go func() {
		defer close(done)
		for entry := range sink.Channel() {
			consumed.Add(1)
			if entry.Level == html.AuditLevelCritical {
				critical.Add(1) // count critical events separately for immediate alerting
			}
		}
	}()

	cfg := html.DefaultConfig()
	cfg.Audit.Enabled = true
	cfg.Audit.Sink = sink

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}

	// Each document triggers one blocked_attr (onclick) and one blocked_tag (script)
	dangerous := []byte(`<html><body><p onclick="alert(1)">hi</p><script>x()</script></body></html>`)
	for i := 0; i < 3; i++ {
		if _, err := p.Extract(dangerous); err != nil {
			log.Fatalf("extraction failed: %v", err)
		}
	}

	// Close closes the channel; the consumer's range loop exits with it
	if err := p.Close(); err != nil {
		log.Fatal(err)
	}
	<-done

	dropped := sink.DroppedCount()
	if dropped > 0 {
		log.Printf("audit drop alert: %d entries dropped; enlarge the buffer or consume faster", dropped)
	}
	fmt.Printf("consumed %d (critical %d), dropped %d\n", consumed.Load(), critical.Load(), dropped) // Output: consumed 6 (critical 0), dropped 0
}
```

A buffer of 100 dwarfs the 6 events in this example, so on the normal path `DroppedCount()` stays 0; the alert branch fires only after consumption stalls long enough to fill the buffer.

## Querying the Audit Log

The Processor also retains entries in memory, so you can query them inside the same process:

```go
p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()

if _, err := p.Extract(data); err != nil {
	log.Printf("extraction failed: %v", err)
}

entries := p.GetAuditLog()
for _, entry := range entries {
	fmt.Printf("[%s] %s: %s\n", entry.Level, entry.EventType, entry.Message)
}

p.ClearAuditLog()
```

:::tip `GetAuditLog` returns only in-memory entries
Retention is bounded by `AuditConfig.MaxEntries` (default 10000, maximum 100000); once the cap is reached the oldest half is dropped, so only recent events survive. For complete retention, configure a Sink instead of relying on `GetAuditLog`.
:::

## Custom Sinks

Implement the two `AuditSink` methods to reach any destination. `Write` is called synchronously on the extraction path, so it must be non-blocking and concurrency-safe:

```go
type slackSink struct {
	webhook string
}

func (s *slackSink) Write(entry html.AuditEntry) {
	if entry.Level != html.AuditLevelCritical {
		return // only send critical events
	}
	msg := fmt.Sprintf("[AUDIT] %s: %s", entry.EventType, entry.Message)
	if _, err := http.Post(s.webhook, "text/plain", strings.NewReader(msg)); err != nil {
		log.Printf("failed to send audit alert: %v", err)
	}
}

func (s *slackSink) Close() error {
	return nil
}
```

The example posts over HTTP inside `Write`, which slows the extraction path; in production, push to a channel or queue and send asynchronously. Two guarantees come from the library, so you do not handle them yourself: a panicking Sink never reaches the caller (SEC-003), and `Processor.Close()` calls the Sink's `Close()` and returns its error.

## Next Steps

- [Production Checklist](./production-checklist) — pre-deployment security checks
- [API Reference: Audit System](../../api-reference/modules/audit) — complete API signatures
- [Error Handling](../performance/error-handling) — classifying and handling security errors

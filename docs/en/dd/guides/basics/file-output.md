---
sidebar_label: "File Output & Rotation"
title: "File Output & Rotation - CyberGo DD | File Logging Guide"
description: "CyberGo DD file logging: FileWriter size rotation and time cleanup, BufferedWriter optimization, MultiWriter fan-out, and production best practices."
sidebar_position: 4
---

# File Output & Rotation

DD provides flexible file-output capabilities, supporting automatic rotation, buffered writes, and multi-target fan-out, suitable for production use.

## Quick Start

### Basic File Output

```go
package main

import (
	"log"

	"github.com/cybergodev/dd"
)

func main() {
	cfg := dd.DefaultConfig()
	cfg.Targets = []dd.OutputTarget{
		dd.FileOutput("logs/app.log"),
	}
	logger, err := dd.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer logger.Close()

	logger.Info("log will be written to a file") // Written to logs/app.log
}
```

### Console + File Dual Output

```go
cfg := dd.DefaultConfig()
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
}
logger, err := dd.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## FileWriter Rotation Configuration

FileWriter supports size-based automatic rotation and time-based cleanup of old files:

### Default Config

```go
cfg := dd.DefaultFileWriterConfig()
// MaxSizeMB:   100   - 100MB max per file
// MaxAge:      30 * 24 * time.Hour  - keep 30 days
// MaxBackups:  10    - keep up to 10 backups
// Compress:    false - no compression
```

### Custom Rotation Strategy

```go
// High-traffic service: small files, fast rotation
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 50                // Rotate at 50MB
fwCfg.MaxBackups = 20               // Keep 20 backups
fwCfg.MaxAge = 7 * 24 * time.Hour   // 7-day cleanup
fwCfg.Compress = true      // Compress old files

fw, err := dd.NewFileWriter("logs/app.log", fwCfg)
if err != nil {
    log.Fatal(err)
}

cfg := dd.DefaultConfig()
cfg.Targets = []dd.OutputTarget{dd.CustomOutput(fw)}
logger, err := dd.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### JSON-format Log File

```go
cfg := dd.DefaultConfig()
cfg.Format = dd.FormatJSON
cfg.Targets = []dd.OutputTarget{
    dd.FileOutput("logs/app.json"),
}
logger, err := dd.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

Rotated file naming rules:

```text
logs/app.log           <- current log
logs/app_log_1.log     <- first rotation (older backup)
logs/app_log_2.log     <- second rotation (newest backup)
logs/app_log_1.log.gz  <- old backups are compressed to .gz when Compress is enabled
```

Each rotation uses a new monotonically increasing index (`maxIndex + 1`), so the **highest index is the newest backup**; when `MaxBackups` is exceeded, cleanup **deletes the lowest indices first**.

:::info Compression and Backups Do Not Coexist
When `Compress` is enabled, compression happens after rotation in a separate goroutine, asynchronously; the backup is compressed into a `.log.gz` file (written to a temp file and verified), then the original `.log` backup is deleted — the two do not coexist.
:::

## BufferedWriter Buffered Writes

For high-throughput scenarios, use `BufferedWriter` to reduce I/O count:

```go
// Create the file Writer
fw, err := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}

// Wrap in a buffered Writer
bwCfg := dd.DefaultBufferedWriterConfig()
// BufferSize: 1024  - 1KB buffer
// FlushTime:  100ms - 100ms auto-flush

bw, err := dd.NewBufferedWriter(fw, bwCfg)
if err != nil {
    log.Fatal(err)
}

cfg := dd.DefaultConfig()
cfg.Targets = []dd.OutputTarget{dd.CustomOutput(bw)}
logger, err := dd.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer logger.Close() // Close auto-flushes
```

### Tuning Advice

| Scenario | BufferSize | FlushTime | Description |
|----------|-----------|-----------|-------------|
| Low-latency | 1024 | 10ms | Default buffer + frequent flush (BufferSize below 1024 is clamped up to the default) |
| General | 1024 | 100ms | Defaults; balances latency and throughput |
| High-throughput | 4096 | 500ms | Large buffer, maximizes throughput |
| Batch processing | 8192 | 1000ms | Large buffer; suitable for offline processing (hard cap is 10MB) |

:::warning Data Safety
BufferedWriter flushes when the buffer is half-full (reaches BufferSize/2) or on a timer tick. Abnormal program exits may lose data still in the buffer. Be sure to call `Close()` or `Flush()` to ensure data integrity.
:::

## MultiWriter Multi-target Fan-out

```go
// Write to file and a remote service simultaneously
fw, err := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}
remote := &RemoteLogWriter{endpoint: "http://log-service/ingest"}

mw := dd.NewMultiWriter(fw, remote)

cfg := dd.DefaultConfig()
cfg.Targets = []dd.OutputTarget{dd.CustomOutput(mw)}
logger, err := dd.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

MultiWriter fans logs out to all Writers; failure of one Writer does not affect the others.

## Dynamic Writer Management

The Logger supports adding and removing Writers at runtime:

```go
// Add a Writer at runtime
fw, err := dd.NewFileWriter("logs/debug.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}
err = logger.AddWriter(fw)

// Remove a Writer at runtime
err = logger.RemoveWriter(fw)

// Query current Writer count
count := logger.WriterCount()
_ = count
```

:::tip Use Cases
Dynamic Writers are suitable for scenarios needing runtime log-target switching, such as adding a detailed log file when debug mode is enabled, or switching to a remote log service when disk space is low.
:::

## Custom Writers

Implement the `io.Writer` interface to create custom output targets:

```go
// Network log sender
type LogstashWriter struct {
    endpoint string
    client   *http.Client
}

func (w *LogstashWriter) Write(p []byte) (n int, err error) {
    resp, err := w.client.Post(w.endpoint, "application/json", bytes.NewReader(p))
    if err != nil {
        return 0, err
    }
    defer resp.Body.Close()
    return len(p), nil
}

// Use the custom Writer
cfg := dd.DefaultConfig()
cfg.Format = dd.FormatJSON
cfg.Targets = []dd.OutputTarget{
    dd.FileOutput("logs/app.json"),
    dd.CustomOutput(&LogstashWriter{
        endpoint: "http://logstash:5044",
        client:   &http.Client{Timeout: 5 * time.Second},
    }),
}
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## Recommended Production Configuration

```go
func NewProductionLogger() (*dd.Logger, error) {
    // File Writer: moderate rotation + compression
    fwCfg := dd.DefaultFileWriterConfig()
    fwCfg.MaxSizeMB = 100
    fwCfg.MaxAge = 30 * 24 * time.Hour
    fwCfg.MaxBackups = 15
    fwCfg.Compress = true

    fw, err := dd.NewFileWriter("logs/app.json", fwCfg)
    if err != nil {
        return nil, err
    }

    // Buffered wrapper
    bw, err := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
    if err != nil {
        return nil, err
    }

    cfg := dd.DefaultConfig()
    cfg.Level = dd.LevelInfo
    cfg.Format = dd.FormatJSON
    cfg.Targets = []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.CustomOutput(bw),
    }
    return dd.New(cfg)
}
```

## Next Steps

- [Structured Logging](./structured-logging) -- Fields and chaining
- [Log Sampling](../operations/sampling) -- Volume control for high-throughput scenarios
- [API Reference - Writers](../../api-reference/output-integration/writers) -- Complete Writer API
- [Performance Tuning](../../advanced/performance) -- Performance tuning advice

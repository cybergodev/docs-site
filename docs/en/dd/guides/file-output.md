---
sidebar_label: "File Output & Rotation"
title: "File Output & Rotation - CyberGo DD | File Logging Guide"
description: "CyberGo DD file output and log-rotation configuration guide, covering FileWriter size rotation and time cleanup, BufferedWriter buffered-write optimization, MultiWriter multi-target fan-out, dynamic Writer management, and production best practices to help you build a highly reliable file-logging system."
sidebar_position: 3
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
    logger, err := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/app.log"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    logger.Info("log will be written to a file") // Written to logs/app.log
}
```

### Console + File Dual Output

```go
logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
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
logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### JSON-format Log File

```go
logger, err := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

Rotated file naming rules:

```text
logs/app.log           <- current log
logs/app_log_1.log     <- first rotation (newest backup)
logs/app_log_2.log     <- older backup
logs/app_log_1.log.gz  <- old backups are compressed to .gz when Compress is enabled
```

:::info Compression and Backups Do Not Coexist
When `Compress` is enabled, compression happens after rotation in a separate goroutine, asynchronously; when compression finishes, the original `.log` backup is **renamed** to `.log.gz` — the two do not coexist.
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

logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close() // Close auto-flushes
```

### Tuning Advice

| Scenario | BufferSize | FlushTime | Description |
|----------|-----------|-----------|-------------|
| Low-latency | 512 | 50ms | Fast flush, lower latency |
| General | 1024 | 100ms | Defaults; balances latency and throughput |
| High-throughput | 4096 | 500ms | Large buffer, maximizes throughput |
| Batch processing | 8192 | 1000ms | Max buffer; suitable for offline processing |

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

logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
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
logger, err := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
        dd.CustomOutput(&LogstashWriter{
            endpoint: "http://logstash:5044",
            client:   &http.Client{Timeout: 5 * time.Second},
        }),
    },
})
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

    return dd.New(dd.Config{
        Level:  dd.LevelInfo,
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.CustomOutput(bw),
        },
    })
}
```

## Next Steps

- [Structured Logging](./structured-logging) -- Fields and chaining
- [Sensitive Data Filtering](./sensitive-filtering) -- Auto-redaction
- [API Reference - Writers](../api-reference/output-integration/writers) -- Complete Writer API
- [Performance Tuning](../advanced/performance) -- Performance tuning advice

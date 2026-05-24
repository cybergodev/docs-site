---
title: "File Output & Rotation - CyberGo DD | Config"
description: "CyberGo DD file output and rotation: FileWriter size and time-based rotation, BufferedWriter optimization, MultiWriter, and production best practices."
---

# File Output and Rotation

DD provides flexible file output capabilities with automatic rotation, buffered writing, and multi-target dispatch, suitable for production environments.

## Quick Start

### Basic File Output

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.log"),
    },
})
defer logger.Close()

logger.Info("Log will be written to file")
```

### Console + File Dual Output

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
defer logger.Close()
```

## FileWriter Rotation Configuration

FileWriter supports automatic size-based rotation and time-based cleanup of old files:

### Default Configuration

```go
cfg := dd.DefaultFileWriterConfig()
// MaxSizeMB:   100   — Max 100MB per file
// MaxAge:      30 * 24 * time.Hour  — Retain for 30 days
// MaxBackups:  10    — Keep up to 10 backups
// Compress:    false — No compression
```

### Custom Rotation Strategy

```go
// High-traffic service: smaller files, faster rotation
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 50                // Rotate at 50MB
fwCfg.MaxBackups = 20               // Keep 20 backups
fwCfg.MaxAge = 7 * 24 * time.Hour   // Clean up after 7 days
fwCfg.Compress = true      // Compress old files

fw, _ := dd.NewFileWriter("logs/app.log", fwCfg)
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})
```

### JSON Format Log Files

```go
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
    },
})
```

Rotated file naming convention:

```text
logs/app.log           ← Current log
logs/app-001.log       ← First rotation
logs/app-002.log.gz    ← Compressed old backup (when Compress is enabled)
```

## BufferedWriter

In high-throughput scenarios, use `BufferedWriter` to reduce I/O operations:

```go
// Create file Writer
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// Wrap as buffered Writer
bwCfg := dd.DefaultBufferedWriterConfig()
// BufferSize: 1024  — 1KB buffer
// FlushTime:  100ms — 100ms auto-flush

bw, _ := dd.NewBufferedWriter(fw, bwCfg)

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
defer logger.Close() // Close automatically flushes
```

### Tuning Recommendations

| Scenario | BufferSize | FlushTime | Description |
|----------|-----------|-----------|-------------|
| Low latency required | 512 | 50ms | Fast flush, reduced latency |
| General purpose | 1024 | 100ms | Default values, balanced latency and throughput |
| High throughput | 4096 | 500ms | Large buffer, maximized throughput |
| Batch processing | 8192 | 1000ms | Maximum buffer, suitable for offline processing |

:::warning Data Safety
BufferedWriter flushes when the buffer is full or the timer triggers. Abnormal program exit may cause data loss in the buffer. Ensure you call `Close()` or `Flush()` to guarantee data integrity.
:::

## MultiWriter Multi-Target Dispatch

```go
// Write to both file and remote service simultaneously
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
remote := &RemoteLogWriter{endpoint: "http://log-service/ingest"}

mw := dd.NewMultiWriter(fw, remote)

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
```

MultiWriter dispatches logs to all Writers. A failure in one Writer does not affect others.

## Dynamic Writer Management

Logger supports adding and removing Writers at runtime:

```go
// Add Writer at runtime
fw, _ := dd.NewFileWriter("logs/debug.log", dd.DefaultFileWriterConfig())
err := logger.AddWriter(fw)

// Remove Writer at runtime
err = logger.RemoveWriter(fw)

// Query current Writer count
count := logger.WriterCount()
```

:::tip Use Cases
Dynamic Writers are suitable for scenarios requiring runtime log target switching, such as: adding detailed log files when debug mode is enabled, or switching to a remote logging service when disk space is low.
:::

## Custom Writer

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

// Use custom Writer
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
        dd.CustomOutput(&LogstashWriter{
            endpoint: "http://logstash:5044",
            client:   &http.Client{Timeout: 5 * time.Second},
        }),
    },
})
```

## Production Environment Recommended Configuration

```go
func NewProductionLogger() (*dd.Logger, error) {
    // File Writer: medium rotation + compression
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
- [Sensitive Data Filtering](./sensitive-filtering) -- Automatic redaction
- [API Reference - Writers](../api-reference/writers) -- Writer complete API
- [Performance Optimization](../advanced/performance) -- Performance tuning tips

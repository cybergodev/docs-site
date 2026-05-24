---
title: "Output Targets - CyberGo DD | FileWriter & Buffer"
description: "CyberGo DD writers API: FileWriter rotation (size and time-based), BufferedWriter performance tuning, and MultiWriter parallel output targets."
---

# Output Targets

DD provides 3 output writers, supporting file rotation, buffered writing, and multi-target output.

## FileWriter

File writer with automatic rotation.

### Creation

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

```go
// With default config
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// With custom config
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ := dd.NewFileWriter("logs/app.log", cfg)
```

### FileWriterConfig

File writer configuration.

```go
type FileWriterConfig struct {
    MaxSizeMB  int            // File size limit MB (default 100)
    MaxAge     time.Duration  // Old file retention duration (default 30 days)
    MaxBackups int            // Number of backups to retain (default 10)
    Compress   bool           // Whether to gzip compress (default false)
}
```

### Default Configuration

```go
func DefaultFileWriterConfig() FileWriterConfig
```

Default values: 100MB size limit, 30-day retention, 10 backup files.

### Validate

```go
func (c FileWriterConfig) Validate() error
```

Validates the file writer configuration.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(p []byte) (int, error)` | Write data (implements io.Writer) |
| `Close` | `() error` | Close file writer |

### File Rotation

FileWriter supports automatic rotation based on the following conditions:

- File size exceeds limit (default 100MB)
- File age exceeds maximum retention days (default 30 days)
- Number of backup files exceeds limit (default 10)

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// Automatic rotation on write
fw.Write([]byte("log content\n"))

// Files generated after rotation:
// logs/app.log      (current)
// logs/app.log.1    (previous backup)
// logs/app.log.2    (older backup)
```

:::tip Security Feature
FileWriter has built-in path traversal protection, rejecting unsafe paths such as `..` and symbolic links.
:::

## BufferedWriter

Buffered writer that reduces system call overhead.

### Creation

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

```go
// With default config
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// With custom config
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

Buffered writer configuration.

```go
type BufferedWriterConfig struct {
    BufferSize int            // Buffer size (bytes, default 1024 = 1KB)
    FlushTime  time.Duration  // Periodic flush interval (default 100ms)
}
```

### Default Configuration

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

Validates the buffered writer configuration.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(p []byte) (int, error)` | Write to buffer |
| `Flush` | `() error` | Flush buffer to underlying Writer |
| `Close` | `() error` | Flush and close |

```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("log line\n"))
bw.Flush()  // Ensure written to disk
defer bw.Close()  // Close automatically flushes
```

## MultiWriter

Multi-writer manager that writes to multiple targets simultaneously.

### Creation

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(p []byte) (int, error)` | Write to all targets |
| `AddWriter` | `(w io.Writer) error` | Dynamically add write target |
| `RemoveWriter` | `(w io.Writer) error` | Dynamically remove write target |
| `Close` | `() error` | Close all writers |

```go
mw := dd.NewMultiWriter(console, file)

// Dynamic management
mw.AddWriter(anotherFile)
mw.RemoveWriter(console)

// Close all underlying writers
mw.Close()
```

:::warning Error Handling
MultiWriter uses a "best-effort" strategy: a failure in one Writer does not affect other Writers. Errors are returned via `MultiWriterError`.
:::

## Combined Usage

```go
// File + Buffer + Multi-target
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bw, _ := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
mw := dd.NewMultiWriter(os.Stdout, bw)

logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
defer logger.Close()  // Automatically flushes buffer and closes file
```

## Next Steps

- [Configuration](./config) -- Config output target configuration (OutputTarget)
- [Logger](./logger) -- AddWriter / RemoveWriter
- [Security Filtering](./security) -- Path security protection

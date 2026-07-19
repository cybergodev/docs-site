---
sidebar_label: "Writers"
title: "Output Targets - CyberGo DD | FileWriter, BufferedWriter, MultiWriter"
description: "CyberGo DD output writer API: FileWriter with automatic size-based rotation and time-based cleanup of old backups, BufferedWriter for high-performance buffered writes (configurable buffer size and flush interval), and MultiWriter for parallel multi-target output. Covers development through production scenarios to help you build a reliable logging system."
sidebar_position: 1
---

# Output Targets

DD provides 3 output writers supporting file rotation, buffered writes, and multi-target output.

## FileWriter

File writer with automatic rotation.

### Creation

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

The path goes through internal path-safety validation (path traversal, null bytes, overlong UTF-8), then `cfg.Validate()` checks the count caps, and falls back to default config for zero/negative values. Errors are returned when:

- Path-related: `ErrEmptyFilePath` / `ErrNullByte` / `ErrPathTooLong` (>4096 bytes) / `ErrPathTraversal` / `ErrInvalidPath` / `ErrOverlongEncoding`
- Config-related: `ErrMaxSizeExceeded` (`MaxSizeMB > 10240`) / `ErrMaxBackupsExceeded` (`MaxBackups > 1000`)
- I/O-related: directory creation failure (wrapped as `failed to create directory: …`) or file open failure (wrapped as `failed to open file …: %w`, including `ErrSymlinkNotAllowed` / `ErrHardlinkNotAllowed`)

<!-- check-code: skip -->
```go
// Default config
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// Custom config
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ = dd.NewFileWriter("logs/app.log", cfg)
```

### FileWriterConfig

File writer configuration.

```go
type FileWriterConfig struct {
    MaxSizeMB  int            // File size cap in MB (default 100)
    MaxAge     time.Duration  // How long to keep old files (default 30 days)
    MaxBackups int            // Number of backups to keep (default 10)
    Compress   bool           // Whether to gzip-compress (default false)
}
```

### Default Config

```go
func DefaultFileWriterConfig() FileWriterConfig
```

Defaults: 100MB size limit, 30-day retention, 10 backup files.

### Validate

```go
func (c FileWriterConfig) Validate() error
```

Validates the file writer config. Returns an error when:

- `MaxSizeMB` exceeds 10240 (returns `ErrMaxSizeExceeded`)
- `MaxBackups` exceeds 1000 (returns `ErrMaxBackupsExceeded`)

Negative values do not trigger a Validate error; among them, zero or negative `MaxSizeMB` falls back to 100MB when defaults are applied, while negative `MaxBackups` / `MaxAge` are kept as-is (see "Default value application rules" below).

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(p []byte) (int, error)` | Writes data (implements `io.Writer`); checks size and triggers rotation before writing; returns `os.ErrClosed` when closed |
| `SetOnRotateCallback` | `(fn func(path string))` | Sets the callback invoked after successful file rotation |
| `Close` | `() error` | Stops the cleanup goroutine and closes the underlying file; safe to call multiple times (CAS-guarded) |

### Rotation Callback

```go
func (fw *FileWriter) SetOnRotateCallback(fn func(path string))
```

Sets a callback invoked **after** a successful file rotation. The callback parameter `path` is the base path of the current log file (the path stored by `NewFileWriter` after path normalization — for absolute-path inputs it is typically equal to the input, while relative paths are resolved to absolute). At this point the old log has been archived as a backup file and a new file has been reopened at the same path. Setting the callback takes an internal mutex to avoid racing with an in-progress rotation.

:::info Internal Use
This method is primarily used internally by `Logger` — when the `FileWriter` is an output target of the Logger, the Logger triggers the `HookOnRotate` hook event through it (see [Hook System](../security-audit/hooks)). Ordinary users typically do not need to call it manually; if you want to customize post-rotation behavior, you may also set it directly.
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// Set a rotation callback: print the current file path after each rotation
fw.SetOnRotateCallback(func(path string) {
    fmt.Println("log rotated, current file:", path)
})

// The callback is invoked after the file exceeds MaxSizeMB and triggers rotation
fw.Write([]byte("log content\n"))
```

### File Rotation and Cleanup

FileWriter's rotation and cleanup run along two independent paths:

- **Rotation**: triggered within the `Write` call when the current file size exceeds `MaxSizeMB` (default 100MB) — the old file is renamed to a backup, a new file is reopened with `O_EXCL` (prevents symlink TOCTOU), then `internal.RotateBackups` truncates the backup chain per `MaxBackups`, and when `Compress=true` a separate goroutine gzip-compresses the backups.
- **Cleanup**: only when `MaxAge > 0` and `MaxBackups > 0`, a background goroutine starts, scanning once per hour and calling `internal.CleanupOldFiles` to delete old backups older than `MaxAge` (default 30 days).

:::tip Default-value application rules
Zero or negative `MaxSizeMB` always falls back to 100MB. Combination rules for `MaxAge`/`MaxBackups`: (1) both 0 -> enable full defaults (30 days + 10 files, start cleanup goroutine); (2) only `MaxBackups` set -> truncate the backup chain by count only, `MaxAge=0` does not start a cleanup goroutine; (3) only `MaxAge` set -> `MaxBackups` falls back to default 10.
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// If writing exceeds MaxSizeMB, rotation is triggered automatically
fw.Write([]byte("log content\n"))

// Files produced after rotation:
// logs/app.log       (current file)
// logs/app_log_1.log (newest backup)
// logs/app_log_2.log (older backup)
// With Compress enabled, old backups are asynchronously compressed to logs/app_log_1.log.gz
```

:::tip Security Features
FileWriter has built-in protection against path traversal, null bytes, symlinks, hardlinks, and overlong UTF-8; new files are opened with `O_EXCL` to prevent TOCTOU attacks.
:::

## BufferedWriter

Buffered writer that reduces syscall count.

### Creation

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

The constructor rejects a `nil` underlying writer (`ErrNilWriter`), then calls `cfg.Validate()`, and finally clamps `BufferSize` values below the default (1KB) to the default and `FlushTime <= 0` to 100ms. Errors are returned when:

- `ErrNilWriter`: `w == nil`
- `ErrBufferSizeTooLarge`: `BufferSize > 10MB` (returned by `Validate`)
- Invalid config: `BufferSize < 0` or `FlushTime < 0` (returned by `Validate`)

<!-- check-code: skip -->
```go
// Default config
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// Custom config
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ = dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

Buffered writer configuration.

```go
type BufferedWriterConfig struct {
    BufferSize int            // Buffer size in bytes (default 1024, i.e. 1KB; max 10MB)
    FlushTime  time.Duration  // Periodic flush interval (default 100ms)
}
```

### Default Config

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

Defaults: 1KB buffer, 100ms flush interval.

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

Validates the buffered writer config. Returns an error when:

- `BufferSize` is negative
- `BufferSize` exceeds 10MB (returns `ErrBufferSizeTooLarge`)
- `FlushTime` is negative

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(p []byte) (int, error)` | Writes to the buffer; auto-flushes when buffered bytes reach `BufferSize/2` |
| `Flush` | `() error` | Explicitly flush the buffer to the underlying Writer |
| `Close` | `() error` | First flushes the buffer, stops the background goroutine, then closes the underlying Writer (if it implements `io.Closer`) |

The background goroutine checks at a `FlushTime` period: triggers an auto-flush only when the buffer is non-empty and the time since the last flush is at least `FlushTime`. Calling `Close` multiple times is safe (CAS-guarded); `Write` on a closed writer returns `os.ErrClosed`.

<!-- check-code: skip -->
```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("log line\n"))
_ = bw.Flush()      // Explicit flush to underlying
defer bw.Close()    // Close first Flush then closes the underlying Writer
```

## MultiWriter

Multi-writer manager that writes to multiple targets simultaneously.

### Creation

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

`nil` writers are silently ignored at construction. The return value is never `nil` (construction never errors).

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(p []byte) (int, error)` | Writes to all targets (see error policy below) |
| `AddWriter` | `(w io.Writer) error` | Dynamically add a target (duplicate writers are silently accepted) |
| `RemoveWriter` | `(w io.Writer) error` | Dynamically remove a target |
| `Close` | `() error` | Close all underlying `io.Closer`s (except standard streams) |

`AddWriter` returns errors for: `ErrNilMultiWriter` (receiver is `nil`) / `ErrNilWriter` (argument is `nil`) / `ErrMaxWritersExceeded` (already has >= 100 registered).
`RemoveWriter` returns errors for: `ErrNilMultiWriter` / `ErrWriterNotFound`.

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(console, file)

// Dynamic management
_ = mw.AddWriter(anotherFile)
_ = mw.RemoveWriter(console)

// Close all underlying writers (standard streams like os.Stdout are not closed)
_ = mw.Close()
```

### Error Types

Errors returned when `Write` fails are carried by two public types (defined in `errors.go`):

```go
// Error for a single writer
type WriterError struct {
    Index  int       // The writer's index within the MultiWriter
    Writer io.Writer // The writer that errored
    Err    error     // The underlying error
}

// Aggregated multi-writer error (Write returns *MultiWriterError)
type MultiWriterError struct {
    Errors []WriterError
}
```

Methods on both types:

| Type | Method | Description |
|------|--------|-------------|
| `*WriterError` | `Error() string` | Formatted as `writer[i]: <err>`; shows "unknown error" when `Err` is nil |
| `*WriterError` | `Unwrap() error` | Returns `Err` for `errors.Is` chain matching |
| `*MultiWriterError` | `Error() string` | Single error returned directly; multiple errors concatenated as `multiple writer errors: [...]` |
| `*MultiWriterError` | `Unwrap() []error` | Returns all `WriterError.Err` values for `errors.As` / `errors.Is` |
| `*MultiWriterError` | `HasErrors() bool` | Whether any errors were collected |
| `*MultiWriterError` | `ErrorCount() int` | Number of errors |
| `*MultiWriterError` | `FirstError() error` | The first error (as `*WriterError`), or `nil` |

### Error Policy

`Write` uses "best effort": a single writer failure does not affect other writers. Errors from underlying writers are aggregated into a `MultiWriterError`, which implements `Unwrap() []error` for use with `errors.As`/`errors.Is`. When all writes fail it returns `(0, *MultiWriterError)`; on partial failure it returns `(pLen, *MultiWriterError)`; writes with fewer bytes than requested are recorded as short-write errors.

:::warning Single-writer optimization
When the underlying has only one writer, `Write` takes a fast path that forwards directly and returns the error as-is without wrapping in `MultiWriterError`.
:::

## Composed Usage

```go
// File + buffer + multi-target
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bw, _ := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
mw := dd.NewMultiWriter(os.Stdout, bw)

logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
defer logger.Close()  // Auto-flushes the buffer and closes the file
```

## Next Steps

- [Config](../core/config) -- Config output-target configuration (OutputTarget)
- [Logger](../core/logger) -- AddWriter / RemoveWriter
- [Security Filtering](../security-audit/security) -- Path-safety protection

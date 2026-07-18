---
sidebar_label: "Writers"
title: "Output Targets - CyberGo DD | FileWriter, BufferedWriter, MultiWriter"
description: "CyberGo DD output writer API: FileWriter auto-rotates by size and time, BufferedWriter delivers high-performance buffered writes (configurable buffer and flush interval), and MultiWriter fans out to multiple targets in parallel, covering every logging scenario from development to production."
sidebar_position: 1
---

# Output Targets

DD provides 3 output writers, supporting file rotation, buffered writing, and multi-target output.

## FileWriter

File writer with automatic rotation.

### Creation

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

The path goes through `internal.ValidateAndSecurePath` for security validation (path traversal, null bytes, symbolic links, overlong UTF-8); then `cfg.Validate()` checks the quantity limits, and `applyFileWriterDefaults` falls back to defaults for zero/negative values. Cases that return an error:

- Path-related: `ErrEmptyFilePath` / `ErrNullByte` / `ErrPathTooLong` (>4096 bytes) / `ErrPathTraversal` / `ErrInvalidPath` / `ErrSymlinkNotAllowed` / `ErrOverlongEncoding` / `ErrHardlinkNotAllowed`
- Config-related: `ErrMaxSizeExceeded` (`MaxSizeMB > 10240`) / `ErrMaxBackupsExceeded` (`MaxBackups > 1000`)
- I/O-related: directory creation or file open failure (wrapping the underlying error)

<!-- check-code: skip -->
```go
// With default config
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// With custom config
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ = dd.NewFileWriter("logs/app.log", cfg)
```

### FileWriterConfig

File writer configuration.

```go
type FileWriterConfig struct {
    MaxSizeMB  int            // File size limit in MB (default 100)
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

Validates the file writer configuration. Cases that return an error:

- `MaxSizeMB` exceeds 10240 (returns `ErrMaxSizeExceeded`)
- `MaxBackups` exceeds 1000 (returns `ErrMaxBackupsExceeded`)

Negative values are allowed and fall back to the defaults.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(p []byte) (int, error)` | Write data (implements `io.Writer`); checks size before writing to trigger rotation, returns `os.ErrClosed` when already closed |
| `SetOnRotateCallback` | `(fn func(path string))` | Set a callback invoked after a successful file rotation |
| `Close` | `() error` | Stop the cleanup goroutine and close the underlying file; safe to call multiple times (CAS guarded) |

### Rotation Callback

```go
func (fw *FileWriter) SetOnRotateCallback(fn func(path string))
```

Sets a callback invoked **after a successful file rotation**. The callback argument `path` is the base path of the current log file (the `path` passed to [`NewFileWriter`](#creation)): at this point the old log has been archived as a backup file and a fresh file has been reopened at that path. Setting the callback takes an internal mutex to avoid racing with an in-progress rotation.

:::info Internal Use
This method is primarily used internally by `Logger` — when `FileWriter` is a Logger output target, Logger uses it to trigger the `HookOnRotate` hook event (see [Hook System](../security-audit/hooks)). Regular users usually do not need to call it manually; if you need custom post-rotation behavior, you may set it directly.
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// Set rotation callback: print the current file path after each rotation
fw.SetOnRotateCallback(func(path string) {
    fmt.Println("log rotated, current file:", path)
})

// The callback is invoked after rotation triggered by exceeding MaxSizeMB
fw.Write([]byte("log content\n"))
```

### File Rotation and Cleanup

FileWriter runs rotation and cleanup along two independent paths:

- **Rotation**: triggered within the `Write` call by checking the current file size against `MaxSizeMB` (default 100MB) — the old file is renamed to a backup, a fresh file is reopened with `O_EXCL` (to defend against symlink TOCTOU), then `internal.RotateBackups` truncates the backup chain per `MaxBackups`, and when `Compress=true` a separate goroutine gzip-compresses the backups.
- **Cleanup**: only when `MaxAge > 0` and `MaxBackups > 0`, a background goroutine starts, scanning once per hour and calling `internal.CleanupOldFiles` to delete backups older than `MaxAge` (default 30 days).

:::tip Default Value Rules
Zero or negative `MaxSizeMB` always falls back to 100MB. Combination rules for `MaxAge`/`MaxBackups`: (1) both 0 → enable full defaults (30 days + 10 files, cleanup goroutine started); (2) only `MaxBackups` set → only truncate the backup chain by count, `MaxAge=0` does not start the cleanup goroutine; (3) only `MaxAge` set → `MaxBackups` falls back to the default 10.
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// Automatic rotation when writing exceeds MaxSizeMB
fw.Write([]byte("log content\n"))

// Files generated after rotation:
// logs/app.log       (current file)
// logs/app_log_1.log (newest backup)
// logs/app_log_2.log (older backup)
// With Compress enabled, old backups are asynchronously compressed to logs/app_log_1.log.gz
```

:::tip Security Features
FileWriter has built-in protection against path traversal, null bytes, symbolic links, hard links, and overlong UTF-8; new files are opened with `O_EXCL` to prevent TOCTOU attacks.
:::

## BufferedWriter

Buffered writer that reduces the number of system calls.

### Creation

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

During construction, a `nil` underlying writer is rejected first (`ErrNilWriter`), then `cfg.Validate()` is called, and finally `BufferSize` values below the default (1KB) are clamped to the default, while `FlushTime <= 0` is clamped to 100ms. Cases that return an error:

- `ErrNilWriter`: `w == nil`
- `ErrBufferSizeTooLarge`: `BufferSize > 10MB` (returned by `Validate`)
- Invalid config: `BufferSize < 0` or `FlushTime < 0` (returned by `Validate`)

<!-- check-code: skip -->
```go
// With default config
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// With custom config
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ = dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

Buffered writer configuration.

```go
type BufferedWriterConfig struct {
    BufferSize int            // Buffer size (bytes, default 1024 = 1KB, max 10MB)
    FlushTime  time.Duration  // Periodic flush interval (default 100ms)
}
```

### Default Configuration

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

Default values: 1KB buffer, 100ms flush interval.

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

Validates the buffered writer configuration. Cases that return an error:

- `BufferSize` is negative
- `BufferSize` exceeds 10MB (returns `ErrBufferSizeTooLarge`)
- `FlushTime` is negative

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(p []byte) (int, error)` | Write to buffer; auto-flushes when buffered bytes reach `BufferSize/2` |
| `Flush` | `() error` | Explicitly flush the buffer to the underlying Writer |
| `Close` | `() error` | Flush the buffer, stop the background goroutine, then close the underlying Writer (if it implements `io.Closer`) |

The background goroutine checks on a `FlushTime` cycle: it triggers an auto-flush only when the buffer is non-empty and the time since the last flush is at least `FlushTime`. Calling `Close` multiple times is safe (CAS guarded); `Write` returns `os.ErrClosed` when already closed.

<!-- check-code: skip -->
```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("log line\n"))
_ = bw.Flush()      // Explicitly flush to the underlying writer
defer bw.Close()    // Close flushes first, then closes the underlying Writer
```

## MultiWriter

Multi-writer manager that writes to multiple targets simultaneously.

### Creation

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

`nil` writers are silently ignored during construction. The return value is never `nil` (construction does not error).

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(p []byte) (int, error)` | Write to all targets (see error strategy below) |
| `AddWriter` | `(w io.Writer) error` | Dynamically add a target (duplicate writers are silently accepted) |
| `RemoveWriter` | `(w io.Writer) error` | Dynamically remove a target |
| `Close` | `() error` | Close all underlying `io.Closer`s (except standard streams) |

Cases where `AddWriter` returns an error: `ErrNilMultiWriter` (receiver is `nil`) / `ErrNilWriter` (argument is `nil`) / `ErrMaxWritersExceeded` (already registered ≥ 100).
Cases where `RemoveWriter` returns an error: `ErrNilMultiWriter` / `ErrWriterNotFound`.

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

When `Write` fails, the returned error is carried by two public types (defined in `errors.go`):

```go
// Error for a single writer
type WriterError struct {
    Index  int       // Index of this writer within the MultiWriter
    Writer io.Writer // The writer that errored
    Err    error     // Underlying error
}

// Aggregation of multiple writer errors (Write returns *MultiWriterError)
type MultiWriterError struct {
    Errors []WriterError
}
```

Methods of the two types:

| Type | Method | Description |
|------|--------|-------------|
| `*WriterError` | `Error() string` | Formatted as `writer[i]: <err>`; shows "unknown error" when `Err` is nil |
| `*WriterError` | `Unwrap() error` | Returns `Err`, for chained `errors.Is` matching |
| `*MultiWriterError` | `Error() string` | Returns the single error directly; multiple errors are joined as `multiple writer errors: [...]` |
| `*MultiWriterError` | `Unwrap() []error` | Returns all `WriterError.Err`s, for `errors.As` / `errors.Is` |
| `*MultiWriterError` | `HasErrors() bool` | Whether any errors were collected |
| `*MultiWriterError` | `ErrorCount() int` | Number of errors |
| `*MultiWriterError` | `FirstError() error` | The first error (as `*WriterError`), or `nil` if none |

### Error Strategy

`Write` is "best-effort": a single writer failure does not affect other writers. Errors from underlying writers are aggregated into a `MultiWriterError`, which implements `Unwrap() []error` for `errors.As`/`errors.Is`. When all writes fail, returns `(0, *MultiWriterError)`; on partial failure, returns `(pLen, *MultiWriterError)`; a short write (fewer bytes than requested) is recorded as a short-write error.

:::warning Single-Writer Optimization
When there is only one underlying writer, `Write` takes a fast path that forwards directly and returns the error as-is, without wrapping it in a `MultiWriterError`.
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
defer logger.Close()  // Automatically flushes the buffer and closes the file
```

## Next Steps

- [Configuration](../core/config) -- Config output target configuration (OutputTarget)
- [Logger](../core/logger) -- AddWriter / RemoveWriter
- [Security Filtering](../security-audit/security) -- Path security protection

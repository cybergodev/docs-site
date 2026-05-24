---
title: "Structured Fields - CyberGo DD | Field Constructors"
description: "CyberGo DD field constructors API: 20+ type-safe fields (String, Int, Float, Bool, Time, Duration, Error, Any) for structured logging composition."
---

# Structured Fields

DD provides 20+ type-safe field constructors for structured log output.

## Basic Fields

| Constructor | Signature | Description |
|-------------|-----------|-------------|
| `Any` | `(key string, value any) Field` | Any type |
| `String` | `(key, value string) Field` | String |
| `Bool` | `(key string, value bool) Field` | Boolean |
| `Err` | `(err error) Field` | Error (key is "error") |
| `ErrWithKey` | `(key string, err error) Field` | Error with custom key |
| `ErrWithStack` | `(err error) Field` | Error with stack trace |

## Numeric Fields

| Constructor | Type | Example |
|-------------|------|---------|
| `Int` | `int` | `dd.Int("count", 42)` |
| `Int8` | `int8` | `dd.Int8("flags", 1)` |
| `Int16` | `int16` | `dd.Int16("port", 8080)` |
| `Int32` | `int32` | `dd.Int32("code", 200)` |
| `Int64` | `int64` | `dd.Int64("id", 123456789)` |
| `Uint` | `uint` | `dd.Uint("size", 1024)` |
| `Uint8` | `uint8` | `dd.Uint8("level", 3)` |
| `Uint16` | `uint16` | `dd.Uint16("year", 2026)` |
| `Uint32` | `uint32` | `dd.Uint32("seq", 1000)` |
| `Uint64` | `uint64` | `dd.Uint64("hash", 0xABCD)` |
| `Float32` | `float32` | `dd.Float32("rate", 0.95)` |
| `Float64` | `float64` | `dd.Float64("elapsed", 1.234)` |

## Time Fields

| Constructor | Signature | Description |
|-------------|-----------|-------------|
| `Time` | `(key string, value time.Time) Field` | Timestamp |
| `Duration` | `(key string, value time.Duration) Field` | Duration |

## Error Fields

```go
// Standard error field (key is "error")
dd.Err(err)

// Custom key
dd.ErrWithKey("db_error", err)

// With stack trace
dd.ErrWithStack(err)
```

## Usage

### Combined with InfoWith

```go
dd.InfoWith("User login",
    dd.String("username", "admin"),
    dd.Time("login_at", time.Now()),
    dd.Bool("mfa", true),
    dd.String("ip", "192.168.1.1"),
)
```

### Chaining with WithFields

```go
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("pid", os.Getpid()),
)
entry.Info("Service started")
```

### Appending to Entry

```go
base := logger.WithFields(dd.String("req_id", id))
base.InfoWith("Response",
    dd.Int("status", 200),
    dd.Duration("elapsed", took),
    dd.Err(err),
)
```

## Type Definition

`Field` is the structured log field type, containing `Key` (string) and `Value` (any) fields. Create instances using the constructor functions above.

## Next Steps

- [Logger](./logger) -- WithFields / InfoWith methods
- [LoggerEntry](./entry) -- Preset field chaining
- [Context Integration](./context) -- ContextExtractor field extraction

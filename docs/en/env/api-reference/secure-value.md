---
sidebar_label: "SecureValue"
title: "SecureValue API - CyberGo env | Secure Value Storage"
description: "CyberGo env SecureValue API: NewSecureValue, mlock lock, Reveal plaintext, Masked display, Release zeroing, IsSensitiveKey; stores passwords, tokens and keys."
sidebar_position: 5
---

# SecureValue API

The `SecureValue` type is used for securely storing sensitive data, providing memory locking, automatic zeroing, and masking functionality.

## Thread Safety

All `SecureValue` methods are thread-safe and can be used concurrently from multiple goroutines:

- **Read methods** (`String()`, `Bytes()`, `Length()`, `Masked()`) use read locks, supporting concurrent reads
- **Close methods** (`Close()`, `Release()`) use write locks, ensuring secure zeroing
- **State checks** (`IsClosed()`, `IsMemoryLocked()`) use atomic operations

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // Concurrent reads are safe
    go func() { fmt.Println(secret.Masked()) }()
    go func() { fmt.Println(secret.Length()) }()
}
```

:::warning Note
`Close()` and `Release()` should only be called once. Repeated calls are safe but no-ops.
:::

## Creation

### NewSecureValue

```go
func NewSecureValue(value string) *SecureValue
```

Creates a secure value wrapper.

**Parameters:**
- `value` - The string value to protect

**Returns:**
- `*SecureValue` - Secure value object

**Behavior:**
- Uses object pooling to reduce allocations
- Sets GC finalizer for automatic zeroing
- If memory locking is enabled, attempts to lock memory (silently ignores on failure)

```go
secret := env.NewSecureValue("my-secret-password")
defer secret.Release()  // or Close()
```

---

### NewSecureValueStrict

```go
func NewSecureValueStrict(value string) (*SecureValue, error)
```

Creates a secure value, returning an error if memory locking fails.

**Parameters:**
- `value` - The string value to protect

**Returns:**
- `*SecureValue` - Secure value object
- `error` - Memory locking error (strict mode only)

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("my-secret")
if err != nil {
    // Memory locking failed
    log.Printf("Warning: %v", err)
}
if secret != nil {
    defer secret.Release()
}
```

---

### GetSecure (Loader Method)

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

Gets a secure value from the loader.

**Parameters:**
- `key` - Key name

**Returns:**
- `*SecureValue` - A **defensive copy** of the secure value; the caller is responsible for releasing it; returns nil if the key doesn't exist or the loader is closed

```go
secret := loader.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    // Use secret
}
```

:::tip Defensive Copy
`GetSecure` returns a copy of the original value, independent of the parent Loader. The caller is responsible for calling `Release()` or `Close()` to release it.
:::

---

## Methods

### String

```go
func (sv *SecureValue) String() string
```

Returns the masked representation, safe for logging and formatting. Implements the `fmt.Stringer` interface, preventing accidental key leakage through `fmt.Printf`, `log.Println`, or error wrapping.

**Returns:**
- `string` - Masked representation (e.g., `[SECURE:32 bytes]`); returns `[NIL]` when nil

```go
secret := env.GetSecure("PASSWORD")
if secret != nil {
    log.Printf("Password: %s", secret)  // Safe, outputs masked representation
    // Equivalent to log.Printf("Password: %s", secret.Masked())
}
```

:::warning Note
`String()` returns the **masked representation**, not the plaintext value. To get the plaintext value, use `Reveal()`.
:::

---

### Reveal

```go
func (sv *SecureValue) Reveal() string
```

Returns the plaintext value. The caller is responsible for handling the returned string securely -- avoid logging, serializing, or storing to persistent locations. Only use when the actual value is needed for cryptographic operations, API calls, or similar secure processing.

**Returns:**
- `string` - Plaintext value; returns empty string when closed or nil

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    plaintext := secret.Reveal()  // Gets plaintext value
    // Use plaintext for API calls and similar secure operations
    _ = plaintext
}
```

:::danger Security Warning
`Reveal()` returns a **plaintext string**. Go strings are immutable and cannot be manually zeroed. Only use when necessary, and avoid logging or storing the returned value.
:::

---

### Bytes

```go
func (sv *SecureValue) Bytes() []byte
```

Returns a byte slice copy of the value. The caller is responsible for zeroing it using `ClearBytes`.

**Returns:**
- `[]byte` - Byte copy of the value; returns nil when closed

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    data := secret.Bytes()
    defer env.ClearBytes(data)  // Zero after use
    // Use data
}
```

---

### Length

```go
func (sv *SecureValue) Length() int
```

Returns the length of the value without exposing its content.

**Returns:**
- `int` - Value length; returns 0 when closed

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    fmt.Printf("API Key length: %d\n", secret.Length())
}
```

---

### Masked

```go
func (sv *SecureValue) Masked() string
```

Returns the masked value for log output.

**Returns:**
- `string` - Masked representation

**Output Format:**
- Closed: `[CLOSED]`
- Empty value: `[SECURE:0 bytes]`
- Normal: `[SECURE:N bytes]` or `[SECURE:N bytes locked]` or `[SECURE:N bytes lock-failed]` or `[SECURE:N bytes unlocked]`

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    log.Printf("API Key: %s", secret.Masked())
    // Output: API Key: [SECURE:32 bytes]
    // Note: Only when memory locking is enabled (SetMemoryLockEnabled(true)) and
    // locking succeeds does the mask append a " locked" suffix
    // (also " lock-failed" or " unlocked").
}
```

---

### Close

```go
func (sv *SecureValue) Close() error
```

Securely zeroes memory and closes the object.

**Returns:**
- `error` - Always returns nil

**Behavior:**
- Securely zeroes internal data
- Marks as closed
- **Does not** return to object pool

```go
secret := env.GetSecure("TOKEN")
if secret != nil {
    defer secret.Close()
    // After Close, memory is zeroed
}
```

---

### Release

```go
func (sv *SecureValue) Release()
```

Zeroes memory and returns to the object pool.

**Behavior:**
- Securely zeroes internal data
- Clears GC finalizer
- Returns to object pool for reuse

```go
secret := env.GetSecure("KEY")
if secret != nil {
    defer secret.Release()
    // After Release, memory is zeroed and the object is returned to the pool
}
```

:::tip Close vs Release
- `Close()` - Only zeroes, does not return to pool
- `Release()` - Zeroes and returns to pool (recommended for high-frequency scenarios)
:::

---

### IsClosed

```go
func (sv *SecureValue) IsClosed() bool
```

Checks whether the object is closed.

**Returns:**
- `bool` - Whether closed

```go
if secret.IsClosed() {
    // Object is closed, unusable
}
```

---

### IsMemoryLocked

```go
func (sv *SecureValue) IsMemoryLocked() bool
```

Checks whether memory is locked (prevents swapping to disk).

**Returns:**
- `bool` - Whether locked

```go
if secret.IsMemoryLocked() {
    fmt.Println("Memory is locked, protected from swapping")
}
```

---

### MemoryLockError

```go
func (sv *SecureValue) MemoryLockError() error
```

Returns the error from the memory locking attempt, if any.

**Returns:**
- `error` - Locking error; returns nil on success or if not attempted

```go
if err := secret.MemoryLockError(); err != nil {
    log.Printf("Memory lock failed: %v", err)
}
```

---

## Memory Lock Configuration

### SetMemoryLockEnabled

```go
func SetMemoryLockEnabled(enabled bool)
```

Globally enables/disables memory locking. Affects all newly created SecureValues.

**Parameters:**
- `enabled` - Whether to enable

```go
package main

import "github.com/cybergodev/env"

func main() {
    // Enable at application startup
    env.SetMemoryLockEnabled(true)

    // All subsequent SecureValues will attempt to lock
}
```

---

### IsMemoryLockEnabled

```go
func IsMemoryLockEnabled() bool
```

Checks whether memory locking is enabled.

**Returns:**
- `bool` - Whether enabled

```go
if env.IsMemoryLockEnabled() {
    // Memory locking is enabled
}
```

---

### SetMemoryLockStrict

```go
func SetMemoryLockStrict(strict bool)
```

Sets strict mode. When enabled, `NewSecureValueStrict` returns an error on locking failure.

**Parameters:**
- `strict` - Whether to enable strict mode

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive-data")
if err != nil {
    // Locking failed
}
```

---

### IsMemoryLockStrict

```go
func IsMemoryLockStrict() bool
```

Checks whether strict mode is enabled.

**Returns:**
- `bool` - Whether enabled

```go
strict := env.IsMemoryLockStrict()
```

---

### IsMemoryLockSupported

```go
func IsMemoryLockSupported() bool
```

Checks whether the current platform supports memory locking.

**Returns:**
- `bool` - Whether supported

| Platform | Supported |
|----------|-----------|
| Linux | Yes |
| macOS | Yes |
| Windows | Yes |
| FreeBSD | Yes |
| wasm | No |

:::warning Note
Returning `true` only indicates platform support, not that the process has sufficient permissions. Linux requires `CAP_IPC_LOCK` or root privileges.
:::

```go
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

---

## Security Utility Functions

### ClearBytes

```go
func ClearBytes(b []byte)
```

Securely zeroes a byte slice. Immediately zeroes sensitive data after use.

**Parameters:**
- `b` - The byte slice to zero

```go
sensitive := []byte("secret-data")
// Use...
env.ClearBytes(sensitive)
// sensitive is now all zeros
```

---

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

Checks whether a key name matches sensitive patterns.

**Parameters:**
- `key` - Key name

**Returns:**
- `bool` - Whether sensitive

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // Sensitive key, handle securely
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

**Sensitive patterns:** password, secret, token, key, api_key, credential, etc.

---

### MaskValue

```go
func MaskValue(key, value string) string
```

Returns a masked value based on the key's sensitivity.

**Parameters:**
- `key` - Key name
- `value` - Original value

**Returns:**
- `string` - Masked value

```go
// Sensitive key - returns [MASKED:N chars] format
masked := env.MaskValue("API_KEY", "secret123")
// Returns: [MASKED:9 chars]

// Non-sensitive key - returns original value (truncated if over 20 characters)
masked := env.MaskValue("APP_NAME", "myapp")
// Returns: myapp
```

---

### MaskKey

```go
func MaskKey(key string) string
```

Masks a key name for logging.

**Parameters:**
- `key` - Key name

**Returns:**
- `string` - Masked key name

```go
masked := env.MaskKey("DB_PASSWORD")
// Returns: DB***
```

---

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

Sanitizes sensitive key-value pair information in a string. Automatically detects and masks sensitive values in `key=value` format.

**Parameters:**
- `s` - Original string

**Returns:**
- `string` - Sanitized string

```go
// Automatically masks sensitive key-value pairs
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// Returns: "Connected with password=[MASKED] api_key=[MASKED]"
```

---

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

Masks potentially sensitive content in a string. Truncates strings exceeding 50 characters.

**Parameters:**
- `s` - Original string

**Returns:**
- `string` - Masked string

```go
// Long strings are truncated (keeps the first 47 characters and appends "...")
long := "This is a very long string that exceeds 50 characters"
clean := env.MaskSensitiveInString(long)
// Returns: "This is a very long string that exceeds 50 char..."
```

:::tip Use Case
Used to truncate long strings that may contain sensitive data. To automatically mask sensitive key-value pairs, use `SanitizeForLog`.
:::

---

## Complete Example

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    // Check and enable memory locking
    if env.IsMemoryLockSupported() {
        env.SetMemoryLockEnabled(true)
        fmt.Println("Memory locking enabled")
    }

    // Load environment variables
    if err := env.Load(".env"); err != nil {
        log.Printf("Warning: %v", err)
    }

    // Safely get sensitive value
    apiKey := env.GetSecure("API_KEY")
    if apiKey == nil {
        log.Fatal("API_KEY not found")
    }
    defer apiKey.Release()

    // Safe usage
    fmt.Printf("API Key length: %d\n", apiKey.Length())
    fmt.Printf("API Key (masked): %s\n", apiKey.Masked())

    // Check memory locking status
    if apiKey.IsMemoryLocked() {
        fmt.Println("Memory is locked")
    }

    // Check locking error
    if err := apiKey.MemoryLockError(); err != nil {
        fmt.Printf("Memory lock warning: %v\n", err)
    }

    // Pass to other functions
    connectAPI(apiKey.Reveal())

    // Use security utility functions
    logMessage := "Processing with API_KEY=secret"
    safeMessage := env.SanitizeForLog(logMessage)
    fmt.Println(safeMessage)  // Processing with API_KEY=[MASKED]
}

func connectAPI(key string) {
    // Connecting with key...
    fmt.Printf("Connecting with key of length %d\n", len(key))
}
```

---

## Internal Implementation

### Object Pooling

`SecureValue` uses `sync.Pool` to reduce memory allocations:

```go
var secureValuePool = sync.Pool{
    New: func() interface{} {
        return &SecureValue{}
    },
}
```

### GC Finalizer

Sets GC finalizer on creation, ensuring automatic zeroing during garbage collection:

```go
runtime.SetFinalizer(sv, (*SecureValue).finalize)
```

### Secure Zeroing

Uses `unsafe.Pointer` to prevent compiler optimization:

```go
func (sv *SecureValue) clearData() {
    dataPtr := unsafe.Pointer(&sv.data[0])
    for i := range sv.data {
        *(*byte)(unsafe.Pointer(uintptr(dataPtr) + uintptr(i))) = 0
    }
    runtime.KeepAlive(sv.data)
    sv.data = nil
}
```

---

## Related Documentation

- [Constants & Errors](/en/env/api-reference/constants) - Forbidden keys, sensitive key patterns, error types
- [Security Overview](/en/env/security/) - Security architecture and core features
- [Production Checklist](/en/env/security/production-checklist) - Pre-deployment security check
- [Loader API](/en/env/api-reference/loader) - GetSecure method

---
sidebar_label: "SecureValue"
title: "SecureValue API - CyberGo env | Secure Value Storage"
description: "SecureValue API reference for CyberGo env: NewSecureValue creation, mlock locking, Reveal plaintext, Masked display, Release zeroing, IsSensitiveKey detection."
sidebar_position: 5
---

# SecureValue API

The `SecureValue` type is used for securely storing sensitive data, providing memory locking, auto-zeroing, and masking functionality.

## Thread Safety

All methods of `SecureValue` are thread-safe and can be used concurrently from multiple goroutines:

- **Read methods** (`String()`, `Bytes()`, `Length()`, `Masked()`) use read locks, supporting concurrent reads
- **Close methods** (`Close()`, `Release()`) use write locks, ensuring safe zeroing
- **Status checks** (`IsClosed()`, `IsMemoryLocked()`) use atomic operations

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // Concurrent reads are safe
    go func() { fmt.Println(secret.Masked()) }()
    go func() { fmt.Println(secret.Length()) }()
}
```

:::warning
`Close()` and `Release()` should only be called once. Repeated calls are safe but no-ops.
:::

## Creation

### NewSecureValue

```go
func NewSecureValue(value string) *SecureValue
```

Creates a secure value wrapper.

**Parameters:**
- `value` - string value to protect

**Returns:**
- `*SecureValue` - secure value object

**Behavior:**
- Uses an object pool to reduce allocations
- Sets a GC finalizer for automatic zeroing
- If memory locking is enabled, attempts to lock memory (silently ignored on failure)

```go
secret := env.NewSecureValue("my-secret-password")
defer secret.Release()  // or Close()
```

---

### NewSecureValueStrict

```go
func NewSecureValueStrict(value string) (*SecureValue, error)
```

Creates a secure value, returning an error if memory locking is enabled and the lock attempt fails.

**Parameters:**
- `value` - string value to protect

**Returns:**
- `*SecureValue` - secure value object (still valid and usable even when an error is returned; the data is simply not locked)
- `error` - memory locking error (returned only when `SetMemoryLockEnabled(true)` is set and locking fails; independent of the `SetMemoryLockStrict` switch)

```go
env.SetMemoryLockEnabled(true)

secret, err := env.NewSecureValueStrict("my-secret")
if err != nil {
    // Memory locking failed (secret is still usable, just not locked)
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
- `key` - key name

**Returns:**
- `*SecureValue` - **defensive copy** of the secure value; caller is responsible for releasing; returns nil if the key doesn't exist or loader is closed

```go
secret := loader.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    // Use secret
}
```

:::tip Defensive copies
`GetSecure` returns a copy of the original value, independent from the parent Loader. The caller is responsible for calling `Release()` or `Close()`.
:::

---

## Methods

### String

```go
func (sv *SecureValue) String() string
```

Returns a masked representation, safe for logging and formatting. Implements the `fmt.Stringer` interface, preventing accidental key leakage through `fmt.Printf`, `log.Println`, or error wrapping.

**Returns:**
- `string` - masked representation (e.g., `[SECURE:32 bytes]`); returns `[NIL]` when nil

```go
secret := env.GetSecure("PASSWORD")
if secret != nil {
    log.Printf("Password: %s", secret)  // Safe, outputs masked representation
    // Equivalent to log.Printf("Password: %s", secret.Masked())
}
```

:::warning
`String()` returns a **masked representation**, not the plaintext value. To get the plaintext value, use `Reveal()`.
:::

---

### Reveal

```go
func (sv *SecureValue) Reveal() string
```

Returns the plaintext value. The caller is responsible for handling the returned string safely — avoid logging, serializing, or storing to persistent locations. Only use when the actual value is needed for cryptographic operations, API calls, or similar secure processing.

**Returns:**
- `string` - plaintext value; returns empty string when closed or nil

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    plaintext := secret.Reveal()  // Get plaintext value
    // Use plaintext for API calls and other secure operations
    _ = plaintext
}
```

:::danger Security warning
`Reveal()` returns a **plaintext string**. Go strings are immutable and cannot be manually zeroed. Use only when necessary, and avoid logging or storing the return value.
:::

---

### Bytes

```go
func (sv *SecureValue) Bytes() []byte
```

Returns a byte slice copy of the value. The caller is responsible for zeroing it with `ClearBytes`.

**Returns:**
- `[]byte` - byte copy of the value; returns nil when closed

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

Returns the length of the value without exposing content.

**Returns:**
- `int` - value length; returns 0 when closed

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

Returns a masked value for log output.

**Returns:**
- `string` - masked representation

**Output formats:**
- Closed: `[CLOSED]`
- Empty value: `[SECURE:0 bytes]`
- Normal: `[SECURE:N bytes]` or `[SECURE:N bytes locked]` or `[SECURE:N bytes lock-failed]` or `[SECURE:N bytes unlocked]`

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    log.Printf("API Key: %s", secret.Masked())
    // Output: API Key: [SECURE:32 bytes]
    // Note: Only when memory locking is enabled (SetMemoryLockEnabled(true)) and locking succeeds,
    // the mask appends the " locked" suffix (also " lock-failed" / " unlocked")
}
```

---

### MarshalJSON

```go
func (sv *SecureValue) MarshalJSON() ([]byte, error)
```

Implements the `json.Marshaler` interface. Returns a masked representation, preventing accidental key leakage through reflection-based serializers like `json.Marshal`. The plaintext never appears in JSON output.

**Returns:**
- `[]byte` - JSON-safe masked string (e.g., `"[SECURE:32 bytes]"`); returns `"null"` when nil
- `error` - always returns nil

```go
type Response struct {
    APIKey *env.SecureValue `json:"api_key"`
}

resp := Response{APIKey: env.NewSecureValue("sk-1234567890")}
data, _ := json.Marshal(resp)
// {"api_key":"[SECURE:13 bytes]"}
// Plaintext does not appear in output
```

:::tip Security design
`MarshalJSON` ensures that even when `SecureValue` is embedded in a struct and JSON-serialized, the plaintext is not leaked. The output is consistent with `String()` / `Masked()`.
:::

---

### MarshalText

```go
func (sv *SecureValue) MarshalText() ([]byte, error)
```

Implements the `encoding.TextMarshaler` interface. Returns a masked representation consistent with `String()`, preventing accidental key leakage through text-based encoders like `encoding/xml`, `text/template`, structured logging, etc.

**Returns:**
- `[]byte` - masked string (e.g., `"[SECURE:32 bytes]"`); returns `"[NIL]"` when nil
- `error` - always returns nil

```go
type Config struct {
    Token *env.SecureValue `xml:"token"`
}

cfg := Config{Token: env.NewSecureValue("Bearer xyz")}
data, _ := xml.Marshal(cfg)
// <Config><token>[SECURE:10 bytes]</token></Config>
```

---

### Close

```go
func (sv *SecureValue) Close() error
```

Securely zeros memory and closes the object.

**Returns:**
- `error` - always returns nil

**Behavior:**
- Securely zeros internal data
- Marks as closed
- Does **not** return to the object pool

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

Zeros memory and returns to the object pool.

**Behavior:**
- Securely zeros internal data
- Marks as closed and returns to the object pool for reuse
- Does **not** clear the GC finalizer: it stays set for the object's entire lifetime, and if the runtime later evicts a pooled object and finalizes it, finalize() observes the closed state and is a no-op

```go
secret := env.GetSecure("KEY")
if secret != nil {
    defer secret.Release()
    // After Release, memory is zeroed and the object is returned to the pool
}
```

:::tip Close vs Release
- `Close()` - zeros only, does not return to pool
- `Release()` - zeros and returns to pool (recommended for high-frequency scenarios)
:::

---

### IsClosed

```go
func (sv *SecureValue) IsClosed() bool
```

Checks whether the object has been closed.

**Returns:**
- `bool` - whether closed

```go
if secret.IsClosed() {
    // Object has been closed, cannot be used
}
```

---

### IsMemoryLocked

```go
func (sv *SecureValue) IsMemoryLocked() bool
```

Checks whether memory is locked (prevents swapping to disk).

**Returns:**
- `bool` - whether locked

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

Returns the error from the memory locking attempt (if any).

**Returns:**
- `error` - locking error; returns nil on success or if not attempted

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
- `enabled` - whether to enable

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
- `bool` - whether enabled

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

Sets strict mode. When enabled, any memory locking failure emits a security warning to the standard logger (stderr), regardless of which construction path it came from; non-strict constructors (`NewSecureValue`, etc.) cannot return an error, so this warning is their only failure signal. The error return of `NewSecureValueStrict` is unaffected by this switch (see the Creation section above).

**Parameters:**
- `strict` - whether to enable strict mode

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

// NewSecureValue cannot return an error; on lock failure it prints:
// env: memory lock failed in strict mode: ...
secret := env.NewSecureValue("sensitive-data")
```

---

### IsMemoryLockStrict

```go
func IsMemoryLockStrict() bool
```

Checks whether strict mode is enabled.

**Returns:**
- `bool` - whether enabled

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
- `bool` - whether supported

| Platform | Supported |
|----------|-----------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| FreeBSD and other BSDs, Solaris | ❌ (no-op fallback) |
| wasm | ❌ |

:::tip Platform fallback
Memory locking is implemented only on Linux, macOS, and Windows. All other platforms (FreeBSD and other BSDs, Solaris, wasm, etc.) take the no-op fallback: `IsMemoryLockSupported()` returns false, and `SecureValue` still works normally — but with memory locking enabled the lock attempt fails and `Masked()` shows the `lock-failed` suffix (no status suffix when locking is not enabled).
:::

:::warning
Returning `true` only means the platform supports it, not that the process has sufficient permissions. Linux requires `CAP_IPC_LOCK` or root privileges.
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

Securely zeros a byte slice. Use to immediately zero sensitive data after use.

**Parameters:**
- `b` - byte slice to zero

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
- `key` - key name

**Returns:**
- `bool` - whether sensitive

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
- `key` - key name
- `value` - original value

**Returns:**
- `string` - masked value

```go
// Sensitive key - returns [MASKED:N chars] format
masked := env.MaskValue("API_KEY", "secret123")
// Returns: [MASKED:9 chars]

// Non-sensitive key - returns original value (truncated if over 20 chars)
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
- `key` - key name

**Returns:**
- `string` - masked key name

```go
masked := env.MaskKey("DB_PASSWORD")
// Returns: DB***
```

---

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

Cleans sensitive key-value pair information from a string. Auto-detects and masks sensitive values in `key=value` format.

**Parameters:**
- `s` - original string

**Returns:**
- `string` - cleaned string

```go
// Auto-mask sensitive key-value pairs
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// Returns: "Connected with password=[MASKED] api_key=[MASKED]"
```

---

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

Masks potential sensitive content in a string: strings longer than 50 characters are truncated first (keeping the first 47 characters and appending `...`), then `key=value`-style sensitive values in the truncated result are masked. Truncation alone would let `password=...` pairs slip through unmasked, so both steps are required.

**Parameters:**
- `s` - original string

**Returns:**
- `string` - masked string

```go
// Long strings are truncated (keeps first 47 characters and appends "...")
long := "This is a very long string that exceeds 50 characters"
clean := env.MaskSensitiveInString(long)
// Returns: "This is a very long string that exceeds 50 char..."
```

:::tip Use cases
Suited for long strings that may carry sensitive data, such as error details or parsed content (truncation plus key-value masking in a single step). To mask `key=value` pairs without truncating, use `SanitizeForLog` directly.
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

	// Securely get sensitive value
	apiKey := env.GetSecure("API_KEY")
	if apiKey == nil {
		log.Fatal("API_KEY not found")
	}
	defer apiKey.Release()

	// Safe usage
	fmt.Printf("API Key length: %d\n", apiKey.Length())
	fmt.Printf("API Key (masked): %s\n", apiKey.Masked())

	// Check memory lock status
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
	fmt.Println(safeMessage) // Processing with API_KEY=[MASKED]
}

func connectAPI(key string) {
	// Connect with key...
	fmt.Printf("Connecting with key of length %d\n", len(key))
}
```

---

## Internal Implementation

### Object Pool

`SecureValue` uses `sync.Pool` to reduce memory allocations:

```go
var secureValuePool = sync.Pool{
    New: func() any {
        sv := &SecureValue{}
        runtime.SetFinalizer(sv, (*SecureValue).finalize) // set once at first creation, kept for life
        return sv
    },
}
```

### GC Finalizer

A GC finalizer is set at creation time, ensuring automatic zeroing during garbage collection:

```go
runtime.SetFinalizer(sv, (*SecureValue).finalize)
```

### Secure Zeroing

Uses `unsafe.Pointer` to prevent compiler optimization (must be called while holding the `sv.mu` lock):

```go
func (sv *SecureValue) clearDataLocked() {
    if len(sv.data) == 0 {
        return
    }
    // Unlock memory (if locked)
    if sv.locked {
        internal.UnlockMemory(sv.data)
        sv.locked = false
    }
    dataPtr := unsafe.Pointer(&sv.data[0])
    for i := range sv.data {
        *(*byte)(unsafe.Pointer(uintptr(dataPtr) + uintptr(i))) = 0
    }
    runtime.KeepAlive(sv.data)
    sv.data = nil
    sv.lockErr = nil
}
```

---

## Leak-Proof Interfaces and Lifecycle Details

### Safe stringification interfaces

`SecureValue` implements a set of "safe stringification" interfaces so secrets **never** leak through the common formatting paths:

| Interface | Behavior |
|-----------|----------|
| `fmt.Stringer` (`String()`) | Returns the masked form (same as `Masked()`); `fmt.Printf("%v")`, `log.Println` are safe |
| `json.Marshaler` (`MarshalJSON()`) | JSON serialization emits the masked string; the plaintext never enters JSON |
| `encoding.TextMarshaler` (`MarshalText()`) | Text encoders (XML, text/template, structured loggers) emit the mask |

The only explicit path to the plaintext is `Reveal()` (or the `Bytes()` copy).

### Close vs. Release

| Method | Zeros data | Returns to pool | Use |
|--------|:----------:|:---------------:|-----|
| `Close()` | ✅ | ❌ | Regular one-shot usage |
| `Release()` | ✅ | ✅ | High-frequency create/destroy cycles (reuse cuts allocations) |

Both are safe to call repeatedly with no side effects. Abandoned unclosed objects are still covered: the GC finalizer zeroes the data when the object becomes unreachable (`runtime.SetFinalizer` is installed once at first creation; pooled reuse doesn't pay that cost again).

### Masked output format

The masked representation carries lock status so you can verify protection from logs:

```text
[SECURE:24 bytes]            // memory locking not enabled
[SECURE:24 bytes locked]     // locked
[SECURE:24 bytes lock-failed] // lock failed (pair with MemoryLockError)
[CLOSED]                      // closed
[NIL]                         // nil receiver
```

### Lock-status queries

- `IsMemoryLocked()`: whether the value's memory is currently locked
- `MemoryLockError()`: the error from the most recent lock attempt (nil on success or when not attempted); the first tool for diagnosing permission issues in strict mode

### GetSecure returns a defensive copy

The `*SecureValue` returned by `Loader.GetSecure` is an **independent copy** of the stored value — its lifecycle is decoupled from the Loader. The caller owns `Close`/`Release`; the Loader's internal original is unaffected.

### ClearBytes

The copy returned by `Bytes()` should be zeroed explicitly when done:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	sv := env.NewSecureValue("my-secret")
	defer sv.Release()

	data := sv.Bytes()
	defer env.ClearBytes(data) // zero when done, no residue

	fmt.Println(len(data))
	// Output: 9
}
```

## Related Documentation

- [Constants & Errors](./constants) - Forbidden keys, sensitive key patterns, error types
- [Security Overview](../security/) - Security architecture and core features
- [Production Checklist](../security/production-checklist) - Pre-launch security checks
- [Loader API](./loader) - GetSecure method

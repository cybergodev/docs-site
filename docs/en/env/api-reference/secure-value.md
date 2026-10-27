---
sidebar_label: "SecureValue"
title: "SecureValue API - CyberGo env | Secure Value Storage"
description: "SecureValue API reference for CyberGo env: NewSecureValue creation, mlock locking, Reveal plaintext, Masked display, Release zeroing, IsSensitiveKey detection."
sidebar_position: 5
---

# SecureValue API

`SecureValue` holds a secret in a buffer it controls and keeps the plaintext out of ordinary strings.

- It can lock the memory page so the secret cannot be swapped to disk.
- It zeroes the buffer on release.
- It renders itself as a mask whenever it is formatted, logged, or serialized.

## Thread Safety

All methods of `SecureValue` are thread-safe and can be called concurrently from multiple goroutines:

- **Read methods** (`String()`, `Reveal()`, `Bytes()`, `Length()`, `Masked()`) take read locks, so concurrent reads are safe
- **Close methods** (`Close()`, `Release()`) take write locks, so zeroing is safe
- **Status checks**: `IsClosed()` reads the atomic closed bit; `IsMemoryLocked()` and `MemoryLockError()` take the read lock

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
The code that obtains a `SecureValue` is responsible for releasing it. See "Close vs. Release" below for the difference between the two methods.
:::

## Method Overview

All `SecureValue` methods (qualified names like `SecureValue.Reveal`); see the sections below for details:

| Method | Description |
|--------|-------------|
| `SecureValue.String` | Masked representation (implements `fmt.Stringer`, so formatting is safe) |
| `SecureValue.Reveal` | Returns a plaintext string copy |
| `SecureValue.Bytes` | Returns a byte-slice copy (zero it with `ClearBytes` afterwards) |
| `SecureValue.Length` | Value length, without exposing the content |
| `SecureValue.Masked` | Masked representation, including a lock-state suffix |
| `SecureValue.MarshalJSON` | JSON serialization emits the mask (implements `json.Marshaler`) |
| `SecureValue.MarshalText` | Text encoding emits the mask (implements `encoding.TextMarshaler`) |
| `SecureValue.Close` | Zeroes and unlocks the data; does not return the object to the pool |
| `SecureValue.Release` | Zeroes and unlocks the data, then returns the object to the pool |
| `SecureValue.IsClosed` | Whether the value has been closed |
| `SecureValue.IsMemoryLocked` | Whether the memory is currently locked |
| `SecureValue.MemoryLockError` | Error from the most recent failed lock attempt |

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
- Takes an object from a pool to reduce allocations
- Sets a GC finalizer that zeroes the data
- If memory locking is enabled, tries to lock the memory. A failure is silent here; the error is readable from `MemoryLockError()` (and surfaced by `NewSecureValueStrict` or strict mode).

```go
secret := env.NewSecureValue("my-secret-password")
defer secret.Release()  // or Close()
```

---

### NewSecureValueStrict

```go
func NewSecureValueStrict(value string) (*SecureValue, error)
```

Creates a secure value. When memory locking is enabled and the lock attempt fails, it also returns an error.

**Parameters:**
- `value` - string value to protect

**Returns:**
- `*SecureValue` - secure value object. It is valid and usable even when an error is returned; the data is not locked.
- `error` - memory locking error. Returned only when `SetMemoryLockEnabled(true)` is set and locking fails; the `SetMemoryLockStrict` switch does not affect it.

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

Returns a secure value from the loader. Key names resolve the same way as `Loader.Lookup` (exact match, uppercase fallback, dotted path), but **not** the comma-separated index fallback, since that only produces virtual values rather than real stored keys.

**Parameters:**
- `key` - key name

**Returns:**
- `*SecureValue` - a **defensive copy** of the stored value. You own it and must release it. Returns nil if the key does not exist, if the loader is closed, or if the stored value has already been closed.

```go
secret := loader.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    // Use secret
}
```

:::tip Defensive copies
`GetSecure` returns a copy of the original value, independent of the parent Loader. You are responsible for calling `Release()` or `Close()`.
:::

---

## Methods

### String

```go
func (sv *SecureValue) String() string
```

Returns a masked representation, safe for logging and formatting. The `fmt.Stringer` implementation keeps the secret out of `fmt.Printf`, `log.Println`, and wrapped errors.

**Returns:**
- `string` - masked representation (e.g. `[SECURE:32 bytes]`); `[NIL]` when the receiver is nil

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

Returns a new plaintext string copy of the value. You are responsible for handling it safely: do not log it, serialize it, or write it to persistent storage.

Reach for `Reveal` only when an operation needs the actual bytes, such as a cryptographic call or an API request.

**Returns:**
- `string` - plaintext value; empty string when the value is closed, or when the receiver is nil

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
`Reveal()` returns a **plaintext string**, and every call returns a fresh copy. Go strings are immutable, so that copy cannot be zeroed and is not covered by memory locking.

Use it only when necessary, and do not log or store the result.
:::

---

### Bytes

```go
func (sv *SecureValue) Bytes() []byte
```

Returns a new byte-slice copy of the value. Zero it with `ClearBytes` when done.

**Returns:**
- `[]byte` - byte copy of the value; nil when closed

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
- `int` - value length; 0 when closed, or when the receiver is nil

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

Returns a masked value for log output. The output is exactly what `String()` produces — `String()` simply calls `Masked()`.

**Returns:**
- `string` - masked representation

**Output formats:**
- Nil receiver: `[NIL]`
- Closed: `[CLOSED]`
- Empty value: `[SECURE:0 bytes]`, with no suffix even when locking is enabled
- Non-empty: `[SECURE:N bytes]`, plus a lock suffix only when the global memory-locking switch is true at call time: ` locked`, ` lock-failed`, or ` unlocked`

The suffix reflects the global switch **at the moment `Masked()` is called** together with the value's own lock result; when `IsMemoryLockEnabled()` is false, no suffix is added at all. See "Masked output format" below for the full rules behind each suffix, and [Memory Locking](../security/memory-locking) for state troubleshooting.

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    log.Printf("API Key: %s", secret.Masked())
    // Output: API Key: [SECURE:32 bytes]
    // When memory locking is enabled at call time (SetMemoryLockEnabled(true)),
    // the mask adds " locked" / " lock-failed" / " unlocked" for this value.
}
```

---

### MarshalJSON

```go
func (sv *SecureValue) MarshalJSON() ([]byte, error)
```

Implements `json.Marshaler`. The output is the masked representation, so reflection-based serializers such as `json.Marshal` never emit the plaintext.

**Returns:**
- `[]byte` - JSON-safe masked string, quoted (e.g. `"[SECURE:32 bytes]"`); the literal `null` when the receiver is nil
- `error` - always nil

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

Implements `encoding.TextMarshaler`. The output matches `String()`, so text-based encoders (`encoding/xml`, `text/template`, structured loggers) cannot leak the plaintext.

**Returns:**
- `[]byte` - masked string (e.g. `"[SECURE:32 bytes]"`); `[NIL]` when the receiver is nil
- `error` - always nil

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

Unlocks the memory (if it was locked), zeroes the internal buffer, and closes the object.

**Returns:**
- `error` - always nil

**Behavior:**
- Unlocks the memory (if it was locked), then zeroes the internal data
- Marks the object as closed
- Does **not** return it to the object pool

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

Zeroes the internal buffer and returns the object to the pool.

**Behavior:**
- Unlocks the memory (if it was locked), then zeroes the internal data
- Marks the object as closed and returns it to the pool for reuse
- Leaves the GC finalizer in place. The finalizer is set once for the object's lifetime; if the runtime later finalizes a pooled object, it sees the closed state and does nothing.

```go
secret := env.GetSecure("KEY")
if secret != nil {
    defer secret.Release()
    // After Release, memory is zeroed and the object is returned to the pool
}
```

:::tip Close vs Release
- `Close()` - unlocks and zeroes; does not return the object to the pool
- `Release()` - unlocks, zeroes, and returns the object to the pool; preferred in high-frequency paths
:::

---

### IsClosed

```go
func (sv *SecureValue) IsClosed() bool
```

Reports whether the object has been closed.

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

Reports whether the value's memory is currently locked, which prevents it from being swapped to disk. Returns false when memory locking is disabled or the lock attempt failed.

**Returns:**
- `bool` - whether the memory is locked

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

Returns the error from the most recent memory-lock attempt, if there was one.

**Returns:**
- `error` - the locking error; nil when locking succeeded or was not attempted

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

Turns memory locking on or off globally. The setting affects every `SecureValue` created afterwards.

**Parameters:**
- `enabled` - whether to enable it

```go
package main

import "github.com/cybergodev/env"

func main() {
	// Enable at application startup
	env.SetMemoryLockEnabled(true)

	// Every SecureValue created from here on attempts to lock
}
```

---

### IsMemoryLockEnabled

```go
func IsMemoryLockEnabled() bool
```

Reports whether memory locking is currently enabled globally.

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

Sets strict mode. When enabled, every failed memory lock writes a warning to stderr (the default `log.Printf` target), whichever constructor produced the value.

For `NewSecureValue` and the other non-strict constructors, this warning is the only failure signal, because they cannot return an error. It does not affect the error returned by `NewSecureValueStrict` (see the Creation section).

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

Reports whether strict mode is enabled.

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

Reports whether the current platform supports memory locking.

**Returns:**
- `bool` - whether memory locking is supported

| Platform | Supported |
|----------|-----------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| FreeBSD and other BSDs, Solaris | ❌ |
| wasm | ❌ |

:::tip Platform fallback
On platforms without a locking implementation (the ❌ rows in the table above):

- `IsMemoryLockSupported()` returns false.
- `SecureValue` still works normally.
- With memory locking enabled, the lock attempt fails and records the error, so `Masked()` adds the `lock-failed` suffix. With locking disabled there is no suffix at all.
:::

:::warning
`true` means the platform supports memory locking, not that your process has permission to use it. Linux requires `CAP_IPC_LOCK` or root privileges.
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

Zeroes a byte slice in place. Call it as soon as you are done with sensitive data.

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

Reports whether a key name matches one of the sensitive patterns.

**Parameters:**
- `key` - key name

**Returns:**
- `bool` - whether the key is sensitive

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // Sensitive key, handle securely
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

**Sensitive patterns:** `password`, `secret`, `token`, `api_key`, `credential`, `private_key`, and others. A bare `key` is not on the list, so `IsSensitiveKey("KEY")` returns false. Matching is case-insensitive and substring-based, with one exception: `AUTH`, `PAN`, `PWD`, and `USERNAME` match only at identifier boundaries, so keys such as `AUTHOR` or `COMPANY` stay non-sensitive (SEC-06).

See [Constants & Errors](./constants#sensitivekeypatterns) for the full list.

---

### MaskValue

```go
func MaskValue(key, value string) string
```

Masks a value according to the key's sensitivity. Non-sensitive values are also passed through `SanitizeForLog`, so an embedded `password=...` pair is masked even when the outer key is not sensitive.

**Parameters:**
- `key` - key name
- `value` - original value

**Returns:**
- `string` - masked value

**Behavior:**
- Sensitive key: returns the fixed `[MASKED]` form, which reveals neither the value nor its length.
- Non-sensitive key, value of 20 bytes or fewer: returns `SanitizeForLog(value)`.
- Non-sensitive key, value longer than 20 bytes: keeps the first 17 bytes, appends `...`, and returns `SanitizeForLog` of that.

```go
// Sensitive key - returns the fixed [MASKED] form
masked := env.MaskValue("API_KEY", "secret123")
// Returns: [MASKED]

// Non-sensitive key, short value - returned unchanged
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
- `string` - the masked key name

`MaskKey` always returns `[MASKED]`, regardless of the key's content:

```go
masked := env.MaskKey("DB_PASSWORD")
// Returns: [MASKED]
```

---

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

Masks sensitive values inside a string. It recognizes both `key=value` and YAML-style `key: value` pairs, keeps the key and the separator, and replaces the value with `[MASKED]`; an HTTP Authorization `Bearer <token>` is masked as well. Control characters are stripped; `\n` and `\t` are kept.

**Parameters:**
- `s` - original string

**Returns:**
- `string` - the sanitized string

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

Masks sensitive content in a string in two steps. First, a string longer than 50 bytes is truncated to its first 47 bytes plus `...`. Then `key=value`-style sensitive pairs in the result are masked.

Both steps are needed. Truncation alone can leave a `password=...` pair in place, and masking alone leaves an oversized string intact.

**Parameters:**
- `s` - original string

**Returns:**
- `string` - the masked string

```go
// Long strings are truncated (keeps first 47 bytes and appends "...")
long := "This is a very long string that exceeds 50 characters"
clean := env.MaskSensitiveInString(long)
// Returns: "This is a very long string that exceeds 50 char..."
```

:::tip Use cases
Use it for long strings that may carry secrets, such as error details or parsed content. To mask `key=value` pairs without truncating, call `SanitizeForLog` directly.
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

The finalizer is installed once, when the object is first created, and kept for its lifetime (see Object Pool above). It zeroes the data once the object becomes unreachable; firing on an already-closed object is a no-op.

### Secure Zeroing

The slice is zeroed over its **full capacity** (including any `[len, cap)` residue), writing through `unsafe.Pointer` so the compiler cannot optimize it away. It must run with the `sv.mu` lock held:

```go
func (sv *SecureValue) clearDataLocked() {
    full := sv.data[:cap(sv.data)]
    if len(full) == 0 {
        return
    }
    // Unlock memory (if locked)
    if sv.locked {
        internal.UnlockMemory(sv.data)
        sv.locked = false
    }
    dataPtr := unsafe.Pointer(&full[0])
    for i := range full {
        *(*byte)(unsafe.Add(dataPtr, i)) = 0
    }
    runtime.KeepAlive(full)
    sv.data = nil
    sv.lockErr = nil
}
```

---

## Leak-Proof Interfaces and Lifecycle Details

### Safe stringification interfaces

`SecureValue` implements the standard "safe stringification" interfaces, so a secret does not leak through the usual formatting paths:

| Interface | Behavior |
|-----------|----------|
| `fmt.Stringer` (`String()`) | Returns the masked form (same as `Masked()`), so `fmt.Printf("%v")` and `log.Println` are safe |
| `json.Marshaler` (`MarshalJSON()`) | JSON serialization emits the masked string; the plaintext never enters JSON |
| `encoding.TextMarshaler` (`MarshalText()`) | Text encoders (XML, text/template, structured loggers) emit the mask |

The only way to reach the plaintext is `Reveal()`, or the copy returned by `Bytes()`.

### Close vs. Release

| Method | Unlocks + zeros data | Returns to pool | Use |
|--------|:--------------------:|:---------------:|-----|
| `Close()` | ✅ | ❌ | One-shot usage |
| `Release()` | ✅ | ✅ | High-frequency create/destroy cycles (reuse avoids allocations) |

Both are safe to call repeatedly, with no side effects. An object that is never closed is still covered: the GC finalizer zeroes the data once the object becomes unreachable. The finalizer is installed once, at first creation, so pooled reuse does not pay that cost again.

### Masked output format

The masked representation carries the lock status, so you can check protection from the logs:

```text
[SECURE:24 bytes]             // memory locking not enabled at call time (no suffix)
[SECURE:24 bytes locked]      // locked
[SECURE:24 bytes lock-failed] // lock failed (pair with MemoryLockError)
[SECURE:24 bytes unlocked]    // locking enabled at call time, but this value is unlocked with no recorded error
[CLOSED]                      // closed
[NIL]                         // nil receiver
```

`unlocked` means "locking is enabled globally, but this value is not locked" — typically because the value was created before locking was enabled, so no attempt was made. The suffix depends on the global switch at call time: when the switch is false at that moment, no lock suffix is added at all; do not read that as `unlocked`. See [Memory Locking](../security/memory-locking) for the complete state rules and troubleshooting.

### Lock-status queries

- `IsMemoryLocked()`: whether the value's memory is currently locked.
- `MemoryLockError()`: the error from the most recent lock attempt; nil on success or when no attempt was made. This is the first place to look when diagnosing permission problems in strict mode.

### GetSecure returns a defensive copy

The `*SecureValue` returned by `Loader.GetSecure` is an **independent copy** of the stored value, with a lifecycle decoupled from the Loader. You own `Close`/`Release`; the Loader's own copy is unaffected.

### ClearBytes

Zero a copy returned by `Bytes()` explicitly once you are done with it:

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

---
sidebar_label: "Memory Locking"
title: "Memory Locking - CyberGo env | mlock Memory Protection"
description: "Memory locking for CyberGo env: SetMemoryLockEnabled, IsMemoryLockSupported, strict mode, platform permissions, mask states and SecureValue lifecycle."
sidebar_position: 3
---

# Memory Locking

Memory locking (`mlock` on Linux and macOS, `VirtualLock` on Windows) marks a memory range as non-swappable, so the operating system never writes it to the swap file or page file. It is one of the defenses `SecureValue` provides.

## Why Memory Locking Is Needed

The operating system swaps inactive memory pages to disk. Zeroing memory with `ClearBytes` therefore does not remove a copy the OS wrote to disk earlier.

```text
Memory (RAM)                   Disk (Swap/Page File)
┌──────────────┐               ┌──────────────┐
│ API_KEY=xxx  │ ── swap ──→   │ API_KEY=xxx  │ ← Residual!
│              │               │ (even after   │
│              │ ←─ read ──    │  zeroing,     │
└──────────────┘               │  still here)  │
                               └──────────────┘
```

With memory locking enabled, the OS keeps those pages in RAM:

```text
Memory (RAM)                   Disk (Swap/Page File)
┌──────────────┐               ┌──────────────┐
│ API_KEY=xxx  │ ╳ no swap ╳   │              │
│ 🔒 mlock     │               │ (no residual) │
└──────────────┘               └──────────────┘
```

## Platform Support

| Platform | System Call | Support |
|----------|-------------|:-------:|
| Linux | `mlock(2)` / `munlock(2)` | ✅ |
| macOS | `mlock(2)` / `munlock(2)` | ✅ |
| Windows | `VirtualLock` / `VirtualUnlock` | ✅ |
| Other platforms (FreeBSD and other BSDs, Solaris, WASM) | N/A | ❌ (no locking implementation) |

Platforms other than Linux, macOS, and Windows have no locking implementation: `IsMemoryLockSupported()` returns `false`, and the lock attempt returns an "unsupported platform" error, which is recorded. `SecureValue` still works, but with locking enabled `Masked()` reports `lock-failed`. With locking disabled, no lock status is appended.

Runtime detection:

```go
if env.IsMemoryLockSupported() {
    fmt.Println("Current platform supports memory locking")
} else {
    fmt.Println("Current platform does not support memory locking (e.g. wasm)")
}
```

## Permission Requirements

Memory locking consumes a system resource, and each platform gates it differently.

### Linux

`mlock` requires the `CAP_IPC_LOCK` capability or root, and the total locked memory is bounded by `RLIMIT_MEMLOCK` (check it with `ulimit -l`):

```bash
# Method 1: Grant the capability to the binary
sudo setcap cap_ipc_lock=ep ./myapp

# Method 2: Via systemd service
# /etc/systemd/system/myapp.service
[Service]
CapabilityBoundingSet=CAP_IPC_LOCK
AmbientCapabilities=CAP_IPC_LOCK

# Method 3: Raise RLIMIT_MEMLOCK
# /etc/security/limits.conf
*    soft    memlock    unlimited
*    hard    memlock    unlimited
```

### macOS

No special permission is required, but the total is bounded by `ulimit -l`.

### Windows

`VirtualLock` needs the `SeLockMemoryPrivilege` ("Lock pages in memory") only for allocations of **more than 30 pages**. Allocations of 30 pages or fewer are locked without the privilege; larger ones fail without it:

```text
Group Policy → Computer Configuration → Windows Settings → Security Settings →
Local Policies → User Rights Assignment → "Lock pages in memory"
```

:::warning Behavior without permission
By default, a memory-locking failure is **silent**: `SecureValue` still works, but the data is not locked. To see failures, enable strict mode.
:::

## Basic Usage

### Enabling Memory Locking

Call this at application startup, before creating any `SecureValue`:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	// Check platform support
	if !env.IsMemoryLockSupported() {
		fmt.Println("Warning: current platform does not support memory locking")
	}

	// Globally enable memory locking
	env.SetMemoryLockEnabled(true)

	// Load configuration
	if err := env.Load(".env"); err != nil {
		panic(err)
	}

	// Every SecureValue created from here on attempts memory locking
	secret := env.GetSecure("API_KEY")
	if secret != nil {
		defer secret.Release()
		fmt.Println(secret.Masked()) // [SECURE:32 bytes locked] when the platform supports it and the lock succeeded (N is the actual value length)
	}
}
```

### Checking Lock Status

```go
sv := env.GetSecure("DB_PASSWORD")
defer sv.Release()

// Check whether the value is locked
if sv.IsMemoryLocked() {
	fmt.Println("Memory is locked, will not be swapped to disk")
} else {
	fmt.Println("Memory is not locked")
}

// Read the locking error, if any
if err := sv.MemoryLockError(); err != nil {
	fmt.Printf("Locking failed: %v\n", err)
}
```

## Strict Mode

By default, locking failures are silent. Strict mode makes them observable.

### Enabling Strict Mode

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

// A subsequent locking failure is written to the standard logger:
// env: memory lock failed in strict mode: operation not permitted
```

### Explicit Error Handling

`NewSecureValueStrict` returns the locking error at creation time:

```go
env.SetMemoryLockEnabled(true) // the error return depends only on "locking enabled + lock failure"

sv, err := env.NewSecureValueStrict("my-api-key")
if err != nil {
	// Locking is enabled and the lock failed.
	// sv is still valid and usable, but its data is not locked.
	log.Printf("Security warning: memory locking failed: %v", err)
}
defer sv.Release()

// Normal usage
fmt.Println(sv.Masked())
```

:::tip Unrelated to SetMemoryLockStrict
The error from `NewSecureValueStrict` depends only on `SetMemoryLockEnabled(true)` plus a lock failure; the strict-mode switch has no effect on it. `SetMemoryLockStrict` controls whether a failure triggers the default handler, which writes a warning to stderr — this applies to every construction path. For constructors that cannot return an error (such as `NewSecureValue`), that warning is the only failure signal.
:::

:::tip Strict-mode behavior
In strict mode, a locking failure triggers the `onStrictLockFailure` callback, which writes to stderr by default. The `SecureValue` itself remains valid and usable; strict mode only makes the failure **observable**.
:::

## Masked Output and Lock Status

`Masked()` reads the global switch at call time. When `IsMemoryLockEnabled()` is `false`, no lock status is appended; when it is `true`, the value's own lock result selects `locked`, `lock-failed`, or `unlocked`. Empty and closed values have their own fixed outputs:

```go
env.SetMemoryLockEnabled(true)

sv := env.GetSecure("API_KEY")
defer sv.Release()

fmt.Println(sv.Masked())
// Lock succeeded:    [SECURE:32 bytes locked]      // locking enabled and the lock succeeded
// Lock failed:       [SECURE:32 bytes lock-failed] // locking enabled but failed (insufficient privilege / unsupported platform)
// Unlocked:          [SECURE:32 bytes unlocked]    // locking enabled at call time, but this value is not locked and has no error (typically created before enabling)
// Locking disabled:  [SECURE:32 bytes]             // global switch off when Masked() runs, so no suffix
// Empty value:       [SECURE:0 bytes]
// Closed:            [CLOSED]
// Nil:               [NIL]
```

## Complete Production Example

```go
package main

import (
	"log"

	"github.com/cybergodev/env"
)

func main() {
	// ── Initialize security configuration ──

	if env.IsMemoryLockSupported() {
		env.SetMemoryLockEnabled(true)
		env.SetMemoryLockStrict(true) // Enable strict mode in production
		log.Println("Memory locking enabled (strict mode)")
	} else {
		log.Println("Warning: platform does not support memory locking")
	}

	// ── Load configuration ──

	cfg := env.ProductionConfig()
	cfg.RequiredKeys = []string{"DB_PASSWORD", "API_KEY"}
	cfg.AutoApply = true

	loader, err := env.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer loader.Close()

	if err := loader.LoadFiles(".env"); err != nil {
		log.Fatal(err)
	}

	// ── Securely access sensitive values ──

	// GetSecure returns a defensive copy: releasing it does not affect the Loader's internal storage
	dbPassword := loader.GetSecure("DB_PASSWORD")
	if dbPassword == nil {
		log.Fatal("DB_PASSWORD not found")
	}
	defer dbPassword.Release()

	// Check lock status
	if !dbPassword.IsMemoryLocked() {
		log.Printf("Security warning: DB_PASSWORD not locked")
		if err := dbPassword.MemoryLockError(); err != nil {
			log.Printf("Reason: %v", err)
		}
	}

	// Reveal returns a new string copy that is not mlock-protected and cannot
	// be zeroed. Discard it as soon as the consumer is done with it.
	password := dbPassword.Reveal()
	_ = password // Used for the database connection, etc.

	// Safe logging (no plaintext leakage)
	log.Printf("Database password: %s", dbPassword.Masked())
	// Output: Database password: [SECURE:12 bytes locked] (N is the actual value length)
}
```

## Best Practices

### Release Promptly

Locked memory cannot be swapped out, so it adds memory pressure. Release each value as soon as you are done with it. An abandoned, unclosed `SecureValue` is eventually zeroed by a GC finalizer, but treat that as a last resort and always call `Release()` explicitly:

```go
// ✅ Recommended: release as soon as done
sv := env.GetSecure("API_KEY")
defer sv.Release()
value := sv.Reveal()
// Use value...
// The deferred call zeroes the data, unlocks the memory, and returns the object to the pool

// ❌ Avoid: holding for a long time
var globalSecret *env.SecureValue // Not recommended
```

### Keep Small and Short-lived

Locking large blocks of memory affects system performance. Store only the sensitive value itself (password, key, token) in each `SecureValue`, not an entire configuration block.

### Plaintext Copies Are Not Lock-Protected

`Reveal()` returns a **new string copy**. It is not protected by `mlock` and cannot be zeroed, because Go strings are immutable. Finish with the plaintext as soon as possible. When you need zeroable plaintext, use `Bytes()` to get a `[]byte` copy and pass it to `ClearBytes` when done:

```go
// string copy: cannot be zeroed — use it briefly, then drop it
password := sv.Reveal()

// when zeroing is required: Bytes() + ClearBytes
raw := sv.Bytes()
defer env.ClearBytes(raw)
```

### Prefer Release Over Close

`Release()` zeroes the value, unlocks the memory, and returns the object to the pool; `Close()` zeroes and unlocks but does not return it to the pool.

```go
sv := env.GetSecure("TOKEN")

// ✅ Release: zeroes, unlocks, and returns the object to the pool (recommended)
defer sv.Release()

// Close also works but does not return the object to the pool
// defer sv.Close()
```

## Troubleshooting

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| `lock-failed` in `Masked()` output | Insufficient permissions or an unsupported platform | Grant `CAP_IPC_LOCK` (Linux) or `SeLockMemoryPrivilege` (Windows); on other platforms locking is unavailable |
| Repeated strict-mode warnings | A locking failure on every `SecureValue` creation | Check `RLIMIT_MEMLOCK` (`ulimit -l`), or disable strict mode |
| `IsMemoryLockSupported()` returns false | The platform is not Linux, macOS, or Windows (FreeBSD, other BSDs, Solaris, WASM) | There is no locking implementation; the attempt fails and the error is recorded. Use other measures such as encrypted storage |
| Increased memory usage | Locked pages cannot be swapped out | Shorten the time each `SecureValue` is held; call `Release()` |

## Related Documentation

- [Security Overview](./) - security architecture overview
- [SecureValue API](../api-reference/secure-value) - complete SecureValue API, including memory-locking functions
- [Performance](../advanced/performance) - memory-locking overhead
- [Production Checklist](./production-checklist) - pre-launch security checks

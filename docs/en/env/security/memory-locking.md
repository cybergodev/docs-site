---
sidebar_label: "Memory Locking"
title: "Memory Locking - CyberGo env | mlock Memory Protection"
description: "Memory locking guide for CyberGo env: SetMemoryLockEnabled, IsMemoryLockSupported, SetMemoryLockStrict strict mode, mlock principles, and SecureValue lifecycle."
sidebar_position: 3
---

# Memory Locking

Memory locking (mlock / VirtualLock) prevents sensitive data from being swapped to disk, and is one of the core defense lines of the SecureValue security system.

## Why Memory Locking Is Needed

Under normal circumstances, the operating system swaps inactive memory pages to disk (swap file / page file). This means that even if you call `ClearBytes` to zero memory in your code, residual copies of sensitive data may still remain on disk.

```text
Memory (RAM)                   Disk (Swap/Page File)
┌──────────────┐               ┌──────────────┐
│ API_KEY=xxx  │ ── swap ──→   │ API_KEY=xxx  │ ← Residual!
│              │               │ (even after   │
│              │ ←─ read ──    │  zeroing,     │
└──────────────┘               │  still here)  │
                               └──────────────┘
```

After enabling memory locking, the OS guarantees these memory pages **will not be swapped out**:

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
| Other platforms (FreeBSD/other BSDs, Solaris, WASM, etc.) | N/A | ❌ (no-op fallback) |

Platforms other than Linux, macOS, and Windows fall back to a no-op: `IsMemoryLockSupported()` returns `false` and enabling locking has no effect (the lock attempt returns a "not supported on this platform" error) — SecureValue still works, but with locking enabled `Masked()` reports `lock-failed`; with locking disabled, no lock status is appended.

Runtime detection:

```go
if env.IsMemoryLockSupported() {
    fmt.Println("Current platform supports memory locking")
} else {
    fmt.Println("Current platform does not support memory locking (e.g., wasm)")
}
```

## Permission Requirements

Memory locking involves system resource limits; different platforms require different permissions:

### Linux

Requires the `CAP_IPC_LOCK` capability:

```bash
# Method 1: Grant via setcap to the binary
sudo setcap cap_ipc_lock=ep ./myapp

# Method 2: Via systemd service
# /etc/systemd/system/myapp.service
[Service]
CapabilityBoundingSet=CAP_IPC_LOCK
AmbientCapabilities=CAP_IPC_LOCK

# Method 3: ulimit adjustment (RLIMIT_MEMLOCK)
# /etc/security/limits.conf
*    soft    memlock    unlimited
*    hard    memlock    unlimited
```

### macOS

Usually requires no special permissions, but is limited by `ulimit -l` (max locked memory).

### Windows

`VirtualLock` requires the `SeLockMemoryPrivilege` ("Lock pages in memory") privilege only for allocations of **more than 30 pages**; smaller allocations can usually be locked directly without it:

```text
Group Policy → Computer Configuration → Windows Settings → Security Settings →
Local Policies → User Rights Assignment → "Lock pages in memory"
```

:::warning Behavior without permission
In default mode, memory locking failures are **silently ignored** — SecureValue still works, but the data is not locked. To ensure locking succeeds, use strict mode.
:::

## Basic Usage

### Enabling Memory Locking

Call at application startup, before creating any SecureValue:

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

	// All subsequent SecureValues will attempt memory locking
	secret := env.GetSecure("API_KEY")
	if secret != nil {
		defer secret.Release()
		fmt.Println(secret.Masked()) // [SECURE:32 bytes locked] (N depends on the actual value length)
	}
}
```

### Checking Lock Status

```go
sv := env.GetSecure("DB_PASSWORD")
defer sv.Release()

// Check if locked
if sv.IsMemoryLocked() {
    fmt.Println("Memory is locked, will not be swapped to disk")
} else {
    fmt.Println("Memory is not locked")
}

// Check locking error (if any)
if err := sv.MemoryLockError(); err != nil {
    fmt.Printf("Locking failed: %v\n", err)
}
```

## Strict Mode

In default mode, locking failures are silently ignored. Strict mode makes failures observable:

### Enabling Strict Mode

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

// Subsequent locking failures will be output to the standard logger:
// env: memory lock failed in strict mode: operation not permitted
```

### Explicit Error Handling

Use `NewSecureValueStrict` to get the locking error at creation time:

```go
env.SetMemoryLockEnabled(true) // error return depends only on "locking enabled + lock failure"

sv, err := env.NewSecureValueStrict("my-api-key")
if err != nil {
    // Memory locking failed
    // SecureValue is still valid, but data is not protected by locking
    log.Printf("Security warning: memory locking failed: %v", err)
}
defer sv.Release()

// Normal usage
fmt.Println(sv.Masked())
```

:::tip Unrelated to SetMemoryLockStrict
`NewSecureValueStrict`'s error return depends only on `SetMemoryLockEnabled(true)` plus a lock failure — it is unrelated to the strict-mode switch; `SetMemoryLockStrict` controls whether a lock failure emits the stderr warning (this applies to every construction path) — for non-strict constructors that cannot return an error (e.g., `NewSecureValue`), that warning is the only failure signal.
:::

:::tip Strict-mode behavior
In strict mode, locking failure triggers the `onStrictLockFailure` callback (outputs to stderr by default). SecureValue itself always remains valid — strict mode just makes locking failures **observable**, rather than preventing usage.
:::

## Masked Output and Lock Status

`Masked()` includes lock status in the output — **the three lock states are appended only when `SetMemoryLockEnabled(true)`**; empty and closed values have their own outputs:

```go
env.SetMemoryLockEnabled(true)

sv := env.GetSecure("API_KEY")
defer sv.Release()

fmt.Println(sv.Masked())
// Lock succeeded:    [SECURE:32 bytes locked]      // locking enabled at creation and lock succeeded
// Lock failed:       [SECURE:32 bytes lock-failed] // locking enabled but failed (insufficient privilege / unsupported platform)
// Never attempted:   [SECURE:32 bytes unlocked]    // value created before locking was enabled
// Locking disabled:  [SECURE:32 bytes]             // no lock status appended
// Empty value:       [SECURE:0 bytes]
// Closed:            [CLOSED]
```

## Complete Production Example

```go
package main

import (
	"log"
	"os"

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

	// Only get plaintext when needed: Reveal returns a new string copy,
	// not protected by memory locking and impossible to zero — discard once done, keep the window short
	password := dbPassword.Reveal()
	_ = password // Used for database connection, etc.

	// Safe logging (no plaintext leakage)
	log.Printf("Database password: %s", dbPassword.Masked())
	// Output: Database password: [SECURE:12 bytes locked] (N depends on the actual value length)

	_ = os.Stdout
}
```

## Best Practices

### Release Promptly

Locking memory increases memory pressure (cannot be swapped out), so release immediately after use. Even if you forget, an abandoned, unclosed SecureValue is zeroed by a GC finalizer as a last resort — but that is a safety net, not something to rely on; always `Release()` explicitly:

```go
// ✅ Recommended: release as soon as done
sv := env.GetSecure("API_KEY")
defer sv.Release()
value := sv.Reveal()
// Use value...
// defer triggers auto-zeroing + unlocking + returning to object pool

// ❌ Avoid: holding for long periods
var globalSecret *env.SecureValue // Not recommended
```

### Keep Small and Short-lived

Locking large blocks of memory affects system performance. Each SecureValue should only store the necessary sensitive value (password, key, token), not entire configuration blocks.

### Plaintext Copies Are Not Lock-Protected

`Reveal()` returns a **new string copy** — it is not protected by mlock and cannot be zeroed (strings are immutable). Discard plaintext **as soon as you are done** and keep the holding window short; when you need zeroable plaintext, use `Bytes()` for a `[]byte` copy and `ClearBytes` it when finished:

```go
// string copy: cannot be zeroed — discard promptly, keep the window short
password := sv.Reveal()

// When zeroing is required: Bytes() + ClearBytes
raw := sv.Bytes()
defer env.ClearBytes(raw)
```

### Prefer Release Over Close

```go
sv := env.GetSecure("TOKEN")

// ✅ Release: zeroing + unlocking + returning to object pool (recommended)
defer sv.Release()

// Close also works, but doesn't return to the object pool
// defer sv.Close()
```

## Troubleshooting

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| `lock-failed` in Masked output | Insufficient permissions | Configure `CAP_IPC_LOCK` (Linux) or `SeLockMemoryPrivilege` (Windows) |
| Strict mode log spam | Locking failure when creating many SecureValues | Check system `RLIMIT_MEMLOCK` limits, or use non-strict mode |
| `IsMemoryLockSupported()` returns false | Any platform other than Linux/macOS/Windows (FreeBSD/other BSDs, Solaris, WASM, etc.) | These platforms don't support memory locking (no-op fallback); use other security measures (e.g., encrypted storage) |
| Increased memory usage | Locked pages cannot be swapped out | Reduce SecureValue hold time, Release promptly |

## Related Documentation

- [Security Overview](./) - Security architecture overview
- [SecureValue API](../api-reference/secure-value) - Complete SecureValue API (including memory locking functions)
- [Performance](../advanced/performance) - Memory locking performance overhead analysis
- [Production Checklist](./production-checklist) - Pre-launch security checks

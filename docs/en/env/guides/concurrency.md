---
sidebar_label: "Concurrency & Lifecycle"
title: "Concurrency & Lifecycle - CyberGo env | Goroutine safety"
description: "CyberGo env concurrency and lifecycle: Load singleton init, ResetDefaultLoader, Apply/Close/Delete process-env rules, sharded lock-free reads for goroutines."
sidebar_position: 9
---

# Concurrency & Lifecycle

Every public API in the env library is safe for concurrent use — a single `Loader` can be freely shared across goroutines. "Concurrency-safe", however, does not mean "lifecycle can be ignored": how the global singleton is initialized and reset, what `Apply`/`Close`/`Delete` each do to the process environment (`os.Environ`), and who wins when goroutines write the same key concurrently — these semantics determine how your program behaves under long-running workloads and in test isolation. This guide covers them one by one.

## Global Mode Lifecycle

### One-Shot Initialization

`Load()` and `LoadWithConfig()` initialize the package-level default loader (the singleton). This is an **explicitly initialized** singleton: there is no lazy auto-creation. `setDefaultLoader` checks under a mutex and allows exactly one assignment — a second call returns `ErrAlreadyInitialized` (the newly created loader is closed and cleaned up immediately):

```go
if err := env.Load(".env"); err != nil {
    log.Fatal(err)
}

// A second initialization is rejected
err := env.Load(".env.local")
fmt.Println(errors.Is(err, env.ErrAlreadyInitialized)) // Output: true
```

Concurrent `Load()` calls from multiple goroutines are also safe: the mutex guarantees exactly one caller succeeds; the rest receive `ErrAlreadyInitialized`.

Note that `Load()` **forces** `AutoApply = true` — every loaded variable is immediately applied to the process environment (`LoadWithConfig` forces the same behavior even if your config says `false`). This is a prerequisite for the package-level getters to work. When you need manual control over the apply timing, use Instance Mode with `New()` instead, whose default `AutoApply` is `false`.

### Behavior Before Initialization

Using package-level functions before calling `Load()`/`LoadWithConfig()` splits into "reads are silent, writes error out":

| Operation | Behavior when not initialized |
|-----------|-------------------------------|
| `GetString` / `GetInt` / `GetBool` and other Get* | Returns the provided default (or zero value), **no error** |
| `Lookup` | Returns `("", false)` |
| `Keys` / `All` / `Len` / `GetSecure` | Returns `nil` / `0` / `nil` |
| `Set` / `Delete` / `Validate` / `ParseInto` | Returns `ErrNotInitialized` |

::: warning
Before initialization, getters silently return defaults — a mistyped key or a missing `Load()` call produces no error signal at all. The usual symptom is "the app runs happily on default configuration". If that happens, check whether your startup path actually ran `Load()`, and whether another test called `ResetDefaultLoader()` beforehand.
:::

### ResetDefaultLoader: Resetting the Singleton

`ResetDefaultLoader()` atomically swaps out the current singleton and closes the old loader, returning any error from that close (`nil` when no loader was set or the close succeeded). It is itself safe for concurrent use: the old loader's `Close` runs outside the lock, avoiding slow cleanup while holding it.

```go
if err := env.ResetDefaultLoader(); err != nil {
    log.Printf("warning: failed to reset loader: %v", err)
}
```

After a reset you can call `Load()` again to re-initialize. This function is intended for **test isolation and program startup**: a normally running application should initialize once and not repeatedly reset — between the reset and the next `Load()`, package-level functions briefly behave as uninitialized (reads return defaults, writes return `ErrNotInitialized`).

::: warning
`ResetDefaultLoader()` closes the old loader but does **not** undo the variables it already applied to the process environment (see the `Close` semantics below). Tests that need a clean process environment should also `os.Unsetenv` manually, or switch to Instance Mode.
:::

## Loader Instance Lifecycle

### Creation: New()

`New()` creates a fully independent loader instance: it does not set the global singleton, applies nothing to the process environment (unless `cfg.AutoApply = true`), and can be called repeatedly with no cross-talk. If `Filenames` is configured, those files are loaded at creation time. The typical lifecycle is **create → load → apply → use → close**:

```go
loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()

if err := loader.LoadFiles("app.env"); err != nil {
    log.Fatal(err)
}
if err := loader.Apply(); err != nil {
    log.Fatal(err)
}
// ... use loader ...
```

### Applying to the Process Environment: Apply()

`Apply()` writes the in-memory variables to the process environment. For keys that **already exist** in the process environment (checked via `LookupEnv`, which correctly distinguishes "not set" from "explicitly empty string"), the default behavior (`OverwriteExisting = false`) is to skip them; only `OverwriteExisting = true` overwrites.

Every key this loader actually writes to the process environment is recorded in an internal `appliedKeys` set — this is what allows `Delete()` to undo precisely.

With `AutoApply` enabled there is no need to call `Apply()` manually: loading files and `Set`-ting individual keys both sync to the process environment immediately.

### Closing: Close()

`Close()` securely zeroes all values stored in memory (sensitive values are wiped byte by byte) and closes the component factory if the loader owns it. `Close` is idempotent: calling it again on a closed or `nil` loader is not an error.

The key semantic: **`Close()` clears memory only — it does not undo the process environment**. Variables previously written there via `Apply`, `AutoApply`, or `Set` with `AutoApply` stay in place. To remove them before shutting down, call `Delete()` per key.

Behavior after closing:

| Operation | Behavior after Close |
|-----------|----------------------|
| `Lookup` / `GetSecure` | `("", false)` / `nil`, no error |
| `GetString` / `GetInt` and other Get* | Returns the default (or zero value) |
| `Keys` / `All` / `Len` / `ParseInto` | Returns `nil` / `0` / `ErrClosed` |
| `Set` / `Delete` / `Apply` / `LoadFiles` / `Validate` | Returns `ErrClosed` |
| `Close` / `IsClosed` | Idempotent `nil` / `true` |

### Per-Key Undo: Delete()

`Delete(key)` does two things: it removes the key from the loader's memory, and — **only if this loader itself wrote that key** to the process environment (a hit in the `appliedKeys` tracking) — it also calls `Unsetenv`.

The per-key tracking is deliberate: unsetting everything whenever "anything was applied" would destroy foreign process variables such as `HOME` and `TERM` that the loader never owned. Deleting a key this loader never applied leaves the process environment untouched.

### Full Lifecycle Example

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/env"
)

func main() {
	// Prepare a demo config file
	const file = "lifecycle_demo.env"
	if err := os.WriteFile(file, []byte("MY_APP_MODE=demo\n"), 0o600); err != nil {
		panic(err)
	}
	defer os.Remove(file)

	cfg := env.DefaultConfig() // AutoApply=false: Apply must be called manually
	cfg.Filenames = nil        // Load explicitly via LoadFiles below

	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}

	// Load into memory (not yet in the process environment)
	if err := loader.LoadFiles(file); err != nil {
		panic(err)
	}

	// Apply to the process environment
	if err := loader.Apply(); err != nil {
		panic(err)
	}
	mode, ok := os.LookupEnv("MY_APP_MODE")
	fmt.Println("after Apply, in process:", mode, ok)

	// Close: zeroes memory, but process-environment variables remain
	if err := loader.Close(); err != nil {
		panic(err)
	}
	_, ok = loader.Lookup("MY_APP_MODE")
	fmt.Println("after Close, in loader:", ok)
	mode, ok = os.LookupEnv("MY_APP_MODE")
	fmt.Println("after Close, in process:", mode, ok)
	// Output:
	// after Apply, in process: demo true
	// after Close, in loader: false
	// after Close, in process: demo true
}
```

The per-key protection of `Delete()` can be verified like this:

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/env"
)

func main() {
	// A foreign variable that already exists in the process
	// (simulating system variables like HOME/TERM)
	if err := os.Setenv("FOREIGN_VAR", "keep"); err != nil {
		panic(err)
	}
	defer os.Unsetenv("FOREIGN_VAR")

	cfg := env.DefaultConfig()
	cfg.AutoApply = true // Set writes straight to the process environment
	cfg.Filenames = nil

	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}
	defer loader.Close()

	if err := loader.Set("MY_APP_TOKEN", "secret"); err != nil {
		panic(err)
	}

	// Delete a key this loader wrote: removed from memory
	// and from the process environment together
	if err := loader.Delete("MY_APP_TOKEN"); err != nil {
		panic(err)
	}
	_, tokenInProc := os.LookupEnv("MY_APP_TOKEN")

	// Delete a key this loader never applied: process environment untouched
	if err := loader.Delete("FOREIGN_VAR"); err != nil {
		panic(err)
	}
	_, foreignInProc := os.LookupEnv("FOREIGN_VAR")

	fmt.Println("MY_APP_TOKEN in process:", tokenInProc)
	fmt.Println("FOREIGN_VAR in process:", foreignInProc)
	// Output:
	// MY_APP_TOKEN in process: false
	// FOREIGN_VAR in process: true
}
```

## Concurrency Safety Model

The env library is designed for concurrency from the storage layer up to the global singleton. Every public API can be called from multiple goroutines without external synchronization, verified continuously under the `-race` detector. The layered mechanisms:

| Layer | Mechanism |
|-------|-----------|
| Variable storage (secureMap) | 8 shards, each with its own RWMutex to reduce lock contention; an atomic counter backs O(1) `Len()` |
| Single-key reads (`Lookup` / `GetSecure`; all Get* build on `Lookup`) | Lock-free fast path: an atomic closed check (`closedFast`) plus the shard's internal lock — no loader-level mutex |
| Multi-key snapshots (`All` / `Keys` / `ParseInto`) | Read lock held for a cross-shard consistent snapshot |
| Writes (`Set` / `Delete` / `Apply`) | Loader-level write lock; `Set` with `OverwriteExisting = true` and no `AutoApply` takes a read-lock fast path |
| Global singleton | Atomic pointer reads (lock-free read path); `Load` and `ResetDefaultLoader` set/swap under a lock |
| `SecureValue` | Mutex-protected data access plus an atomic closed bit; concurrent `Release` is safe |

### Racing Against Close

Reads racing with `Close()` degrade gracefully instead of crashing: a single-key read observes either the pre-close value or the post-close state (default / `("", false)` / `nil`) — never a panic or a torn value. Multi-key snapshots either capture a consistent pre-close snapshot or return zero values / `ErrClosed` after the close.

### Concurrent Writes and OverwriteExisting

How `Set` treats an existing key is decided by `OverwriteExisting`:

| Configuration | `Set` on an existing key |
|---------------|--------------------------|
| `false` (`DefaultConfig` / `ProductionConfig`) | Silently skipped — first write wins, no error |
| `true` (`DevelopmentConfig` / `TestingConfig`) | Overwrites |

So when **multiple goroutines repeatedly write the same key** and you expect "last write wins", you must use a config with `OverwriteExisting = true` (e.g. `DevelopmentConfig`); otherwise only the first write takes effect and every subsequent one is silently skipped.

### Concurrent Reads and Writes on One Loader

```go
package main

import (
	"fmt"
	"sync"

	"github.com/cybergodev/env"
)

func main() {
	cfg := env.DevelopmentConfig() // OverwriteExisting=true, repeated Set works
	cfg.Filenames = nil            // load no files: deterministic output

	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}
	defer loader.Close()

	if err := loader.Set("APP_NAME", "demo"); err != nil {
		panic(err)
	}

	var wg sync.WaitGroup

	// 8 goroutines writing their own keys concurrently
	for i := range 8 {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			key := fmt.Sprintf("WORKER_%d", id)
			if err := loader.Set(key, fmt.Sprintf("value-%d", id)); err != nil {
				fmt.Println("set error:", err)
			}
		}(i)
	}

	// Concurrent readers of existing keys at the same time
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = loader.GetString("APP_NAME")
		}()
	}

	wg.Wait()
	fmt.Println("APP_NAME =", loader.GetString("APP_NAME"))
	fmt.Println("total keys:", loader.Len())
	// Output:
	// APP_NAME = demo
	// total keys: 9
}
```

## Global Mode Full Example

The following example walks the full singleton lifecycle: uninitialized behavior → one-shot initialization → rejecting a second initialization → re-initializing after a reset.

```go
package main

import (
	"errors"
	"fmt"
	"os"

	"github.com/cybergodev/env"
)

func main() {
	// Prepare a demo config file
	const file = ".env.global-demo"
	if err := os.WriteFile(file, []byte("GL_PORT=9000\n"), 0o600); err != nil {
		panic(err)
	}
	defer os.Remove(file)

	// 1) Not yet initialized: reads silently return defaults,
	//    writes return ErrNotInitialized
	fmt.Println("before Load, port =", env.GetInt("GL_PORT", 8080))
	if err := env.Set("GL_PORT", "9090"); err != nil {
		fmt.Println("before Load, Set is ErrNotInitialized:",
			errors.Is(err, env.ErrNotInitialized))
	}

	// 2) One-shot initialization (AutoApply forced, variable
	//    enters the process environment)
	if err := env.Load(file); err != nil {
		panic(err)
	}
	fmt.Println("after Load, port =", env.GetInt("GL_PORT"))
	_, inProc := os.LookupEnv("GL_PORT")
	fmt.Println("GL_PORT in process:", inProc)

	// 3) A second initialization is rejected
	err := env.Load(file)
	fmt.Println("second Load is ErrAlreadyInitialized:",
		errors.Is(err, env.ErrAlreadyInitialized))

	// 4) After resetting the singleton, Load works again
	if err := env.ResetDefaultLoader(); err != nil {
		panic(err)
	}
	if err := env.Load(file); err != nil {
		panic(err)
	}
	fmt.Println("reloaded, port =", env.GetInt("GL_PORT"))
	// Output:
	// before Load, port = 8080
	// before Load, Set is ErrNotInitialized: true
	// after Load, port = 9000
	// GL_PORT in process: true
	// second Load is ErrAlreadyInitialized: true
	// reloaded, port = 9000
}
```

## Resetting the Singleton Between Tests

The global singleton outlives individual tests — a loader from a previous `Load()` leaks into the next case (showing up as `ErrAlreadyInitialized` or stale values). The standard pattern is a TestMain that resets around the whole run:

```go
func TestMain(m *testing.M) {
	// Cleanup on entry: isolate any leftover singleton
	_ = env.ResetDefaultLoader()

	code := m.Run()

	// Cleanup on exit: close the loader these tests initialized
	_ = env.ResetDefaultLoader()
	os.Exit(code)
}
```

Cases that need Global Mode then call `Load()` themselves. Because `Load` forces `AutoApply = true` and `Close` does not undo the process environment, tests should also clean applied process variables via `t.Cleanup`. For deeper isolation (independent instances, in-memory filesystems, table-driven tests, and more), see [Testing](./testing).

## Common Pitfalls

| Pitfall | Consequence | Do instead |
|---------|-------------|------------|
| Calling `Load()` from multiple code paths | Every call after the first returns `ErrAlreadyInitialized` | Initialize once in `main`/TestMain; use `ResetDefaultLoader()` in tests |
| Expecting Get* errors to surface config problems before initialization | Getters silently return defaults, hiding the issue | Call `Validate()` after startup, or confirm explicitly via `Lookup`/`Set` (write paths return `ErrNotInitialized`) |
| Expecting the process environment to be restored after `Close()` | Applied variables remain in the process environment | `Delete()` each key before closing, or evaluate the impact before enabling `OverwriteExisting` |
| Concurrent/repeated writes to the same key without `OverwriteExisting` | Later writes are silently skipped; stale values are read | Use `DevelopmentConfig`/`TestingConfig` or set `cfg.OverwriteExisting = true` explicitly |
| Repeatedly `New()`-ing loaders for the same config | Duplicate resources and a muddled process environment | Share one loader (it is concurrency-safe), or use Global Mode |
| Forgetting to `Close()` an instance loader | Sensitive values in memory are only zeroed at GC | `defer loader.Close()` |

## Next Steps

- [Testing](./testing) — `TestingConfig`, in-memory filesystems, and fuller test-isolation patterns
- [Performance](../advanced/performance) — benchmark data and tuning details for the sharded storage and lock-free read path
- [Loader API Reference](../api-reference/loader) — full signatures and error semantics of `Apply`/`Close`/`Delete` and friends

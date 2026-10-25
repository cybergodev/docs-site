---
sidebar_label: "Concurrency & Lifecycle"
title: "Concurrency & Lifecycle - CyberGo env | Goroutine safety"
description: "CyberGo env concurrency and lifecycle: Load singleton init, ResetDefaultLoader, Apply/Close/Delete process-env rules, and 32-shard lock-free reads."
sidebar_position: 9
---

# Concurrency & Lifecycle

Every public API in env is safe for concurrent use: one `Loader` can be shared across goroutines without external locking. Concurrency safety does not cover lifecycle, though. Three things still decide how your program behaves under long-running workloads and in test isolation:

- how the global singleton is initialized and reset
- what `Apply`, `Close`, and `Delete` each do to the process environment
- which write survives when goroutines write the same key

Each is covered below.

## Global Mode Lifecycle

### One-Shot Initialization

`Load()` and `LoadWithConfig()` initialize the package-level default loader (the singleton). Initialization is **explicit**: there is no lazy auto-creation. `setDefaultLoader` checks under a mutex and allows exactly one assignment. A second call returns `ErrAlreadyInitialized`, and the newly created loader is closed immediately:

```go
if err := env.Load(".env"); err != nil {
    log.Fatal(err)
}

// A second initialization is rejected
err := env.Load(".env.local")
fmt.Println(errors.Is(err, env.ErrAlreadyInitialized)) // Output: true
```

Concurrent `Load()` calls from multiple goroutines are also safe: the mutex guarantees exactly one caller succeeds and the rest receive `ErrAlreadyInitialized`.

`Load()` **forces** `AutoApply = true`, so every loaded variable is written to the process environment immediately. `LoadWithConfig` forces the same behavior even when your config sets `AutoApply = false`. The package-level getters depend on this. When you need control over when values are applied, use instance mode with `New()`, whose default `AutoApply` is `false`.

### Behavior Before Initialization

Using package-level functions before `Load()` or `LoadWithConfig()` splits into "reads return defaults, writes and validation return errors":

| Operation | Behavior when not initialized |
|-----------|-------------------------------|
| `GetString` / `GetInt` / `GetBool` and other Get* | Returns the provided default (or zero value), **no error** |
| `Lookup` | Returns `("", false)` |
| `Keys` / `All` / `Len` / `GetSecure` | Returns `nil` / `nil` / `0` / `nil`, in that order |
| `Set` / `Delete` / `Validate` / `ParseInto` | Returns `ErrNotInitialized` |

::: warning
Before initialization, getters return defaults without any error signal — a mistyped key or a missing `Load()` call looks identical to a working setup. The usual symptom is an app that runs happily on default configuration. If that happens, check that your startup path actually ran `Load()`, and that no earlier test called `ResetDefaultLoader()`.
:::

### ResetDefaultLoader: Resetting the Singleton

`ResetDefaultLoader()` atomically swaps out the current singleton and closes the old loader. It returns the close error, or `nil` when no loader was set or the close succeeded. It is safe for concurrent use: the old loader's `Close` runs outside the lock, so slow cleanup does not block other callers.

```go
if err := env.ResetDefaultLoader(); err != nil {
    log.Printf("warning: failed to reset loader: %v", err)
}
```

After a reset you can call `Load()` again. Use this function for **test isolation and program startup**; a normally running application should initialize once and never reset. Between the reset and the next `Load()`, package-level functions behave as uninitialized: reads return defaults and `Set`/`Delete`/`Validate`/`ParseInto` return `ErrNotInitialized`.

::: warning
`ResetDefaultLoader()` closes the old loader but does **not** undo the variables it already applied to the process environment (see `Close()` below). Tests that need a clean process environment should also call `os.Unsetenv`, or switch to instance mode.
:::

## Loader Instance Lifecycle

### Creation: New()

`New()` creates a fully independent loader instance. It does not set the global singleton, applies nothing to the process environment unless `cfg.AutoApply = true`, and you can call it repeatedly without cross-talk between instances. If `Filenames` is set, those files are loaded at creation time. The typical lifecycle is **create → load → apply → use → close**:

```go
loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()

if err := loader.LoadFiles("app.env"); err != nil {
    log.Fatal(err)
}
// A failed Apply means "partially applied": keys written before the failure
// are not rolled back and IsApplied() stays false. Log it and carry on here;
// production code should Delete the written keys or fix the environment and retry.
if err := loader.Apply(); err != nil {
    log.Printf("apply failed (partially applied): %v", err)
}
// ... use loader ...
```

### Applying to the Process Environment: Apply()

`Apply()` writes the in-memory variables to the process environment. For a key that **already exists** there (checked via `LookupEnv`, which distinguishes "not set" from "explicitly empty"), the default behavior (`OverwriteExisting = false`) is to skip it. With `OverwriteExisting = true`, the existing value is overwritten.

Every key this loader writes to the process environment is recorded in an internal `appliedKeys` set. That record is what lets `Delete()` undo precisely.

With `AutoApply` enabled you don't call `Apply()` manually: loading files and individual `Set` calls sync to the process environment immediately.

A failed `Apply()` means **partially applied**: keys written before the failure are not rolled back and `IsApplied()` stays `false`. Log the error and continue (or `Delete()` the keys you know were written and retry after fixing the environment) instead of panicking; see [Loader API · Apply](../api-reference/loader#apply) for the full semantics.

### Closing: Close()

`Close()` zeroes and unlocks every value stored in memory (sensitive values are wiped byte by byte, and unlocking happens before zeroing), and closes the component factory if the loader owns it. It is idempotent: a second call on a closed or `nil` loader returns no error.

`Close()` zeroes and **unlocks** the in-memory copies. It does **not** undo the process environment: variables previously written there via `Apply`, `AutoApply`, or `Set` with `AutoApply` stay in place. To remove them before shutdown, call `Delete()` per key.

Behavior after closing:

| Operation | Behavior after Close |
|-----------|----------------------|
| `Lookup` / `GetSecure` | `("", false)` / `nil`, no error |
| `GetString` / `GetInt` and other Get* | Returns the default (or zero value) |
| `Keys` / `All` / `Len` / `ParseInto` | Returns `nil` / `nil` / `0` / `ErrClosed`, in that order |
| `Set` / `Delete` / `Apply` / `LoadFiles` / `Validate` | Returns `ErrClosed` |
| `Close` / `IsClosed` | Idempotent `nil` / `true` |

### Per-Key Undo: Delete()

`Delete(key)` does two things: it removes the key from the loader's memory, and — **only if this loader itself wrote that key** to the process environment (a hit in `appliedKeys`) — it calls `Unsetenv`.

The per-key tracking is deliberate. Unsetting everything whenever "anything was applied" would destroy foreign process variables such as `HOME` and `TERM` that the loader never owned. Deleting a key this loader never applied leaves the process environment untouched.

### Full Lifecycle Example

```go
package main

import (
	"fmt"
	"log"
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

	// Apply to the process environment. A failure means "partially applied":
	// keys already written are not rolled back and IsApplied() stays false,
	// so log it and continue rather than panicking.
	if err := loader.Apply(); err != nil {
		log.Printf("apply failed (partially applied): %v", err)
	}
	mode, ok := os.LookupEnv("MY_APP_MODE")
	fmt.Println("after Apply, in process:", mode, ok)

	// Close: zeroes and unlocks memory, but process-environment variables remain
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

The per-key protection of `Delete()` verifies like this:

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

env is concurrency-safe from the storage layer up to the global singleton. Every public API can be called from multiple goroutines without external synchronization, and the test suite runs continuously under the `-race` detector. The layers:

| Layer | Mechanism |
|-------|-----------|
| Variable storage (secureMap) | 32 shards, each with its own `RWMutex`, to reduce lock contention; an atomic counter backs O(1) `Len()` |
| Single-key reads (`Lookup` / `GetSecure`; every Get* builds on `Lookup`) | Lock-free fast path: an atomic closed check (`closedFast`) plus the shard's internal lock, no loader-level mutex |
| `All` / `Keys` | Per-shard read locks, sized from the atomic counter; the result is an **approximate** snapshot, not guaranteed consistent across shards |
| `ParseInto` | Takes the loader read lock only long enough to snapshot all values into a map, then releases it before filling your struct (so `UnmarshalText` callbacks can call back into the loader) |
| Writes (`Set` / `Delete` / `Apply`) | Loader-level write lock; `Set` with `OverwriteExisting = true` and no `AutoApply` takes a read-lock fast path |
| Global singleton | Atomic pointer reads (lock-free read path); `Load` and `ResetDefaultLoader` set or swap under a lock |
| `SecureValue` | Mutex-protected data access plus an atomic closed bit; concurrent `Release` is safe |

### Racing Against Close

Reads racing with `Close()` degrade instead of crashing. A single-key read observes either the pre-close value or the post-close state (default / `("", false)` / `nil`), never a panic or a torn value. `All` and `Keys` either capture an approximate pre-close snapshot or return `nil` after the close; `ParseInto` returns `ErrClosed`.

### Concurrent Writes and OverwriteExisting

How `Set` treats an existing key depends on `OverwriteExisting`:

| Configuration | `Set` on an existing key |
|---------------|--------------------------|
| `false` (`DefaultConfig` / `ProductionConfig`) | Skipped with no error: the first write wins |
| `true` (`DevelopmentConfig` / `TestingConfig`) | Overwrites |

When **multiple goroutines repeatedly write the same key** and you expect last-write-wins, use a config with `OverwriteExisting = true` (for example `DevelopmentConfig`). Otherwise only the first write takes effect, and every later write is skipped without an error.

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

This example walks the full singleton lifecycle: uninitialized behavior, one-shot initialization, a rejected second initialization, and re-initialization after a reset.

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
	//    Set/Delete/Validate/ParseInto return ErrNotInitialized
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

The global singleton outlives individual tests, so a loader from a previous `Load()` leaks into the next case as `ErrAlreadyInitialized` or stale values. The essentials:

- Reset once in TestMain, and check the error returned by `ResetDefaultLoader()`.
- Cases that use global mode then call `Load()` themselves.
- `Load` forces `AutoApply = true` and `Close` does not undo the process environment, so tests should also clean applied process variables in `t.Cleanup`.

The full TestMain template and process-variable cleanup are in [Testing · Cleaning Up Test State](./testing#cleaning-up-test-state); the in-memory filesystem is in [Testing · Mocking Filesystem](./testing#mocking-filesystem).

## Common Pitfalls

| Pitfall | Consequence | Do instead |
|---------|-------------|------------|
| Calling `Load()` from multiple code paths | Every call after the first returns `ErrAlreadyInitialized` | Initialize once in `main`/`TestMain`; use `ResetDefaultLoader()` in tests |
| Expecting Get* to report config problems before initialization | Getters return defaults, hiding the issue | Call `Validate()` after startup, or confirm with `Lookup`/`Set` (write paths return `ErrNotInitialized`) |
| Expecting the process environment to be restored after `Close()` | Applied variables remain in the process environment | `Delete()` each key before closing, or evaluate the impact before enabling `OverwriteExisting` |
| Concurrent or repeated writes to the same key without `OverwriteExisting` | Later writes are skipped without an error; stale values are read | Use `DevelopmentConfig`/`TestingConfig`, or set `cfg.OverwriteExisting = true` explicitly |
| Creating a new loader with `New()` for the same config repeatedly | Duplicate resources and a muddled process environment | Share one loader (it is concurrency-safe), or use global mode |
| Forgetting to `Close()` an instance loader | Sensitive values in memory are only zeroed at GC | `defer loader.Close()` |

## Next Steps

- [Testing](./testing) - `TestingConfig`, in-memory filesystems, and further test-isolation patterns
- [Performance](../advanced/performance) - benchmark data and tuning for sharded storage and the lock-free read path
- [Loader API Reference](../api-reference/loader) - full signatures and error semantics of `Apply`, `Close`, and `Delete`

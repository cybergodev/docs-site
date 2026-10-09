---
sidebar_label: "Log Sampling"
title: "Log Sampling - CyberGo DD | High-Throughput Logging"
description: "Configure CyberGo DD log sampling: SamplingConfig Initial, Thereafter, Tick parameters cut log volume in high-throughput scenarios, with runtime toggling."
sidebar_position: 1
---

# Log Sampling

In high-throughput scenarios (HTTP request logging, event stream processing), logging every entry produces massive data. DD's sampling feature retains logs proportionally, controlling log volume while still reflecting overall trends.

## Sampling Principle

DD uses a **counter-based sampling** strategy:

```
┌──────────────────────────────────────────────────────────┐
│  Requests 1-100  →  all logged (Initial phase)           │
│  Request 101     →  skipped                               │
│  Request 102     →  skipped                               │
│  ...                                                      │
│  Request 110     →  logged (1 of every Thereafter=10)     │
│  Request 111     →  skipped                               │
│  ...                                                      │
│  (Tick expires → counter resets, re-enters Initial phase) │
└──────────────────────────────────────────────────────────┘
```

| Parameter | Description | Typical Value |
|-----------|-------------|---------------|
| `Enabled` | Enable sampling | `true` |
| `Initial` | First N entries always logged | 100 |
| `Thereafter` | Log 1 out of every N after Initial | 10 |
| `Tick` | Counter reset interval (0 = never reset) | `1s` / `1m` |

## Quick Start

### Enable at Configuration

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/dd"
)

func main() {
	cfg := dd.DefaultConfig()
	cfg.Sampling = &dd.SamplingConfig{
		Enabled:    true,
		Initial:    100,         // First 100 always logged
		Thereafter: 10,          // Then log 1 of every 10
		Tick:       time.Second, // Reset counter every second
	}

	logger, err := dd.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer logger.Close()

	// Simulate high-throughput logging
	for i := 0; i < 1000; i++ {
		logger.InfoWith("request processed",
			dd.Int("seq", i),
		)
	}
	// Actual output: first 100 + 90 of remaining 900 = 190 entries
}
```

### Runtime Toggle

```go
// Enable sampling
logger.SetSampling(&dd.SamplingConfig{
    Enabled:    true,
    Initial:    50,
    Thereafter: 20,
    Tick:       0, // No auto-reset
})

// Disable sampling (resume full logging)
logger.SetSampling(nil)

// Query current sampling config
sc := logger.GetSampling()
if sc != nil {
    fmt.Printf("Sampling: Initial=%d, Thereafter=%d\n", sc.Initial, sc.Thereafter)
}
```

:::tip Global Logger sampling
Package-level functions `dd.SetSampling()` and `dd.GetSampling()` operate on the global Logger directly.
:::

## Parameter Details

### Initial: Initial Full-Volume Window

`Initial` guarantees that the first N entries after startup or Tick reset are **all logged**, ensuring:

- Startup-phase initialization logs are not lost
- Short burst traffic has complete records
- Period-start state is visible after Tick reset

### Thereafter: Sampling Rate

| Thereafter | Effect | Retention Rate (after Initial) |
|:----------:|--------|:------------------------------:|
| 1 | Log every entry (= disabled) | 100% |
| 10 | Log 1 of every 10 | 10% |
| 100 | Log 1 of every 100 | 1% |
| 0 | Stop logging after Initial | 0% |

:::warning Thereafter=0
`Thereafter=0` means **completely stop logging** after the Initial phase. Useful in some scenarios (e.g., only startup logs needed), but ensure no important information is missed.
:::

### Tick: Periodic Reset

```go
// Option A: Reset every second (burst detection)
Sampling: &dd.SamplingConfig{
    Enabled: true, Initial: 100, Thereafter: 10,
    Tick: time.Second,
}

// Option B: No reset (global count, long-term reduction)
Sampling: &dd.SamplingConfig{
    Enabled: true, Initial: 1000, Thereafter: 100,
    Tick: 0,
}
```

After Tick reset, the counter resets to zero and re-enters the Initial full-volume phase. Useful for **observing traffic patterns per period**.

## Typical Scenarios

### Scenario 1: HTTP Request Logging

```go
// High-traffic API: first 100 full, then 10% sampled, reset every second
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,
    Thereafter: 10,
    Tick:       time.Second,
}
```

### Scenario 2: Background Task Logging

```go
// Batch processing: first 50 full, then 1 of every 100, no reset
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    50,
    Thereafter: 100,
    Tick:       0,
}
```

### Scenario 3: Debug Mode Toggle

```go
// Normal: sampled
logger.SetSampling(&dd.SamplingConfig{
    Enabled: true, Initial: 10, Thereafter: 50,
})

// Troubleshooting: disable sampling, full logging
logger.SetSampling(nil)

// Fixed: restore sampling
logger.SetSampling(&dd.SamplingConfig{
    Enabled: true, Initial: 10, Thereafter: 50,
})
```

## Thread Safety

Sampling uses atomic operations (`atomic.Int64`) for the counter and a mutex for Tick reset. No additional synchronization needed for concurrent logging from multiple goroutines.

:::tip Fatal logs bypass sampling
Even with sampling enabled, `Fatal`-level logs are **always written** — Fatal must be recorded before program exit and should never be skipped by sampling.
:::

## Next Steps

- [Performance](../../advanced/performance) -- Zero-allocation and buffer pool mechanisms
- [Configuration](../basics/configuration) -- Complete configuration fields
- [Hook System](./hooks) -- BeforeLog hooks can complement sampling

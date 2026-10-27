---
sidebar_label: "Configuration Files"
title: "Configuration Files - CyberGo JSON | Read, Modify & Save"
description: "CyberGo JSON for config files: LoadFromFile, GetString/GetInt nested reads, Set/SetCreate edits, SaveToFile with PrettyConfig, and MergeJSON merging."
sidebar_position: 20
---

# Configuration File Handling

A config file lives through load, read, modify, save, and a reload check. The examples below cover that flow and the two ways to merge defaults with user settings.

## The Full Config-File Lifecycle

Load the config → read nested values → modify → save back to the file → reload and verify. The example uses a temp directory so it runs standalone.

```go
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/cybergodev/json"
)

func main() {
	// Use a temp directory so the example runs standalone
	tmpDir, err := os.MkdirTemp("", "cybergo-config-*")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(tmpDir)

	configPath := filepath.Join(tmpDir, "config.json")

	// Write the initial config file
	initial := `{
        "server": {"host": "0.0.0.0", "port": 8080},
        "database": {"host": "localhost", "port": 5432, "name": "appdb"},
        "logging": {"level": "info"}
    }`
	if err := os.WriteFile(configPath, []byte(initial), 0644); err != nil {
		panic(err)
	}

	// 1. Load the config from the file
	data, err := json.LoadFromFile(configPath)
	if err != nil {
		panic(err)
	}

	// 2. Read nested values (optional default-value parameter supported)
	fmt.Printf("Server address: %s:%d\n", json.GetString(data, "server.host"), json.GetInt(data, "server.port"))
	fmt.Printf("Database: %s/%s\n", json.GetString(data, "database.host"), json.GetString(data, "database.name"))
	fmt.Printf("Log level: %s\n", json.GetString(data, "logging.level", "info"))

	// 3. Modify the config (changing existing values)
	data, err = json.Set(data, "server.port", 9090)
	if err != nil {
		panic(err)
	}
	data, err = json.Set(data, "logging.level", "debug")
	if err != nil {
		panic(err)
	}

	// 4. Save back to the file (pretty-printed)
	if err := json.SaveToFile(configPath, data, json.PrettyConfig()); err != nil {
		panic(err)
	}

	// 5. Reload to verify the changes persisted
	reloaded, err := json.LoadFromFile(configPath)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Port after restart: %d\n", json.GetInt(reloaded, "server.port"))
	fmt.Printf("Log level after restart: %s\n", json.GetString(reloaded, "logging.level"))
}
```

## Merging Default and User Configuration

Applications often overlay user configuration onto built-in defaults, then fill in missing nested paths. `MergeJSON` performs a **deep merge** (user values win), and `SetCreate` creates missing intermediate paths.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// Default configuration (built-in)
	defaults := `{
        "server": {"host": "0.0.0.0", "port": 8080, "timeout": 30},
        "database": {"host": "localhost", "port": 5432, "pool": 10},
        "logging": {"level": "info", "format": "json"}
    }`

	// User configuration (overrides some fields)
	userConfig := `{
        "server": {"port": 3000},
        "database": {"host": "db.prod.example.com"},
        "logging": {"level": "debug"}
    }`

	// Deep merge: user config overrides defaults; default fields not
	// overridden are preserved
	merged, err := json.MergeJSON(defaults, userConfig)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Port: %d (user override)\n", json.GetInt(merged, "server.port"))
	fmt.Printf("Timeout: %d (default preserved)\n", json.GetInt(merged, "server.timeout"))
	fmt.Printf("Database: %s:%d\n", json.GetString(merged, "database.host"), json.GetInt(merged, "database.port"))

	// Add a not-yet-existing nested path with SetCreate (intermediate
	// objects created automatically)
	merged, err = json.SetCreate(merged, "features.metrics.enabled", true)
	if err != nil {
		panic(err)
	}
	merged, err = json.SetCreate(merged, "features.metrics.endpoint", "/metrics")
	if err != nil {
		panic(err)
	}

	fmt.Printf("Metrics toggle: %v\n", json.GetBool(merged, "features.metrics.enabled"))
	fmt.Printf("Metrics endpoint: %s\n", json.GetString(merged, "features.metrics.endpoint"))
}

// Output:
// Port: 3000 (user override)
// Timeout: 30 (default preserved)
// Database: db.prod.example.com:5432
// Metrics toggle: true
// Metrics endpoint: /metrics
```

:::tip
`MergeJSON` is a deep recursive merge: object keys merge level by level, while arrays and scalar values are replaced outright. To merge multiple config sources, `MergeMany([]string{...})` merges them all in one call.
:::

## Choosing a Merge Mode: MergeUnion / MergeIntersection / MergeDifference

`Config.MergeMode` controls the merge strategy, defaulting to `MergeUnion` (union, user values override defaults). The other two modes serve different configuration-management questions:

| Mode | Semantics | Typical config scenario |
|------|-----------|--------------------------|
| `MergeUnion` (default) | Takes the union of both objects; on conflict the user value wins | Regular config overlay: defaults as the base + user overrides |
| `MergeIntersection` | Keeps only keys present on both sides (values from the user side) | Extracting "which shared settings did the user actually change"; aligning multi-environment configs |
| `MergeDifference` | Keeps only keys unique to the base side (first argument) | Finding "which settings still use defaults", for audits or config documentation |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// Same default/user config as the previous section
	defaults := `{
        "server": {"host": "0.0.0.0", "port": 8080, "timeout": 30},
        "database": {"host": "localhost", "port": 5432, "pool": 10},
        "logging": {"level": "info", "format": "json"}
    }`
	user := `{
        "server": {"port": 3000},
        "database": {"host": "db.prod.example.com"},
        "logging": {"level": "debug"}
    }`

	// Intersection: keep only keys appearing on both sides (nested objects
	// intersect recursively; scalars take the user value)
	interCfg := json.DefaultConfig()
	interCfg.MergeMode = json.MergeIntersection
	overridden, err := json.MergeJSON(defaults, user, interCfg)
	if err != nil {
		panic(err)
	}
	fmt.Println("[Intersection] user-overridden port:", json.GetInt(overridden, "server.port"))
	fmt.Println("[Intersection] user-overridden DB host:", json.GetString(overridden, "database.host"))
	// Output:
	// [Intersection] user-overridden port: 3000
	// [Intersection] user-overridden DB host: db.prod.example.com

	// Difference: keep only keys the user did NOT override
	diffCfg := json.DefaultConfig()
	diffCfg.MergeMode = json.MergeDifference
	untouched, err := json.MergeJSON(defaults, user, diffCfg)
	if err != nil {
		panic(err)
	}
	fmt.Println("[Difference] still-default host:", json.GetString(untouched, "server.host"))
	fmt.Println("[Difference] still-default timeout:", json.GetInt(untouched, "server.timeout"))
	fmt.Println("[Difference] still-default pool:", json.GetInt(untouched, "database.pool"))
	// Output:
	// [Difference] still-default host: 0.0.0.0
	// [Difference] still-default timeout: 30
	// [Difference] still-default pool: 10
}
```

:::tip
`MergeMany` also reads `cfg.MergeMode` (merging left to right one by one). The full effect of union mode is in the previous section. Both non-default modes take the first argument as the base: intersection answers "what changed", difference answers "what is still unchanged".
:::

## Next Steps

- [Basic Examples](./index) — path queries, modification, struct encoding/decoding basics
- [Cheat Sheet](../getting-started/cheatsheet) — Quick API reference
- [Path Expression Syntax](../getting-started/path-syntax) — The complete path syntax (incl. slices, wildcards)
- [Utility Functions](../api-reference/helpers) — `MergeJSON`, `CompareJSON`, and other utilities

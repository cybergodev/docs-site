---
sidebar_label: "并发与生命周期"
title: "并发与生命周期 - CyberGo env | 单例与进程环境管理"
description: "CyberGo env 并发与生命周期指南：Load 一次性初始化全局单例，未初始化时读写返回默认值或 ErrNotInitialized；Apply/Close/Delete 管理实例与进程环境；分片存储与无锁单键读保障多 goroutine 并发安全。"
sidebar_position: 9
---

# 并发与生命周期

env 库的全部公开 API 都是并发安全的，可以在多个 goroutine 之间自由共享同一个 `Loader`。但「并发安全」不等于「生命周期可以随意对待」：全局单例如何初始化与重置、`Apply`/`Close`/`Delete` 对进程环境（`os.Environ`）各自做什么、并发写同名键时谁获胜——这些语义决定了程序在长时间运行和测试隔离下的行为。本指南逐一说明。

## 全局模式的生命周期

### 一次性初始化

`Load()` 与 `LoadWithConfig()` 负责初始化包级默认加载器（单例）。这是一个**显式初始化**的单例：不存在惰性自动创建，`setDefaultLoader` 在互斥锁下检查并只允许设置一次，重复调用返回 `ErrAlreadyInitialized`（此时新建的 loader 会被立即关闭清理）：

```go
if err := env.Load(".env"); err != nil {
    log.Fatal(err)
}

// 第二次初始化被拒绝
err := env.Load(".env.local")
fmt.Println(errors.Is(err, env.ErrAlreadyInitialized)) // 输出：true
```

多个 goroutine 并发调用 `Load()` 也是安全的：互斥锁保证恰好一个调用成功，其余得到 `ErrAlreadyInitialized`。

注意 `Load()` 会**强制** `AutoApply = true`——所有加载到的变量会立即写入进程环境（`LoadWithConfig` 同样强制此行为，即使你传入的配置里写的是 `false`）。这是包级读函数正常工作的前提。需要手动控制应用时机时，改用实例模式 `New()`，其默认 `AutoApply` 为 `false`。

### 未初始化时的行为

在调用 `Load()`/`LoadWithConfig()` 之前使用包级函数，行为按「读静默、写报错」分化：

| 操作 | 未初始化时的行为 |
|------|------------------|
| `GetString` / `GetInt` / `GetBool` 等 Get* | 返回提供的默认值（或零值），**不报错** |
| `Lookup` | 返回 `("", false)` |
| `Keys` / `All` / `Len` / `GetSecure` | 返回 `nil` / `0` / `nil` |
| `Set` / `Delete` / `Validate` / `ParseInto` | 返回 `ErrNotInitialized` |

::: warning 注意
未初始化时读函数静默返回默认值，配置拼错键名、忘记调用 `Load()` 都不会产生任何错误信号——最终表现往往是「程序用默认配置跑起来了」。如果出现这种情况，先检查启动路径是否真正执行了 `Load()`，以及在测试中是否有其他用例调用过 `ResetDefaultLoader()`。
:::

### ResetDefaultLoader：重置单例

`ResetDefaultLoader()` 原子地换出当前单例并关闭旧 loader，返回关闭时产生的错误（没有设置过单例或关闭成功时返回 `nil`）。它自身并发安全：旧 loader 的 `Close` 在锁外执行，避免持锁做慢速清理。

```go
if err := env.ResetDefaultLoader(); err != nil {
    log.Printf("warning: failed to reset loader: %v", err)
}
```

重置后可以再次调用 `Load()` 重新初始化。该函数的定位是**测试隔离与程序启动阶段**：正常运行的应用初始化一次后不应反复重置——重置与重新初始化之间，包级函数会短暂处于未初始化状态（读操作返回默认值，写操作返回 `ErrNotInitialized`）。

::: warning 注意
`ResetDefaultLoader()` 关闭旧 loader，但**不会撤销**该 loader 已经应用到进程环境的变量（见下文 `Close` 的语义）。测试若需要干净的进程环境，还要自行 `os.Unsetenv` 或使用实例模式。
:::

## Loader 实例的生命周期

### 创建：New()

`New()` 创建完全独立的 loader 实例：不设置全局单例、不应用任何变量到进程环境（除非 `cfg.AutoApply = true`）、可多次调用互不影响。配置了 `Filenames` 时会在创建时自动加载这些文件。典型生命周期是 **创建 → 加载 → 应用 → 使用 → 关闭**：

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
// ... 使用 loader ...
```

### 应用到进程环境：Apply()

`Apply()` 把内存中的变量写入进程环境。对**进程环境已存在**的键（用 `LookupEnv` 判断，能正确区分「未设置」与「显式空串」），默认（`OverwriteExisting = false`）直接跳过不覆盖；只有 `OverwriteExisting = true` 时才会改写。

每个被本 loader 实际写入进程环境的键都会记录在内部的 `appliedKeys` 集合中——这是 `Delete()` 能精确撤销的依据。

启用 `AutoApply` 后无需手动调用 `Apply()`：加载文件、`Set` 单个键时都会立即同步到进程环境。

### 关闭：Close()

`Close()` 安全清零内存中存储的全部值（敏感值按字节清零），并在 loader 拥有自己的组件工厂时一并关闭它。`Close` 是幂等的：对已关闭或 `nil` 的 loader 再次调用不报错。

关键语义：**`Close()` 只清内存，不撤销进程环境**。此前通过 `Apply`、`AutoApply` 或带 `AutoApply` 的 `Set` 写入进程环境的变量会原样保留——需要在关闭前从进程环境移除，请逐键调用 `Delete()`。

关闭后的行为一览：

| 操作 | 关闭后的行为 |
|------|--------------|
| `Lookup` / `GetSecure` | `("", false)` / `nil`，不报错 |
| `GetString` / `GetInt` 等 Get* | 返回默认值（或零值） |
| `Keys` / `All` / `Len` / `ParseInto` | 返回 `nil` / `0` / `ErrClosed` |
| `Set` / `Delete` / `Apply` / `LoadFiles` / `Validate` | 返回 `ErrClosed` |
| `Close` / `IsClosed` | 幂等返回 `nil` / `true` |

### 按键撤销：Delete()

`Delete(key)` 做两件事：从 loader 内存中移除该键；**仅当这个键是本 loader 写入进程环境的时候**（命中 `appliedKeys` 追踪）才同步 `Unsetenv`。

这个按键追踪是有意设计：如果只要「应用过」就全量 unset，会把 `HOME`、`TERM` 等 loader 从未拥有的外来进程变量一并破坏。因此删除一个 loader 从未应用的键，进程环境完全不受影响。

### 生命周期完整示例

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/env"
)

func main() {
	// 准备演示用配置文件
	const file = "lifecycle_demo.env"
	if err := os.WriteFile(file, []byte("MY_APP_MODE=demo\n"), 0o600); err != nil {
		panic(err)
	}
	defer os.Remove(file)

	cfg := env.DefaultConfig() // AutoApply=false：需要手动 Apply
	cfg.Filenames = nil        // 稍后用 LoadFiles 显式加载

	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}

	// 加载到内存（尚未写入进程环境）
	if err := loader.LoadFiles(file); err != nil {
		panic(err)
	}

	// 写入进程环境
	if err := loader.Apply(); err != nil {
		panic(err)
	}
	mode, ok := os.LookupEnv("MY_APP_MODE")
	fmt.Println("after Apply, in process:", mode, ok)

	// Close：清零内存，但进程环境中的变量保留
	if err := loader.Close(); err != nil {
		panic(err)
	}
	_, ok = loader.Lookup("MY_APP_MODE")
	fmt.Println("after Close, in loader:", ok)
	mode, ok = os.LookupEnv("MY_APP_MODE")
	fmt.Println("after Close, in process:", mode, ok)
	// 输出：
	// after Apply, in process: demo true
	// after Close, in loader: false
	// after Close, in process: demo true
}
```

`Delete()` 的按键保护可以用下面的例子验证：

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/env"
)

func main() {
	// 进程中原本存在的外来变量（模拟 HOME/TERM 等系统变量）
	if err := os.Setenv("FOREIGN_VAR", "keep"); err != nil {
		panic(err)
	}
	defer os.Unsetenv("FOREIGN_VAR")

	cfg := env.DefaultConfig()
	cfg.AutoApply = true // Set 时直接写入进程环境
	cfg.Filenames = nil

	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}
	defer loader.Close()

	if err := loader.Set("MY_APP_TOKEN", "secret"); err != nil {
		panic(err)
	}

	// 删除本 loader 写入的键：内存与进程环境一并移除
	if err := loader.Delete("MY_APP_TOKEN"); err != nil {
		panic(err)
	}
	_, tokenInProc := os.LookupEnv("MY_APP_TOKEN")

	// 删除非本 loader 写入的键：进程环境不受影响
	if err := loader.Delete("FOREIGN_VAR"); err != nil {
		panic(err)
	}
	_, foreignInProc := os.LookupEnv("FOREIGN_VAR")

	fmt.Println("MY_APP_TOKEN in process:", tokenInProc)
	fmt.Println("FOREIGN_VAR in process:", foreignInProc)
	// 输出：
	// MY_APP_TOKEN in process: false
	// FOREIGN_VAR in process: true
}
```

## 并发安全模型

env 库从底层存储到全局单例都为并发而设计，全部公开 API 可被多个 goroutine 同时调用，无需外部同步，并通过 `-race` 竞态检测的持续验证。分层机制如下：

| 层次 | 机制 |
|------|------|
| 变量存储（secureMap） | 8 分片、每分片独立 RWMutex，降低锁竞争；原子计数支持 O(1) 的 `Len()` |
| 单键读（`Lookup` / `GetSecure`，Get* 均基于 `Lookup`） | 无锁快速路径：以原子位检查关闭状态（`closedFast`）+ 分片内部锁，不获取 loader 级互斥锁 |
| 多键快照（`All` / `Keys` / `ParseInto`） | 持读锁，保证跨分片的一致性快照 |
| 写操作（`Set` / `Delete` / `Apply`） | loader 级写锁；`OverwriteExisting = true` 且未启用 `AutoApply` 的 `Set` 走读锁快速路径 |
| 全局单例 | 原子指针读取（读路径无锁），`Load` 与 `ResetDefaultLoader` 在锁下设置/换出 |
| `SecureValue` | 互斥锁保护数据访问 + 原子关闭位；并发 `Release` 安全 |

### 与 Close 并发竞争

读操作与 `Close()` 并发时是**优雅降级**而非竞态崩溃：单键读要么观察到关闭前的值，要么观察到清零后的状态（默认值/`("", false)`/`nil`），不会 panic 或读到撕裂数据。多键快照要么拿到关闭前的一致快照，要么在关闭后返回零值/`ErrClosed`。

### 并发写与 OverwriteExisting

`Set` 对已存在键的行为由 `OverwriteExisting` 决定：

| 配置 | `Set` 已存在键的行为 |
|------|---------------------|
| `false`（`DefaultConfig` / `ProductionConfig`） | 静默跳过，首次写入获胜，不报错 |
| `true`（`DevelopmentConfig` / `TestingConfig`） | 覆盖写入 |

因此**多个 goroutine 反复写同一个键**时，若希望「最后一次写入获胜」，必须使用 `OverwriteExisting = true` 的配置（如 `DevelopmentConfig`），否则只有第一次写入生效，后续写入全部被静默跳过。

### 多 goroutine 并发读写示例

```go
package main

import (
	"fmt"
	"sync"

	"github.com/cybergodev/env"
)

func main() {
	cfg := env.DevelopmentConfig() // OverwriteExisting=true，重复 Set 生效
	cfg.Filenames = nil            // 不加载文件，保证输出确定

	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}
	defer loader.Close()

	if err := loader.Set("APP_NAME", "demo"); err != nil {
		panic(err)
	}

	var wg sync.WaitGroup

	// 8 个 goroutine 并发写各自的键
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

	// 同时并发读既有键
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
	// 输出：
	// APP_NAME = demo
	// total keys: 9
}
```

## 全局模式完整示例

下面的示例完整走一遍单例的生命周期：未初始化行为 → 一次性初始化 → 拒绝重复初始化 → 重置后重新初始化。

```go
package main

import (
	"errors"
	"fmt"
	"os"

	"github.com/cybergodev/env"
)

func main() {
	// 准备演示用配置文件
	const file = ".env.global-demo"
	if err := os.WriteFile(file, []byte("GL_PORT=9000\n"), 0o600); err != nil {
		panic(err)
	}
	defer os.Remove(file)

	// 1) 尚未初始化：读操作静默返回默认值，写操作报 ErrNotInitialized
	fmt.Println("before Load, port =", env.GetInt("GL_PORT", 8080))
	if err := env.Set("GL_PORT", "9090"); err != nil {
		fmt.Println("before Load, Set is ErrNotInitialized:",
			errors.Is(err, env.ErrNotInitialized))
	}

	// 2) 一次性初始化（强制 AutoApply，变量进入进程环境）
	if err := env.Load(file); err != nil {
		panic(err)
	}
	fmt.Println("after Load, port =", env.GetInt("GL_PORT"))
	_, inProc := os.LookupEnv("GL_PORT")
	fmt.Println("GL_PORT in process:", inProc)

	// 3) 重复初始化被拒绝
	err := env.Load(file)
	fmt.Println("second Load is ErrAlreadyInitialized:",
		errors.Is(err, env.ErrAlreadyInitialized))

	// 4) 重置单例后可重新初始化
	if err := env.ResetDefaultLoader(); err != nil {
		panic(err)
	}
	if err := env.Load(file); err != nil {
		panic(err)
	}
	fmt.Println("reloaded, port =", env.GetInt("GL_PORT"))
	// 输出：
	// before Load, port = 8080
	// before Load, Set is ErrNotInitialized: true
	// after Load, port = 9000
	// GL_PORT in process: true
	// second Load is ErrAlreadyInitialized: true
	// reloaded, port = 9000
}
```

## 测试间重置单例

全局单例会跨越测试用例存在——上一个用例 `Load()` 过的 loader 会泄漏到下一个用例（表现为 `ErrAlreadyInitialized` 或读到旧值）。标准做法是在 TestMain 里统一重置：

```go
func TestMain(m *testing.M) {
	// 进入前清理：隔离其他来源可能遗留的单例
	_ = env.ResetDefaultLoader()

	code := m.Run()

	// 退出前清理：关闭本次测试初始化的 loader
	_ = env.ResetDefaultLoader()
	os.Exit(code)
}
```

需要全局模式的用例内部再自行 `Load()`。由于 `Load` 强制 `AutoApply = true` 且 `Close` 不撤销进程环境，测试中还要用 `t.Cleanup` 清理写入的进程变量；更彻底的隔离方案（独立实例、内存文件系统、表驱动等）见[测试场景](./testing)。

## 常见陷阱

| 陷阱 | 后果 | 正确做法 |
|------|------|----------|
| 在不同代码路径重复调用 `Load()` | 第二次起返回 `ErrAlreadyInitialized` | 只在 `main`/TestMain 初始化一次；测试用 `ResetDefaultLoader()` |
| 未初始化时依赖 Get* 报错发现配置问题 | 读函数静默返回默认值，问题被掩盖 | 启动后调用 `Validate()`，或用 `Lookup`/`Set`（写路径会返回 `ErrNotInitialized`）显式确认 |
| `Close()` 后期望进程环境恢复原状 | 已应用变量仍留在进程环境 | 关闭前逐键 `Delete()`，或启用 `OverwriteExisting` 前评估影响 |
| 并发/反复写同键但未开 `OverwriteExisting` | 后续写入被静默跳过，读到旧值 | 使用 `DevelopmentConfig`/`TestingConfig` 或显式 `cfg.OverwriteExisting = true` |
| 为同一份配置反复 `New()` 多个 loader | 重复资源、进程环境来源混乱 | 共享一个 loader（并发安全），或用全局模式 |
| 忘记 `Close()` 实例 loader | 内存中的敏感值延迟到 GC 才清零 | `defer loader.Close()` |

## 下一步

- [测试场景](./testing)——`TestingConfig`、内存文件系统与更完整的测试隔离模式
- [性能优化](../advanced/performance)——分片存储与无锁读路径的基准数据与调优细节
- [Loader API 参考](../api-reference/loader)——`Apply`/`Close`/`Delete` 等方法的完整签名与错误语义

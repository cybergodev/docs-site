---
sidebar_label: "内存锁定"
title: "内存锁定 - CyberGo env | mlock 内存保护"
description: "CyberGo env 内存锁定指南，详解 SetMemoryLockEnabled 启用、IsMemoryLockSupported 检测与 SetMemoryLockStrict 严格模式，阐述 mlock 防止敏感数据被交换到磁盘的原理与 SecureValue 生命周期管理实践。"
sidebar_position: 3
---

# 内存锁定

内存锁定（mlock / VirtualLock）防止敏感数据被交换到磁盘，是 SecureValue 安全体系的核心防线之一。

## 为什么需要内存锁定

正常情况下，操作系统会将不活跃的内存页交换到磁盘（swap file / page file）。这意味着即使你在代码中调用了 `ClearBytes` 清零内存，磁盘上仍可能留有敏感数据的残留副本。

```text
内存 (RAM)                      磁盘 (Swap/Page File)
┌──────────────┐                ┌──────────────┐
│ API_KEY=xxx  │ ── 交换 ──→    │ API_KEY=xxx  │ ← 残留！
│              │                │ (即使清零后    │
│              │ ←─ 读回 ──     │  仍存在于此)  │
└──────────────┘                └──────────────┘
```

启用内存锁定后，操作系统保证这些内存页**不会被换出**：

```text
内存 (RAM)                      磁盘 (Swap/Page File)
┌──────────────┐                ┌──────────────┐
│ API_KEY=xxx  │ ╳ 不可交换 ╳   │              │
│ 🔒 mlock     │                │ (无残留)      │
└──────────────┘                └──────────────┘
```

## 平台支持

| 平台 | 系统调用 | 支持状态 |
|------|----------|:--------:|
| Linux | `mlock(2)` / `munlock(2)` | ✅ |
| macOS | `mlock(2)` / `munlock(2)` | ✅ |
| Windows | `VirtualLock` / `VirtualUnlock` | ✅ |
| 其他平台（FreeBSD/其他 BSD、Solaris、WASM 等） | 不适用 | ❌（no-op 降级） |

Linux、macOS 与 Windows 之外的平台为 no-op 降级：`IsMemoryLockSupported()` 返回 `false`，启用锁定也不会生效（锁定尝试直接返回「平台不支持」错误）——SecureValue 仍可正常使用，但启用锁定后 `Masked()` 会显示 `lock-failed`；未启用锁定时不附加任何锁定状态。

运行时检测：

```go
if env.IsMemoryLockSupported() {
    fmt.Println("当前平台支持内存锁定")
} else {
    fmt.Println("当前平台不支持内存锁定（如 wasm）")
}
```

## 权限要求

内存锁定涉及系统资源限制，不同平台需要不同权限：

### Linux

需要 `CAP_IPC_LOCK` 能力：

```bash
# 方式一：通过 setcap 赋予二进制文件
sudo setcap cap_ipc_lock=ep ./myapp

# 方式二：通过 systemd 服务
# /etc/systemd/system/myapp.service
[Service]
CapabilityBoundingSet=CAP_IPC_LOCK
AmbientCapabilities=CAP_IPC_LOCK

# 方式三：ulimit 调整（RLIMIT_MEMLOCK）
# /etc/security/limits.conf
*    soft    memlock    unlimited
*    hard    memlock    unlimited
```

### macOS

通常无需特殊权限，但受 `ulimit -l`（最大锁定内存）限制。

### Windows

`VirtualLock` 对**超过 30 页**的分配才需要 `SeLockMemoryPrivilege`（「锁定内存中的页面」）权限；较小的分配通常无需该特权即可直接锁定：

```text
组策略 → 计算机配置 → Windows 设置 → 安全设置 →
本地策略 → 用户权限分配 → "锁定内存中的页面"
```

::: warning 无权限时的行为
默认模式下，内存锁定失败会被**静默忽略**——SecureValue 仍然可用，但数据未被锁定。如需确保锁定成功，请使用严格模式。
:::

## 基本用法

### 启用内存锁定

在应用启动时、创建任何 SecureValue 之前调用：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	// 检查平台支持
	if !env.IsMemoryLockSupported() {
		fmt.Println("警告：当前平台不支持内存锁定")
	}

	// 全局启用内存锁定
	env.SetMemoryLockEnabled(true)

	// 加载配置
	if err := env.Load(".env"); err != nil {
		panic(err)
	}

	// 此后所有 SecureValue 都会尝试锁定内存
	secret := env.GetSecure("API_KEY")
	if secret != nil {
		defer secret.Release()
		fmt.Println(secret.Masked()) // [SECURE:32 bytes locked]（N 取决于实际值长度）
	}
}
```

### 检查锁定状态

```go
sv := env.GetSecure("DB_PASSWORD")
defer sv.Release()

// 检查是否已锁定
if sv.IsMemoryLocked() {
    fmt.Println("内存已锁定，不会被交换到磁盘")
} else {
    fmt.Println("内存未锁定")
}

// 查看锁定错误（如果有）
if err := sv.MemoryLockError(); err != nil {
    fmt.Printf("锁定失败: %v\n", err)
}
```

## 严格模式

默认模式下，锁定失败被静默忽略。严格模式让失败变得可观测：

### 启用严格模式

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

// 此后如果锁定失败，会输出到标准日志：
// env: memory lock failed in strict mode: operation not permitted
```

### 显式错误处理

使用 `NewSecureValueStrict` 在创建时获取锁定错误：

```go
env.SetMemoryLockEnabled(true) // 错误返回只取决于「已启用锁定且锁定失败」

sv, err := env.NewSecureValueStrict("my-api-key")
if err != nil {
    // 内存锁定失败
    // SecureValue 仍然有效，但数据未受锁定保护
    log.Printf("安全警告：内存锁定失败: %v", err)
}
defer sv.Release()

// 正常使用
fmt.Println(sv.Masked())
```

::: tip 与 SetMemoryLockStrict 无关
`NewSecureValueStrict` 的错误返回只取决于 `SetMemoryLockEnabled(true)` 且锁定失败，与严格模式开关无关；`SetMemoryLockStrict` 控制的是锁定失败时是否向 stderr 输出告警（对任何构造路径生效）——对无法返回错误的非严格构造器（如 `NewSecureValue`），这条告警是唯一的失败信号。
:::

::: tip 严格模式行为
严格模式下，锁定失败会触发 `onStrictLockFailure` 回调（默认输出到 stderr）。SecureValue 本身始终有效可用——严格模式只是让锁定失败变得**可观测**，而非阻止使用。
:::

## Masked 输出与锁定状态

`Masked()` 会在输出中包含锁定状态——**三种锁定状态仅在 `SetMemoryLockEnabled(true)` 时附加**；空值与已关闭另有专属输出：

```go
env.SetMemoryLockEnabled(true)

sv := env.GetSecure("API_KEY")
defer sv.Release()

fmt.Println(sv.Masked())
// 锁定成功：    [SECURE:32 bytes locked]      // 创建时已启用锁定且锁定成功
// 锁定失败：    [SECURE:32 bytes lock-failed] // 已启用锁定但失败（权限不足/平台不支持）
// 从未尝试锁定：[SECURE:32 bytes unlocked]    // 值在启用锁定之前创建
// 未启用锁定：  [SECURE:32 bytes]             // 不附加任何锁定状态
// 空值：        [SECURE:0 bytes]
// 已关闭：      [CLOSED]
```

## 完整生产示例

```go
package main

import (
	"log"
	"os"

	"github.com/cybergodev/env"
)

func main() {
	// ── 初始化安全配置 ──

	if env.IsMemoryLockSupported() {
		env.SetMemoryLockEnabled(true)
		env.SetMemoryLockStrict(true) // 生产环境启用严格模式
		log.Println("内存锁定已启用（严格模式）")
	} else {
		log.Println("警告：平台不支持内存锁定")
	}

	// ── 加载配置 ──

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

	// ── 安全访问敏感值 ──

	// GetSecure 返回防御性副本：Release 该副本不影响 Loader 内部存储
	dbPassword := loader.GetSecure("DB_PASSWORD")
	if dbPassword == nil {
		log.Fatal("DB_PASSWORD not found")
	}
	defer dbPassword.Release()

	// 检查锁定状态
	if !dbPassword.IsMemoryLocked() {
		log.Printf("安全警告：DB_PASSWORD 未锁定")
		if err := dbPassword.MemoryLockError(); err != nil {
			log.Printf("原因: %v", err)
		}
	}

	// 仅在需要时获取明文：Reveal 返回新的 string 副本，
	// 不受内存锁定保护、也无法清零——用毕即弃，缩短持有窗口
	password := dbPassword.Reveal()
	_ = password // 用于数据库连接等

	// 安全日志（不泄露明文）
	log.Printf("数据库密码: %s", dbPassword.Masked())
	// 输出：数据库密码：[SECURE:12 bytes locked]（N 取决于实际值长度）

	_ = os.Stdout
}
```

## 最佳实践

### 及时释放

锁定内存会增加内存压力（无法被换出），应在使用完毕后立即释放。即使忘记释放，被弃用且未关闭的 SecureValue 也会由 GC 的 finalizer 兜底清零——但这只是最后防线，不应依赖，请始终显式 `Release()`：

```go
// ✅ 推荐：用完即释放
sv := env.GetSecure("API_KEY")
defer sv.Release()
value := sv.Reveal()
// 使用 value...
// defer 触发时自动清零 + 解锁 + 归还对象池

// ❌ 避免：长时间持有
var globalSecret *env.SecureValue // 不推荐
```

### 保持小而短命

锁定大块内存会影响系统性能。每个 SecureValue 应仅存储必要的敏感值（密码、密钥、令牌），而非整个配置块。

### 明文副本不受锁定保护

`Reveal()` 返回的是**新的 string 副本**——不受 mlock 保护，也无法清零（string 不可变）。明文应**用毕即弃**、尽量缩短持有窗口；需要可清零的明文时，改用 `Bytes()` 获取 `[]byte` 副本并在用完后 `ClearBytes` 清零：

```go
// string 副本：无法清零，用毕即弃、缩短持有窗口
password := sv.Reveal()

// 需要清零时：Bytes() + ClearBytes
raw := sv.Bytes()
defer env.ClearBytes(raw)
```

### 优先使用 Release 而非 Close

```go
sv := env.GetSecure("TOKEN")

// ✅ Release：清零 + 解锁 + 归还对象池（推荐）
defer sv.Release()

// Close 也可以，但不归还对象池
// defer sv.Close()
```

## 故障排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| `lock-failed` 在 Masked 输出中 | 权限不足 | 配置 `CAP_IPC_LOCK`（Linux）或 `SeLockMemoryPrivilege`（Windows） |
| 严格模式日志刷屏 | 大量 SecureValue 创建时锁定失败 | 检查系统 `RLIMIT_MEMLOCK` 限制，或使用非严格模式 |
| `IsMemoryLockSupported()` 返回 false | 所有非 Linux/macOS/Windows 平台（含 FreeBSD/其他 BSD、Solaris、WASM） | 这些平台不支持内存锁定（no-op 降级），使用其他安全措施（如加密存储） |
| 内存使用量增加 | 锁定页无法换出 | 减少 SecureValue 持有时间，及时 Release |

## 相关文档

- [安全概述](./) - 安全架构总览
- [SecureValue API](../api-reference/secure-value) - 安全值完整 API（含内存锁定函数）
- [性能优化](../advanced/performance) - 内存锁定性能开销分析
- [生产检查清单](./production-checklist) - 上线前安全检查

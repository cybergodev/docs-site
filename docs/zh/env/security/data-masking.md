---
sidebar_label: "敏感数据脱敏"
title: "敏感数据脱敏 - CyberGo env | 日志安全工具"
description: "CyberGo env 敏感数据脱敏工具完整指南，详解 IsSensitiveKey 自动检测密码密钥等敏感键、MaskValue 按敏感性脱敏值、MaskKey 脱敏键名、SanitizeForLog 清理日志字符串与 ClearBytes 安全清零。"
sidebar_position: 2
---

# 敏感数据脱敏

env 提供一组**独立于 Loader 的实用工具函数**，用于在日志、错误信息和调试输出中防止敏感数据泄露。这些函数无需创建 Loader 即可直接调用，适用于任何需要安全记录配置的场景。

## 为什么需要脱敏

即使你用 [SecureValue](../api-reference/secure-value) 妥善保护了内存中的敏感值，它们仍可能在三个环节泄露：

- **应用日志** —— 直接打印配置、请求参数、连接字符串
- **错误消息** —— panic / error 把密钥带进日志收集系统
- **调试输出** —— `fmt.Println` 调试时随手打印环境变量

```text
log.Printf("加载配置 DB_PASSWORD=%s", pwd)          ← 日志泄露
panic("connect failed: password=hunter2")           ← 错误泄露
fmt.Println(env.GetString("API_KEY"))               ← 调试泄露
```

一旦这些输出进入日志聚合系统（ELK、Datadog……）或被团队成员、运维、甚至攻击者看到，密钥就等于失窃。env 的脱敏工具让你在记录时**自动遮蔽敏感内容**，从源头堵住泄露。

## 函数详解

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

大小写不敏感地检查 `key` 是否包含敏感模式。检测采用**子串匹配**——只要键名（转为大写后）包含任一内置模式即判定为敏感。

**内置检测模式：**

| 类别 | 模式 |
|------|------|
| 认证类 | `PASSWORD`、`SECRET`、`TOKEN`、`AUTH`、`CREDENTIAL`、`PASSPHRASE`、`SESSION`、`COOKIE` |
| 密钥类 | `API_KEY`、`APIKEY`、`ACCESS_KEY`、`SECRET_KEY`、`PRIVATE_KEY`、`PUBLIC_KEY` |
| 加密类 | `PRIVATE`、`ENCRYPTION_KEY`、`ENCRYPT_KEY`、`DECRYPT_KEY`、`SIGNING_KEY`、`SIGN_KEY`、`VERIFY_KEY` |
| 金融 / PII | `SSN`、`SOCIAL_SECURITY`、`CREDIT_CARD`、`CARD_NUMBER`、`CVV`、`CVC`、`CCV`、`PAN` |
| 加密货币 | `MNEMONIC`、`SEED`、`RECOVERY`、`WALLET`、`PRIVATE_ADDRESS` |
| 基础设施 | `CONNECTION_STRING`、`CONN_STRING`、`DATABASE_URL`、`DB_PASSWORD` |
| 云服务 | `AWS_SECRET`、`AZURE_KEY`、`GCP_KEY`、`SERVICE_ACCOUNT` |

::: tip 子串匹配的含义
`IsSensitiveKey("MY_API_KEY_TOKEN")` 会匹配到 `API_KEY` 和 `TOKEN`，返回 true。这意味着 `AUTHORIZATION` 也会因包含 `AUTH` 而被判定敏感——这正是期望的保守行为。
:::

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// 认证与密钥类
	fmt.Println(env.IsSensitiveKey("DB_PASSWORD"))  // true
	fmt.Println(env.IsSensitiveKey("API_KEY"))      // true
	fmt.Println(env.IsSensitiveKey("ACCESS_TOKEN")) // true

	// 大小写不敏感
	fmt.Println(env.IsSensitiveKey("api_key")) // true
	fmt.Println(env.IsSensitiveKey("ApiKey"))  // true

	// 非敏感键
	fmt.Println(env.IsSensitiveKey("PORT"))    // false
	fmt.Println(env.IsSensitiveKey("DB_HOST")) // false
}
```

### MaskValue

```go
func MaskValue(key, value string) string
```

根据 `key` 的敏感性对 `value` 脱敏，适合记录配置键值对：

| 条件 | 返回值 |
|------|--------|
| `IsSensitiveKey(key)` 为 true | `[MASKED:N chars]`（N = `len(value)`） |
| 非敏感且 `len(value) ≤ 20` | 原始值 |
| 非敏感且 `len(value) > 20` | `value[:17] + "..."` |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// 敏感值 → 脱敏（保留长度信息便于排查）
	fmt.Println(env.MaskValue("DB_PASSWORD", "p@ssw0rd123"))
	// 输出: [MASKED:11 chars]

	// 非敏感短值 → 原样返回
	fmt.Println(env.MaskValue("PORT", "8080"))
	// 输出: 8080

	// 非敏感长值（>20 字符）→ 截断
	fmt.Println(env.MaskValue("DESCRIPTION", "this-is-a-very-long-description-value"))
	// 输出: this-is-a-very-lo...
}
```

::: tip 保留长度的用意
`[MASKED:N chars]` 暴露的是值的长度而非内容。这在排查「密码是否被截断」「密钥是否完整」时很有用，同时不泄露明文。
:::

### MaskKey

```go
func MaskKey(key string) string
```

脱敏键名本身，用于需要展示键存在但不暴露键含义的场景（公开 API `MaskKey` 即内部脱敏例程的包装，与错误报告共用同一实现；审计日志不使用 `MaskKey`——审计中的键值掩码走 `MaskValue` 的 `[MASKED:N chars]`）：

| 条件 | 返回值 |
|------|--------|
| `len(key) ≤ 3` | `***` |
| `len(key) > 3` | `key[:2] + "***"` |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	fmt.Println(env.MaskKey("DB_PASSWORD")) // DB***
	fmt.Println(env.MaskKey("API_KEY"))     // AP***
	fmt.Println(env.MaskKey("TOKEN"))       // TO***
	fmt.Println(env.MaskKey("AB"))          // ***
	fmt.Println(env.MaskKey("XYZ"))         // ***（长度 ≤ 3）
}
```

::: warning 与 MaskValue 的搭配
`MaskKey` 只取键名前 2 个字符，因此 `DB_HOST` 和 `DB_PASSWORD` 都会变成 `DB***`。若需在日志中区分两者，请配合 `MaskValue` 一同输出，或仅在键名无关紧要时单独使用。
:::

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

**先截断、再掩码**的两级处理：先对超过 50 字符的长字符串截断（防止日志过长或间接泄露信息），再对结果调用 [`SanitizeForLog`](#sanitizeforlog) 掩码敏感键值——纯截断会让 `password=...` 原样留在日志里（SEC-04 修复）：

| 条件 | 返回值 |
|------|--------|
| `len(s) > 50` | `SanitizeForLog(s[:47] + "...")` |
| 否则 | `SanitizeForLog(s)` |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// 第一级：超过 50 字符先截断
	long := "012345678901234567890123456789012345678901234567890123456789"
	fmt.Println(env.MaskSensitiveInString(long))
	// 输出: 012345678901234567890123456789012345678901234567...

	// 第二级：截断（或未触发截断）后仍会掩码敏感键值
	s := "connect failed: user=admin password=hunter2"
	fmt.Println(env.MaskSensitiveInString(s))
	// 输出: connect failed: user=admin password=[MASKED]

	short := "hello world"
	fmt.Println(env.MaskSensitiveInString(short))
	// 输出: hello world
}
```

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

扫描字符串中的 `key=value` 模式，对敏感键值对**保留键名与分隔符、仅把值替换为 `[MASKED]`**，同时移除控制字符（保留 `\n` 和 `\t`）。适合处理连接字符串、错误消息等内联键值。

**检测的赋值模式：** `password=`、`secret=`、`token=`、`auth=`、`credential=`、`passphrase=`、`session=`、`cookie=`、`api_key=`、`apikey=`、`access_key=`、`secret_key=`、`private_key=`、`public_key=`、`encrypt_key=`、`decrypt_key=`、`signing_key=`、`ssn=`、`credit_card=`、`card_number=`、`cvv=`、`cvc=`、`mnemonic=`、`seed=`、`recovery=`、`wallet=`、`connection_string=`、`database_url=`、`db_password=`

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	fmt.Println(env.SanitizeForLog("user=admin password=s3cret"))
	// 输出: user=admin password=[MASKED]

	fmt.Println(env.SanitizeForLog("token=abc123 host=localhost"))
	// 输出: token=[MASKED] host=localhost

	// 多个敏感值全部脱敏
	fmt.Println(env.SanitizeForLog("user=pguser password=hunter2 api_key=sk_123"))
	// 输出: user=pguser password=[MASKED] api_key=[MASKED]
}
```

::: tip 替换粒度
`SanitizeForLog` 保留 `password=` 的键名与分隔符，仅把值 `s3cret` 替换为 `[MASKED]`。键名与键值结构在日志中仍可见（能看出存在哪些配置项），但敏感值本身不会泄露。
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

将字节切片全部置零。用于手动清理由 `Reveal()` 获取、并以 `[]byte` 形式处理的敏感数据，避免明文在内存中残留。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// 模拟以 []byte 形式处理的敏感数据
	secret := []byte("secret123")
	fmt.Printf("清零前: %s\n", secret)
	// 输出: 清零前: secret123

	env.ClearBytes(secret)
	fmt.Printf("清零后: %q\n", secret)
	// 输出: 清零后: "\x00\x00\x00\x00\x00\x00\x00\x00\x00"
}
```

::: warning ClearBytes 的局限
`ClearBytes` 只清零你传入的那个切片。如果同一份敏感数据被多次复制（如 string 与 []byte 之间的转换会产生新副本），这些副本无法被一并清零。敏感数据应尽量减少复制，并配合 [SecureValue](../api-reference/secure-value) 的 `Release()` / `Close()` 使用。
:::

## 实战示例

下面演示在应用启动时安全地打印配置，并处理含内联凭据的错误消息——涵盖 `MaskValue`、`SanitizeForLog`、`IsSensitiveKey`、`MaskKey` 的协同使用：

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// 模拟从环境变量加载的配置
	config := []struct{ key, value string }{
		{"PORT", "8080"},
		{"DB_HOST", "localhost"},
		{"DB_PASSWORD", "super-secret-pwd"},
		{"API_KEY", "sk_live_1234567890abcdef"},
	}

	fmt.Println("=== 启动配置（已脱敏）===")
	for _, c := range config {
		fmt.Printf("%-15s = %s\n", c.key, env.MaskValue(c.key, c.value))
	}

	fmt.Println("\n=== 错误日志（自动脱敏）===")
	err := errors.New("failed to connect: user=admin password=hunter2 host=db.local")
	fmt.Println(env.SanitizeForLog(err.Error()))

	fmt.Println("\n=== 敏感键清单（键名脱敏）===")
	for _, c := range config {
		if env.IsSensitiveKey(c.key) {
			fmt.Printf("敏感配置: %s\n", env.MaskKey(c.key))
		}
	}
}
```

输出：

```text
=== 启动配置（已脱敏）===
PORT            = 8080
DB_HOST         = localhost
DB_PASSWORD     = [MASKED:16 chars]
API_KEY         = [MASKED:24 chars]

=== 错误日志（自动脱敏）===
failed to connect: user=admin password=[MASKED] host=db.local

=== 敏感键清单（键名脱敏）===
敏感配置: DB***
敏感配置: AP***
```

## 与 SecureValue 的关系

env 的安全体系由两道互补的防线组成：

| 防线 | 保护对象 | 工具 |
|------|----------|------|
| **内存保护** | 运行时驻留在内存中的值 | `GetSecure` / `Reveal` / `Masked` / `Release` |
| **输出脱敏** | 写入日志、错误、调试输出的值 | `IsSensitiveKey` / `MaskValue` / `SanitizeForLog` 等 |

```go
// 1. 内存保护：用 SecureValue 读取
secret := env.GetSecure("API_KEY")
defer secret.Release()
key := secret.Reveal()

// 2. 输出脱敏：记录时遮蔽
log.Printf("使用 %s 连接", secret.Masked())
// 或手动脱敏任意来源的值（不限于 SecureValue）
log.Printf("配置 %s", env.MaskValue("API_KEY", key))
```

::: tip 分工明确
- SecureValue 的 `Masked()` 输出形如 `[SECURE:32 bytes locked]`，专用于它管理的值。
- 脱敏工具函数（`MaskValue` 等）可用于**任何来源**的值——不限于 SecureValue，也不依赖 Loader。
:::

## 相关文档

- [安全概述](./) - 安全架构总览
- [SecureValue API](../api-reference/secure-value) - 内存中的值保护（含 `Masked` / `Reveal`）
- [内存锁定](./memory-locking) - 防止敏感数据交换到磁盘
- [生产检查清单](./production-checklist) - 上线前安全检查

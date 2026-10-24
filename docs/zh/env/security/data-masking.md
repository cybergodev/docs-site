---
sidebar_label: "敏感数据脱敏"
title: "敏感数据脱敏 - CyberGo env | 日志安全工具"
description: "CyberGo env 敏感数据脱敏工具指南：IsSensitiveKey 的敏感键检测与短模式边界规则、MaskValue 按敏感性脱敏值、MaskKey 脱敏键名、SanitizeForLog 清理日志内联键值，以及 ClearBytes 手动清零。"
sidebar_position: 2
---

# 敏感数据脱敏

env 的脱敏工具是一组**独立于 Loader 的纯函数**，用于在日志、错误信息和调试输出中遮蔽敏感数据。不创建 Loader 也能直接调用。

## 为什么需要脱敏

用 [SecureValue](../api-reference/secure-value) 保护内存中的敏感值，并不能阻止它们从三个环节泄露：

- **应用日志**：直接打印配置、请求参数、连接字符串
- **错误消息**：panic / error 把密钥带进日志收集系统
- **调试输出**：`fmt.Println` 调试时随手打印环境变量

```text
log.Printf("加载配置 DB_PASSWORD=%s", pwd)          ← 日志泄露
panic("connect failed: password=hunter2")           ← 错误泄露
fmt.Println(env.GetString("API_KEY"))               ← 调试泄露
```

这些输出一旦进入日志聚合系统（ELK、Datadog 等），或落到无权限查看密钥的人手里，密钥就等同于泄露。脱敏工具在记录时替换敏感内容，从源头堵住这条路径。它们只处理字符串，不改变值的实际使用方式。

## 函数详解

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

大小写不敏感地检查 `key` 是否包含敏感模式。多数模式按**子串匹配**：键名转为大写后，只要包含任一内置模式即判定为敏感。短模式例外，见下方说明。

**主要内置检测模式：**

| 类别 | 模式 |
|------|------|
| 认证类 | `PASSWORD`、`SECRET`、`TOKEN`、`AUTH`、`CREDENTIAL`、`PASSPHRASE`、`SESSION`、`COOKIE` |
| 密钥类 | `API_KEY`、`APIKEY`、`ACCESS_KEY`、`SECRET_KEY`、`PRIVATE_KEY`、`PUBLIC_KEY` |
| 加密类 | `PRIVATE`、`ENCRYPTION_KEY`、`ENCRYPT_KEY`、`DECRYPT_KEY`、`SIGNING_KEY`、`SIGN_KEY`、`VERIFY_KEY` |
| 金融 / PII | `SSN`、`SOCIAL_SECURITY`、`CREDIT_CARD`、`CARD_NUMBER`、`CVV`、`CVC`、`CCV`、`PAN` |
| 加密货币 | `MNEMONIC`、`SEED`、`RECOVERY`、`WALLET`、`PRIVATE_ADDRESS` |
| 基础设施 | `CONNECTION_STRING`、`CONN_STRING`、`DATABASE_URL`、`DB_PASSWORD` |
| 云服务 | `AWS_SECRET`、`AZURE_KEY`、`GCP_KEY`、`SERVICE_ACCOUNT` |

::: tip 子串匹配与标识符边界
多数模式按子串匹配：`IsSensitiveKey("MY_API_KEY_TOKEN")` 同时命中 `API_KEY` 和 `TOKEN`，返回 true。短模式 `AUTH`、`PAN`、`PWD`、`USERNAME` 例外：只有前后相邻字节都**不是字母或数字**时才命中（`internal/sensitive.go` 的 `containsWordIgnoreCase`），所以 `AUTHORIZATION` 不匹配（`AUTH` 后面紧跟字母 `O`），而 `AUTH_TOKEN`、`DB_AUTH`、`PWD_HASH` 都会匹配（下划线算边界）。
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
| `IsSensitiveKey(key)` 为 true | `[MASKED]`（固定掩码，不暴露长度） |
| 非敏感且 `len(value) ≤ 20` | 原值经 `SanitizeForLog` 处理后返回 |
| 非敏感且 `len(value) > 20` | `value[:17] + "..."`，再经 `SanitizeForLog` 处理 |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// 敏感值 → 固定掩码（不暴露长度）
	fmt.Println(env.MaskValue("DB_PASSWORD", "p@ssw0rd123"))
	// 输出：[MASKED]

	// 非敏感短值 → 经 SanitizeForLog 后原样返回
	fmt.Println(env.MaskValue("PORT", "8080"))
	// 输出：8080

	// 非敏感长值（>20 字符）→ 截断到 17 字符后补 "..."
	fmt.Println(env.MaskValue("DESCRIPTION", "this-is-a-very-long-description-value"))
	// 输出：this-is-a-very-lo...
}
```

::: tip 固定掩码
敏感值统一返回固定字符串 `[MASKED]`，不暴露值的长度，避免通过长度差异反推机密内容。非敏感长值仍保留截断处理（`value[:17] + "..."`）。
:::

### MaskKey

```go
func MaskKey(key string) string
```

脱敏键名本身，用于需要展示「存在某个键」但不暴露键含义的场景。`MaskKey` 是内部 DefaultMaskKey 的包装，与错误报告共用同一实现，对任意键名都返回固定 `[MASKED]`。审计日志的键掩码走的是 `MaskValue`：敏感键得 `[MASKED]`，非敏感键原样保留：

| 条件 | 返回值 |
|------|--------|
| 任意键名 | `[MASKED]`（固定掩码） |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	fmt.Println(env.MaskKey("DB_PASSWORD")) // [MASKED]
	fmt.Println(env.MaskKey("API_KEY"))     // [MASKED]
	fmt.Println(env.MaskKey("TOKEN"))       // [MASKED]
	fmt.Println(env.MaskKey("AB"))          // [MASKED]
	fmt.Println(env.MaskKey("XYZ"))         // [MASKED]
}
```

::: warning 与 MaskValue 的搭配
`MaskKey` 返回固定 `[MASKED]`，`DB_HOST` 和 `DB_PASSWORD` 都会变成同一串掩码，无法区分。需要在日志中区分两者时，配合 `MaskValue` 一同输出，或只在键名无关紧要时单独使用。
:::

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

处理分两级：`len(s) > 50` 时先截断为 `s[:47] + "..."`，再对结果调用 [`SanitizeForLog`](#sanitizeforlog) 掩码敏感键值。只截断不掩码会把 `password=...` 原样留在日志里，这是 SEC-04 修复的问题：

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
	// 第一级：超过 50 字符先截断到 47 字符，再补 "..."
	long := "012345678901234567890123456789012345678901234567890123456789"
	fmt.Println(env.MaskSensitiveInString(long))
	// 输出：01234567890123456789012345678901234567890123456...

	// 第二级：截断（或未触发截断）后仍会掩码敏感键值
	s := "connect failed: user=admin password=hunter2"
	fmt.Println(env.MaskSensitiveInString(s))
	// 输出：connect failed: user=admin password=[MASKED]

	short := "hello world"
	fmt.Println(env.MaskSensitiveInString(short))
	// 输出：hello world
}
```

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

扫描字符串中的键值模式，对敏感键值对**保留键名与分隔符、仅把值替换为 `[MASKED]`**，同时移除控制字符（保留 `\n` 和 `\t`）。识别的形态包括 `key=value` 与 YAML 风格的 `key: value`，适合处理连接字符串、错误消息等内联键值。

**检测的赋值模式：** 每个敏感键模式同时派生 `key=` 与 `key:` 两种形态，常用项包括 `password=`、`secret=`、`token=`、`auth=`、`credential=`、`passphrase=`、`session=`、`cookie=`、`api_key=`、`apikey=`、`access_key=`、`secret_key=`、`private_key=`、`public_key=`、`encrypt_key=`、`decrypt_key=`、`signing_key=`、`ssn=`、`credit_card=`、`card_number=`、`cvv=`、`cvc=`、`mnemonic=`、`seed=`、`recovery=`、`wallet=`、`connection_string=`、`database_url=`、`db_password=`；另有 `authorization=`、`pwd=` 与 HTTP 头的 `Bearer ` 形式。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	fmt.Println(env.SanitizeForLog("user=admin password=s3cret"))
	// 输出：user=admin password=[MASKED]

	fmt.Println(env.SanitizeForLog("token=abc123 host=localhost"))
	// 输出：token=[MASKED] host=localhost

	// 多个敏感值全部脱敏
	fmt.Println(env.SanitizeForLog("user=pguser password=hunter2 api_key=sk_123"))
	// 输出：user=pguser password=[MASKED] api_key=[MASKED]
}
```

::: tip 替换粒度
`SanitizeForLog` 保留 `password=` 的键名与分隔符，只把值 `s3cret` 替换为 `[MASKED]`。日志中仍能看出存在哪些配置项，敏感值本身不会泄露。
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

将字节切片全部置零。用于手动清理经 `Reveal()` 取得、以 `[]byte` 形式处理的敏感数据，避免明文在内存中残留。

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
	// 输出：清零前：secret123

	env.ClearBytes(secret)
	fmt.Printf("清零后: %q\n", secret)
	// 输出：清零后："\x00\x00\x00\x00\x00\x00\x00\x00\x00"
}
```

::: warning ClearBytes 的局限
`ClearBytes` 只清零传入的那个切片。同一份敏感数据被复制过多次时（string 与 `[]byte` 之间的转换会产生新副本），这些副本无法一并清零。敏感数据应尽量减少复制，并配合 [SecureValue](../api-reference/secure-value) 的 `Release()` / `Close()` 使用。
:::

## 实战示例

下面的启动流程同时使用四个函数：`MaskValue` 打印配置、`SanitizeForLog` 处理含内联凭据的错误、`IsSensitiveKey` + `MaskKey` 输出敏感键清单：

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
DB_PASSWORD     = [MASKED]
API_KEY         = [MASKED]

=== 错误日志（自动脱敏）===
failed to connect: user=admin password=[MASKED] host=db.local

=== 敏感键清单（键名脱敏）===
敏感配置：[MASKED]
敏感配置：[MASKED]
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
- `SecureValue` 的 `Masked()` 专用于它管理的值，格式为 `[SECURE:N bytes]`；启用内存锁定时附带锁定状态（` locked` / ` lock-failed` / ` unlocked`），空值为 `[SECURE:0 bytes]`，已关闭为 `[CLOSED]`，nil 为 `[NIL]`。
- 脱敏工具函数（`MaskValue` 等）适用于**任何来源**的值，不限于 SecureValue，也不依赖 Loader。
:::

## 相关文档

- [安全概述](./) - 安全架构总览
- [SecureValue API](../api-reference/secure-value) - 内存中的值保护（含 `Masked` / `Reveal`）
- [内存锁定](./memory-locking) - 防止敏感数据交换到磁盘
- [生产检查清单](./production-checklist) - 上线前安全检查

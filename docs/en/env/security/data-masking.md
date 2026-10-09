---
sidebar_label: "Data Masking"
title: "Data Masking - CyberGo env | Log Security Tools"
description: "Sensitive data masking guide for CyberGo env: IsSensitiveKey auto-detection, MaskValue and MaskKey masking, and ClearBytes zeroing, with logging examples."
sidebar_position: 2
---

# Data Masking

env provides a set of **utility functions independent of the Loader** for preventing sensitive data leakage in logs, error messages, and debug output. These functions can be called directly without creating a Loader, suitable for any scenario where you need to safely log configuration.

## Why Masking Is Needed

Even if you properly protect sensitive values in memory with [SecureValue](/en/env/api-reference/secure-value), they can still leak in three places:

- **Application logs** — directly printing configuration, request parameters, connection strings
- **Error messages** — panic / error carries keys into log collection systems
- **Debug output** — casually printing environment variables during `fmt.Println` debugging

```text
log.Printf("Loading config DB_PASSWORD=%s", pwd)          ← Log leak
panic("connect failed: password=hunter2")           ← Error leak
fmt.Println(env.GetString("API_KEY"))               ← Debug leak
```

Once these outputs enter log aggregation systems (ELK, Datadog, etc.) or are seen by team members, operators, or even attackers, the keys are effectively stolen. env's masking tools let you **automatically obscure sensitive content** at logging time, stopping leaks at the source.

## Function Details

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

Case-insensitively checks whether `key` contains sensitive patterns. Detection uses **substring matching** — as long as the key name (converted to uppercase) contains any built-in pattern, it is classified as sensitive.

**Built-in detection patterns:**

| Category | Patterns |
|----------|----------|
| Authentication | `PASSWORD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE` |
| Keys | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY` |
| Encryption | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY` |
| Financial / PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN` |
| Cryptocurrency | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| Infrastructure | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD` |
| Cloud Services | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

:::tip
`IsSensitiveKey("MY_API_KEY_TOKEN")` matches both `API_KEY` and `TOKEN`, returning true. This means `AUTHORIZATION` is also classified as sensitive because it contains `AUTH` — this is the intended conservative behavior.
:::

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// Authentication and key types
	fmt.Println(env.IsSensitiveKey("DB_PASSWORD"))  // true
	fmt.Println(env.IsSensitiveKey("API_KEY"))      // true
	fmt.Println(env.IsSensitiveKey("ACCESS_TOKEN")) // true

	// Case-insensitive
	fmt.Println(env.IsSensitiveKey("api_key")) // true
	fmt.Println(env.IsSensitiveKey("ApiKey"))  // true

	// Non-sensitive keys
	fmt.Println(env.IsSensitiveKey("PORT"))    // false
	fmt.Println(env.IsSensitiveKey("DB_HOST")) // false
}
```

### MaskValue

```go
func MaskValue(key, value string) string
```

Masks `value` based on the sensitivity of `key`, suitable for logging configuration key-value pairs:

| Condition | Return Value |
|-----------|-------------|
| `IsSensitiveKey(key)` is true | `[MASKED:N chars]` (N = `len(value)`) |
| Non-sensitive and `len(value) ≤ 20` | Original value |
| Non-sensitive and `len(value) > 20` | `value[:17] + "..."` |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// Sensitive value → masked (preserves length info for troubleshooting)
	fmt.Println(env.MaskValue("DB_PASSWORD", "p@ssw0rd123"))
	// Output: [MASKED:11 chars]

	// Non-sensitive short value → returned as-is
	fmt.Println(env.MaskValue("PORT", "8080"))
	// Output: 8080

	// Non-sensitive long value (>20 chars) → truncated
	fmt.Println(env.MaskValue("DESCRIPTION", "this-is-a-very-long-description-value"))
	// Output: this-is-a-very-lo...
}
```

:::tip
`[MASKED:N chars]` exposes the value's length but not its content. This is useful for troubleshooting "was the password truncated" or "is the key complete" without leaking plaintext.
:::

### MaskKey

```go
func MaskKey(key string) string
```

Masks the key name itself, for scenarios where you need to show a key exists but don't want to expose its meaning (the public API `MaskKey` is a wrapper around the internal masking routine, sharing one implementation with error reporting and audit logs):

| Condition | Return Value |
|-----------|-------------|
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
	fmt.Println(env.MaskKey("XYZ"))         // *** (length ≤ 3)
}
```

:::warning
`MaskKey` only takes the first 2 characters of the key name, so `DB_HOST` and `DB_PASSWORD` both become `DB***`. If you need to distinguish them in logs, output alongside `MaskValue`, or only use `MaskKey` alone when the key name doesn't matter.
:::

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

Truncates long strings to prevent excessive content in logs (which may indirectly leak information or bloat logs):

| Condition | Return Value |
|-----------|-------------|
| `len(s) > 50` | `s[:47] + "..."` |
| Otherwise | Original value |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	long := "012345678901234567890123456789012345678901234567890123456789"
	fmt.Println(env.MaskSensitiveInString(long))
	// Output: 012345678901234567890123456789012345678901234567...

	short := "hello world"
	fmt.Println(env.MaskSensitiveInString(short))
	// Output: hello world
}
```

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

Scans the string for `key=value` patterns, **replacing the entire** sensitive `key=value` with `[MASKED]`, while removing control characters (preserving `\n` and `\t`). Suitable for processing connection strings, error messages, and other inline key-value pairs.

**Detected assignment patterns:** `password=`, `secret=`, `token=`, `auth=`, `credential=`, `passphrase=`, `session=`, `cookie=`, `api_key=`, `apikey=`, `access_key=`, `secret_key=`, `private_key=`, `public_key=`, `encrypt_key=`, `decrypt_key=`, `signing_key=`, `ssn=`, `credit_card=`, `card_number=`, `cvv=`, `cvc=`, `mnemonic=`, `seed=`, `recovery=`, `wallet=`, `connection_string=`, `database_url=`, `db_password=`

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	fmt.Println(env.SanitizeForLog("user=admin password=s3cret"))
	// Output: user=admin [MASKED]

	fmt.Println(env.SanitizeForLog("token=abc123 host=localhost"))
	// Output: [MASKED] host=localhost

	// Multiple sensitive values all masked
	fmt.Println(env.SanitizeForLog("user=pguser password=hunter2 api_key=sk_123"))
	// Output: user=pguser [MASKED] [MASKED]
}
```

:::tip
`SanitizeForLog` replaces `password=s3cret` entirely with a single `[MASKED]` (including the key name), rather than keeping `password=[MASKED]`. This way the log doesn't even reveal "there's a password here."
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

Sets all bytes in a slice to zero. Used to manually clean sensitive data obtained via `Reveal()` and processed as `[]byte`, preventing plaintext from lingering in memory.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// Simulate sensitive data processed as []byte
	secret := []byte("secret123")
	fmt.Printf("Before zeroing: %s\n", secret)
	// Output: Before zeroing: secret123

	env.ClearBytes(secret)
	fmt.Printf("After zeroing: %q\n", secret)
	// Output: After zeroing: "\x00\x00\x00\x00\x00\x00\x00\x00\x00"
}
```

:::warning
`ClearBytes` only zeros the slice you pass in. If the same sensitive data was copied multiple times (e.g., conversions between string and []byte create new copies), those copies cannot be zeroed together. Minimize copying of sensitive data, and use it alongside [SecureValue](/en/env/api-reference/secure-value)'s `Release()` / `Close()`.
:::

## Practical Example

The following demonstrates safely printing configuration at application startup and handling error messages containing inline credentials — covering the combined use of `MaskValue`, `SanitizeForLog`, `IsSensitiveKey`, and `MaskKey`:

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// Simulate configuration loaded from environment variables
	config := []struct{ key, value string }{
		{"PORT", "8080"},
		{"DB_HOST", "localhost"},
		{"DB_PASSWORD", "super-secret-pwd"},
		{"API_KEY", "sk_live_1234567890abcdef"},
	}

	fmt.Println("=== Startup Config (masked) ===")
	for _, c := range config {
		fmt.Printf("%-15s = %s\n", c.key, env.MaskValue(c.key, c.value))
	}

	fmt.Println("\n=== Error Log (auto-masked) ===")
	err := errors.New("failed to connect: user=admin password=hunter2 host=db.local")
	fmt.Println(env.SanitizeForLog(err.Error()))

	fmt.Println("\n=== Sensitive Key List (key names masked) ===")
	for _, c := range config {
		if env.IsSensitiveKey(c.key) {
			fmt.Printf("Sensitive config: %s\n", env.MaskKey(c.key))
		}
	}
}
```

Output:

```text
=== Startup Config (masked) ===
PORT            = 8080
DB_HOST         = localhost
DB_PASSWORD     = [MASKED:16 chars]
API_KEY         = [MASKED:24 chars]

=== Error Log (auto-masked) ===
failed to connect: user=admin [MASKED] host=db.local

=== Sensitive Key List (key names masked) ===
Sensitive config: DB***
Sensitive config: AP***
```

## Relationship with SecureValue

env's security system consists of two complementary defense lines:

| Defense Line | Protects | Tools |
|-------------|----------|-------|
| **Memory protection** | Values residing in memory at runtime | `GetSecure` / `Reveal` / `Masked` / `Release` |
| **Output masking** | Values written to logs, errors, debug output | `IsSensitiveKey` / `MaskValue` / `SanitizeForLog`, etc. |

```go
// 1. Memory protection: read with SecureValue
secret := env.GetSecure("API_KEY")
defer secret.Release()
key := secret.Reveal()

// 2. Output masking: obscure when logging
log.Printf("Connecting with %s", secret.Masked())
// Or manually mask values from any source (not limited to SecureValue)
log.Printf("Config %s", env.MaskValue("API_KEY", key))
```

:::tip
- SecureValue's `Masked()` output looks like `[SECURE:32 bytes locked]`, dedicated to the values it manages.
- The masking utility functions (`MaskValue`, etc.) can be used on values from **any source** — not limited to SecureValue, and not dependent on a Loader.
:::

## Related Documentation

- [Security Overview](/en/env/security/) - Security architecture overview
- [SecureValue API](/en/env/api-reference/secure-value) - In-memory value protection (including `Masked` / `Reveal`)
- [Memory Locking](/en/env/security/memory-locking) - Preventing sensitive data from being swapped to disk
- [Production Checklist](/en/env/security/production-checklist) - Pre-launch security checks

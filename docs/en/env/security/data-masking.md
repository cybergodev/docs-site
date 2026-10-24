---
sidebar_label: "Data Masking"
title: "Data Masking - CyberGo env | Log Security Tools"
description: "Sensitive data masking guide for CyberGo env: IsSensitiveKey detection, MaskValue, MaskKey, MaskSensitiveInString, SanitizeForLog and ClearBytes zeroing."
sidebar_position: 2
---

# Data Masking

env provides masking functions that work **without a Loader**: they take strings and return masked strings. Use them wherever configuration values reach logs, error messages, or debug output.

## Why Masking Is Needed

Even when you protect values in memory with [SecureValue](../api-reference/secure-value), they can still leak in three places:

- **Application logs**: printing configuration, request parameters, or connection strings
- **Error messages**: a panic or error carries the key into a log collection system
- **Debug output**: printing environment variables during a `fmt.Println` debugging session

```text
log.Printf("Loading config DB_PASSWORD=%s", pwd)          ← Log leak
panic("connect failed: password=hunter2")           ← Error leak
fmt.Println(env.GetString("API_KEY"))               ← Debug leak
```

Once one of these outputs reaches a log aggregation system (ELK, Datadog, and similar) or is read by a teammate, an operator, or an attacker, the secret is effectively stolen. The masking functions obscure sensitive content at logging time, which stops the leak at its source.

## Function Details

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

Case-insensitively checks whether `key` contains a sensitive pattern. Most patterns use **substring matching**: once the key name is uppercased, containing any built-in pattern anywhere makes it sensitive. Short patterns are the exception.

**Built-in detection patterns:**

| Category | Patterns |
|----------|----------|
| Authentication | `PASSWORD`, `PASSWD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE` |
| Keys | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY`, `KEYSTORE` |
| Encryption | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY`, `CERT`, `SALT`, `NONCE` |
| Financial / PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN`, `USERNAME` |
| Cryptocurrency | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| Infrastructure | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD`, `DSN` |
| Cloud Services | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

:::tip Substring matching and the short patterns
`IsSensitiveKey("MY_API_KEY_TOKEN")` contains both `API_KEY` and `TOKEN`, so it returns true.

The short patterns `AUTH`, `PAN`, `PWD`, and `USERNAME` do not match as substrings. They match only when the bytes on **both** sides of the match are neither a letter nor a digit (`containsWordIgnoreCase` in `internal/sensitive.go`); an underscore counts as a boundary. So `AUTHORIZATION` does not match, because `AUTH` is followed by the letter `O`, while `AUTH_TOKEN`, `DB_AUTH`, and `PWD_HASH` all do.
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

	// Short patterns need a non-alphanumeric byte on both sides
	fmt.Println(env.IsSensitiveKey("AUTH_TOKEN"))    // true
	fmt.Println(env.IsSensitiveKey("DB_AUTH"))       // true
	fmt.Println(env.IsSensitiveKey("PWD_HASH"))      // true
	fmt.Println(env.IsSensitiveKey("AUTHORIZATION")) // false
	fmt.Println(env.IsSensitiveKey("AUTHOR"))        // false

	// Non-sensitive keys
	fmt.Println(env.IsSensitiveKey("PORT"))    // false
	fmt.Println(env.IsSensitiveKey("DB_HOST")) // false
}
```

### MaskValue

```go
func MaskValue(key, value string) string
```

Masks `value` according to the sensitivity of `key`. Use it when logging configuration key-value pairs:

| Condition | Return Value |
|-----------|-------------|
| `IsSensitiveKey(key)` is true | `[MASKED]` (fixed mask; reveals nothing, not even the length) |
| Non-sensitive and `len(value) ≤ 20` | `SanitizeForLog(value)` |
| Non-sensitive and `len(value) > 20` | `SanitizeForLog(value[:17] + "...")` |

Non-sensitive values pass through `SanitizeForLog`, so an inline `password=...` inside an otherwise harmless value is still masked.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// Sensitive value → fixed mask (does not reveal length)
	fmt.Println(env.MaskValue("DB_PASSWORD", "p@ssw0rd123"))
	// Output: [MASKED]

	// Non-sensitive short value → returned as-is
	fmt.Println(env.MaskValue("PORT", "8080"))
	// Output: 8080

	// Non-sensitive long value (>20 chars) → truncated at 17 characters
	fmt.Println(env.MaskValue("DESCRIPTION", "this-is-a-very-long-description-value"))
	// Output: this-is-a-very-lo...
}
```

:::tip Fixed mask
A sensitive value always returns the fixed string `[MASKED]`, which reveals nothing about the value's length and prevents length-based inference of the secret. A long non-sensitive value is truncated to `value[:17] + "..."`.
:::

### MaskKey

```go
func MaskKey(key string) string
```

Masks the key name itself, for cases where you need to show that a key exists without revealing which one. `MaskKey` is a wrapper around the internal masking routine that error reporting uses. Key masking inside audit events goes through `MaskValue`, which also returns the fixed `[MASKED]`:

| Condition | Return Value |
|-----------|-------------|
| Any key name | `[MASKED]` (fixed mask) |

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

:::warning Combining with MaskValue
`MaskKey` returns the fixed `[MASKED]`, so `DB_HOST` and `DB_PASSWORD` become indistinguishable. If you need to tell keys apart in logs, log the key name together with `MaskValue`, or use `MaskKey` alone only when the key name carries no information you need.
:::

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

Truncate first, then mask. A string longer than 50 characters is truncated to 47 characters plus `...`, which keeps logs small and limits indirect leakage. The result then passes through [`SanitizeForLog`](#sanitizeforlog), so sensitive key-value pairs inside it are still masked (SEC-04; truncation alone would leave `password=...` intact):

| Condition | Return Value |
|-----------|-------------|
| `len(s) > 50` | `SanitizeForLog(s[:47] + "...")` |
| Otherwise | `SanitizeForLog(s)` |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	// Stage one: strings over 50 characters are truncated first
	long := "012345678901234567890123456789012345678901234567890123456789"
	fmt.Println(env.MaskSensitiveInString(long))
	// Output: 01234567890123456789012345678901234567890123456...

	// Stage two: sensitive key-values are still masked after (or without) truncation
	s := "connect failed: user=admin password=hunter2"
	fmt.Println(env.MaskSensitiveInString(s))
	// Output: connect failed: user=admin password=[MASKED]

	short := "hello world"
	fmt.Println(env.MaskSensitiveInString(short))
	// Output: hello world
}
```

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

Scans the string for `key=value` and YAML `key: value` pairs. For each sensitive pair it **keeps the key name and separator and replaces only the value** with `[MASKED]`. Control characters are stripped, except `\n` and `\t`. Use it for connection strings, error messages, and other inline key-value text.

**Detected assignment patterns:** `password=`, `secret=`, `token=`, `auth=`, `credential=`, `passphrase=`, `session=`, `cookie=`, `api_key=`, `apikey=`, `access_key=`, `secret_key=`, `private_key=`, `public_key=`, `encrypt_key=`, `decrypt_key=`, `signing_key=`, `ssn=`, `credit_card=`, `card_number=`, `cvv=`, `cvc=`, `mnemonic=`, `seed=`, `recovery=`, `wallet=`, `connection_string=`, `database_url=`, `db_password=`. The same names are recognized in YAML form (`password: ...`).

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	fmt.Println(env.SanitizeForLog("user=admin password=s3cret"))
	// Output: user=admin password=[MASKED]

	fmt.Println(env.SanitizeForLog("token=abc123 host=localhost"))
	// Output: token=[MASKED] host=localhost

	// Multiple sensitive values all masked
	fmt.Println(env.SanitizeForLog("user=pguser password=hunter2 api_key=sk_123"))
	// Output: user=pguser password=[MASKED] api_key=[MASKED]
}
```

:::tip Replacement granularity
`SanitizeForLog` keeps the `password=` key name and separator and replaces only the value `s3cret` with `[MASKED]`. The key names and structure stay visible, so you can still see which config entries exist, while the sensitive values never reach the log.
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

Sets every byte in a slice to zero. Use it to clear sensitive data obtained from `Reveal()` and held as `[]byte`, so the plaintext does not linger in memory.

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

:::warning ClearBytes limitations
`ClearBytes` zeros only the slice you pass in. If the same value was copied elsewhere — for example by converting between `string` and `[]byte` — those copies are untouched. Copy sensitive data as little as possible, and use `Reveal()` on a `SecureValue` only for the short window in which you need it. `Bytes()` returns a `[]byte` copy that `ClearBytes` can zero.
:::

## Practical Example

The following prints startup configuration and an error message that contains inline credentials. It combines `MaskValue`, `SanitizeForLog`, `IsSensitiveKey`, and `MaskKey`:

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
DB_PASSWORD     = [MASKED]
API_KEY         = [MASKED]

=== Error Log (auto-masked) ===
failed to connect: user=admin password=[MASKED] host=db.local

=== Sensitive Key List (key names masked) ===
Sensitive config: [MASKED]
Sensitive config: [MASKED]
```

## Relationship with SecureValue

env's security system has two complementary defense lines:

| Defense Line | Protects | Tools |
|-------------|----------|-------|
| **Memory protection** | Values held in memory at runtime | `GetSecure` / `Reveal` / `Masked` / `Release` |
| **Output masking** | Values written to logs, errors, or debug output | `IsSensitiveKey` / `MaskValue` / `SanitizeForLog` |

```go
// 1. Memory protection: read with SecureValue
secret := env.GetSecure("API_KEY")
defer secret.Release()
key := secret.Reveal()

// 2. Output masking: obscure when logging
log.Printf("Connecting with %s", secret.Masked())
// Or mask a value from any source (not limited to SecureValue)
log.Printf("Config %s", env.MaskValue("API_KEY", key))
```

:::tip Division of labor
- `SecureValue.Masked()` produces output like `[SECURE:32 bytes locked]` and applies only to the value it manages.
- The masking functions (`MaskValue` and others) accept values from **any source** — no `SecureValue` and no Loader required.
:::

## Related Documentation

- [Security Overview](./) - security architecture overview
- [SecureValue API](../api-reference/secure-value) - in-memory value protection (including `Masked` and `Reveal`)
- [Memory Locking](./memory-locking) - preventing sensitive data from being swapped to disk
- [Production Checklist](./production-checklist) - pre-launch security checks

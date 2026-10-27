---
title: "Redirects - CyberGo HTTPC | Following & Whitelist"
description: "HTTPC redirect guide: follow control, RedirectChain, 301-308 method semantics, credential stripping, SensitiveHeaders, RedirectWhitelist open-redirect defense."
sidebar_label: "Redirects"
sidebar_position: 30
---

# Redirects

HTTPC follows HTTP redirects automatically by default, with a `MaxRedirects` cap of 10 — the count includes the initial request, so at most 9 hops are actually followed, matching net/http — and records the complete redirect chain. The following policy is set by `Security.FollowRedirects` and `MaxRedirects` at client, request, or preset level.

Sensitive headers are stripped on cross-origin jumps. Circular chains, targets outside the whitelist, and targets that fail SSRF validation are rejected.

## Default Behavior

Without any configuration, the client follows redirects automatically until the final response is reached or the hop limit is hit:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://httpbin.org/redirect/2")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode())       // 200 (status of the final response)
	fmt.Println(result.Meta.RedirectCount) // 2 (redirects actually followed)
}
```

The engine automatically follows the five redirect status codes 301/302/303/307/308, with method semantics per the HTTP specification:

| Status | Method handling |
|--------|-----------------|
| 301 / 302 / 303 | 301/302 rewrite POST and similar to GET; 303 always rewrites to GET |
| 307 / 308 | Resent with the original method and body |

### Status-Code Semantics (301/302/303/307/308)

The five status codes differ in method rewriting and body handling:

| Status | Meaning | Method handling | Body | Typical use |
|--------|---------|-----------------|------|-------------|
| 301 | Moved permanently | GET/HEAD unchanged; POST and the like rewritten to GET | Dropped | Domain migration, URL normalization |
| 302 | Found (temporary) | Same as 301 (follows the de-facto standard behavior) | Dropped | Temporary jumps, post-login forwarding |
| 303 | See Other | Always rewritten to GET | Dropped | Redirecting to a result page after POST |
| 307 | Temporary redirect | Original method kept | Resent | Temporary jumps that must resend the body |
| 308 | Permanent redirect | Original method kept | Resent | Permanent jumps that must resend the body |

:::warning 307/308 requires a replayable request body
307/308 require **replaying the request body** with the original method, and net/http follows only when the body is replayable (`GetBody` set). HTTPC sets `GetBody` for:

- `string`, `[]byte`, JSON, XML, and multipart bodies;
- the three replayable readers `*strings.Reader`, `*bytes.Reader`, and `*bytes.Buffer`.

Such requests **are followed on 307/308, replaying the body on every hop**.

A generic `io.Reader` (including `io.Pipe`) denotes a stream that cannot be rewound, so `GetBody` cannot be derived from it directly. When retries are **actually in effect for that request**, such a body is buffered into `[]byte` first (up to 100MB), which makes it replayable and followed; when it is not buffered (`Retry.MaxRetries = 0`, or a non-idempotent method that is not retried because `RetryNonIdempotent` is off), a 307/308 is **not followed and the 3xx response is returned as-is** (no error). To follow such jumps, switch to a replayable body, enable retries for that request, disable following with `WithFollowRedirects(false)` and loop manually, or have the server use 302/303 instead.
:::

:::tip 300/304 and other 3xx are outside the follow set
Even with a `Location` header present, the engine follows only 301/302/303/307/308. 300 (Multiple Choices), 304 (Not Modified), and other 3xx responses are returned as-is for the caller to handle.

`Result.IsRedirect()` tests the whole 300-399 range and is unrelated to automatic following.
:::

:::tip Exceeding the limit fails the request
When the redirect count exceeds `MaxRedirects`, the request ends with an error (message like `stopped after 3 redirects`) rather than looping indefinitely. The count includes the initial request: with `MaxRedirects = N`, at most N-1 hops are followed — the default of 10 means at most 9 hops. The valid range for `MaxRedirects` is 0-50; out-of-range values fail config validation.
:::

## Controlling Following

Redirect configuration lives on three levels, from widest to narrowest scope:

| Level | Configuration | Scope |
|-------|---------------|-------|
| Client level | `Config.Security.FollowRedirects` / `MaxRedirects` | All requests of the whole client |
| Request level | `WithFollowRedirects(bool)` / `WithMaxRedirects(n)` | A single request, overriding the client configuration |
| Preset | `SecureConfig()`, `MinimalConfig()` (both set `FollowRedirects=false`) | These two presets do not follow by default |

### Client Level

`Config.Security` (`SecurityConfig`) sets the redirect policy for the entire client:

```go
cfg := httpc.DefaultConfig()
cfg.Security.FollowRedirects = true  // default: follow
cfg.Security.MaxRedirects = 5        // default: 10

client, err := httpc.New(cfg)
```

### Per Request

`WithFollowRedirects` / `WithMaxRedirects` override the client configuration for a single request:

```go
// Disable following for just this request and take the 3xx response directly
result, err := httpc.Get("https://httpbin.org/redirect/1",
    httpc.WithFollowRedirects(false),
)
if result.IsRedirect() {
    fmt.Println(result.Response.Headers.Get("Location")) // the redirect target
}

// Cap at 3 for just this request (the count includes the initial request,
// so at most 2 hops are followed)
result, err = httpc.Get(url, httpc.WithMaxRedirects(3))
```

:::warning MaxRedirects(0) is not "disable"
`0` is the "unset" sentinel — the engine falls back to the default of 10 instead of disabling redirects. To disable following, use `WithFollowRedirects(false)` or `Config.Security.FollowRedirects = false`.
:::

:::tip SecureConfig disables redirects by default
The `SecureConfig()` preset sets `FollowRedirects` to `false`, preventing requests from being led to internal addresses via redirects (redirect-based SSRF). See [SSRF Protection](../security/ssrf) for the security details.
:::

## Tracking the Redirect Chain

`Result.Meta` records redirect information for every request:

| Field | Description |
|-------|-------------|
| `Meta.RedirectCount` | Number of redirects actually followed |
| `Meta.RedirectChain` | Sequence of URLs visited during the redirects |

The precise semantics of both fields:

- `RedirectChain` records the **source URL** of each hop: the first entry is the initial request URL, followed by each intermediate URL in order; **the final target URL is not in the chain**. For the final address, read `result.Request.URL` (the final request URL once following completes).
- `RedirectCount` always equals `len(RedirectChain)`.

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://httpbin.org/redirect/3")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Followed %d redirects\n", result.Meta.RedirectCount)
	for i, u := range result.Meta.RedirectChain {
		fmt.Printf("  %d. %s\n", i+1, u)
	}
	fmt.Println("Final destination:", result.Request.URL)
	// Output:
	//   1. https://httpbin.org/redirect/3
	//   2. https://httpbin.org/redirect/2
	//   3. https://httpbin.org/redirect/1
	// Final destination: https://httpbin.org/get
}
```

## Cross-Origin Credential Stripping

While following redirects, the engine compares the target's **origin** (scheme + host + port, with scheme default ports normalized) at every hop. When the target origin differs from the **initial request's** origin (a cross-origin jump), sensitive request headers are removed automatically so credentials do not leak to the redirect target:

| Header | Target origin = initial request origin | Target origin ≠ initial request origin |
|--------|----------------------------------------|----------------------------------------|
| `Authorization` | Kept | Removed |
| `Proxy-Authorization` | Kept | Removed |
| `Cookie` | Kept | Removed |
| `X-Api-Key` | Kept | Removed |
| `X-Auth-Token` | Kept | Removed |
| Other custom headers (when not listed in `Security.SensitiveHeaders`) | Kept | Kept |

The built-in stripping set contains **five** headers. net/http itself covers only the first three (`Authorization` / `Proxy-Authorization` / `Cookie`). HTTPC additionally strips `X-Api-Key` and `X-Auth-Token` cross-origin.

Matching details:

- The comparison baseline is the **initial request's** origin (the first hop's `via[0]`), not the previous hop. The origin comparison covers scheme, host, and port (with scheme default ports normalized): a different subdomain (`api.example.com → www.example.com`), a different port (`example.com:443 → example.com:8080`), and a scheme change (including an https → http downgrade) all count as cross-origin; `A → B → A` returning to the initial origin is not stripped.
- Stripping is independent of the cookie jar: even with `EnableCookies` off, a manually set `Cookie` request header is still removed on cross-origin jumps.

No extra handling is needed alongside `WithBasicAuth` / `WithBearerToken`: the token goes only to the original host and is not forwarded to third-party domains by the jumps.

### Custom credential headers: SensitiveHeaders

Business-specific credential headers (e.g. `X-Secret-Key`) are not in the built-in stripping set. Without extra configuration, such headers are **forwarded verbatim** to whatever the `Location` header points at, an open-redirect credential leak (CWE-525).

`Security.SensitiveHeaders` appends custom credential headers to the cross-origin stripping set:

```go
cfg := httpc.DefaultConfig()
cfg.Security.SensitiveHeaders = []string{"X-Secret-Key", "X-Internal-Token"}

client, err := httpc.New(cfg)
```

- Entries match case-insensitively (compared by canonicalized header name internally) and are deduplicated;
- The five built-in sensitive headers (the first five rows above) are **always stripped**, regardless of this field;
- For the field-level reference, see [Configuration API](../api-reference/client-config/config).

:::warning Masking does not cover SensitiveHeaders
The masking in `Result.String()` and audit output covers only the **built-in** sensitive header names. Headers listed in `SensitiveHeaders` remain visible in plain text in those outputs. Account for this difference when auditing logs for leaks.
:::

## Circular Redirect Detection

Beyond the hop limit, the engine also detects **circular redirects** (a jump target that has already appeared earlier in the chain). On a hit, the request fails immediately instead of consuming the remaining hop budget:

```text
A → B → A     circular: fails with circular redirect detected: A
A → A → A     consecutive identical URLs: not counted as circular (the server may return a different response each time)
```

Circular detection and the `MaxRedirects` hop limit complement each other: the hop limit covers every loop, while circular detection identifies looping chains early and avoids wasted requests.

## Redirect Error Classification

When following is refused (limit exceeded, circular, whitelist, SSRF block), the request ends with a `ClientError` whose Type is uniformly `ErrorTypeValidation`:

| Underlying error message | Message field | Trigger |
|--------------------------|---------------|---------|
| `stopped after N redirects` | `redirect limit exceeded` | The request count reached the `MaxRedirects` cap (the count includes the initial request) |
| `circular redirect detected: <URL>` | `circular redirect detected` | The target URL already appears in the jump chain |
| `redirect blocked by whitelist: ...` | `redirect blocked by policy` | The target domain is not in `RedirectWhitelist` |
| `redirect blocked: ...` | `redirect blocked by policy` | The target host was blocked by SSRF protection |

```go
package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Security.MaxRedirects = 2 // cap counts 2 requests (including the initial one, so at most 1 follow)

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// /redirect/5 needs 5 follows and will necessarily exceed the limit
	_, err = client.Get("https://httpbin.org/redirect/5")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) && clientErr.Type == httpc.ErrorTypeValidation {
			fmt.Println("Redirect refused:", clientErr.Message)
			// Output: Redirect refused: redirect limit exceeded
		}
	}
}
```

SSRF validation of redirect targets also includes two hard rules: **only http/https schemes are allowed** (a `Location` with `ftp://` or a custom scheme is rejected), and **the target host must not be empty**.

No DNS resolution happens at validation time. Full IP validation and DNS-rebinding protection run at connection time in the dialer (see [SSRF Protection](../security/ssrf)).

## Domain Whitelist

`Security.RedirectWhitelist` restricts redirect targets to trusted domains to defend against open-redirect attacks:

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "*.cdn.example.com", // wildcard: matches strict subdomains, not the bare domain
}

client, err := httpc.New(cfg)
```

Matching rule details:

- **Exact match**: `api.example.com` matches only itself.
- **Wildcard**: `*.cdn.example.com` matches **strict subdomains** (e.g. `img.cdn.example.com`) but not the bare domain `cdn.example.com`; to allow both, list both.
- The comparison target is the `Location` target's **hostname** (without port or scheme), normalized before comparison: surrounding whitespace ignored, case-insensitive.

Once set, requests redirected to domains outside the whitelist are rejected; redirect targets also pass SSRF IP validation. When handling untrusted URLs, combine this with `SecureConfig` or a whitelist.

## Handling Redirects Manually

When per-hop inspection, conditional following, or custom logging is required, disable automatic following and loop manually. Two constraints apply:

1. A `Location` without scheme and host is a **relative address**; resolve it against the current URL into an absolute one before requesting it.
2. A manual loop does not go through the whitelist checks, but the connection-layer SSRF IP validation still applies when each hop establishes its connection.

```go
package main

import (
	"fmt"
	"log"
	"net/url"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Security.FollowRedirects = false

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	currentURL := "https://httpbin.org/redirect/3"
	base, err := url.Parse(currentURL)
	if err != nil {
		log.Fatal(err)
	}

	for i := 0; i < 5; i++ {
		result, err := client.Get(currentURL)
		if err != nil {
			log.Fatal(err)
		}
		if !result.IsRedirect() {
			fmt.Println("Reached final destination:", currentURL)
			break
		}

		location := result.Response.Headers.Get("Location")
		if location == "" {
			fmt.Println("Redirect response has no Location header, stopping")
			break
		}

		// Resolve a relative address against the current URL
		next, err := base.Parse(location)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("Hop %d: %s\n", i+1, next.String())

		currentURL = next.String()
		base = next
	}
}
```

:::tip Security responsibility in manual loops
The whitelist and redirect-target pre-checks that apply during automatic following do not apply to manual loops. When processing `Location` from untrusted sources, validate the target domain inside the loop (or reuse the whitelist logic). Connection-layer SSRF validation still applies, but domain-level control is the caller's responsibility.
:::

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| A generic `io.Reader` body receives 307/308 and is not followed | The stream cannot be rewound and the request has no retries in effect to buffer it into `[]byte`, so `GetBody` cannot be set (same as net/http) | Switch to a `[]byte`/string/JSON body, enable retries for that request, or loop manually |
| `WithMaxRedirects(0)` did not disable following | `0` is the "unset" sentinel and falls back to the default of 10 | Use `WithFollowRedirects(false)` |
| A 300/399 carrying `Location` did not jump | The engine only follows 301/302/303/307/308 | Handle it with `IsRedirect()` + `Location` |
| Query parameters "lost" after a jump | The target query string is decided entirely by `Location`; the client does not merge the original request's parameters | Have the server include the needed parameters in `Location` |
| Identifying the final domain | `RedirectChain` does not include the final URL | Read `result.Request.URL` |
| Request returns 401 after a cross-origin jump | `Authorization`/`Cookie` were stripped cross-origin (by design) | Re-authenticate against the new domain, or have the server redirect within the same domain |

## Next Steps

- [Request and Response](./request-response) - Request options and response handling
- [SSRF Protection](../security/ssrf) - SSRF checks during redirects in detail
- [Error Handling](./error-handling) - ErrorType classification and error matching
- [Configuration API](../api-reference/client-config/config) - RequestDefaults and security field reference

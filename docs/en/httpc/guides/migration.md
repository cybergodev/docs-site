---
sidebar_label: "Migrating from net/http"
title: "Migrating from net/http - CyberGo HTTPC | Migration Guide"
description: "Migrate from net/http to CyberGo HTTPC: full API mapping tables, error-model differences, five-level timeouts, Transport mapping, and a step-by-step checklist."
sidebar_position: 130
---

# Migrating from net/http

Migrating from `net/http` to HTTPC involves three kinds of differences: idioms that can be replaced mechanically, APIs whose semantics changed, and default behaviors that need re-checking. Each is mapped below, and all behavior descriptions follow the source code.

## Compatibility Overview: Built on Top of net/http

HTTPC is not a replacement for `net/http`; it is an enhancement layer built on top of its transport. The underlying engine is still `http.Client` and `http.Transport`: connection reuse, HTTP/2 negotiation, TLS sessions, and proxy tunnels are all executed by the standard library.

HTTPC layers security validation, a retry engine, a middleware chain, and the `Result` transformation on top (see the FAQ entry ["How does HTTPC relate to net/http?"](../faq/#how-does-httpc-relate-to-net-http)).

**What stays the same after migration:**

- **Transport-layer behavior** — connection-pool reuse, HTTP/2 negotiation, and TLS session resumption match the standard library, so migration does not change performance characteristics;
- **Types are reused as-is** — `http.Cookie`, `tls.Config`, `context.Context`, `io.Reader`, and `http.Header` are used unchanged, with no adapter layer;
- **Mental model** — package-level functions correspond to `http.Get`, a Client instance corresponds to `http.Client`, and context is passed the same way (see the two-layer API architecture in [Core Concepts](../getting-started/concepts)).

**What migration adds:**

- Enforced TLS 1.2+, SSRF protection, CRLF-injection validation, and response-body size limits (secure by default);
- Retries with exponential backoff (honors `Retry-After`; the timeout budget is shared across retries);
- An onion-model middleware chain (logging/metrics/audit/request ID);
- A one-stop `Result` wrapper — the response-body lifecycle is managed automatically, no `Close()` needed.

The same request, before and after migration:

```go
package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	resp, err := http.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close() // must close manually, otherwise the connection leaks

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(err)
	}

	fmt.Println(resp.StatusCode) // 200
	fmt.Println(len(body))       // response byte count
}
```

```go
package main

import (
	"fmt"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://httpbin.org/get")
	if err != nil {
		panic(err) // network-layer errors only
	}

	fmt.Println(result.StatusCode())   // 200
	fmt.Println(len(result.RawBody())) // response byte count (already in memory, nothing to close)
}
```

The migrated code is shorter, and TLS policy, SSRF protection, and up to 3 retries are enabled by default.

## API Mapping Tables

### Client and Requests

| net/http idiom | HTTPC equivalent | Key difference |
|----------------|------------------|----------------|
| `http.Get(url)` | `httpc.Get(url)` | Both are package-level functions + a shared default instance (lazily initialized) |
| `http.Post(url, ct, body)` | `httpc.Post(url, httpc.WithJSON(data))` | The request body is declared via `With*` options; Content-Type is set automatically |
| `http.PostForm(url, values)` | `httpc.Post(url, httpc.WithForm(m))` | `WithForm` takes a `map[string]string`; for `url.Values` use `WithBody(values, httpc.BodyForm)` |
| `http.Head(url)` | `httpc.Head(url)` | One-to-one; `Put/Patch/Delete/Options` work the same way |
| `client := &http.Client{...}` | `httpc.New(cfg)` / `httpc.NewDefault()` | Returns the `Client` interface; holds a connection pool, release with `Close()` |
| `http.DefaultClient` | The default client inside package-level functions | Lazy singleton; `SetDefaultClient` takes over, `CloseDefaultClient` releases and it auto-rebuilds |
| `http.NewRequest` + `client.Do(req)` | `client.Get(url, opts...)` and other verb methods | No need to build an `*http.Request`; method and URL are passed directly |
| `http.NewRequestWithContext` + `Do` | `client.Request(ctx, method, url, opts...)` | The generic form, any method string |
| `req.Header.Set(k, v)` | `httpc.WithHeader(k, v)` / `WithHeaderMap(m)` | Header keys and values are CRLF-injection validated; invalid values return `ErrInvalidHeader` |
| `req.Header.Set("User-Agent", ua)` | `httpc.WithUserAgent(ua)` | Instance-level default via `cfg.Defaults.UserAgent` |
| `req.SetBasicAuth(u, p)` | `httpc.WithBasicAuth(u, p)` | Format-validated |
| `req.AddCookie(&http.Cookie{...})` | <code v-pre>httpc.WithCookies([]http.Cookie{{...}})</code> | Takes a cookie slice (a single cookie is a one-element slice); name-value only via `WithCookieMap`, raw header string via `WithCookieString` |
| `req.URL.Query()` string assembly | `httpc.WithQuery(k, v)` / `WithQueryMap(m)` | Values support common scalars and `fmt.Stringer`; encoded and merged into the URL automatically |
| `jar, _ := cookiejar.New(nil)` on `client.Jar` | `cfg.Connection.EnableCookies = true` | Or use a `DomainClient` that maintains cookies and common headers automatically (see [Domain Sessions](./domain-session)) |
| `client.CheckRedirect = func(...)` | `cfg.Security.FollowRedirects` / `MaxRedirects` | Per-request `WithFollowRedirects(false)`; redirect domain whitelist via `Security.RedirectWhitelist` (see [Redirects](./redirects)) |
| Proxy: `Transport.Proxy` | `cfg.Connection.ProxyURL` / `ProxyPool` / `EnableSystemProxy` | The three modes take effect by priority; see [Proxy & Proxy Pool](./proxy) |

### Response Handling

| net/http idiom | HTTPC equivalent | Key difference |
|----------------|------------------|----------------|
| `resp.StatusCode` | `result.StatusCode()` | Nil-safe accessor; status checks via `IsSuccess()` / `IsClientError()` / `IsServerError()` / `IsRedirect()` |
| `resp.Status` / `resp.Proto` | `result.Response.Status` / `result.Proto()` | Protocol version such as `HTTP/1.1` |
| `resp.Header.Get(k)` | `result.Response.Headers.Get(k)` | Still a standard `http.Header`, case-insensitive |
| `io.ReadAll(resp.Body)` | `result.Body()` / `result.RawBody()` | The response body has already been read into memory and copied; decompression is automatic |
| `defer resp.Body.Close()` | No equivalent | Do **not** look for a close hook — connections are managed by the pool, `Result` is left to the GC |
| `json.NewDecoder(resp.Body).Decode(&v)` | `result.Unmarshal(&v)` | An empty body returns the sentinel error `ErrResponseBodyEmpty` (not `io.EOF`, see below) |
| `resp.Cookies()` | `result.ResponseCookies()` / `result.GetCookie(name)` | Also `GetRequestCookie` to inspect the cookies actually sent |
| `resp.ContentLength` | `result.Response.ContentLength` | — |
| `resp.Request` (final request after redirects) | `result.Request` | Contains `URL` / `Method` / `Headers` / `Cookies` |
| `io.Copy(f, resp.Body)` to disk | `result.SaveToFile(path)` | For large files switch to `Download` (streaming, resumable; see [File Transfer](./file-transfer)) |
| (no equivalent) | `result.Meta` | New in HTTPC: `Duration` / `Attempts` / `RedirectChain` / `ProxyURL` |
| `resp.Trailer` | No equivalent | `Result` does not expose trailers; trailer-dependent scenarios are not supported yet |

## Error-Model Differences

This is the part where migration most often goes wrong. Start with what is the same: neither library treats 4xx/5xx as an `error` — `err` only means the request could not be completed successfully. The differences are the shape of `err`, the response-body lifecycle, and retry behavior:

| Dimension | net/http | HTTPC |
|-----------|----------|-------|
| Error shape | The raw transport error wrapped in `*url.Error` | Classified `*ClientError` (12-value `ErrorType` enum) |
| How to classify | Type assertions (`net.Error`, `net.DNSError`, `x509.UnknownAuthorityError`…) or string matching | Extract with `errors.As`, then read `Code()` / `IsRetryable()` / `Attempts`; sentinel errors via `errors.Is` |
| Response when `err != nil` | `resp` may be non-nil (when `CheckRedirect` returns an error it carries the last response) | `result` is always nil — no need to nil-check the response |
| Body read errors | Surface at `io.ReadAll` / `Decode` time (`io.EOF`, `unexpected EOF`) | Already read during the request phase; a read failure is returned as a `ClientError` (`ErrorTypeResponseRead`) with `err` |
| Empty body + JSON decode | `Decode` returns `io.EOF` | `Unmarshal` returns `ErrResponseBodyEmpty` |
| Retries | None — errors go straight to the caller | Timeouts/transport errors and 408/429/500/502/503/504 are retried automatically; exhausted network errors return an `error`, exhausted retryable status codes return the **last response** |
| URLs in error messages | Printed as-is (including credentials when present) | Sanitized automatically (credentials `***:***`, sensitive params `[REDACTED]`) |

Typical error handling before migration:

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

func main() {
	resp, err := http.Get("https://api.example.com/users/42")
	if err != nil {
		// *url.Error: connection failures, timeouts, and TLS errors all
		// surface here; further classification needs type assertions or
		// string matching
		panic(err)
	}
	defer resp.Body.Close()

	// 4xx/5xx are not errors: normal path, status code checked manually
	if resp.StatusCode != http.StatusOK {
		fmt.Println("HTTP error:", resp.StatusCode)
		return
	}

	var user map[string]any
	// Decode returns io.EOF on an empty body — a commonly missed branch
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil && !errors.Is(err, io.EOF) {
		panic(err)
	}
	fmt.Println(user["name"])
}

// Output (depends on the server's response):
// HTTP error: 404
```

After migration:

```go
package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://api.example.com/users/42")
	if err != nil {
		// Network-layer error: already classified as a ClientError (12 types),
		// carrying a short code and retryability
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) {
			log.Printf("error type: %s, retryable: %v, attempts: %d",
				clientErr.Code(), clientErr.IsRetryable(), clientErr.Attempts)
		}
		panic(err)
	}

	// 4xx/5xx are not errors: check via Result's status helpers
	if !result.IsSuccess() {
		fmt.Println("HTTP error:", result.StatusCode())
		return
	}

	var user map[string]any
	// An empty body returns the sentinel error ErrResponseBodyEmpty,
	// matched precisely with errors.Is
	if err := result.Unmarshal(&user); err != nil {
		if errors.Is(err, httpc.ErrResponseBodyEmpty) {
			fmt.Println("(empty response body)")
			return
		}
		panic(err)
	}
	fmt.Println(user["name"])
}

// Output (depends on the server's response):
// HTTP error: 404
```

Common error-classification scenarios side by side (`clientErr` is the `*httpc.ClientError` extracted via `errors.As`):

| What to detect | net/http idiom | HTTPC idiom |
|-------------------------|----------------|-------------|
| Timeout | `var ne net.Error` + `ne.Timeout()` | `clientErr.Type == httpc.ErrorTypeTimeout` |
| DNS failure | `var de *net.DNSError` + `errors.As` | `httpc.ErrorTypeDNS` |
| Certificate validation failure | `var ce x509.UnknownAuthorityError` + `errors.As` | `httpc.ErrorTypeCertificate` |
| TLS protocol error | String matching `"tls:"` | `httpc.ErrorTypeTLS` |
| Connection refused/reset | `var oe *net.OpError` + `errors.As` | `httpc.ErrorTypeNetwork` |
| Context canceled/deadline | `errors.Is(err, context.Canceled)` | `httpc.ErrorTypeContextCanceled` (never retried) |

For the complete picture of error classification, retryability, and sentinel errors, see [Error Handling](./error-handling) and [Error Types](../api-reference/types/errors).

## Request Body, Header, and Context Migration

The three-step `net/http` flow — "build the request → set fields one by one → Do" — becomes "verb method + declarative options" in HTTPC.

<!-- check-code: skip -->
```go
// net/http: manual serialization, manual headers, manual query-string assembly
payload, _ := json.Marshal(map[string]any{"name": "test"})
req, err := http.NewRequest("POST", "https://api.example.com/orders", bytes.NewReader(payload))
if err != nil {
    log.Fatal(err)
}
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Authorization", "Bearer "+token)

q := req.URL.Query()
q.Set("page", "2")
req.URL.RawQuery = q.Encode()

resp, err := client.Do(req)
```

<!-- check-code: skip -->
```go
// HTTPC: options are the request; Content-Type is set automatically and
// query parameters are encoded automatically
result, err := client.Post("https://api.example.com/orders",
    httpc.WithJSON(map[string]any{"name": "test"}),
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 2),
)
```

Mapping of standard-library operations to request options:

| Standard-library operation | HTTPC option |
|----------------------------|--------------|
| `json.Marshal` + `bytes.NewReader` + Content-Type | `WithJSON(data)` (equivalent to `WithBody(data, BodyJSON)`) |
| `xml.Marshal` | `WithXML(data)` |
| `url.Values` form encoding | `WithForm(m)` / `WithBody(values, httpc.BodyForm)` |
| Hand-written `multipart.Writer` boundaries | `WithFile(field, name, content)` / `WithFormData(form)` |
| `bytes.NewReader(raw)` raw body | `WithBody(raw)` (type auto-detected) / `WithBinary(data, ct...)` |
| `req.Header.Set(k, v)` | `WithHeader(k, v)` / `WithHeaderMap(m)` |
| `req.SetBasicAuth` / hand-assembled Bearer | `WithBasicAuth(u, p)` / `WithBearerToken(t)` |
| `req.AddCookie` | `WithCookies(cs)` / `WithCookieMap(m)` / `WithCookieString(s)` |
| `io.Reader` streaming request body | `WithBody(reader)` (passed through as-is; unlimited with the default `Security.MaxRequestBodySize = 0`, enforced at send time once a limit is set; `io.LimitReader` is still recommended for untrusted sources) |

Context usage matches the standard library: `context.Context` is still the carrier of timeouts and cancellation, and only the position where it is passed differs:

<!-- check-code: skip -->
```go
// net/http: the ctx goes into the request object
req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
resp, err := client.Do(req)
```

<!-- check-code: skip -->
```go
// HTTPC: ctx is passed directly as the first argument
result, err := client.Request(ctx, "GET", url)

// Convenience methods (Get/Post, etc.) do not take a ctx — swap it in
// with WithContext:
result, err = client.Get(url, httpc.WithContext(ctx))
```

For the complete option list, see [Request and Response](./request-response) and the [Request Options API](../api-reference/core/options).

## Timeout System Comparison

`http.Client.Timeout` is a single timeout covering the whole process; HTTPC splits it into five independently configurable levels and adds a per-request override:

| net/http | HTTPC field | Default | Scope |
|----------|-------------|---------|-------|
| `http.Client.Timeout` | `Timeouts.Request` | 180s | Total request timeout, **covering all retries and backoff waits** |
| `Transport.DialContext` (`net.Dialer{Timeout}`) | `Timeouts.Dial` | 10s | TCP connection establishment |
| `Transport.TLSHandshakeTimeout` | `Timeouts.TLSHandshake` | 10s | TLS handshake (HTTPS only) |
| `Transport.ResponseHeaderTimeout` | `Timeouts.ResponseHeader` | 0 (disabled) | Waiting for response headers; a positive value acts as a transport-level hard cap |
| `Transport.IdleConnTimeout` | `Timeouts.IdleConn` | 90s | How long idle connections are kept |
| (no per-request override) | `WithTimeout(d)` | — | Per-request override of the total budget; capped at 30 minutes |

<!-- check-code: skip -->
```go
// net/http: a single timeout covering the whole process (no retries)
client := &http.Client{Timeout: 30 * time.Second}
```

<!-- check-code: skip -->
```go
// HTTPC: instance-level total budget + per-request override
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 30 * time.Second // total budget including all retries
client, _ := httpc.New(cfg)

result, err := client.Get(url, httpc.WithTimeout(30*time.Second)) // override for this request
```

Three semantic differences:

- **The total budget is shared across retries** — `Timeouts.Request` / `WithTimeout` covers all retry attempts and backoff waits; the clock does not restart per attempt;
- **`ResponseHeader` is special** — defaults to 0 (disabled), leaving the total budget fully in charge; once set to a positive value it applies to **all requests** sharing the same client and, when shorter than `WithTimeout`, fires before it (defense-in-depth against slowloris; `SecureConfig()` ships it configured);
- **Long-running responses** — for APIs that need long waits (AI APIs and the like), give `WithTimeout` enough budget; with the default configuration, a response-header timeout does not cut off slow responses.

See the timeout section of [Request and Response](./request-response) and the FAQ entry [How do I choose timeouts?](../faq/#how-do-i-choose-timeouts).

## Transport Customization Migration

The commonly used `http.Transport` tuning fields map to the corresponding sub-structures of `Config` in HTTPC:

| `http.Transport` / `http.Client` field | HTTPC configuration | Default |
|------------------------------------------|----------------------|---------|
| `MaxIdleConns` | `Connection.MaxIdleConns` | 50 |
| `MaxConnsPerHost` / `MaxIdleConnsPerHost` | `Connection.MaxConnsPerHost` | 10 |
| `Proxy: http.ProxyFromEnvironment` | `Connection.EnableSystemProxy` | false |
| Custom `Proxy` function | `Connection.ProxyURL` (single proxy) / `ProxyPool` (pool rotation) | empty |
| `TLSClientConfig` | `Security.TLSConfig` | nil |
| `ForceAttemptHTTP2` | `Connection.EnableHTTP2` | true |
| `ResponseHeaderTimeout` | `Timeouts.ResponseHeader` | 0 (disabled) |
| `MaxResponseHeaderBytes` | `Connection.MaxResponseHeaderBytes` | 0 (standard-library default 1MB) |
| `CheckRedirect` | `Security.FollowRedirects` / `MaxRedirects` + `Security.RedirectWhitelist` | true / 10 |
| Custom `DialContext` (dialer) | No direct entry point | SSRF validation is wrapped into the dial layer |

An existing `tls.Config` (mTLS, custom CAs, cipher suites) migrates as-is:

```go
package main

import (
	"crypto/tls"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	// An existing tls.Config (custom CA, cipher suites, mTLS client
	// certificates) migrates as-is
	tlsCfg := &tls.Config{
		MinVersion: tls.VersionTLS12,
		MaxVersion: tls.VersionTLS13,
	}

	cfg := httpc.DefaultConfig()
	cfg.Security.TLSConfig = tlsCfg
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err) // network-layer error
	}
	fmt.Println(result.StatusCode()) // 200
}
```

:::warning Source of the TLS version policy
Once `Security.TLSConfig` is set, the `MinTLSVersion` / `MaxTLSVersion` fields are ignored and the TLS version policy follows the `tls.Config` that was passed in. In that case set `MinVersion` explicitly and keep it at TLS 1.2 or higher.
:::

Two boundaries:

- **No custom-Transport injection point** — HTTPC creates and manages the `*http.Transport` itself (SSRF validation is wrapped into the dial function, redirect policy is injected via `CheckRedirect`); `Config` does not expose the whole Transport. For extreme dial customization, first check whether `Config.Connection` / `Config.Security` already covers it.
- **Use `Doer` to replace the whole implementation** — a test mock or alternate implementation only needs the single-method interface `Doer` (`Request(ctx, method, url, opts...)`), without implementing the full `Client` interface; see [Testing](./testing).

## Migration Pitfalls Checklist

These behavioral differences most often cause problems when moving from `net/http`:

**1. `resp.Body` does not need (and must not) be closed manually**

What `Result` holds is the already-read and copied bytes. HTTPC performs the read, drain, and close internally, and the underlying connection is managed by the pool. When migrating, **delete every `defer resp.Body.Close()`** and do not look for a close hook. See the FAQ entry ["Do I need to close the response body manually?"](../faq/#do-i-need-to-close-the-response-body-manually) for details.

**2. Retries are on by default — but only for idempotent requests**

`net/http` never retries. HTTPC by default retries timeouts/transport errors and 408/429/500/502/503/504, up to 3 times, and **only for idempotent requests** (GET/HEAD/PUT/DELETE/OPTIONS/TRACE). POST, PATCH, and custom methods **execute exactly once and are never retried**.

One risk needs handling: after opting into non-idempotent retries with `WithRetryNonIdempotent(true)`, order-placement and payment-style endpoints can receive duplicate submissions and must be handled:

<!-- check-code: skip -->
```go
// Dangerous: once opted in, POST takes part in the (up to 3) retries
result, err := client.Post("https://api.example.com/orders",
    httpc.WithJSON(order),
    httpc.WithRetryNonIdempotent(true),
)

// Safe (option 1): keep the default — non-idempotent endpoints execute once (recommended, no handling needed)
result, err := client.Post("https://api.example.com/orders", httpc.WithJSON(order))

// Safe (option 2): if you do need retries, deduplicate via a server-side idempotency key (recommended)
result, err = client.Post("https://api.example.com/orders",
    httpc.WithJSON(order),
    httpc.WithHeader("Idempotency-Key", orderID),
)
```

For mitigation strategies, see the FAQ entry ["Can retries cause duplicate POST submissions?"](../faq/#can-retries-cause-duplicate-post-submissions).

**3. SSRF protection is on by default — internal networks and localhost are blocked**

After migrating from `net/http`, accessing `127.0.0.1`, `10.x`, `192.168.x`, and other private/reserved addresses fails outright (`net/http` has no such restriction). For local development, choose in order of increasing blast radius:

<!-- check-code: skip -->
```go
// Per-request exemption (recommended, smallest blast radius)
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)

// Client-level precise CIDR exemption (e.g. VPC / Tailscale)
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
```

For the full policy, see [SSRF Protection](../security/ssrf).

**4. The default client is a lazy singleton — use an explicit instance for long-running services**

Package-level functions share an internally managed default client (rebuilt automatically after being closed). Production services should create an explicit instance to control configuration and lifecycle; requests after `Close()` return `ErrClientClosed`:

<!-- check-code: skip -->
```go
// Long-running service: explicit instance, shared process-wide, Close when done
client, err := httpc.NewDefault()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

// To make package-level functions use your configuration: take over the
// default client (the old instance is closed automatically)
custom, err := httpc.New(httpc.SecureConfig())
if err != nil {
    log.Fatal(err)
}
if err := httpc.SetDefaultClient(custom); err != nil {
    log.Fatal(err)
}
```

**5. Match sentinel errors with `errors.Is` / `errors.As`, not string matching**

Sentinel errors such as `ErrClientClosed`, `ErrResponseBodyEmpty`, `ErrResponseBodyTooLarge`, and `ErrInvalidHeader` are tested with `errors.Is`; classified errors are extracted as `*ClientError` with `errors.As`. The error chain unwraps down to the underlying cause (`Cause`).

**6. Response bodies have default caps**

Regular requests cap the response body at 10MB by default and the decompressed body at 100MB (guarding against memory exhaustion and decompression bombs); exceeding a cap returns an error.

Old code that downloads large files with `http.Get` + `io.Copy` should switch to `Download` (streams to disk, resumable, progress callbacks). The caps are adjustable via `Security.MaxResponseBodySize` / `MaxDecompressedBodySize`.

**7. Redirects have defaults**

Redirects are followed by default (up to 10). `WithMaxRedirects(0)` / `MaxRedirects = 0` is the "unset" sentinel value, not a disable. To stop following, use `WithFollowRedirects(false)` or `Security.FollowRedirects = false`. See [Redirects](./redirects).

## Step-by-Step Migration Checklist

Execute in order; every step can be verified independently:

1. **Install the dependency** — `go get github.com/cybergodev/httpc`, and swap `"github.com/cybergodev/httpc"` in wherever `"net/http"` client calls live (types like `http.Cookie` still come from the standard library).
2. **Mechanically replace request calls** — `http.Get` → `httpc.Get`, `client.Do(req)` → `client.Get/Post/...`; `http.Client` literals → `httpc.New(cfg)`.
3. **Delete resource-management code** — remove `defer resp.Body.Close()` and `io.ReadAll`; switch to `result.Body()` / `result.RawBody()` / `result.Unmarshal(&v)`.
4. **Rework error handling** — in the `err` branch, extract `ClientError` with `errors.As` as needed; turn status-code checks into the `result.IsSuccess()` family; replace the `io.EOF` empty-body branch with `errors.Is(err, httpc.ErrResponseBodyEmpty)`.
5. **Map timeouts** — `http.Client.Timeout` → `cfg.Timeouts.Request`; per-request differences via `WithTimeout`; place former Transport-level timeouts per [Timeout System Comparison](#timeout-system-comparison).
6. **Migrate Transport tuning** — pool sizes, proxies, TLS, and HTTP/2 land in `Config.Connection` / `Config.Security` per the table above; move `tls.Config` into `Security.TLSConfig`.
7. **Handle the secure defaults** — add SSRF exemptions for internal-network/localhost calls; confirm the response-body caps fit the response sizes of the APIs in use.
8. **Review the retry impact** — non-idempotent POSTs execute exactly once by default, so no handling is needed; if retries are enabled, add an idempotency key; confirm the retry budget matches the service timeouts.
9. **Finish lifecycle housekeeping** — long-running services use an explicit instance + `defer client.Close()`; confirm no client is created per request on the request path.
10. **Regression-test** — run the existing integration tests; focus on error paths (network loss/timeouts/4xx/5xx) and large-response scenarios.

## Next Steps

With the migration done, return to the main guide track to go deeper:

- **[Request and Response](./request-response)** - Complete request options and `Result` response handling
- **[Tutorial](./tutorial)** - Build a complete GitHub API client in 30 minutes to consolidate typical post-migration patterns
- **[Core Concepts](../getting-started/concepts)** - Two-layer API architecture, configuration system, and request lifecycle
- **[FAQ](../faq/)** - Source-grounded answers on retries, timeouts, proxies, cookies, and other frequent questions

---
sidebar_label: "Domain Client & Sessions"
title: "Domain Client and Sessions - CyberGo HTTPC | Cookie Mgmt"
description: "HTTPC domain client guide: NewDomain URL joining, path-traversal protection, SetHeader session headers, cookie auto-capture, and CookieSecurity validation."
sidebar_position: 5
---

# Domain Client and Sessions

The domain client (DomainClient) is a session-management client for a single domain, automatically maintaining cookies and headers.

Three components, each with its own job:

| Component | Responsibility | When to use |
|-----------|----------------|-------------|
| `Client` | General-purpose HTTP client: configuration, connection pool, retries, middleware | Requests spread across many domains, no cross-request state needed |
| `DomainClient` | Domain-scoped client: automatic URL joining + built-in session | Pinned to one API domain, needs headers/cookies maintained across requests |
| `SessionManager` | Thread-safe session state store (headers + cookies), usable standalone | Managing session state yourself, combining with any Client |

## Creating a Domain Client

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Cookies are enabled automatically
dc.SetHeader("Authorization", "Bearer "+token)

// Send requests with relative paths
result, err := dc.Get("/users")
```

:::tip
`NewDomain` automatically enables cookie management (`EnableCookies = true`) — no manual configuration needed.
:::

Three things happen automatically at creation:

1. **baseURL validation**: it must include a scheme and host (e.g. `https://api.example.com`), otherwise an error is returned
2. **Cookies force-enabled**: the incoming configuration's `Connection.EnableCookies` is ignored — the domain client always ships with cookie management
3. **Session creation**: a `SessionManager` is created internally (with `DefaultSessionConfig` by default); headers and cookies both live there

`NewDomain` also accepts a full Config for custom timeouts, retries, and so on (in that case `dc.Get` and the other methods behave exactly like a plain client's):

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 15 * time.Second
	cfg.Retry.MaxRetries = 2
	cfg.Defaults.UserAgent = "my-app/1.0"

	dc, err := httpc.NewDomain("https://api.github.com", cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer dc.Close()

	if err := dc.SetHeader("Accept", "application/vnd.github+json"); err != nil {
		log.Fatal(err)
	}

	result, err := dc.Get("/repos/golang/go")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.StatusCode()) // 200
}
```

## URL Joining Rules

The first argument of `Get`/`Post` and the other methods is a path relative to the base URL; joining rules:

| Input path | Result | Rule |
|-----------|--------|------|
| `/users` | `{base}/users` | Relative paths are joined onto the base path |
| `/users/` | `{base}/users/` | The trailing slash is preserved |
| `https://other.com/data` | Used as-is | Full URLs starting with `http://`/`https://` skip joining |
| `/users?page=2` | `{base}/users?page=2` | The query string is preserved; if the base carries its own query parameters the two are merged |
| `""` | `{base}` | An empty path returns the base itself |

:::warning Path traversal protection
If the base URL carries a path prefix (e.g. `https://example.com/api/v1`), the joined result must stay inside that prefix; paths trying to escape it with `..` return a `path escapes base URL scope` error and no request is sent.
:::

## Session Header Management

```go
// Set session headers (automatically included with all subsequent requests)
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// Set in bulk
dc.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
    "X-Version":     "2.0",
})

// Delete and clear
dc.DeleteHeader("X-Version")
dc.ClearHeaders()

// Query
headers := dc.GetHeaders()
```

All keys and values go through the same CRLF-injection validation as `WithHeader`; invalid keys or values return an error. `GetHeaders()` returns a **copy** — modifying it does not affect the session.

A single request can override a session header with an option (options are applied after the session headers):

```go
dc.SetHeader("X-API-Version", "v1")

// This request sends v2
result, _ := dc.Get("/data", httpc.WithHeader("X-API-Version", "v2"))
```

Note: as described in the next section, `v2` is written back to the session, so subsequent requests will also send `v2`.

## Cookie Management

```go
// Set a cookie
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc123"})

// Set in bulk
dc.SetCookies([]*http.Cookie{
    {Name: "session", Value: "abc123"},
    {Name: "lang", Value: "en"},
})

// Response cookies are captured automatically
result, _ := dc.Get("/login")
// Set-Cookie from the server is stored into the session automatically

// Query
cookie := dc.GetCookie("session")
cookies := dc.GetCookies()

// Delete and clear
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::tip
After every request, cookies returned by the server are automatically updated into the session — no manual handling needed.
:::

Automatic cookie maintenance covers three paths:

- **Response write-back**: after each request finishes, `Set-Cookie` from the response is written into the session automatically (the `Download` method used for downloads captures response cookies as well)
- **Validation**: before writing, the same validity checks as `WithCookies` apply; when a cookie security policy is configured (see "Cookie Security Validation" below), non-compliant cookies are **silently skipped** without affecting the others
- **Copy semantics**: `GetCookie`/`GetCookies` return copies of the cookies — modifying the returned values does not pollute the session's internal state

### Automatic Persistence of Request Options

Cookies and headers passed via **request options** are also captured into the session and keep applying to subsequent requests:

```go
// First request: the cookie and header passed via options...
_, err := dc.Get("/login",
    httpc.WithCookies([]http.Cookie{{Name: "session", Value: "abc"}}),
    httpc.WithHeader("X-Client", "mobile"),
)
if err != nil {
    log.Fatal(err)
}

// ...have been written into the session:
fmt.Println(dc.GetCookie("session").Value) // Output: abc
fmt.Println(dc.GetHeaders()["X-Client"])   // Output: mobile

// Later requests carry them automatically even without the options;
// passing the same name via an option again overwrites the session value
_, err = dc.Get("/profile")
```

:::warning Do not pass one-off headers via options
Headers/cookies in options are persisted to the session and apply to **all subsequent requests**. For one-shot headers whose value differs every time (e.g. an incrementing trace ID or a random nonce), remember to remove them with `DeleteHeader`/`DeleteCookie` after use, or send that request with the underlying `Client` instead.
:::

## Request Methods

```go
// Relative paths
result, _ := dc.Get("/users")
result, _ := dc.Post("/users", httpc.WithJSON(data))
result, _ := dc.Put("/users/1", httpc.WithJSON(data))
result, _ := dc.Patch("/users/1", httpc.WithJSON(data))
result, _ := dc.Delete("/users/1")
result, _ := dc.Head("/users/1")
result, _ := dc.Options("/users")

// With context
result, _ := dc.Request(ctx, "GET", "/users")

// Absolute URL (skips base URL joining)
result, _ := dc.Get("https://other-api.com/data")
```

:::warning Request options are applied twice
The domain client internally applies request options **twice** (once to capture session state, once for the actual request). Avoid options with side effects (e.g. counters, nonce generation); if you need such options, use the underlying `Client`.
:::

The `Download` method has the same signature as `Client.Download`; the path is likewise resolved relative to the base URL, and on completion the response cookies are captured into the session:

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "data.json"
dlCfg.Overwrite = true

result, err := dc.Download(ctx, "/export/data", dlCfg)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.FilePath, result.BytesWritten)
```

## Session Access

```go
// Basic information
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com" (host without the port)

// Access the underlying SessionManager
session := dc.Session()
if err := session.SetHeader("X-Trace-ID", traceID); err != nil {
    log.Fatal(err)
}
```

`DomainClient` embeds a `SessionManager` and thereby exposes all session methods, so `dc.SetHeader(...)` and `dc.Session().SetHeader(...)` are fully equivalent.

### Using SessionManager Standalone

A `SessionManager` can be created without a `DomainClient` and used as a thread-safe header/cookie store:

```go
session, err := httpc.NewSessionManagerDefault()
if err != nil {
    log.Fatal(err)
}

// Write state
if err := session.SetHeader("Authorization", "Bearer my-token"); err != nil {
    log.Fatal(err)
}
if err := session.SetCookies([]*http.Cookie{{Name: "session_id", Value: "abc123"}}); err != nil {
    log.Fatal(err)
}

// Backfill cookies from the response
result, err := client.Get("https://api.example.com/data")
if err != nil {
    log.Fatal(err)
}
session.UpdateFromResult(result)     // capture response cookies from the Result
session.UpdateFromCookies(cookies)   // bulk update from []*http.Cookie
```

Combined with a plain `Client`, you read `GetHeaders()`/`GetCookies()` yourself and turn them into `WithHeaderMap`/`WithCookies` options attached to requests (this is exactly how `DomainClient` injects session state into every request internally).

## Concurrency Semantics

- **SessionManager is concurrency-safe**: all read/write methods are protected by a `sync.RWMutex`; multiple goroutines can call `SetHeader`/`GetCookies` concurrently without extra locking
- **Session snapshots are eventually consistent**: the per-request sequence "read a session snapshot → send the request → write response cookies back" is not atomic — concurrent requests may read a slightly stale snapshot (e.g. a login cookie another request just received may not be visible to you yet); this is a deliberate trade-off, and the snapshot an individual request sees is always self-consistent
- **DomainClient is safe for concurrent use**: the methods themselves carry no extra locks and can be shared by multiple goroutines

:::tip
Operations that significantly change session state — logging in, refreshing a token — should avoid running concurrently with business requests, or be completed before issuing requests that depend on the new state.
:::

## Cookie Security Validation

You can configure a cookie security policy to accept only cookies that meet the security bar:

```go
dc, _ := httpc.NewDomainDefault("https://api.example.com")

// Set strict cookie security
session := dc.Session()
session.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
// Requires: Secure=true, HttpOnly=true, SameSite=Strict

// Cookies that fail the security requirements make SetCookie return an error
if err := dc.SetCookie(&http.Cookie{
    Name:  "insecure",
    Value: "test",
    // Missing Secure, HttpOnly -> rejected
}); err != nil {
    log.Println("Cookie rejected:", err)
}
```

Behavioral differences between the two validation entry points:

| Entry point | Behavior on non-compliance |
|-------------|----------------------------|
| `SetCookie` / `SetCookies` (explicit writes) | Returns an error; the cookie does not enter the session |
| Response write-back / option capture (automatic writes) | The cookie is **silently skipped**; everything else is processed as usual |

The policy applies to all subsequent writes after `SetCookieSecurity`. When creating a `SessionManager` standalone you can preconfigure it via `SessionConfig.CookieSecurity` (`NewDomain` uses the default session config internally, so call `SetCookieSecurity` after creation). For a lenient starting point use `DefaultCookieSecurityConfig()` (which enforces nothing by default) and tighten the fields as needed.

## Lifecycle and Reuse

```go
// Recommended: keep one DomainClient alive for the whole process, reusing
// the connection pool and session across requests
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// When the session expires (e.g. the token times out), reset the session and log in again
dc.ClearCookies()
dc.DeleteHeader("Authorization")
// ...run the login flow again, restoring state with SetCookie/SetHeader...
```

- `Close()` closes the underlying Client (connection pool, transport) and does **not** clear session headers/cookies (they live in the SessionManager); requests after the close return `ErrClientClosed`
- Do not create a new `DomainClient` per request — you lose connection reuse and session accumulation, and you may exhaust connections
- For whole-client changes such as switching the security policy, just build a new instance and discard the old one after `Close`

## Complete Example: REST API Client

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// Create the domain client
	dc, err := httpc.NewDomainDefault("https://api.example.com")
	if err != nil {
		log.Fatal(err)
	}
	defer dc.Close()

	// Log in to get a token
	loginResult, err := dc.Post("/auth/login", httpc.WithJSON(map[string]string{
		"username": "admin",
		"password": "secret",
	}))
	if err != nil {
		log.Fatal(err)
	}

	// Parse the token from the response
	var loginResp struct {
		Token string `json:"token"`
	}
	if err := loginResult.Unmarshal(&loginResp); err != nil {
		log.Fatal(err)
	}

	// Set the session header
	if err := dc.SetHeader("Authorization", "Bearer "+loginResp.Token); err != nil {
		log.Fatal(err)
	}

	// Subsequent requests automatically carry the token and cookies
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	users, err := dc.Request(ctx, "GET", "/users")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(users.StatusCode()) // 200
}
```

## Next Steps

- [Domain Client API](../api-reference/client-config/domain-client) - Complete API reference
- [Session Management API](../api-reference/client-config/session) - SessionManager reference
- [Request and Response](./request-response) - Basic request guide

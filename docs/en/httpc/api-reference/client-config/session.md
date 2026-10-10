---
sidebar_label: "Session Management"
title: "Session Management - CyberGo HTTPC | SessionManager"
description: "HTTPC SessionManager API: NewSessionManager, SessionConfig, SetHeader and SetCookie management, plus SetCookieSecurity validation."
sidebar_position: 30
---

# Session Management

SessionManager provides thread-safe cookie and header storage, embedded internally by DomainClient. It encapsulates a concurrency-safe store based on `sync.RWMutex`: all read operations use a read lock and write operations use a write lock, making it suitable for sharing session state across requests in high-concurrency scenarios.

:::tip When to use SessionManager directly
You usually do not need to create a SessionManager manually — the DomainClient created by `NewDomain` embeds one automatically. Scenarios where you would use SessionManager directly include: sharing a session across multiple DomainClients, switching cookie security policy at runtime, or bulk-extracting cookies from responses.
:::

## SessionConfig

```go
type SessionConfig struct {
    // CookieSecurity configures cookie security validation.
    // nil means no cookie security validation is performed.
    CookieSecurity *CookieSecurityConfig
}
```

| Field | Type | Description |
|------|------|------|
| `CookieSecurity` | `*CookieSecurityConfig` | Cookie security validation config; nil means no validation |

```go
func DefaultSessionConfig() SessionConfig
```

Returns the default config (no cookie security validation). See [NewSessionManager](#newsessionmanager) below for usage.

## NewSessionManager

```go
func NewSessionManager(cfg SessionConfig) (*SessionManager, error)
```

Creates a session manager. Pass a `SessionConfig` value, or use `NewSessionManagerDefault()` as a zero-argument shortcut. The current implementation always returns a nil error; the error return value is reserved for future config-validation extensions.

```go
// Using default config
sm, err := httpc.NewSessionManagerDefault()

// With config (strict cookie security validation enabled)
cfg := httpc.DefaultSessionConfig()
cfg.CookieSecurity = httpc.StrictCookieSecurityConfig()
sm, err := httpc.NewSessionManager(cfg)
```

### NewSessionManager vs NewSessionManagerDefault

| Constructor | Parameter | Applicable scenario |
|----------|------|----------|
| `NewSessionManager(cfg)` | Explicit SessionConfig | When you need a custom CookieSecurity policy |
| `NewSessionManagerDefault()` | None | Default config (no cookie security validation) |

`NewSessionManagerDefault()` is equivalent to `NewSessionManager(DefaultSessionConfig())`, symmetric with the main client's `NewDefault()` design.

## NewSessionManagerDefault

```go
func NewSessionManagerDefault() (*SessionManager, error)
```

Convenience constructor, equivalent to `NewSessionManager(DefaultSessionConfig())`.

```go
sm, err := httpc.NewSessionManagerDefault()
```

## Header Management

SessionManager maintains cross-request headers via the following methods. All methods are thread-safe: write operations (SetHeader/SetHeaders/DeleteHeader/ClearHeaders) acquire a write lock, and the read operation (GetHeaders) acquires a read lock.

### SetHeader

```go
func (s *SessionManager) SetHeader(key, value string) error
```

Adds or updates a single session header. All subsequent requests carry it automatically. Before the call, `validation.ValidateHeaderKeyValue` validates the key-value legality (intercepting control characters, CRLF injection, etc.); on failure it returns a wrapped error. A nil receiver returns `"session manager is nil"`.

```go
err := sm.SetHeader("Authorization", "Bearer "+token)
if err != nil {
    log.Fatalf("failed to set header: %v", err)
}
```

### SetHeaders

```go
func (s *SessionManager) SetHeaders(headers map[string]string) error
```

Adds or updates session headers in bulk. Each item is validated outside the lock first (any invalid item rejects the whole batch), then merged via `maps.Copy` inside the lock. Atomic semantics: either all succeed or none change.

```go
err := sm.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
    "X-Custom":      "value",
})
```

### DeleteHeader

```go
func (s *SessionManager) DeleteHeader(key string)
```

Deletes the specified session header by key. Silently does nothing if the key does not exist. Nil-receiver safe (returns directly).

### ClearHeaders

```go
func (s *SessionManager) ClearHeaders()
```

Clears all session headers, re-initializing to an empty map.

### GetHeaders

```go
func (s *SessionManager) GetHeaders() map[string]string
```

Returns a **deep-copy** of all session headers (a newly allocated map with copied values); the caller can modify the copy without affecting internal state. An empty session returns an empty map (not nil).

### Header-Management Method Overview

| Method | Signature | Lock | Description |
|------|------|----|------|
| `SetHeader` | `(key, value string) error` | Write | Single set, with validation |
| `SetHeaders` | `(headers map[string]string) error` | Write | Bulk set, atomic validation |
| `DeleteHeader` | `(key string)` | Write | Delete by key |
| `ClearHeaders` | `()` | Write | Clear all |
| `GetHeaders` | `() map[string]string` | Read | Returns a deep-copy |

The fully qualified method names are `SessionManager.SetHeader`, `SessionManager.SetHeaders`, `SessionManager.DeleteHeader`, `SessionManager.ClearHeaders`, and `SessionManager.GetHeaders`.

## Cookie Management

SessionManager maintains cross-request cookies via the following methods. All write operations validate legality through `validation.ValidateCookie`; if `CookieSecurity` is configured, security attributes (Secure/HttpOnly/SameSite) are additionally validated.

### SetCookie

```go
func (s *SessionManager) SetCookie(cookie *http.Cookie) error
```

Adds or updates a single session cookie. Validation flow: ① nil-cookie check; ② `ValidateCookie` basic validation; ③ if CookieSecurity is configured, run `validateCookieSecurity` (inside the write lock for thread safety). Any validation failure returns a wrapped error and does not modify storage.

```go
err := sm.SetCookie(&http.Cookie{
    Name:     "session",
    Value:    "abc123",
    Secure:   true,
    HttpOnly: true,
    SameSite: http.SameSiteStrictMode,
})
if err != nil {
    log.Fatalf("failed to set cookie: %v", err)
}
```

### SetCookies

```go
func (s *SessionManager) SetCookies(cookies []*http.Cookie) error
```

Sets cookies in bulk. Uses a **two-phase atomic write**: ① pre-validate the basic legality of every cookie outside the lock (nil check + ValidateCookie); ② run security validation item by item inside the lock — any failure returns an error immediately (already-validated items are not written either); ③ only after all pass are they stored uniformly. This guarantees atomicity for bulk operations — no "partial write" intermediate state.

### DeleteCookie

```go
func (s *SessionManager) DeleteCookie(name string)
```

Deletes a cookie by name. Silently does nothing if the name does not exist.

### ClearCookies

```go
func (s *SessionManager) ClearCookies()
```

Clears all cookies, re-initializing to an empty map.

### GetCookies

```go
func (s *SessionManager) GetCookies() []*http.Cookie
```

Returns a **deep-copy** of all cookies. Uses a contiguous-backing-array optimization: pre-allocates an `[]http.Cookie` of length N with all cookie structs laid out contiguously, and the returned `[]*http.Cookie` points into that array. This reduces N independent heap allocations to 2 (the backing array + the pointer slice), significantly reducing GC pressure. An empty session returns nil.

### GetCookie

```go
func (s *SessionManager) GetCookie(name string) *http.Cookie
```

Returns a **deep-copy** of a cookie by name, or nil if it does not exist.

### Cookie-Management Method Overview

| Method | Signature | Lock | Validation |
|------|------|----|------|
| `SetCookie` | `(cookie *http.Cookie) error` | Write | ValidateCookie + optional CookieSecurity |
| `SetCookies` | `(cookies []*http.Cookie) error` | Write | Two-phase atomic validation |
| `DeleteCookie` | `(name string)` | Write | None |
| `ClearCookies` | `()` | Write | None |
| `GetCookies` | `() []*http.Cookie` | Read | None (returns a deep-copy) |
| `GetCookie` | `(name string) *http.Cookie` | Read | None (returns a deep-copy) |

The fully qualified method names are `SessionManager.SetCookie`, `SessionManager.SetCookies`, `SessionManager.DeleteCookie`, `SessionManager.ClearCookies`, `SessionManager.GetCookies`, and `SessionManager.GetCookie`.

## Cookie Security

### SetCookieSecurity

```go
func (s *SessionManager) SetCookieSecurity(config *CookieSecurityConfig)
```

Updates the cookie security validation config at runtime, affecting **all subsequent** SetCookie/SetCookies/UpdateFromResult/UpdateFromCookies calls. Passing nil disables security validation. Nil-receiver safe. This is the sole entry point for switching security policy — you can switch from lenient to strict (or vice versa) at runtime without rebuilding the SessionManager.

```go
// Switch from lenient to strict at runtime
sm.SetCookieSecurity(httpc.StrictCookieSecurityConfig())

// Disable security validation
sm.SetCookieSecurity(nil)
```

### CookieSecurityConfig Fields

```go
type CookieSecurityConfig struct {
    RequireSecure                bool    // Require the Secure attribute (HTTPS transport only)
    RequireHttpOnly              bool    // Require the HttpOnly attribute (XSS defense)
    RequireSameSite              string  // Required SameSite value: "Strict"/"Lax"/"None"/""
    AllowSameSiteNone            bool    // Whether SameSite=None is allowed
    RequireSecureForSameSiteNone bool    // Force Secure when SameSite=None
}
```

Available factory functions:

| Factory function | Description |
|----------|------|
| `DefaultCookieSecurityConfig()` | Lenient default (allows non-HTTPS, allows JS access, allows SameSite=None) |
| `StrictCookieSecurityConfig()` | Strict policy (requires Secure + HttpOnly + SameSite=Strict) |

### UpdateFromResult

```go
func (s *SessionManager) UpdateFromResult(result *Result)
```

`SessionManager.UpdateFromResult` extracts cookies from a request result's (`*Result`) `Response.Cookies` and stores them in the session. If CookieSecurity is configured, insecure cookies are **silently skipped** (no error returned, just ignored); only cookies that pass validation are stored. Returns directly when result is nil, Response is nil, or Cookies is empty. DomainClient's `Request` method calls this automatically after every request.

### UpdateFromCookies

```go
func (s *SessionManager) UpdateFromCookies(cookies []*http.Cookie)
```

`SessionManager.UpdateFromCookies` updates session cookies from a cookie slice. Same semantics as `SessionManager.UpdateFromResult` — insecure cookies are silently skipped. DomainClient's Download method captures download-response cookies through this method.

## Internal Mechanisms

### captureFromOptions

```go
func (s *SessionManager) captureFromOptions(options []RequestOption)
```

Called internally by DomainClient's `prepareSessionOptions` to extract cookies and headers from user-supplied RequestOptions into the session. Implementation details:

1. Uses a temporary `engine.Request` from the object pool (`acquireMiddlewareRequest`/`releaseMiddlewareRequest`) to reduce hot-path allocations
2. Applies each option to the temporary request one by one — **safety measure**: clears `OnRequest`/`OnResponse` callbacks before and after each option application, preventing `WithOnRequest`/`WithOnResponse` closures from accumulating side effects during capture
3. Extracts cookies and headers from the temporary request, validates them, and stores them in the session
4. Only cookies and headers are extracted; other data (query params, body, callbacks) is discarded

:::warning RequestOptions execute twice
DomainClient's Request/Download executes RequestOptions **twice** — once for session capture (captureFromOptions) and once for the actual request. Therefore **avoid side-effect options** (e.g. counters, nonce generation, random numbers). If you need side effects, use the underlying Client directly.
:::

### prepareOptions

```go
func (s *SessionManager) prepareOptions() []RequestOption
```

Called by DomainClient before each request to inject the current session state as RequestOptions:

- **Cookie bulk injection**: packs all session cookies into a single closure option (`r.SetCookies(append(existing, cookies...))`), avoiding N closure allocations
- **Header map injection**: injects a deep-copied header map in one go via `WithHeaderMap`

Returns nil when the session is empty (no cookies and no headers) — zero overhead.

### Thread-Safety Model

SessionManager protects all state with a single `sync.RWMutex`:

| Operation type | Lock level | Methods |
|----------|--------|------|
| Read (GetHeaders/GetCookies/GetCookie/prepareOptions) | RLock | Concurrent |
| Write (Set*/Delete*/Clear*/UpdateFrom*/captureFromOptions/SetCookieSecurity) | Lock | Mutually exclusive |

DomainClient's `prepareSessionOptions` uses a non-atomic "read-then-write" sequence: it reads a snapshot first (prepareOptions) then writes the capture (captureFromOptions), and concurrent requests may interleave between the two steps. This is an **eventual-consistency** design — each request captures a consistent snapshot at its `prepareOptions()` moment, and transient cross-request races do not affect the correctness of a single request.

## Complete Example: Maintaining a Login Session

The example below shows how DomainClient automatically manages a login session: after login, cookies are automatically maintained until logout.

```go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	ctx := context.Background()

	// Create a DomainClient — cookies auto-enabled and SessionManager embedded
	dc, err := httpc.NewDomain("https://httpbin.org", httpc.DefaultConfig())
	if err != nil {
		log.Fatalf("failed to create client: %v", err)
	}
	defer func() { _ = dc.Close() }()

	// Manually set session headers (carried automatically by all subsequent requests)
	sm := dc.Session()
	if err := sm.SetHeader("Accept", "application/json"); err != nil {
		log.Fatalf("failed to set header: %v", err)
	}
	if err := sm.SetCookie(&http.Cookie{
		Name:  "session",
		Value: "initial",
	}); err != nil {
		log.Fatalf("failed to set cookie: %v", err)
	}

	// Login: the response's Set-Cookie is automatically captured into the session by UpdateFromResult
	loginCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	_, err = dc.Request(loginCtx, "POST", "/cookies/set?token=abc123")
	cancel()
	if err != nil {
		log.Fatalf("login failed: %v", err)
	}

	// Subsequent requests automatically carry the session cookies
	verifyCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	result, err := dc.Request(verifyCtx, "GET", "/cookies")
	cancel()
	if err != nil {
		log.Fatalf("verification failed: %v", err)
	}

	fmt.Println("session cookies maintained successfully, response:")
	fmt.Println(result.String())

	// Logout: clear the session
	sm.ClearCookies()
	sm.ClearHeaders()

	fmt.Println("logged out, session cleared")
}
```

:::tip Manually managing SessionManager
You can also create a SessionManager independently and share it across multiple DomainClients. But DomainClient's automatic management usually suffices — it captures response cookies automatically after each request and injects session state automatically before each request.
:::

## See Also

- [Domain Client](./domain-client) - DomainClient reference
- [Domain Client and Sessions](../../guides/domain-session) - Usage guide
- [Interface Definitions](../types/interfaces) - DomainClienter interface reference
- [Constants & Types](../types/constants) - CookieSecurityConfig field reference

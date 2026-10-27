---
sidebar_label: "Session Management"
title: "Session Management - CyberGo HTTPC | SessionManager"
description: "HTTPC SessionManager API: NewSessionManager, SessionConfig, SetHeader and SetCookie management, plus SetCookieSecurity validation."
sidebar_position: 30
---

# Session Management

`SessionManager` provides thread-safe cookie and header storage and is embedded internally by DomainClient. Its store is based on `sync.RWMutex`: read operations take a read lock and write operations take a write lock, so session state can be shared across requests in high-concurrency scenarios.

:::tip Nil-receiver safety
Every method is nil-receiver safe, in one of two ways:

- Methods that return an error (SetHeader/SetHeaders/SetCookie/SetCookies) return `"session manager is nil"`.
- All other methods silently return zero values: GetHeaders/GetCookies/GetCookie return nil; SetCookieSecurity/Delete*/Clear*/UpdateFrom* return immediately.
:::

:::tip When to use SessionManager directly
The DomainClient created by `NewDomain` already embeds a SessionManager; create one manually only in these cases:

- share a session across multiple DomainClients;
- switch the cookie security policy at runtime;
- bulk-extract cookies from responses.
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

| Constructor | Parameter | Use case |
|----------|------|----------|
| `NewSessionManager(cfg)` | Explicit SessionConfig | A custom CookieSecurity policy is needed |
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

Adds or updates a single session header. Keys are stored in the canonical `http.CanonicalHeaderKey` form (case-insensitive: `"cache-control"` and `"Cache-Control"` address the same entry), and all subsequent requests carry the header automatically. Before the call, `validation.ValidateHeaderKeyValue` validates the key-value legality (intercepting control characters, CRLF injection, etc.); on failure it returns a wrapped error. A nil receiver returns `"session manager is nil"`.

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

Adds or updates session headers in bulk. Each item is validated outside the lock first, in sorted key order (any invalid item rejects the whole batch), then each key is written inside the lock in canonical `http.CanonicalHeaderKey` form (same-batch keys differing only in casing overwrite each other in sorted order, so the result is deterministic). Atomic semantics: either all succeed or none change.

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

Cookie-string parsing follows RFC 6265 underneath: only space and horizontal tab count as legal optional whitespace (OWS). Parsing is index-based with zero extra string allocations, and the result slice is independently allocated, never shared with the internal object pool. The [`WithCookieString`](../core/options#withcookiestring) option and the extraction of the request Cookie header share this same parser.

### SetCookie

```go
func (s *SessionManager) SetCookie(cookie *http.Cookie) error
```

Adds or updates a single session cookie. A cookie carrying RFC 6265 deletion semantics (`MaxAge < 0`, or an already-expired Expires) is not stored — instead the same-named entry is deleted, matching the response-capture path and preventing a logged-out session cookie from being replayed. All other cookies go through three validation steps: ① nil-cookie check; ② basic format validation; ③ if CookieSecurity is configured, `validateCookieSecurity` (executed inside the write lock for thread safety). Any validation failure returns a wrapped error and leaves storage unchanged.

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

Sets cookies in bulk, using a **two-phase atomic write**:

1. Pre-validate the basic legality of every cookie outside the lock (nil check + ValidateCookie).
2. Run security validation item by item inside the lock; any failure returns an error immediately, and already-validated items are not written either.
3. Store all of them only after every item passes.

Cookies with deletion semantics (logout scenarios, usually sent without Secure/HttpOnly attributes) skip both validation rounds and only delete their entries — under a strict security configuration, a failed check can no longer strand an expired session cookie in storage during a bulk logout.

Bulk operations are therefore atomic: there is no "partial write" intermediate state.

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

Returns a **deep-copy** of all cookies; entries whose Expires has already passed are absent from the result — this view matches the cookies a request would actually send. The implementation uses a contiguous-backing-array optimization: it pre-allocates an `[]http.Cookie` of length N with all cookie structs laid out contiguously, and the returned `[]*http.Cookie` points into that array.

N independent heap allocations therefore become 2 (the backing array + the pointer slice). An empty session returns nil.

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

Updates the cookie security validation config at runtime, affecting **all subsequent** SetCookie/SetCookies/UpdateFromResult/UpdateFromCookies calls. Passing nil disables security validation. Nil-receiver safe.

This is the only entry point for switching security policy: the SessionManager can move from lenient to strict (or back) at runtime without being rebuilt.

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

`UpdateFromResult` extracts cookies from a request result's (`*Result`) `Response.Cookies` and stores them in the session (fully qualified name `SessionManager.UpdateFromResult`). If CookieSecurity is configured, insecure cookies are **silently skipped** (no error returned, just ignored); only cookies that pass validation are stored.

Returns directly when result is nil, Response is nil, or Cookies is empty. DomainClient's `Request` method calls this automatically after every request that **hits the base origin**: when the request URL targets a different host (different host:port), session state is neither injected nor captured, preventing base-domain credentials from leaking to third-party origins.

### UpdateFromCookies

```go
func (s *SessionManager) UpdateFromCookies(cookies []*http.Cookie)
```

`SessionManager.UpdateFromCookies` updates session cookies from a cookie slice, with the same semantics as `SessionManager.UpdateFromResult`: insecure cookies are silently skipped. DomainClient's Download method captures download-response cookies through this method.

## Internal Mechanisms

### captureFromOptions

```go
func (s *SessionManager) captureFromOptions(options []RequestOption)
```

Called internally by DomainClient's `prepareSessionOptions` to extract cookies and headers from caller-supplied RequestOptions into the session. Implementation details:

1. Walks the options with a static type switch and **never executes the option closures**: it recognizes only `WithHeader`/`WithHeaderMap`/`WithCookies`/`WithCookieMap`/`WithCookieString` and skips every other option type.
2. Extracts cookies and headers from those options, validates them, and stores them in the session.
3. Only cookies and headers are extracted; other data (query params, body, callbacks) is never captured.

:::warning Options run once; session capture is static
A DomainClient's Request/Download executes RequestOptions once (on the actual request). Session capture is done statically by `captureFromOptions`, so a `SetHeader`/`SetCookies` call inside a custom `RequestOptionFunc` is neither captured nor a source of side effects; persist session state with `SetHeader`/`SetCookie` instead.
:::

### prepareOptions

```go
func (s *SessionManager) prepareOptions(fullURL string) []RequestOption
```

Called by DomainClient before each request to inject the current session state as RequestOptions:

- **Cookie bulk injection**: packs all session cookies into a single closure option (`r.SetCookies(append(existing, cookies...))`), avoiding N closure allocations. Cookies are injected in name order, keeping the Cookie header deterministic.
- **Cookie replay scoping**: `fullURL` defines the replay scope — expired cookies are skipped; only cookies whose Path matches the request path (RFC 6265 §5.1.4 path-match) and whose Secure attribute matches the request scheme (a Secure cookie is never replayed over plaintext HTTP) are replayed.
- **Header map injection**: injects a deep-copied header map in one call via `WithHeaderMap`.

Returns nil when the session is empty (no cookies and no headers), with no extra overhead.

### Thread-Safety Model

SessionManager protects all state with a single `sync.RWMutex`:

| Operation type | Lock level | Methods |
|----------|--------|------|
| Read (GetHeaders/GetCookies/GetCookie/prepareOptions) | RLock | Concurrent |
| Write (Set*/Delete*/Clear*/UpdateFrom*/captureFromOptions/SetCookieSecurity) | Lock | Mutually exclusive |

DomainClient's `prepareSessionOptions` uses a non-atomic "read-then-write" sequence: it reads a snapshot first (prepareOptions) and then writes the capture (captureFromOptions). Concurrent requests interleave between the two steps.

The design is **eventual consistency**: each request captures a consistent snapshot at its `prepareOptions()` moment, and transient cross-request races do not affect the correctness of a single request.

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
A SessionManager can also be created independently and shared across multiple DomainClients. DomainClient's automatic management already covers standard usage: response cookies are captured after each request, and session state is injected before each request.
:::

## See Also

- [Domain Client](./domain-client) - DomainClient reference
- [Domain Client and Sessions](../../guides/domain-session) - Usage guide
- [Interface Definitions](../types/interfaces) - DomainClienter interface reference
- [Constants & Types](../types/constants) - CookieSecurityConfig field reference

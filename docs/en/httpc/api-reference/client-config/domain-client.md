---
sidebar_label: "Domain Client"
title: "Domain Client - CyberGo HTTPC | NewDomain & Sessions"
description: "HTTPC domain client API: NewDomain constructor, seven HTTP methods plus generic Request, URL auto-concatenation, and DomainClienter session management."
sidebar_position: 20
---

# Domain Client

The domain client (`DomainClient`) manages requests for a specific domain and maintains session cookies and session headers. A plain `Client` requires auth headers to be passed and cookies to be tracked manually across requests; `DomainClient` moves that state into a session: it injects session state before each request and captures cookies from each response.

```text
DomainClient architecture
├── client         underlying Client (reuses connection pool, middleware chain)
├── baseURL        domain scope (e.g. https://api.example.com/v1)
├── parsedURL      cached parse result (avoids re-running url.Parse per request)
├── domain         hostname (without port)
└── SessionManager session state
      ├── headers  map[string]string  session-level request headers
      └── cookies  map[string]*http.Cookie session-level cookies
```

## DomainClienter Interface

```go
type DomainClienter interface {
    Client

    URL() string
    Domain() string

    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    Session() *SessionManager
}
```

`DomainClienter` implements both the `Client` interface (with `Get`/`Post`/`Put`/`Patch`/`Delete`/`Head`/`Options`/`Request`/`Download`/`Close`) and the session-management methods. Using the interface type rather than the concrete type makes testing and implementation swapping easier.

### Complete Method Table

#### HTTP Request Methods (inherited from Client)

| Method | Signature | Description |
|------|------|------|
| `Get` | `(path string, opts ...RequestOption) (*Result, error)` | GET request |
| `Post` | `(path string, opts ...RequestOption) (*Result, error)` | POST request |
| `Put` | `(path string, opts ...RequestOption) (*Result, error)` | PUT request |
| `Patch` | `(path string, opts ...RequestOption) (*Result, error)` | PATCH request |
| `Delete` | `(path string, opts ...RequestOption) (*Result, error)` | DELETE request |
| `Head` | `(path string, opts ...RequestOption) (*Result, error)` | HEAD request |
| `Options` | `(path string, opts ...RequestOption) (*Result, error)` | OPTIONS request |
| `Request` | `(ctx, method, path string, opts ...RequestOption) (*Result, error)` | Generic request with context |
| `Download` | `(ctx, path string, cfg *DownloadConfig, opts ...RequestOption) (*DownloadResult, error)` | File download |
| `Close` | `() error` | Close the client and release resources |

The concrete type `*DomainClient` implements every method in the table above, one for one with the interface signatures. The fully qualified method names are `DomainClient.Get`, `DomainClient.Post`, `DomainClient.Put`, `DomainClient.Patch`, `DomainClient.Delete`, `DomainClient.Head`, `DomainClient.Options`, `DomainClient.Request`, `DomainClient.Download`, and `DomainClient.Close`. `Download` and `Close` are detailed in their own sections below.

#### URL Access Methods

| Method | Signature | Description |
|------|------|------|
| `URL` | `URL() string` | Base URL (the `baseURL` passed at construction) |
| `Domain` | `Domain() string` | Domain (hostname, without port) |
| `Session` | `Session() *SessionManager` | Underlying session manager |

On the interface these are defined as `DomainClienter.URL`, `DomainClienter.Domain`, and `DomainClienter.Session`, implemented by `DomainClient.URL`, `DomainClient.Domain`, and `DomainClient.Session`.

`URL()` / `Domain()` / `Session()` / `Close()` are all nil-receiver-safe: with a nil receiver they return `""`, `""`, `nil`, and `nil` respectively.

#### Session Header Management

| Method | Signature | Description |
|------|------|------|
| `SetHeader` | `(key, value string) error` | Set a single session header (validates CRLF safety) |
| `SetHeaders` | `(headers map[string]string) error` | Set session headers in bulk |
| `DeleteHeader` | `(key string)` | Delete a single session header |
| `ClearHeaders` | `()` | Clear all session headers |
| `GetHeaders` | `() map[string]string` | Get a copy of the session headers |

On the interface these are defined as `DomainClienter.SetHeader`, `DomainClienter.SetHeaders`, `DomainClienter.DeleteHeader`, `DomainClienter.ClearHeaders`, and `DomainClienter.GetHeaders`; the implementations delegate to the embedded `SessionManager` (see [Session Management](./session)).

#### Session Cookie Management

| Method | Signature | Description |
|------|------|------|
| `SetCookie` | `(cookie *http.Cookie) error` | Set a single session cookie |
| `SetCookies` | `(cookies []*http.Cookie) error` | Set session cookies in bulk |
| `DeleteCookie` | `(name string)` | Delete a cookie by name |
| `ClearCookies` | `()` | Clear all cookies |
| `GetCookies` | `() []*http.Cookie` | Get a copy of all cookies |
| `GetCookie` | `(name string) *http.Cookie` | Get a copy of a cookie by name |

On the interface these are defined as `DomainClienter.SetCookie`, `DomainClienter.SetCookies`, `DomainClienter.DeleteCookie`, `DomainClienter.ClearCookies`, `DomainClienter.GetCookies`, and `DomainClienter.GetCookie`; the implementations likewise delegate to the `SessionManager`.

## NewDomain

```go
func NewDomain(baseURL string, cfg Config) (DomainClienter, error)
```

Creates a domain-scoped client. The client embeds a `SessionManager` that stores and replays session cookies independently. Pass a `Config` value, or use `NewDomainDefault(baseURL)` as a zero-argument shortcut.

```go
// Using default config (or call NewDomainDefault for the same effect)
dc, err := httpc.NewDomain("https://api.example.com", httpc.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Using custom configuration
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
dc, err := httpc.NewDomain("https://api.example.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer dc.Close()
```

**Parameters:**

| Parameter | Type | Description |
|------|------|------|
| `baseURL` | `string` | Base URL (must include scheme and host) |
| `cfg` | `Config` | Configuration value (use `DefaultConfig()` or a preset function) |

**Returns:** `DomainClienter` interface (not the concrete `*DomainClient` type).

**Error conditions:**

| Condition | Error message |
|------|----------|
| `baseURL` cannot be parsed | `invalid base URL: ...` |
| `baseURL` missing scheme or host | `base URL must include scheme and host` |
| Configuration validation failure (including an invalid `SSRFExemptCIDRs` CIDR) | `invalid configuration: ...` |
| Underlying client / session creation failure | `failed to create domain client: ...` / `failed to create session: ...` |

:::tip Cookie sessions live in the SessionManager
The DomainClient created by `NewDomain` embeds a `SessionManager`: session headers and cookies are injected before each request, and `Set-Cookie` is captured from each response. This session store is independent of `Connection.EnableCookies`; `NewDomain` does not modify `cfg.Connection.EnableCookies`.
:::

:::tip Configuration is frozen at construction
As with `New()`, `NewDomain` deep-copies the passed Config, so modifying the original `cfg` after construction does not affect that client. `DomainClient` exposes no method for changing configuration at runtime; use request options such as [`WithTimeout`](../core/options#withtimeout) for per-request control.
:::

## NewDomainDefault

```go
func NewDomainDefault(baseURL string) (DomainClienter, error)
```

Convenience constructor, equivalent to `NewDomain(baseURL, DefaultConfig())`.

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()
```

## HTTP Methods

All methods accept relative paths or absolute URLs. The convenience methods use `context.Background()` internally; use [`Request`](#request) with an explicit ctx when timeout or cancellation control is needed:

```go
// Relative path: auto-concatenated with baseURL
result, err := dc.Get("/users")
result, err := dc.Post("/users", httpc.WithJSON(data))
result, err := dc.Put("/users/1", httpc.WithJSON(data))
result, err := dc.Patch("/users/1", httpc.WithJSON(data))
result, err := dc.Delete("/users/1")
result, err := dc.Head("/users/1")
result, err := dc.Options("/users")

// Absolute URL: used directly
result, err := dc.Get("https://other-api.com/data")
```

### Request

```go
result, err := dc.Request(ctx, "GET", "/users", options...)
```

Generic request method with context support for timeout and cancellation control. `DomainClient` satisfies the `Client` interface by implementing this method.

## URL Concatenation Rules In Detail

The `buildURL` method is responsible for joining the request path with `baseURL`. The rules:

```text
buildURL(pathStr):

  ① pathStr is empty -> return baseURL
  ② pathStr starts with http:// or https:// -> absolute URL, returned directly
  ③ Otherwise -> relative-path join:
       a. Clone the cached parsedURL (to avoid mutating the original)
       b. Parse pathStr to split path / query / fragment
       c. result.Path = path.Join(basePath, parsedPath)
       d. Trailing-slash preservation: if the original path ends with /, so does the result
       e. Path-traversal defense: the result must stay within the base-path scope
       f. Query-parameter merge: base query params + path query params
       g. Fragment passthrough
```

### Concatenation Examples

| Input path | Result (baseURL = `https://api.example.com/v1`) |
|----------|------|
| `""` | `https://api.example.com/v1` |
| `/users` | `https://api.example.com/v1/users` |
| `users` | `https://api.example.com/v1/users` |
| `/users/` | `https://api.example.com/v1/users/` (trailing slash preserved) |
| `/users?page=1` | `https://api.example.com/v1/users?page=1` |
| `?page=2` | `https://api.example.com/v1?page=2` (query only, empty path) |
| `search?q=go` | `https://api.example.com/v1/search?q=go` |
| `https://other.com/api` | `https://other.com/api` (absolute URL used directly) |

If `baseURL` itself ends with `/` (e.g. `https://api.example.com/v1/`), relative paths are joined and normalized by `path.Join` (`users` → `.../v1/users`); when the request path is empty or contains only query parameters, the base trailing slash is kept (`""` → `.../v1/`, `?page=2` → `.../v1/?page=2`).

### Query-Parameter Merge

When `baseURL` itself carries query parameters, the request path's query parameters are **appended** to them:

```text
baseURL  = https://api.example.com/v1?lang=zh
path     = /users?page=1
result   = https://api.example.com/v1/users?lang=zh&page=1
```

### Path-Traversal Defense

`buildURL` checks that the joined path stays within the base-path scope, preventing path-traversal attacks:

```text
baseURL = https://api.example.com/v1
path    = ../admin/delete       <- after path.Clean this becomes /admin/delete

Check: is /admin/delete within the /v1 scope?
Result: no -> returns error "path escapes base URL scope"
```

:::warning Absolute-URL recognition
Only paths prefixed with `http://` or `https://` are recognized as absolute URLs (the prefix comparison is case-insensitive, so `HTTP://host` is treated as an absolute URL too). Other protocols (e.g. `ftp://`) are not recognized as absolute, are joined as relative paths, and the request therefore fails. No scope check is performed when the base path is empty or `/`.
:::

## Automatic Session Management

The domain client's session management has three phases:

```text
Session management across the request lifecycle:

  ① prepareOptions(fullURL) (before send)
     Read session headers and cookies from the SessionManager
     -> convert to RequestOption and inject into the request
        (cookies replayed per RFC 6265 scoping)

  ② captureFromOptions() (before send)
     Extract cookies and headers from the user-supplied RequestOptions
     -> store into the SessionManager (update if present, skip otherwise)

  ③ UpdateFromResult() (after send)
     Extract Set-Cookie from the response
     -> store into the SessionManager
```

```go
dc, _ := httpc.NewDomainDefault("https://api.example.com")

// Session headers: injected into every subsequent request
dc.SetHeader("Authorization", "Bearer token-abc")
dc.SetHeader("Accept-Language", "zh-CN")

// After login, the response's Set-Cookie is auto-captured
dc.Post("/login", httpc.WithJSON(loginData))
// Subsequent requests automatically carry the login cookies

// You can also set cookies manually
dc.SetCookie(&http.Cookie{Name: "session", Value: "xyz"})

// Inspect session state
dc.GetCookie("session")  // -> *http.Cookie copy
dc.GetCookies()          // -> []*http.Cookie copy (expired entries not returned)
dc.GetHeaders()          // -> map[string]string copy

// Log out: delete a single cookie, or clear all session state
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::warning Cross-origin requests carry no session credentials
Session headers and cookies are scoped to the base origin (host:port, compared case-insensitively). When a call passes an absolute URL pointing at a different host, session headers and cookies are **neither injected nor captured** — base-domain credentials never leak to third-party origins. Redirects work the same way: a response's `Set-Cookie` is stored back into the session only when the final response still lands on the base origin.
:::

:::tip Thread safety
`SessionManager` is protected internally by a `sync.RWMutex`; `SetHeader`/`SetCookie`/`GetCookie` and similar methods can be called concurrently. `prepareOptions` uses a read-then-write non-atomic sequence: the session state is designed for eventual consistency, so concurrent requests interleave during `prepareOptions`, but each request captures a consistent snapshot at its `prepareOptions` moment.
:::

## Option Execution and Session Capture

Request options run **exactly once** on a `DomainClient`: the capture phase does not execute option closures, and execution happens in the `client.Request` stage.

Session capture is performed inside `SessionManager` through **static type assertions**: it pulls headers and cookies from known concrete option types without ever calling `apply`. Only the built-in named option types are recognized — `WithHeader`, `WithHeaderMap`, `WithCookies`, `WithCookieMap`, and `WithCookieString`. The headers and cookies they carry persist into the session and apply to later requests.

```text
prepareSessionOptions(fullURL, options):
  ① managedOptions = prepareOptions(fullURL) <- read session state (cookies replayed per fullURL scope)
  ② allOptions = managedOptions + options    <- merge
  ③ captureFromOptions(options)              <- static type assertions, never runs closures
  ④ return allOptions -> client.Request()    <- the only execution point
```

::: warning Headers and cookies in custom options are not captured
`SetHeader`/`SetCookies` calls inside a custom option such as `RequestOptionFunc` are **not** captured — static assertions cannot see them. For persistent session state use `dc.SetHeader`/`dc.SetCookie` (or the matching `SessionManager` methods).

Because options run once, `WithOnRequest`/`WithOnResponse` callbacks fire only once as well.
:::

## Download Method

```go
func (dc *DomainClient) Download(ctx context.Context, path string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Downloads a file to `cfg.FilePath`; `path` is resolved relative to `baseURL`. The signature matches the package-level `Download` and `Client.Download`: `Download` is the single canonical download entry point across all three. `cfg` must not be nil, and `cfg.FilePath` must be set (otherwise `ErrEmptyFilePath` is returned).

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"
cfg.Overwrite = true

result, err := dc.Download(ctx, "/files/report.pdf", cfg)
```

Download response cookies are automatically captured into the session (via `UpdateFromCookies`). Options likewise run only once; response cookies are stored back into the session only when the final URL (after redirects) still targets the base origin.

## Relationship to the Client Interface

`DomainClient` satisfies both interfaces via compile-time assertions:

```go
var _ Client = (*DomainClient)(nil)           // implements Client
var _ DomainClienter = (*DomainClient)(nil)   // implements DomainClienter
```

```text
Interface hierarchy:
  Doer                                    <- minimal interface (only Request)
    └── Client                             <- + HTTP methods + Download + Close
          └── DomainClienter               <- + URL/Domain/Session + session header/cookie management
                └── *DomainClient          <- concrete implementation
```

`DomainClienter` embeds `Client`, so any function that accepts a `Client` parameter also accepts a `DomainClienter`. `DomainClient` can therefore be used wherever a `Client` is expected, while providing additional session-management capabilities.

## Complete REST API Client Wrapper Example

The example below shows how to use `DomainClient` to wrap a GitHub API client that automatically manages auth headers and pagination query parameters.

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/httpc"
)

// GitHubClient wraps the GitHub REST API
type GitHubClient struct {
	dc httpc.DomainClienter
}

// NewGitHubClient creates a GitHub API client
func NewGitHubClient(token string) (*GitHubClient, error) {
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 30 * time.Second

	dc, err := httpc.NewDomain("https://api.github.com", cfg)
	if err != nil {
		return nil, err
	}

	// Set session-level request headers
	if err := dc.SetHeader("Authorization", "Bearer "+token); err != nil {
		return nil, fmt.Errorf("set auth header: %w", err)
	}
	if err := dc.SetHeader("Accept", "application/vnd.github+json"); err != nil {
		return nil, fmt.Errorf("set accept header: %w", err)
	}
	if err := dc.SetHeader("X-GitHub-Api-Version", "2022-11-28"); err != nil {
		return nil, fmt.Errorf("set api version: %w", err)
	}

	return &GitHubClient{dc: dc}, nil
}

// Close releases resources
func (g *GitHubClient) Close() error { return g.dc.Close() }

// GetUser fetches user info (relative path auto-concatenated with baseURL)
func (g *GitHubClient) GetUser(username string) (*httpc.Result, error) {
	return g.dc.Get(fmt.Sprintf("/users/%s", username))
}

// ListUserRepos lists a user's repositories (with pagination parameters)
func (g *GitHubClient) ListUserRepos(username string, page, perPage int) (*httpc.Result, error) {
	return g.dc.Get(fmt.Sprintf("/users/%s/repos?page=%d&per_page=%d", username, page, perPage))
}

func main() {
	client, err := NewGitHubClient("ghp_your_token_here")
	if err != nil {
		panic(err)
	}
	defer client.Close()

	// Every request automatically carries Authorization, Accept, X-GitHub-Api-Version headers
	result, err := client.GetUser("torvalds")
	if err != nil {
		panic(err)
	}
	fmt.Printf("status code: %d\n", result.StatusCode())

	// Parse the JSON response via Unmarshal
	var user struct {
		Login string `json:"login"`
	}
	if err := result.Unmarshal(&user); err != nil {
		panic(err)
	}
	fmt.Printf("username: %s\n", user.Login)

	repos, err := client.ListUserRepos("torvalds", 1, 5)
	if err != nil {
		panic(err)
	}
	fmt.Printf("repo list status code: %d\n", repos.StatusCode())
	// Sample output:
	// status code: 200
	// username: torvalds
	// repo list status code: 200
}
```

:::tip Interface return type
`NewDomain` and `NewDomainDefault` return the `DomainClienter` interface rather than the concrete `*DomainClient` type, making it easy to substitute a mock in tests. Type-assert when you need to access the concrete type.
:::

## See Also

- [Session Management](./session) - Detailed SessionManager reference
- [Domain Client and Sessions](../../guides/domain-session) - Usage guide
- [Interface Definitions](../types/interfaces) - Client, Doer, DomainClienter interface definitions
- [File Download](./download) - DownloadConfig and DownloadResult details

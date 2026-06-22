---
title: "Domain Client - CyberGo HTTPC | NewDomain & Sessions"
description: "HTTPC domain client API reference: NewDomain, seven HTTP methods, the Request method, URL auto-concatenation, and SetHeader/SetCookie session management."
---

# Domain Client

The domain client provides request management for a specific domain, automatically maintaining cookies and headers.

## NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

Creates a domain-scoped client. Cookies are automatically enabled.

```go
// Using default configuration
dc, err := httpc.NewDomain("https://api.example.com")
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
|-----------|------|-------------|
| `baseURL` | `string` | Base URL (must include scheme and host) |
| `config` | `...*Config` | Optional configuration; uses DefaultConfig() if not provided |

**Returns:** `DomainClienter` interface (not the concrete `*DomainClient` type).

## HTTP Methods

All methods accept relative paths or absolute URLs:

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

Generic request method with context support for timeout and cancellation control.

## Download Methods

```go
func (dc *DomainClient) Download(ctx context.Context, path string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Downloads a file to `cfg.FilePath`; `path` is resolved relative to `baseURL`. The signature matches the package-level `Download` and `Client.Download` — `Download` is the single canonical download entry point across all three. `cfg` must not be nil, and `cfg.FilePath` must be set (otherwise `ErrEmptyFilePath` is returned).

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"
cfg.Overwrite = true

result, err := dc.Download(ctx, "/files/report.pdf", cfg)
```

Download response cookies are automatically captured into the session.

## Access Methods

```go
dc.URL()      // string - Base URL
dc.Domain()   // string - Domain (without port)
dc.Session()  // *SessionManager - Underlying session manager
dc.Close()    // error - Close client and release resources
```

## URL Concatenation Rules

| Input Path | Result (baseURL = `https://api.example.com/v1`) |
|------------|------|
| `/users` | `https://api.example.com/v1/users` |
| `users` | `https://api.example.com/v1/users` |
| `/users?page=1` | `https://api.example.com/v1/users?page=1` |
| `https://other.com/api` | `https://other.com/api` (absolute URL) |

:::warning
Only `http://` and `https://` protocol absolute URLs are allowed; other protocols are rejected (SSRF prevention).
:::

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

Using the interface type rather than the concrete type is recommended for easier testing and implementation swapping.

## See Also

- [Session Management](./session) - Detailed SessionManager reference
- [Domain Client and Sessions](../guides/domain-session) - Usage guide
- [Interface Definitions](./interfaces) - Client, Doer interface reference

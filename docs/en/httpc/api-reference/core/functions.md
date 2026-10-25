---
sidebar_label: "Functions & Methods"
title: "Functions & Methods - CyberGo HTTPC | HTTP Method API"
description: "HTTPC package functions and client methods: Get/Post and other HTTP methods, New, Download, NewDomain, and formatting helpers."
sidebar_position: 10
---

# Package Functions & Client Methods

Package-level functions and client methods are HTTPC's request entry points: the former use a shared default client, the latter an explicit instance. This page lists every signature, return value, and boundary behavior.

## Package-Level HTTP Methods

`Get`/`Post`/`Put`/`Patch`/`Delete`/`Head`/`Options` send requests without creating a client and use a lazily-initialized default client internally. `Request` takes a caller-supplied context.

| Function | HTTP method | Context |
|------|-----------|--------|
| `Get` / `Post` / `Put` / `Patch` / `Delete` / `Head` / `Options` | The corresponding verb | `context.Background()` |
| `Request` | Any (specified via argument) | Caller-supplied |

The package manages the default client:

- **Lazy initialization**: created on the first package-level call (with `DefaultConfig()`); no startup cost.
- **Automatic rebuild**: after the default client is closed (`CloseDefaultClient` or a direct `Close`), the next package-level call recreates it.
- **Concurrency-safe**: initialization and replacement are guarded by a double-checked lock; safe to call from multiple goroutines.

:::tip Production guidance
Package-level functions suit scripts and one-off requests. Long-running services should create an explicit client with `NewDefault()`/`New()` and control its configuration and lifecycle.
:::

> The lazy creation and post-close rebuild of the default client are described in [Core Concepts](../../getting-started/concepts).

### Get

```go
func Get(url string, options ...RequestOption) (*Result, error)
```

Sends a GET request.

```go
result, err := httpc.Get("https://api.example.com/data",
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

### Post

```go
func Post(url string, options ...RequestOption) (*Result, error)
```

Sends a POST request.

```go
result, err := httpc.Post("https://api.example.com/users",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

### Put / Patch / Delete / Head / Options

```go
func Put(url string, options ...RequestOption) (*Result, error)
func Patch(url string, options ...RequestOption) (*Result, error)
func Delete(url string, options ...RequestOption) (*Result, error)
func Head(url string, options ...RequestOption) (*Result, error)
func Options(url string, options ...RequestOption) (*Result, error)
```

### Request

```go
func Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
```

Generic request method with context support for timeout and cancellation control.

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

:::tip panic safety net
`Request` (package-level function and client method) recovers panics: an unexpected panic on the execution path is converted into a returned error instead of terminating the caller's goroutine, and underlying resources are released during stack unwinding.
:::

## Client Methods

The Client interface provides the same HTTP methods as the package-level functions, plus a context-taking `Request` method.

The Client interface (see [Interface Definitions](../types/interfaces)) = the minimal `Doer` interface (a single `Request` method) + seven HTTP verb convenience methods + `Download` + `Close`. Code that accepts a `Doer` also accepts a custom implementation, as long as that implementation satisfies `Doer`.

### New

```go
func New(cfg Config) (Client, error)
```

Creates a new HTTP client. Pass a `Config` value; obtain it from `DefaultConfig()` or a preset function, then modify as needed. Returns an error for invalid configuration (e.g. invalid `SecurityConfig.SSRFExemptCIDRs`).

The configuration is deep-copied at creation: modifying the original `Config` afterwards does not affect the created client. Two fields are shared by reference: `Retry.CustomPolicy` and `Security.CertificatePinner`. Do not share a stateful custom policy across clients concurrently.

```go
// Using default config (or call NewDefault() for the same effect)
client, err := httpc.New(httpc.DefaultConfig())

// Using a preset
client, err := httpc.New(httpc.SecureConfig())

// Using custom config
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
client, err := httpc.New(cfg)
```

### NewDefault

```go
func NewDefault() (Client, error)
```

Convenience constructor, equivalent to `New(DefaultConfig())`, for scenarios that need no custom configuration.

```go
client, err := httpc.NewDefault()
defer func() { _ = client.Close() }()
```

### Client HTTP Methods

```go
result, err := client.Get(url, options...)
result, err := client.Post(url, options...)
result, err := client.Put(url, options...)
result, err := client.Patch(url, options...)
result, err := client.Delete(url, options...)
result, err := client.Head(url, options...)
result, err := client.Options(url, options...)
result, err := client.Request(ctx, "GET", url, options...)
```

The complete method set of the `Client` interface:

- Seven verb convenience methods: `Client.Get`, `Client.Post`, `Client.Put`, `Client.Patch`, `Client.Delete`, `Client.Head`, and `Client.Options`, all with the signature `(url string, options ...RequestOption) (*Result, error)`.
- `Doer.Request`, obtained through the embedded `Doer` interface.
- `Client.Download`.
- The lifecycle method `Client.Close`.

### Close

A Client interface method that releases the resources held by the client (connection pool, Transport). Requests after `Close` return `ErrClientClosed`; repeated calls are safe.

```go
// Client interface method
Close() error
```

```go
client, _ := httpc.NewDefault()
defer client.Close()
```

## Default Client Management

### SetDefaultClient

```go
func SetDefaultClient(client Client) error
```

Sets a custom client as the default client used by package-level functions. The previous default client is closed automatically. The function is concurrency-safe.

:::warning
`SetDefaultClient` accepts only clients created via `httpc.New()` or `httpc.NewDefault()`. It returns an error for nil, foreign, or already-closed clients.

The swap happens before the close: even when the new client is installed, a failure to close the previous default returns `default client replaced, but closing the previous default failed: ...`. That error reports a failed cleanup of the old instance, not a failed replacement.
:::

```go
client, _ := httpc.New(httpc.PerformanceConfig())
httpc.SetDefaultClient(client)

// Subsequent package-level functions now use PerformanceConfig
result, _ := httpc.Get(url)
```

### CloseDefaultClient

```go
func CloseDefaultClient() error
```

Closes and resets the default client. The next package-level function call creates a new client. The function is concurrency-safe. If the default client was already closed directly, the next package-level call recreates it as well (see [Core Concepts](../../getting-started/concepts)).

### CloseRoutedClients

```go
func CloseRoutedClients() error
```

Closes and releases every package-level routed client (the dedicated clients cached by `WithProxy`, `WithSystemProxy`, and `WithTLSFingerprint`) and clears the cache. Idempotent and safe for concurrent use. Two differences from `CloseDefaultClient`:

- It does not close the default client; `CloseDefaultClient` still owns that client.
- It iterates every cached entry and closes each one: a single failure does not stop the rest, and all failures are joined (`errors.Join`) into the returned error.

## Download Functions

Package-level download functions use the default client. The Client interface and DomainClient also provide methods of the same name; all three share an identical signature.

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

`Download` is the download entry shared by the package-level function, the `Client` interface, and `DomainClient`; all three use the same signature.

`cfg` must not be nil, and `cfg.FilePath` must be set (otherwise `ErrEmptyFilePath` is returned). Pass `context.Background()` when no cancellation or timeout control is needed. Request options set headers, authentication, query parameters, and more.

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%%", float64(downloaded)/float64(total)*100)
}

// Package-level function (uses the default client)
result, err := httpc.Download(context.Background(), url, cfg)

// Client interface method
result, err = client.Download(ctx, url, cfg)

// DomainClient method (path is relative to baseURL; response cookies are auto-captured)
result, err = dc.Download(ctx, "/files/report.pdf", cfg)
```

:::tip
The old download functions (DownloadFile, DownloadWithOptions, DownloadFileWithContext, and DownloadWithOptionsWithContext) were removed in v1.5.2. Use `Download(ctx, url, cfg, options...)` instead, and configure path, overwrite, resume, and checksum through `DownloadConfig`.
:::

## Helper Functions

### SetSecurityWarnOutput

```go
func SetSecurityWarnOutput(w io.Writer)
```

Redirects security-warning output (three categories: `TestingConfig`, `InsecureSkipVerify`, and a hand-built all-off `Config`). Output goes to `os.Stderr` by default, and each warning type is printed at most once per process. Pass `io.Discard` to silence all warnings.

```go
// Silence all security warnings
httpc.SetSecurityWarnOutput(io.Discard)

// Change the output to a custom log
httpc.SetSecurityWarnOutput(log.Writer())
```

:::warning
`SetSecurityWarnOutput` is primarily for testing. Production environments should use `SecureConfig()` or `DefaultConfig()` rather than suppressing warnings.
:::

## Formatting Tools

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

Formats a byte count as a human-readable string (e.g. `"1.50 KB"`, `"500 B"`). Commonly used for displaying download results and in log output.

```go
result, _ := httpc.Download(context.Background(), url, cfg)
fmt.Printf("Downloaded %s\n", httpc.FormatBytes(result.BytesWritten))
// Downloaded 12.34 MB
```

| Input | Output |
|-------|--------|
| `500` | `500 B` |
| `1536` | `1.50 KB` |
| `1048576` | `1.00 MB` |
| `1073741824` | `1.00 GB` |

### FormatSpeed

```go
func FormatSpeed(bytesPerSecond float64) string
```

Formats a bytes-per-second rate as a human-readable string (e.g. `"1.50 MB/s"`). Commonly paired with `DownloadResult.AverageSpeed` or the `speed` parameter of `DownloadProgressCallback`.

```go
result, _ := httpc.Download(context.Background(), url, cfg)
fmt.Printf("Average speed %s\n", httpc.FormatSpeed(result.AverageSpeed))
// Average speed 5.67 MB/s

// Used inside a progress callback
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%s / %s (%s)",
        httpc.FormatBytes(downloaded),
        httpc.FormatBytes(total),
        httpc.FormatSpeed(speed),
    )
}
```

| Input (bytes/s) | Output |
|-----------------|--------|
| `500` | `500 B/s` |
| `1536` | `1.50 KB/s` |
| `1048576` | `1.00 MB/s` |

:::tip
Both use binary units (1024-step), with the unit sequence `B -> KB -> MB -> GB -> TB -> PB -> EB`.
:::

## Domain Client

### NewDomain

```go
func NewDomain(baseURL string, cfg Config) (DomainClienter, error)
```

Creates a domain client that manages cookies and headers automatically. Pass a `Config` value. `baseURL` must include a scheme and host (e.g. `https://api.example.com`), otherwise an error is returned. Validation rules match `New`.

A DomainClient created by `NewDomain` contains a `SessionManager`: it injects session headers and cookies before the request and writes back `Set-Cookie` after the response. That session store is independent of `Connection.EnableCookies`.

```go
dc, err := httpc.NewDomain("https://api.example.com", httpc.DefaultConfig())
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, err := dc.Get("/users")
```

### NewDomainDefault

```go
func NewDomainDefault(baseURL string) (DomainClienter, error)
```

Convenience constructor, equivalent to `NewDomain(baseURL, DefaultConfig())`.

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
defer dc.Close()
```

## See Also

- [Result](./result) - Response result types and methods
- [Request Options](./options) - Request configuration options
- [Domain Client](../client-config/domain-client) - Domain client and URL concatenation rules
- [File Download](../client-config/download) - Download functions and types

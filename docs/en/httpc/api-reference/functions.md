---
title: "Package Functions - CyberGo HTTPC | Package Functions"
description: "HTTPC package functions API reference: seven HTTP methods like Get/Post, New client creation, the Download entry, helpers, and NewDomain creation."
---

# Package Functions

## Package-Level HTTP Methods

No need to create a client - send requests directly. Uses a lazily initialized default client internally.

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

## Client Methods

The Client interface provides the same HTTP methods as package-level functions, plus a `Request` method with context.

### New

```go
func New(config ...*Config) (Client, error)
```

Creates a new HTTP client. Pass no config or `nil` to use `DefaultConfig()`.

```go
client, err := httpc.New()
client, err := httpc.New(nil)
client, err := httpc.New(httpc.SecureConfig())

cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
client, err := httpc.New(cfg)
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

### Close

Client interface method that releases resources held by the client (connection pool, Transport). Cannot be used after calling.

```go
// Client interface method
Close() error
```

```go
client, _ := httpc.New()
defer client.Close()
```

## Default Client Management

### SetDefaultClient

```go
func SetDefaultClient(client Client) error
```

Sets a custom client as the default client for package-level functions. The old default client is automatically closed.

:::warning
Only accepts clients created via `httpc.New()`. Cannot set a closed client.
:::

```go
client, _ := httpc.New(httpc.PerformanceConfig())
httpc.SetDefaultClient(client)

// Subsequent package-level functions use PerformanceConfig
result, _ := httpc.Get(url)
```

### CloseDefaultClient

```go
func CloseDefaultClient() error
```

Closes the default client and resets it. A new client will be created on the next package-level function call.

## Download Functions

Package-level download functions use the default client. The Client interface and DomainClient also provide methods with the same name, all sharing an identical signature.

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

`Download` is the **single canonical download entry point** shared across the package-level function, the `Client` interface, and `DomainClient` — replacing the previous `{config}` x `{context}` variant matrix with a single signature.

`cfg` must not be nil, and `cfg.FilePath` must be set (otherwise `ErrEmptyFilePath` is returned). Pass `context.Background()` when no cancellation or timeout control is needed; request options are used to set headers, authentication, query parameters, and more.

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

:::tip Migration note
The old `DownloadFile`, `DownloadWithOptions`, `DownloadFileWithContext`, and `DownloadWithOptionsWithContext` were removed in v1.5.2. Migrate to the unified `Download(ctx, url, cfg, options...)` and configure path, overwrite, resume, and checksum via `DownloadConfig`.
:::

## Helper Functions

### SetSecurityWarnOutput

```go
func SetSecurityWarnOutput(w io.Writer)
```

Redirects security warning output (such as `TestingConfig`, `InsecureSkipVerify` warnings). Pass `io.Discard` to silence all warnings.

```go
// Silence all security warnings
httpc.SetSecurityWarnOutput(io.Discard)

// Redirect to custom log
httpc.SetSecurityWarnOutput(log.Writer())
```

:::warning
This function is primarily for testing. Production environments should use `SecureConfig()` or `DefaultConfig()` rather than suppressing warnings.
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
Both use binary units (1024-step) with the unit sequence `B -> KB -> MB -> GB -> TB -> PB -> EB`.
:::

## Domain Client

### NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

Creates a domain-scoped client with automatic cookie and header management.

```go
dc, err := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, err := dc.Get("/users")
```

## See Also

- [Result](./result) - Response result types and methods
- [Request Options](./options) - Request configuration options
- [Domain Client](./domain-client) - Domain-scoped client
- [File Download](./download) - Download functions and types

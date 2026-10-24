---
sidebar_label: "Testing Guide"
title: "Testing Guide - CyberGo HTTPC | httptest & Assertions"
description: "HTTPC testing guide: TestingConfig, httptest mock servers, Doer doubles, error/delay/redirect scenarios, deterministic retries, and download tests."
sidebar_position: 120
---

# Testing Guide

HTTPC testing has two layers. Integration tests drive the full request pipeline through an `httptest` mock server; unit tests construct `Result` values directly through a `Doer` double. Both start from the `TestingConfig()` preset.

## TestingConfig

`TestingConfig()` targets test environments: security checks are disabled and connection and handshake timeouts are shortened (`Request` stays at the default 180s).

```go
func TestAPI(t *testing.T) {
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("http://localhost:8080/test")
    // ...
}
```

:::danger
`TestingConfig` disables TLS verification, SSRF protection, and other security features; it is for test environments only. Using it outside a test process prints one security warning to stderr.
:::

The key values of `TestingConfig` (overridden on top of `DefaultConfig`):

- `InsecureSkipVerify=true`, `AllowPrivateIPs=true`, `ValidateURL=false`, `ValidateHeaders=false`: allows 127.0.0.1/intranet httptest servers;
- `EnableHTTP2=false`: simpler protocol behavior, easier to assert on;
- `MaxRetries=1`, `EnableJitter=false`: deterministic retry cadence;
- connection and handshake timeouts shortened to 5s, while `Request` stays at the default 180s.

:::tip About the security warning
The warning identifies test processes by checking for a `.test` executable name and the `GO_TEST`/`GOTEST` environment variables; tests run by `go test` do not trigger it. When used temporarily in a non-test process such as a local development script, silence the output with `httpc.SetSecurityWarnOutput(io.Discard)`, where `io` is the standard library `io` package.
:::

## httptest.Server Integration

Use the standard library `net/http/httptest` to create mock servers for integration tests without a real backend:

<!-- check-code: skip -->
```go
package main

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/cybergodev/httpc"
)

func TestGetUser(t *testing.T) {
    // Create a mock server
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/users/1" {
            t.Errorf("unexpected path: %s", r.URL.Path)
        }
        if r.Header.Get("Authorization") != "Bearer test-token" {
            t.Errorf("missing auth header")
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]any{
            "id":   1,
            "name": "Test User",
        })
    }))
    defer server.Close()

    // Create a client with TestingConfig
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    // Send a request to the mock server
    result, err := client.Get(server.URL+"/users/1",
        httpc.WithBearerToken("test-token"),
    )
    if err != nil {
        t.Fatal(err)
    }

    if !result.IsSuccess() {
        t.Fatalf("expected success, got %d", result.StatusCode())
    }

    var user struct {
        ID   int    `json:"id"`
        Name string `json:"name"`
    }
    if err := result.Unmarshal(&user); err != nil {
        t.Fatal(err)
    }

    if user.Name != "Test User" {
        t.Errorf("expected Test User, got %s", user.Name)
    }
}
```

## Mock and Transport Injection

Custom transport injection (replacing the underlying `http.RoundTripper`) is an internal mechanism of HTTPC. The engine's transport interface and mocks serve only the library's own tests, and the root `httpc` package exports no injection point. Two paths are available:

| Approach | Level | Characteristics |
|------|----------|------|
| `httptest.Server` | Integration tests | Exercises the full request pipeline (security validation, retries, middleware, connection pool); closest to real behavior |
| Implement the minimal `httpc.Doer` interface | Unit tests | No server and no network traffic; returns a constructed `*Result` directly, with no network overhead and fully deterministic |

`Doer` is an interface with a single `Request` method. The `Request`/`Response`/`Meta` fields of `Result` are exported so callers can construct them directly in tests:

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

// fakeDoer implements httpc.Doer: no network, returns a preset result directly
type fakeDoer struct {
	result *httpc.Result
	err    error
}

func (f *fakeDoer) Request(ctx context.Context, method, url string, options ...httpc.RequestOption) (*httpc.Result, error) {
	return f.result, f.err
}

// getUser is the business function under test: it depends on httpc.Doer, not a concrete Client
func getUser(d httpc.Doer, id int) (string, error) {
	result, err := d.Request(context.Background(), "GET", fmt.Sprintf("https://api.example.com/users/%d", id))
	if err != nil {
		return "", err
	}
	if !result.IsSuccess() {
		return "", fmt.Errorf("API error: %d", result.StatusCode())
	}
	var name struct {
		Name string `json:"name"`
	}
	if err := result.Unmarshal(&name); err != nil {
		return "", err
	}
	return name.Name, nil
}

func main() {
	fake := &fakeDoer{
		result: &httpc.Result{
			Response: &httpc.ResponseInfo{
				StatusCode: 200,
				Status:     "200 OK",
				Body:       `{"name":"Test User"}`,
				RawBody:    []byte(`{"name":"Test User"}`),
				Headers:    map[string][]string{"Content-Type": {"application/json"}},
			},
			Meta: &httpc.RequestMeta{Attempts: 1},
		},
	}

	name, err := getUser(fake, 1)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(name) // Output: Test User
}
```

:::tip Populate both Body and RawBody when constructing a Result
`Body()` returns a pre-stored string and `RawBody()` the byte slice, while `Unmarshal` reads the raw bytes. Fill in both fields in the mock so every accessor returns consistent results.
:::

## Simulating Different Scenarios

### Simulating Error Responses

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusNotFound)
    json.NewEncoder(w).Encode(map[string]string{
        "error": "user not found",
    })
}))
defer server.Close()
```

### Simulating Delays

```go
// TestingConfig disables SSRF protection — otherwise the default client blocks the 127.0.0.1 test server
// and you get an SSRF error instead of a timeout error.
client, _ := httpc.New(httpc.TestingConfig())
defer client.Close()

server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    time.Sleep(5 * time.Second)
    w.WriteHeader(http.StatusOK)
}))
defer server.Close()

// Test timeout handling: 1s context timeout < 5s server delay
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
defer cancel()

_, err := client.Request(ctx, "GET", server.URL)
if err == nil {
    t.Fatal("expected timeout error")
}
```

### Simulating Redirects

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    switch r.URL.Path {
    case "/old":
        http.Redirect(w, r, "/new", http.StatusMovedPermanently)
    case "/new":
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("redirected"))
    }
}))
defer server.Close()
```

### Simulating File Upload

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        t.Errorf("expected POST, got %s", r.Method)
    }

    // Parse the multipart form
    r.ParseMultipartForm(10 << 20)
    file, header, err := r.FormFile("upload")
    if err != nil {
        t.Fatal(err)
    }
    defer file.Close()

    if header.Filename != "test.txt" {
        t.Errorf("expected test.txt, got %s", header.Filename)
    }

    w.WriteHeader(http.StatusOK)
}))
defer server.Close()
```

### Simulating a TLS Server

`httptest.NewTLSServer` uses a self-signed certificate. `TestingConfig` already sets `InsecureSkipVerify=true`, so the server can be requested directly with no extra TLS configuration:

```go
server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("secure"))
}))
defer server.Close()

client, _ := httpc.New(httpc.TestingConfig())
defer client.Close()

result, err := client.Get(server.URL) // request the self-signed TLS server directly
```

### Deterministic Retry Tests

Have the server return a retryable status code (408/429/500/502/503/504) for the first N calls and then succeed. This verifies retry behavior without timers or network jitter; `result.Meta.Attempts` reports the actual attempt count:

```go
func TestRetry(t *testing.T) {
    var calls int32

    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if atomic.AddInt32(&calls, 1) <= 2 {
            w.WriteHeader(http.StatusServiceUnavailable) // first two calls: 503 (retryable)
            return
        }
        w.WriteHeader(http.StatusOK) // third call succeeds
    }))
    defer server.Close()

    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get(server.URL, httpc.WithMaxRetries(2))
    if err != nil {
        t.Fatal(err)
    }

    if result.Meta.Attempts != 3 { // 1 original + 2 retries
        t.Errorf("expected 3 attempts, got %d", result.Meta.Attempts)
    }
}
```

:::tip Pin retry parameters explicitly in tests
`TestingConfig` defaults to `MaxRetries=1` with no jitter. Pass `WithMaxRetries(N)` explicitly with the expected value so assertions stay stable.
:::

## Testing File Downloads

`Download` is covered by httptest the same way: the server writes known content, `DownloadConfig.FilePath` points into `t.TempDir()` (cleaned up automatically when the test ends), and the test asserts the byte count and checksum:

```go
func TestDownload(t *testing.T) {
    payload := []byte("file content for download test")

    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
        _, _ = w.Write(payload)
    }))
    defer server.Close()

    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    sum := sha256.Sum256(payload)

    cfg := httpc.DefaultDownloadConfig()
    cfg.FilePath = filepath.Join(t.TempDir(), "out.bin")
    cfg.Checksum = hex.EncodeToString(sum[:]) // also exercises the checksum path

    result, err := client.Download(context.Background(), server.URL, cfg)
    if err != nil {
        t.Fatal(err)
    }

    if result.BytesWritten != int64(len(payload)) {
        t.Errorf("expected %d bytes, got %d", len(payload), result.BytesWritten)
    }
    if result.ActualChecksum != cfg.Checksum {
        t.Errorf("checksum mismatch: %s != %s", result.ActualChecksum, cfg.Checksum)
    }
}
```

## Cookie and Session Assertions

Cookie behavior can be asserted from both ends. The server side reads the cookies actually received in the request, confirming the client sent them. The client side uses `result.GetCookie`/`HasCookie` for response cookies, or checks automatic session capture on a `DomainClient`:

```go
func TestCookieSession(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        switch r.URL.Path {
        case "/login":
            http.SetCookie(w, &http.Cookie{Name: "session", Value: "abc123", Path: "/"})
            w.WriteHeader(http.StatusOK)
        case "/me":
            // Server-side assertion: the second request should carry the session cookie automatically
            if c, err := r.Cookie("session"); err != nil || c.Value != "abc123" {
                t.Errorf("expected session cookie abc123, got %v (err=%v)", c, err)
            }
            w.WriteHeader(http.StatusOK)
        }
    }))
    defer server.Close()

    dc, err := httpc.NewDomain(server.URL, httpc.TestingConfig()) // bypass SSRF private-network blocking
    if err != nil {
        t.Fatal(err)
    }
    defer dc.Close()

    if _, err := dc.Get("/login"); err != nil { // response cookies enter the session automatically
        t.Fatal(err)
    }
    if c := dc.GetCookie("session"); c == nil || c.Value != "abc123" {
        t.Errorf("session cookie not captured: %+v", c)
    }
    if _, err := dc.Get("/me"); err != nil { // the session cookie is sent with the request
        t.Fatal(err)
    }
}
```

## Table-Driven Tests

```go
func TestHTTPMethods(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte(r.Method))
    }))
    defer server.Close()

    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    tests := []struct {
        name   string
        method func(url string, opts ...httpc.RequestOption) (*httpc.Result, error)
    }{
        {"GET", client.Get},
        {"POST", client.Post},
        {"PUT", client.Put},
        {"PATCH", client.Patch},
        {"DELETE", client.Delete},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := tt.method(server.URL + "/test")
            if err != nil {
                t.Fatal(err)
            }

            if result.Body() != tt.name {
                t.Errorf("expected %s, got %s", tt.name, result.Body())
            }
        })
    }
}
```

## Best Practices

| Practice | Description |
|----------|-------------|
| Use `httptest.Server` | Simulates real HTTP behavior with no network dependency; covers the full request pipeline |
| Use `TestingConfig()` | Disables security checks so local connections aren't blocked by SSRF protection |
| Depend on the `Doer` interface in business code | A minimal interface dependency lets unit tests use doubles with no server |
| Deterministic retries | Server returns 503 for the first N calls, then succeeds; assert with `Meta.Attempts` |
| Use `t.TempDir()` in download tests | Files are cleaned up automatically when the test ends, and the path passes safety validation |
| Use `defer` | Ensures resources are released even when tests fail |
| Table-driven | Covers many inputs with one code path |
| Pin retry and timeout parameters explicitly | Declare `WithMaxRetries(N)` and similar explicitly so assertions stay stable |

## Next Steps

- [Configuration API](../api-reference/client-config/config) - TestingConfig detailed parameters
- [Error Types](../api-reference/types/errors) - Error assertion reference
- [Middleware Chain](./middleware-chain) - Middleware testing patterns
- [File Upload and Download](./file-transfer) - Download semantics in depth (expanding this page's "Testing File Downloads")
- [Advanced Examples](../examples/advanced-usage) - Production-grade code patterns
- [Migrating from net/http](./migration) - Behavioral differences and a pitfall list for projects moving off the standard library

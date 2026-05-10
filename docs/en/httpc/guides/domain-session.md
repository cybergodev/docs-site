---
title: Domain Client and Sessions - HTTPC
description: Guide to HTTPC domain client and session management, covering NewDomain creation, URL auto-concatenation, session headers, automatic Cookie management, and security configuration.
---

# Domain Client and Sessions

The domain client (DomainClient) is a session management client for a specific domain, automatically maintaining cookies and request headers.

## Creating a Domain Client

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Cookies automatically enabled
dc.SetHeader("Authorization", "Bearer "+token)

// Send requests using relative paths
result, err := dc.Get("/users")
```

:::tip
`NewDomain` automatically enables cookie management (`EnableCookies = true`), no manual configuration needed.
:::

## Session Header Management

```go
// Set session headers (automatically included with all subsequent requests)
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// Batch set
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

## Cookie Management

```go
// Set cookie
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc123"})

// Batch set
dc.SetCookies([]*http.Cookie{
    {Name: "session", Value: "abc123"},
    {Name: "lang", Value: "en"},
})

// Response cookies are automatically captured
result, _ := dc.Get("/login")
// Set-Cookie from the server is automatically stored in the session

// Query
cookie := dc.GetCookie("session")
cookies := dc.GetCookies()

// Delete and clear
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::tip
After each request, cookies returned by the server are automatically updated in the session without manual handling.
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

// Absolute URL (skips base URL concatenation)
result, _ := dc.Get("https://other-api.com/data")
```

## Session Access

```go
// Get basic info
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com"

// Access underlying SessionManager
session := dc.Session()
if err := session.SetHeader("X-Trace-ID", traceID); err != nil {
    log.Fatal(err)
}
```

## Cookie Security Validation

You can configure cookie security policies to only accept cookies that meet security standards:

```go
dc, _ := httpc.NewDomain("https://api.example.com")

// Set strict cookie security
session := dc.Session()
session.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
// Requires: Secure=true, HttpOnly=true, SameSite=Strict

// Cookies that don't meet security requirements will cause SetCookie to return an error
if err := dc.SetCookie(&http.Cookie{
    Name:  "insecure",
    Value: "test",
    // Missing Secure, HttpOnly → rejected
}); err != nil {
    log.Println("Cookie rejected:", err)
}
```

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
    // Create domain client
    dc, err := httpc.NewDomain("https://api.example.com")
    if err != nil {
        log.Fatal(err)
    }
    defer dc.Close()

    // Login to get token
    loginResult, err := dc.Post("/auth/login", httpc.WithJSON(map[string]string{
        "username": "admin",
        "password": "secret",
    }))
    if err != nil {
        log.Fatal(err)
    }

    // Parse token from response
    var loginResp struct {
        Token string `json:"token"`
    }
    if err := loginResult.Unmarshal(&loginResp); err != nil {
        log.Fatal(err)
    }
    httpc.ReleaseResult(loginResult)

    // Set session header
    if err := dc.SetHeader("Authorization", "Bearer "+loginResp.Token); err != nil {
        log.Fatal(err)
    }

    // Subsequent requests automatically carry token and cookies
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    users, err := dc.Request(ctx, "GET", "/users")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(users)

    fmt.Println(users.StatusCode()) // 200
}
```

## Next Steps

- [Domain Client API](../api-reference/domain-client) - Complete API reference
- [Session Management API](../api-reference/session) - SessionManager reference
- [Request and Response](./request-response) - Basic request guide

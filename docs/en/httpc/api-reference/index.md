---
title: API Reference - HTTPC
description: HTTPC API reference index, organized by functional modules covering package-level functions, Client interface, request options, middleware, error types, configuration, and constants.
---

# API Reference

HTTPC provides 27 request option functions, 5 configuration presets, 8 built-in middleware, and complete download support.

## Core Architecture

```text
httpc package
├── Client interface - Main client, supports all HTTP methods
├── DomainClienter interface - Domain-scoped client with built-in session management
├── Config - Configuration system (timeout/connection/security/retry/middleware)
├── RequestOption - 27 request option functions
├── MiddlewareFunc - Middleware chain
├── Result - Response result (includes request metadata)
└── Package-level functions - Use without creating a client
```

## Module Navigation

### Core

| Module | Description |
|--------|-------------|
| [Package Functions](./functions) | Get/Post/Put/Patch/Delete and other package-level functions, client methods, and helper functions |
| [Configuration](./config) | Config struct, 5 preset configurations, validation functions, and Cookie security |
| [Interfaces](./interfaces) | Client, Doer, DomainClienter, RetryPolicy, and other core interfaces |
| [Result](./result) | Result, RequestInfo, ResponseInfo, RequestMeta types and all methods |

### Request and Response

| Module | Description |
|--------|-------------|
| [Request Options](./options) | 27 WithXxx request option functions (headers, body, auth, cookies, callbacks, etc.) |
| [Middleware](./middleware) | Chain composition, 8 built-in middleware factories, and audit event types |
| [Error Types](./errors) | ClientError, 12 ErrorType enums, and 13 error variables |

### Advanced Features

| Module | Description |
|--------|-------------|
| [Domain Client](./domain-client) | DomainClient creation, HTTP methods, download methods, and URL joining rules |
| [Session Management](./session) | SessionManager cookie/header management and security validation |
| [File Download](./download) | Download functions, DownloadConfig, resume support, and security protections |
| [Constants and Types](./constants) | BodyKind enum, FormData/FileData, and audit context keys |

## Quick Reference

### Creating a Client

```go
client, err := httpc.New()                    // Default configuration
client, err := httpc.New(httpc.SecureConfig()) // Secure preset
client, err := httpc.New(customConfig)         // Custom configuration
```

### Sending Requests

```go
// Package-level function
result, err := httpc.Get(url, options...)

// Client method
result, err := client.Get(url, options...)

// With context
result, err := client.Request(ctx, "GET", url, options...)
```

### Handling Responses

```go
result.StatusCode()           // Status code
result.Body()                 // Response body (string)
result.RawBody()              // Response body (bytes)
result.Unmarshal(&data)       // JSON parsing
result.IsSuccess()            // Is 2xx
result.Meta.Duration          // Request duration
result.Meta.Attempts          // Retry count
defer httpc.ReleaseResult(result) // Release to object pool
```

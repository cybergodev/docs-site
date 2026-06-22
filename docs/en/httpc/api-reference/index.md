---
title: "API Reference - CyberGo HTTPC | Full API Index"
description: "HTTPC API reference index: navigate core, request/response, and advanced features — functions, options, presets, middleware, downloads, and error types."
---

# API Reference

HTTPC provides 28 request option functions, 5 configuration presets, 8 built-in middleware, and complete download support.

## Core Architecture

```text
httpc package
├── Client interface - Main client, supports all HTTP methods
├── DomainClienter interface - Domain-scoped client with built-in session management
├── Config - Configuration system (timeouts/connection/security/retry/middleware)
├── RequestOption - 28 request option functions
├── MiddlewareFunc - Middleware chain
├── Result - Response result (includes request metadata)
└── Package-level functions - Use without creating a client
```

## Module Navigation

### Core

| Module | Description |
|--------|-------------|
| [Package Functions](./functions) | Package-level functions like Get/Post/Put/Patch/Delete, client methods, and helper functions |
| [Configuration](./config) | Config struct, 5 configuration presets, validation functions, and cookie security |
| [Interfaces](./interfaces) | Core interfaces including Client, Doer, DomainClienter, and RetryPolicy |
| [Result](./result) | Result, RequestInfo, ResponseInfo, RequestMeta types and all methods |

### Request and Response

| Module | Description |
|--------|-------------|
| [Request Options](./options) | 28 WithXxx request option functions (headers, body, authentication, cookies, callbacks, etc.) |
| [Middleware](./middleware) | Chain composition, 8 built-in middleware factories, and audit event types |
| [Error Types](./errors) | ClientError, 12 ErrorType enums, and 12 error variables |

### Advanced Features

| Module | Description |
|--------|-------------|
| [Domain Client](./domain-client) | DomainClient creation, HTTP methods, download methods, and URL concatenation rules |
| [Session Management](./session) | SessionManager cookie/header management and security validation |
| [File Download](./download) | Download functions, DownloadConfig, resumable downloads, and security protection |
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
// Package-level functions
result, err := httpc.Get(url, options...)

// Client methods
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
```

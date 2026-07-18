---
sidebar_label: "Overview"
title: "API Reference - CyberGo HTTPC | Full API Index"
description: "HTTPC API reference index: navigate core, request/response, and advanced features — functions, options, presets, middleware, downloads, and error types."
sidebar_position: 1
---

# API Reference

HTTPC provides 28 request option functions, 5 configuration presets, 8 built-in middleware, and complete download support.

## Core Architecture

HTTPC uses a two-layer design: the Layer 1 method API is a thin wrapper, and the real request-processing engine is the Layer 2 Handler pipeline.

```text
HTTPC two-layer architecture
├── Layer 1  Method API (thin wrapper)
│     Package functions httpc.Get/Post/... + Client methods + request options → Result
│
└── Layer 2  Handler pipeline (request-processing engine)
      MiddlewareFunc(Handler) onion chain
      → assembles clientImpl.middlewareChain
      → executes (each request = assemble and run a Handler chain)
```

## Module Navigation

### Core

| Module | Description |
|--------|-------------|
| [Package Functions & Client Methods](./core/functions) | Package-level functions like Get/Post/Put/Patch/Delete, client methods, and helper functions |
| [Configuration](./client-config/config) | Config struct, 5 configuration presets, validation functions, and cookie security |
| [Interfaces](./types/interfaces) | Core interfaces including Client, Doer, DomainClienter, and RetryPolicy |
| [Result](./core/result) | Result, RequestInfo, ResponseInfo, RequestMeta types and all methods |
| [Handler Pipeline](./handler/handler-chain) | Handler pipeline, MiddlewareFunc onion chain, Chain combinator, and mutator contracts |

### Request and Response

| Module | Description |
|--------|-------------|
| [Request Options](./core/options) | 28 WithXxx request option functions (headers, body, authentication, cookies, callbacks, etc.) |
| [Middleware](./client-config/middleware) | Chain composition, 8 built-in middleware factories, and audit event types |
| [Error Types](./types/errors) | ClientError, 12 ErrorType enums, and 12 error variables |

### Advanced Features

| Module | Description |
|--------|-------------|
| [Domain Client](./client-config/domain-client) | DomainClient creation, HTTP methods, download methods, and URL concatenation rules |
| [Session Management](./client-config/session) | SessionManager cookie/header management and security validation |
| [File Download](./client-config/download) | Download functions, DownloadConfig, resumable downloads, and security protection |
| [Constants and Types](./types/constants) | BodyKind enum, FormData/FileData, and audit context keys |

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

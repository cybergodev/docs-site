---
sidebar_label: "Overview"
title: "API Reference - CyberGo HTTPC | Full API Index"
description: "HTTPC API index: full API map of 27 WithXxx options, 5 config presets, 7 built-in middleware, 12 error variables, and quick-start examples grouped for lookup."
sidebar_position: 1
---

# API Reference

HTTPC provides 27 request-option functions, 5 configuration presets, 7 built-in middleware, and complete download support.

## Core Architecture

HTTPC uses a two-layer design: the Layer 1 method API is a thin wrapper, while the real request-processing engine is the Layer 2 Handler pipeline.

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
| [Mutators](./handler/mutators) | Read/write methods and type assertions of RequestMutator/ResponseMutator |

### Request and Response

| Module | Description |
|--------|-------------|
| [Request Options](./core/options) | 27 WithXxx request-option functions (headers, body, authentication, cookies, callbacks, etc.) |
| [Built-in Middleware](./client-config/middleware) | Chain composition, 7 built-in middleware factories, and audit event types |
| [Error Types](./types/errors) | ClientError, 12 ErrorType enums, and 12 error variables |

### Advanced Features

| Module | Description |
|--------|-------------|
| [Domain Client](./client-config/domain-client) | DomainClient creation, HTTP methods, download methods, and URL concatenation rules |
| [Session Management](./client-config/session) | SessionManager cookie/header management and security validation |
| [File Download](./client-config/download) | Download functions, DownloadConfig, resumable downloads, and security protection |
| [Constants and Types](./types/constants) | BodyKind enum, FormData/FileData, and audit context keys |

## API Map

A complete index grouped by symbol type, mapping one-to-one to the exported surface of the `github.com/cybergodev/httpc` package — click any entry to jump to its detail page.

### Client and Package-Level Functions

| Symbol | Description |
|--------|-------------|
| [`New`](./core/functions#new) / [`NewDefault`](./core/functions#newdefault) | Create a client (custom / default configuration) |
| [`Get`](./core/functions#get) / `Post` / `Put` / `Patch` / `Delete` / `Head` / `Options` / [`Request`](./core/functions#request) | Package-level HTTP methods (share the internal default client) |
| [`Download`](./core/functions#download) | Unified file-download entry (same name and signature on the package function / Client / DomainClient) |
| [`SetDefaultClient`](./core/functions#setdefaultclient) / [`CloseDefaultClient`](./core/functions#closedefaultclient) | Replace and close the default client |
| [`NewDomain`](./core/functions#newdomain) / [`NewDomainDefault`](./core/functions#newdomaindefault) | Domain-scoped clients |
| [`SetSecurityWarnOutput`](./core/functions#setsecuritywarnoutput) | Redirect security-warning output |
| [`FormatBytes`](./core/functions#formatbytes) / [`FormatSpeed`](./core/functions#formatspeed) | Format byte counts / speeds |

### Request Options (27)

| Group | Options |
|-------|---------|
| Headers (3) | `WithHeader`, `WithHeaderMap`, `WithUserAgent` |
| Authentication (2) | `WithBasicAuth`, `WithBearerToken` |
| Body (7) | `WithJSON`, `WithXML`, `WithForm`, `WithFormData`, `WithFile`, `WithBinary`, `WithBody` |
| Query parameters (2) | `WithQuery`, `WithQueryMap` |
| Cookies (4) | `WithCookies`, `WithCookieMap`, `WithCookieString`, `WithSecureCookie` |
| Request control (7) | `WithContext`, `WithTimeout`, `WithMaxRetries`, `WithFollowRedirects`, `WithMaxRedirects`, `WithAllowPrivateIPs`, `WithStreamBody` |
| Callbacks (2) | `WithOnRequest`, `WithOnResponse` |

For the signatures, validation rules, and Config defaults overridden by all options, see [Request Options](./core/options).

### Result Family

| Category | Symbols |
|----------|---------|
| Types | `Result` (17 nil-safe methods) |
| Status and protocol | `StatusCode`, `Proto`, `IsSuccess`, `IsRedirect`, `IsClientError`, `IsServerError` |
| Body access | `Body`, `RawBody` |
| Parsing and saving | `Unmarshal`, `SaveToFile`, `String` |
| Cookies | `ResponseCookies`, `GetCookie`, `HasCookie`, `RequestCookies`, `GetRequestCookie`, `HasRequestCookie` |
| Sub-types | `RequestInfo`, `ResponseInfo`, `RequestMeta` (with the `ProxyURL` proxy field) |

See [Result](./core/result) for details.

### Configuration

| Category | Symbols |
|----------|---------|
| Main type | `Config` (`Timeouts` / `Connection` / `Security` / `Retry` / `Middleware` / `Defaults` — six groups) |
| Sub-config types | `TimeoutConfig`, `ConnectionConfig`, `SecurityConfig`, `RetryConfig`, `MiddlewareConfig`, `RequestDefaults` |
| Presets (5) | `DefaultConfig`, `SecureConfig`, `PerformanceConfig`, `TestingConfig`, `MinimalConfig` |
| Validation and output | `ValidateConfig`, `Config.String` |
| Cookie security | `CookieSecurityConfig`, `DefaultCookieSecurityConfig`, `StrictCookieSecurityConfig` |
| Download config | `DownloadConfig`, `DefaultDownloadConfig`, `DownloadResult`, `DownloadProgressCallback`, `ChecksumAlgorithm` |
| Session config | `SessionConfig`, `DefaultSessionConfig`, `NewSessionManager`, `NewSessionManagerDefault` |

See [Configuration](./client-config/config), [File Download](./client-config/download), and [Session Management](./client-config/session) for details.

### Handler, Middleware, and Mutators

| Category | Symbols |
|----------|---------|
| Pipeline types | `Handler`, `MiddlewareFunc`, `Chain` |
| Middleware factories (7) | `LoggingMiddleware`, `RecoveryMiddleware`, `RequestIDMiddleware`, `TimeoutMiddleware`, `HeaderMiddleware`, `MetricsMiddleware`, `AuditMiddleware` |
| Middleware configs | `LoggingConfig`, `RequestIDConfig`, `TimeoutMiddlewareConfig`, `HeaderConfig`, `MetricsConfig`, `AuditConfig` (each with a `Default*Config()` constructor) |
| Mutators | `RequestMutator`, `ResponseMutator` (the contract through which middleware reads/writes requests and responses) |

See [Handler Pipeline](./handler/handler-chain), [Built-in Middleware](./client-config/middleware), and [Mutators](./handler/mutators) for details.

### Interfaces and Types

| Category | Symbols |
|----------|---------|
| Core interfaces | `Client`, `Doer`, `DomainClienter`, `RetryPolicy` |
| Type aliases | `RequestOption`, `ClientError`, `ErrorType`, `CertificatePinner`, `ProxyStrategy` |
| Certificate pinning | `NewSPKIHashPinner`, `NewPublicKeyPinner`, `NewCertificatePinnerChain` |
| Session and domain | `SessionManager`, `DomainClient` (recommended for use via the `DomainClienter` interface) |
| Data types | `FormData`, `FileData`, `AuditEvent` |

See [Interfaces](./types/interfaces), [Domain Client](./client-config/domain-client), [Session Management](./client-config/session), and [Constants and Types](./types/constants) for details.

### Errors and Constants

| Category | Symbols |
|----------|---------|
| Error types | `ClientError`, `ErrorType` (enum of 12 error categories) |
| Sentinel errors (12) | `ErrClientClosed`, `ErrNilConfig`, `ErrInvalidHeader`, `ErrInvalidTimeout`, `ErrInvalidRetry`, `ErrInvalidConnection`, `ErrInvalidSecurity`, `ErrInvalidMiddleware`, `ErrEmptyFilePath`, `ErrFileExists`, `ErrResponseBodyEmpty`, `ErrResponseBodyTooLarge` |
| BodyKind (6 constants) | `BodyAuto`, `BodyJSON`, `BodyXML`, `BodyForm`, `BodyBinary`, `BodyMultipart` |
| Other constants | `ProxyStrategyRoundRobin` / `ProxyStrategyRandom`, `ChecksumSHA256`, audit context keys |

See [Error Types](./types/errors) and [Constants and Types](./types/constants) for details.

## Quick Reference

### Creating a Client

```go
client, err := httpc.NewDefault()             // Default configuration
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

## Version Compatibility

- **Go version**: requires Go 1.25 or later (`go.mod` declares `go 1.25.0`).
- **Import path**: `github.com/cybergodev/httpc` (package name `httpc`, no alias needed).
- **Direct dependencies**: only `golang.org/x/sys` (for per-platform system-proxy detection, covering Linux/macOS/Windows); no other third-party dependencies.
- **API status**: no exported symbol currently carries a `Deprecated` marker; the library is under active maintenance.

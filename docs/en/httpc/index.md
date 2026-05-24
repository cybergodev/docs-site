---
title: "HTTP Client - HTTPC"
description: "CyberGo HTTPC is a secure Go HTTP client with TLS 1.2+, SSRF protection, smart retry, middleware chains, and object pool reuse for microservices."
---

# HTTPC

A secure HTTP client library that is secure by default, with built-in smart retries, middleware chains, and object pool reuse.

## Features

- **TLS 1.2+** - Enforces minimum TLS version, defaulting to TLS 1.2-1.3
- **SSRF Protection** - Blocks private IP connections by default, with configurable CIDR exemptions
- **Smart Retries** - Exponential backoff with jitter, customizable retry strategies
- **Connection Pool Management** - High-performance connection reuse with HTTP/2 support
- **Middleware Chain** - Built-in middleware for logging, auditing, metrics, recovery, request IDs, and more
- **File Downloads** - Supports resumable downloads, progress callbacks, and checksum verification
- **DNS-over-HTTPS** - Built-in DoH resolution to reduce DNS hijacking risks
- **Object Pool Reuse** - Built-in sync.Pool to reduce memory allocations and lower GC pressure

## Installation

```bash
go get github.com/cybergodev/httpc
```

## 30-Second Quickstart

```go
package main

import (
    "fmt"
    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://httpbin.org/get")
    if err != nil {
        panic(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
}
```

## Getting Started

Choose your reading path based on your goal:

| Goal | Recommended |
|------|-------------|
| Get started in 5 minutes | [Getting Started](./getting-started) |
| Hands-on tutorial in 30 minutes | [Tutorial](./guides/tutorial) |
| Look up a specific usage | [Cheatsheet](./cheatsheet) |
| Learn about security features | [Security Overview](./security/) |
| Look up API signatures | [API Reference](./api-reference/) |

## Core Concepts

HTTPC provides three usage patterns, from simple to flexible:

```text
Package-level functions    Client instance                Domain client
httpc.Get()  →  client, _ := httpc.New()  →  dc, _ := httpc.NewDomain(url)
One-off requests     Custom config/middleware    Session management/Auto Cookie
```

### Configuration Presets

| Preset | Use Case |
|--------|----------|
| `DefaultConfig()` | General use, secure defaults |
| `SecureConfig()` | Security-sensitive scenarios, strict timeouts |
| `PerformanceConfig()` | High throughput, large connection pool |
| `TestingConfig()` | Test environments, security checks disabled |
| `MinimalConfig()` | Lightweight scripts, no retries or redirects |

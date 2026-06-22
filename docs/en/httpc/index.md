---
title: "HTTP Client - CyberGo HTTPC | Secure Go Client"
description: "CyberGo HTTPC is a secure Go HTTP client with TLS 1.2+, SSRF protection, exponential backoff retry, middleware chains, and connection pooling for microservices."
---

# HTTPC

A secure HTTP client library with secure defaults, built-in smart retries, middleware chain, and object pool reuse.

## Features

- **TLS 1.2+** - Enforces minimum TLS version, defaults to TLS 1.2-1.3
- **SSRF Protection** - Blocks private IP connections by default, configurable CIDR exemptions
- **Smart Retries** - Exponential backoff with jitter, customizable retry policies
- **Connection Pool Management** - High-performance connection reuse, HTTP/2 support
- **Middleware Chain** - Logging, audit, metrics, recovery, request ID, and other built-in middleware
- **File Download** - Resumable downloads, progress callbacks, checksum verification
- **DNS-over-HTTPS** - Built-in DoH resolution, reducing DNS hijacking risk
- **Object Pool Reuse** - Internal response objects and string builders are reused via sync.Pool, reducing GC pressure

## Installation

```bash
go get github.com/cybergodev/httpc
```

## 30-Second Quick Start

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

    fmt.Println(result.StatusCode()) // 200
}
```

## Getting Started

Choose your reading path based on your goal:

| Goal | Recommended |
|------|-------------|
| 5-minute setup | [Quick Start](./getting-started) |
| 30-minute hands-on | [Tutorial](./guides/tutorial) |
| Look up a specific usage | [Cheat Sheet](./cheatsheet) |
| Learn about security | [Security Overview](./security/) |
| Check API signatures | [API Reference](./api-reference/) |

## Core Concepts

HTTPC provides three usage patterns, from simple to flexible:

```text
Package-level functions    Client instance              Domain client
httpc.Get()         →  client, _ := httpc.New()  →  dc, _ := httpc.NewDomain(url)
One-off requests       Custom config/middleware    Session management/Auto Cookie maintenance
```

### Configuration Presets

| Preset | Use Case |
|--------|----------|
| `DefaultConfig()` | General purpose, secure defaults |
| `SecureConfig()` | Security-sensitive scenarios, strict timeouts |
| `PerformanceConfig()` | High throughput, large connection pool |
| `TestingConfig()` | Test environments, security checks disabled |
| `MinimalConfig()` | Lightweight scripts, no retries or redirects |

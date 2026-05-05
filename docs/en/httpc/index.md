---
title: HTTP Client - HTTPC
description: CyberGo HTTPC is a secure, high-performance HTTP client library for Go, designed with secure defaults, built-in TLS 1.2+ enforcement, SSRF protection, smart retries, onion-model middleware chaining, and object pool recycling for microservice architectures and security-sensitive HTTP communication.
---

# HTTPC

A secure HTTP client library with secure defaults, built-in smart retries, middleware chaining, and object pool recycling.

## Features

- **TLS 1.2+** - Enforces minimum TLS version, defaults to TLS 1.2-1.3
- **SSRF Protection** - Blocks private IP connections by default, configurable CIDR exemptions
- **Smart Retries** - Exponential backoff with jitter, customizable retry strategies
- **Connection Pool Management** - High-performance connection reuse with HTTP/2 support
- **Middleware Chain** - Built-in middleware for logging, auditing, metrics, recovery, request ID, and more
- **File Downloads** - Supports resuming downloads, progress callbacks, and checksum verification
- **DNS-over-HTTPS** - Built-in DoH resolution to reduce DNS hijacking risks
- **Object Pool Recycling** - Built-in sync.Pool reduces memory allocations and GC pressure

## Installation

```bash
go get github.com/cybergodev/httpc
```

## Quick Start in 30 Seconds

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
| Look up a specific usage | [Cheat Sheet](./cheatsheet) |
| Learn about security features | [Security Overview](./security/) |
| Look up API signatures | [API Reference](./api-reference/) |

## Core Concepts

HTTPC provides three usage modes, from simple to flexible:

```text
Package-level functions    Client instance               Domain client
httpc.Get()  →  client, _ := httpc.New()  →  dc, _ := httpc.NewDomain(url)
One-off requests       Custom config/middleware     Session management/Auto Cookie
```

### Configuration Presets

| Preset | Use Case |
|--------|----------|
| `DefaultConfig()` | General purpose with secure defaults |
| `SecureConfig()` | Security-sensitive scenarios with strict timeouts |
| `PerformanceConfig()` | High throughput with large connection pools |
| `TestingConfig()` | Testing environments with security checks disabled |
| `MinimalConfig()` | Lightweight scripts with no retries or redirects |

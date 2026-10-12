---
sidebar_label: "Installation"
title: "Installation - CyberGo DD | Requirements & Integration"
description: "CyberGo DD installation guide: Go version requirements, go get, Go Module integration, CI/CD tips, and troubleshooting for common issues."
sidebar_position: 2
---

# Installation

## Requirements

| Requirement | Version |
|-------------|---------|
| Go | ≥ 1.25 |
| OS | Linux / macOS / Windows |

:::tip Go Version
DD uses features from Go 1.25. If your project uses an older Go toolchain, upgrade with: `go env -w GOTOOLCHAIN=go1.25.0+auto`.
:::

## Quick Install

```bash
go get github.com/cybergodev/dd
```

## Go Module Integration

From your project root:

```bash
# Initialize module (if you don't have go.mod yet)
go mod init your-project

# Add DD dependency
go get github.com/cybergodev/dd
```

Import the package:

```go
import "github.com/cybergodev/dd"
```

Verify installation:

```go
package main

import "github.com/cybergodev/dd"

func main() {
	dd.Info("DD installed successfully!")
}
```

## Version Management

### Pinning a Version

```bash
# Install a specific version
go get github.com/cybergodev/dd@v1.0.0

# Upgrade to latest
go get github.com/cybergodev/dd@latest
```

### Dependency Management

```bash
# Tidy dependencies
go mod tidy

# Check current version
go list -m github.com/cybergodev/dd
```

## CI/CD Integration

Using DD in GitHub Actions:

```yaml
steps:
  - uses: actions/setup-go@v5
    with:
      go-version: '1.25'
  - uses: actions/checkout@v4
  - run: go mod download
  - run: go build ./...
```

:::warning Private Repositories
If DD is hosted on a private Git server, configure GOPRIVATE:

```bash
go env -w GOPRIVATE=github.com/cybergodev/*
```
:::

## Troubleshooting

### `go get` reports `module not found`

Ensure Go ≥ 1.25 and check your proxy:

```bash
go env -w GOPROXY=https://proxy.golang.org,direct
```

### Build error `undefined: dd.xxx`

Run `go mod tidy` to sync dependencies, then rebuild.

## Next Steps

- [Quick Start](./) -- 5-minute guide
- [Global Logger](./global-logger) -- Package-level convenience functions
- [Core Concepts](../guides/basics/core-concepts) -- Understanding DD architecture

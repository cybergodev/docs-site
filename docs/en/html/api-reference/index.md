---
sidebar_label: "Overview"
title: "API Reference - CyberGo html | Function & Type Index"
description: "CyberGo html API index: package functions vs Processor modes plus extraction, output, links, batch, config, security, audit, interfaces, types, and errors."
sidebar_position: 1
---

# API Reference

The HTML library provides the following core components:

| Component | Description | Docs |
|-----------|-------------|------|
| Package functions | Convenience functions, suited for one-off calls | [Package Functions](./core/functions) |
| Processor | Processor instance, reusing resources and cache | [Processor](./core/processor) |
| Config | Configuration struct and presets | [Config](./core/config) |
| Output Formats | Markdown and JSON output | [Output Formats](./modules/output) |
| Link Extraction | Standalone link extraction API | [Link Extraction](./modules/links) |
| Batch Processing | Concurrent batch extraction | [Batch Processing](./modules/batch) |
| Interfaces | Extractor, StatsProvider, etc. | [Interface Definitions](./types/interfaces) |
| Types | Result, ImageInfo, etc. | [Type Definitions](./types/type-defs) |
| Constants & Errors | Defaults, sentinel errors | [Constants & Errors](./types/constants) |
| Security | Sanitization, input limits, path safety | [Security](./modules/security) |
| Audit System | Audit pipeline and Sinks | [Audit System](./modules/audit) |

## API Overview

### Two Calling Modes

```text
┌─────────────────────────────────────────┐
│      Package functions (convenience)    │
│  html.Extract(data) → *Result, error    │
│  Reuses Processor via sync.Pool         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      Processor (instance mode)          │
│  p, _ := html.New(cfg)                  │
│  defer p.Close()                        │
│  result, err := p.Extract(data)         │
│  ✓ cache reuse  ✓ stats  ✓ audit log    │
└─────────────────────────────────────────┘
```

### Function Naming Rules

| Pattern | Naming | Example |
|---------|--------|---------|
| Base | `Extract*` | `Extract`, `ExtractText` |
| From file | `Extract*FromFile` | `ExtractFromFile` |
| With context | `Extract*WithContext` | `ExtractWithContext` |
| From file + context | `Extract*FromFileWithContext` | `ExtractFromFileWithContext` |

### Module Information

- **Module path**: `github.com/cybergodev/html`
- **Go version**: 1.26+
- **Dependencies**: `golang.org/x/net`, `golang.org/x/text`

## Core Type Quick Reference

| Type | Description | Docs |
|------|-------------|------|
| `Result` | Extraction result (text, title, images, links, statistics) | [Type Definitions](./types/type-defs) |
| `Config` | Unified config struct and presets | [Config](./core/config) |
| `Processor` | Core processing engine with caching and statistics | [Processor](./core/processor) |
| `Statistics` | Processing statistics (hits, errors, average time) | [Type Definitions](./types/type-defs) |
| `BatchResult` | Batch extraction result | [Batch Processing](./modules/batch) |
| `LinkResource` | Link resource (with type classification) | [Link Extraction](./modules/links) |
| `AuditEntry` | Audit log entry | [Audit System](./modules/audit) |

## Interface Quick Reference

| Interface | Description | Docs |
|-----------|-------------|------|
| `Extractor` | Main extraction interface, for decoupling and mocking | [Interface Definitions](./types/interfaces) |
| `StatsProvider` | Statistics query interface | [Interface Definitions](./types/interfaces) |
| `Scorer` | Custom content scoring algorithm | [Interface Definitions](./types/interfaces) |
| `ContentNode` | Node abstraction, hiding the internal parser type | [Interface Definitions](./types/interfaces) |
| `AuditSink` | Audit log output target (custom backend) | [Interface Definitions](./types/interfaces) |

## Preset Configurations

Start from a preset and fine-tune as needed; avoid hand-writing zero-value configs (the `Config` zero value is not directly usable):

| Preset | Purpose |
|--------|---------|
| `DefaultConfig()` | General scenarios, balancing features and performance |
| `TextOnlyConfig()` | Extract plain text only, disable all media, highest performance |
| `MarkdownConfig()` | Output inline Markdown-format images and links |
| `HighSecurityConfig()` | High-security environments: tighter limits, shorter timeouts, audit enabled |

See [Config](./core/config) for details.

## Find an API by Scenario

Common needs and their entry points:

| Need | Recommended API | Docs |
|------|-----------------|------|
| Plain text only | `ExtractText` / `Processor.ExtractText` | [Package Functions](./core/functions) |
| Markdown output | `ExtractToMarkdown` or `MarkdownConfig()` | [Output Formats](./modules/output) |
| Extract all link resources | `ExtractAllLinks` | [Link Extraction](./modules/links) |
| Concurrent batch processing | `ExtractBatch` / `ExtractBatchFiles` | [Batch Processing](./modules/batch) |
| Custom content identification | `Scorer` interface + `Config.Scorer` | [Interface Definitions](./types/interfaces) |
| Audit security events | `AuditConfig` + `AuditSink` | [Audit System](./modules/audit) |
| High-frequency reuse + cache | `html.New()` long-lived `Processor` | [Processor](./core/processor) |

---
sidebar_label: "Overview"
title: "API Reference - CyberGo html | Function & Type Index"
description: "CyberGo html API reference index: compares package functions with the Processor mode and links to config, output, links, batch, interfaces, types, and errors."
sidebar_position: 10
---

# API Reference

CyberGo html is a Go library for HTML content extraction. Its API has two entry points: package functions for one-off calls, and `Processor` instances that reuse the cache and accumulate state. The table below maps each component to its documentation.

| Component | Description | Docs |
|-----------|-------------|------|
| Package functions | Convenience functions for one-off calls | [Package Functions](./core/functions) |
| Processor | Processor instance that reuses resources and cache | [Processor](./core/processor) |
| Config | Configuration struct and presets | [Config](./core/config) |
| Output Formats | Markdown and JSON output | [Output Formats](./modules/output) |
| Link Extraction | Standalone link extraction API | [Link Extraction](./modules/links) |
| Batch Processing | Concurrent batch extraction | [Batch Processing](./modules/batch) |
| Interfaces | `Extractor`, `StatsProvider`, and others | [Interfaces](./types/interfaces) |
| Types | `Result`, `ImageInfo`, and others | [Types](./types/type-defs) |
| Constants & Errors | Defaults and sentinel errors | [Constants & Errors](./types/constants) |
| Security | Sanitization, input limits, path safety | [Security](./modules/security) |
| Audit System | Audit pipeline and Sinks | [Audit System](./modules/audit) |

## API Overview

### Two Calling Modes

```text
┌─────────────────────────────────────────┐
│         Package functions (one-off)     │
│  html.Extract(data) → *Result, error    │
│  Reuses Processor via sync.Pool         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         Processor (instance mode)       │
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
| `Result` | Extraction result (text, title, images, links, statistics) | [Types](./types/type-defs) |
| `Config` | Unified config struct and presets | [Config](./core/config) |
| `Processor` | Core processing engine with cache and statistics | [Processor](./core/processor) |
| `Statistics` | Processing statistics (hits, errors, average time) | [Types](./types/type-defs) |
| `BatchResult` | Batch extraction result | [Batch Processing](./modules/batch) |
| `LinkResource` | Link resource with type classification | [Link Extraction](./modules/links) |
| `AuditEntry` | Audit log entry | [Audit System](./modules/audit) |

## Interface Quick Reference

| Interface | Description | Docs |
|-----------|-------------|------|
| `Extractor` | Main extraction interface, for decoupling and mocking | [Interfaces](./types/interfaces) |
| `StatsProvider` | Statistics and cache management interface | [Interfaces](./types/interfaces) |
| `Scorer` | Custom content scoring algorithm | [Interfaces](./types/interfaces) |
| `ContentNode` | Node abstraction hiding the internal parser type | [Interfaces](./types/interfaces) |
| `AuditSink` | Audit log output target | [Interfaces](./types/interfaces) |

## Preset Configurations

Start from a preset and override fields; do not hand-write a zero-value config (`Config{}` fails `Validate()`):

| Preset | Purpose |
|--------|---------|
| `DefaultConfig()` | General scenarios, balancing features and performance |
| `TextOnlyConfig()` | No media or link information retained; those extractions are skipped |
| `MarkdownConfig()` | Inline images and links in the body rendered as Markdown |
| `HighSecurityConfig()` | High-security environments: tighter limits, shorter timeouts, audit enabled |

See [Config](./core/config) for details.

## Find an API by Scenario

| Need | Recommended API | Docs |
|------|-----------------|------|
| Plain text only | `ExtractText` / `Processor.ExtractText` | [Package Functions](./core/functions) |
| Markdown output | `ExtractToMarkdown` or `MarkdownConfig()` | [Output Formats](./modules/output) |
| Extract all link resources | `ExtractAllLinks` | [Link Extraction](./modules/links) |
| Concurrent batch processing | `ExtractBatch` / `ExtractBatchFiles` | [Batch Processing](./modules/batch) |
| Custom content identification | `Scorer` interface + `Config.Scorer` | [Interfaces](./types/interfaces) |
| Audit security events | `AuditConfig` + `AuditSink` | [Audit System](./modules/audit) |
| High-frequency reuse + cache | `html.New()` long-lived `Processor` | [Processor](./core/processor) |

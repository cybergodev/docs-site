---
sidebar_label: "Overview"
title: "API Reference - CyberGo html | Full Function & Type Index"
description: "Full CyberGo html API index: package functions and Processor call styles, covering content extraction, format output, links, batch, config, audit, and types."
sidebar_position: 1
---

# API Reference

The HTML library provides the following core components:

| Component | Description | Documentation |
|-----------|-------------|---------------|
| Package Functions | Convenience functions for one-time calls | [Functions](./core/functions) |
| Processor | Processor instance for reusing resources and cache | [Processor](./core/processor) |
| Config | Configuration struct and presets | [Config](./core/config) |
| Output Formats | Markdown, JSON output | [Output Formats](./modules/output) |
| Link Extraction | Standalone link extraction API | [Link Extraction](./modules/links) |
| Batch Processing | Concurrent batch extraction | [Batch Processing](./modules/batch) |
| Interfaces | Extractor, StatsProvider, etc. | [Interfaces](./types/interfaces) |
| Types | Result, ImageInfo, etc. | [Types](./types/type-defs) |
| Constants & Errors | Defaults, sentinel errors | [Constants & Errors](./types/constants) |
| Audit System | Audit pipeline and Sinks | [Audit System](./modules/audit) |

## API Overview

### Two Calling Modes

```text
┌─────────────────────────────────────────┐
│         Package Functions (Convenience)  │
│  html.Extract(data) → *Result, error    │
│  Uses sync.Pool internally              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         Processor (Instance Mode)        │
│  p, _ := html.New(cfg)                  │
│  defer p.Close()                        │
│  result, err := p.Extract(data)         │
│  ✓ Cache reuse  ✓ Statistics  ✓ Audit   │
└─────────────────────────────────────────┘
```

### Function Naming Convention

| Pattern | Naming | Example |
|---------|--------|---------|
| Basic | `Extract*` | `Extract`, `ExtractText` |
| From file | `Extract*FromFile` | `ExtractFromFile` |
| With context | `Extract*WithContext` | `ExtractWithContext` |
| From file + context | `Extract*FromFileWithContext` | `ExtractFromFileWithContext` |

### Module Information

- **Module path**: `github.com/cybergodev/html`
- **Go version**: 1.25+
- **Dependencies**: `golang.org/x/net`, `golang.org/x/text`

---
title: "API Reference - CyberGo HTML | Full Module Index"
description: "CyberGo HTML full API index: content and text extraction, format output, links, batch processing, configuration, audit, and types overview."
---

# API Reference

The HTML library provides the following core components:

| Component | Description | Documentation |
|-----------|-------------|---------------|
| Package Functions | Convenience functions for one-time calls | [Functions](./functions) |
| Processor | Processor instance for reusing resources and cache | [Processor](./processor) |
| Config | Configuration struct and presets | [Config](./config) |
| Output Formats | Markdown, JSON output | [Output Formats](./output) |
| Link Extraction | Standalone link extraction API | [Link Extraction](./links) |
| Batch Processing | Concurrent batch extraction | [Batch Processing](./batch) |
| Interfaces | Extractor, StatsProvider, etc. | [Interfaces](./interfaces) |
| Types | Result, ImageInfo, etc. | [Types](./types) |
| Constants & Errors | Defaults, sentinel errors | [Constants & Errors](./constants) |
| Audit System | Audit pipeline and Sinks | [Audit System](./audit) |

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

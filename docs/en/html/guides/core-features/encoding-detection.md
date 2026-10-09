---
sidebar_label: "Encoding Detection"
title: "Encoding Detection - CyberGo html | Charset Detection Guide"
description: "CyberGo html encoding detection: four-level priority (manual, meta, statistical, UTF-8 fallback), 15+ encodings, Config.Encoding, GBK/Shift_JIS/Windows-1252."
sidebar_position: 5
---

# Encoding Detection Guide

HTML documents may use various character encodings (GBK, Shift_JIS, Windows-1252, etc.). The library has built-in automatic encoding detection that identifies the encoding from the HTML bytes and converts to UTF-8. It supports 15+ encodings with no manual handling required.

## Detection Priority

The library determines the input encoding in the following order, trying each in turn; the first match wins:

| Priority | Source | Description |
|--------|------|------|
| ① Highest | `Config.Encoding` manual override | Used directly when non-empty, skipping all automatic detection |
| ② | HTML meta tag declaration | `<meta charset>` or `http-equiv="content-type"`, scanning the first 1024 bytes |
| ③ | Statistical algorithm detection | Samples up to 10KB; adopted only when confidence ≥ 80 |
| ④ Fallback | UTF-8 | Falls back to UTF-8 when none of the above match |

```text
Config.Encoding non-empty? ── yes ──→ use directly
        │
        no
        │
meta tag declares encoding? ── yes ──→ use declared value
        │
        no
        │
statistical confidence ≥ 80? ── yes ──→ adopt statistical result
        │
        no
        │
        └──→ UTF-8
```

:::tip BOM detection
In addition to the four levels above, the library also detects the BOM (byte order mark): UTF-8 BOM (`EF BB BF`), UTF-16 LE BOM (`FF FE`), UTF-16 BE BOM (`FE FF`). When a BOM is present, the encoding is determined directly.
:::

## Supported Encodings

| Category | Encodings | Notes |
|------|------|------|
| Unicode | UTF-8, UTF-16LE, UTF-16BE | UTF-8 is the default fallback |
| Western European | Windows-1252, ISO-8859-1, ISO-8859-15 | ISO-8859-15 includes the euro sign |
| Central European | Windows-1250 | — |
| Cyrillic | Windows-1251 | Russian, etc. |
| Simplified Chinese | GBK | The alias `gb2312` is normalized to `gbk` |
| Traditional Chinese | Big5 | — |
| Japanese | Shift_JIS, EUC-JP | — |
| Korean | EUC-KR | — |

### Encoding alias normalization

Encoding names and aliases are **case-insensitive** and are normalized to canonical names automatically:

| Input alias | Normalized result |
|----------|-----------|
| `gb2312`, `GB2312` | `gbk` |
| `sjis`, `x-sjis`, `shift-jis` | `shift_jis` |
| `latin1`, `latin-1` | `iso-8859-1` |
| `utf8`, `utf_8` | `utf-8` |
| `8859-1`, `iso88591` | `iso-8859-1` |
| `cp1252`, `windows1252` | `windows-1252` |

## Automatic Detection Example

A GBK-encoded Chinese HTML document is recognized automatically via its meta tag declaration:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/simplifiedchinese"
)

func main() {
	// GBK-encoded Chinese HTML (meta tag declares charset=gbk)
	gbkHTML := `<html><head><meta charset="gbk">` +
		`<title>中文网页</title></head>` +
		`<body><article><h1>你好世界</h1>` +
		`<p>这是一段中文内容。</p></article></body></html>`

	// Encode the UTF-8 string to GBK bytes (simulating a real GBK web page)
	gbkBytes, err := simplifiedchinese.GBK.NewEncoder().Bytes([]byte(gbkHTML))
	if err != nil {
		log.Fatal(err)
	}

	// Auto-detect encoding and extract (detects GBK from meta charset, converts to UTF-8, then extracts)
	result, err := html.Extract(gbkBytes)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Title:", result.Title)
	// Title: 中文网页

	fmt.Println("Text:", result.Text)
	// Text: 你好世界
	//       这是一段中文内容。
}
```

## Manually Specifying the Encoding

When the meta tag is missing, declared incorrectly, or automatic detection is uncertain, force a specific encoding via `Config.Encoding`:

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"

result, err := html.Extract(gbkBytes, cfg)
```

| Use case | Description |
|----------|------|
| Source encoding is known | Obtain the encoding from the HTTP `Content-Type` header and specify it directly to avoid misdetection |
| Meta tag missing | Legacy pages without a `<meta charset>` declaration |
| Automatic detection fails | The statistical algorithm's confidence is too low, producing incorrect results |

:::tip Config.Encoding has the highest priority
Once `Config.Encoding` is set, the library skips automatic detection entirely and decodes directly with the specified encoding. Ideal for deterministic scenarios, avoiding the uncertainty of statistical detection.
:::

### Shift_JIS Automatic Detection in Practice

Japanese web pages often use the Shift_JIS encoding. Even without a meta declaration, the statistical algorithm can recognize it:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/japanese"
)

func main() {
	// Shift_JIS-encoded Japanese HTML (no meta charset declaration)
	sjisHTML := `<html><head><title>日本語ページ</title></head>` +
		`<body><article><h1>こんにちは</h1>` +
		`<p>東京の天気は晴れです。</p></article></body></html>`

	// Encode to Shift_JIS bytes
	sjisBytes, err := japanese.ShiftJIS.NewEncoder().Bytes([]byte(sjisHTML))
	if err != nil {
		log.Fatal(err)
	}

	// The statistical algorithm recognizes Shift_JIS automatically (samples bytes to analyze Japanese character distribution)
	result, err := html.Extract(sjisBytes)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Title:", result.Title)
	// Title: 日本語ページ

	fmt.Println("Text:", result.Text)
	// Text: こんにちは
	//       東京の天気は晴れです。
}
```

### Manually Specifying Windows-1252

Western European encodings (containing characters like `é`, `€`) can be specified manually:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/charmap"
)

func main() {
	// Windows-1252-encoded Western European text
	winHTML := `<html><head><title>Café Menu</title></head>` +
		`<body><article><h1>Café</h1>` +
		`<p>Price: 100 €. Résumé available.</p></article></body></html>`

	winBytes, err := charmap.Windows1252.NewEncoder().Bytes([]byte(winHTML))
	if err != nil {
		log.Fatal(err)
	}

	// Manually specify the Windows-1252 encoding
	cfg := html.DefaultConfig()
	cfg.Encoding = "windows-1252"

	result, err := html.Extract(winBytes, cfg)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Title:", result.Title)
	// Title: Café Menu

	fmt.Println("Text:", result.Text)
	// Text: Café
	//       Price: 100 €. Résumé available.
}
```

## Encoding Detection Failure

When encoding detection or conversion fails (e.g., corrupted data, an unsupported encoding), a wrapping error is returned:

```go
result, err := html.Extract(data)
if err != nil {
    if strings.Contains(err.Error(), "encoding detection failed") {
        // Encoding detection failed; fall back to manual specification
        cfg := html.DefaultConfig()
        cfg.Encoding = "windows-1252"
        result, err = html.Extract(data, cfg)
        if err != nil {
            log.Fatal(err)
        }
    } else {
        log.Fatal(err)
    }
}
```

:::warning Error message format
The error message for an encoding detection failure always contains the `"encoding detection failed"` prefix, which can be matched with `strings.Contains`. When detection fails, it is recommended to fall back to a manually specified encoding.
:::

## Audit Logging

With auditing enabled, encoding detection issues are logged as `AuditEventEncodingIssue` (info level):

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.Audit = html.DefaultAuditConfig()
	cfg.Audit.Enabled = true
	// LogEncodingIssues defaults to true (enabled in DefaultAuditConfig)

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// Process HTML (encoding issues are logged to the audit log automatically)
	p.Extract([]byte(`<html><body><p>content</p></body></html>`))

	// Query the audit log for encoding events
	for _, entry := range p.GetAuditLog() {
		if entry.EventType == html.AuditEventEncodingIssue {
			fmt.Printf("[Encoding issue] %s\n", entry.Message)
		}
	}

	fmt.Println("Encoding event check complete")
	// Encoding event check complete
}
```

:::tip Trigger conditions
`AuditEventEncodingIssue` is logged only when encoding detection or conversion fails (e.g., an unsupported encoding was used and the data is not valid UTF-8). Normal documents never produce this event. Encoding issues are `info` level (the lowest), indicating the data may not have been decoded perfectly but security is unaffected. To filter them out, use `LevelFilteredSink` with a minimum level of `warning`.
:::

## Next Steps

- [Content Extraction](./content-extraction) - Extraction workflow and article recognition
- [Error Handling](../performance/error-handling) - Sentinel errors and structured error handling
- [API Reference: Config](../../api-reference/core/config) - The Encoding field and all configuration options

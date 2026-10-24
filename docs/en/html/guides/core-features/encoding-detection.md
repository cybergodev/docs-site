---
sidebar_label: "Encoding Detection"
title: "Encoding Detection - CyberGo html | Charset Detection Guide"
description: "CyberGo html charset detection: the order of Config.Encoding, BOM, meta declaration, valid UTF-8, and windows-1252 fallback, with GBK and Shift_JIS examples."
sidebar_position: 50
---

# Encoding Detection

An HTML document's character encoding comes from `Config.Encoding`, a BOM, a `<meta>` declaration, or the data itself. This page covers the decision order, the supported encodings, and what undeclared pages actually produce.

## Detection Order

Detection has two stages: basic detection proposes a charset, then the candidate is scored — 90 or above is accepted, otherwise the statistical pass can take over.

| Priority | Stage | Source | Notes |
|----------|-------|--------|-------|
| ① | Forced | `Config.Encoding` | Used directly; all later detection is skipped |
| ② | Basic | BOM | UTF-8 (`EF BB BF`), UTF-16 LE (`FF FE`), UTF-16 BE (`FE FF`) |
| ③ | Basic | Pure ASCII | Uses the `<meta>` declaration when present, otherwise UTF-8 |
| ④ | Basic | Valid UTF-8 (non-ASCII present) | Treated as UTF-8 and the meta declaration is **ignored** |
| ⑤ | Basic | Meta declaration | `<meta charset>` or `http-equiv="content-type"`, scanning only the first 1024 bytes |
| ⑥ | Basic | windows-1252 fallback | When nothing above applies |
| ⑦ | Statistical | Scores 13 candidate encodings | Runs when the basic result scores below 90 (a `utf-8` basic result scoring 70–89 is accepted directly); samples up to 10KB |

Steps ③ and ④ differ deliberately. Pure ASCII carries no encoding information, so the declaration decides. Non-ASCII data that is already valid UTF-8 is trusted over its declaration, because some pages declare a legacy charset while actually serving UTF-8.

```text
Config.Encoding set? ── yes ──→ use it
        │
        no
        │
BOM? ── yes ──→ use the BOM charset
        │
        no
        │
Pure ASCII? ── yes ──→ meta declaration if present, else UTF-8
        │
        no
        │
Valid UTF-8? ── yes ──→ UTF-8 (meta declaration ignored)
        │
        no
        │
Meta declaration? ── yes ──→ use the declared value
        │
        no
        │
windows-1252 fallback
```

The charset from basic detection is then scored: 90 or above is used as-is; 70–89 is also accepted when the basic result is `utf-8`; otherwise the statistical pass runs (samples up to 10KB, decodes and scores 13 candidates) and the highest score wins.

:::tip The BOM outranks the meta declaration
A BOM is an encoding declaration carried by the data itself, and basic detection checks it first. When a BOM is present the encoding is settled without consulting any meta declaration.
:::

## Supported Encodings

| Category | Encodings | Notes |
|------|------|------|
| Unicode | UTF-8, UTF-16LE, UTF-16BE | Pure ASCII / valid UTF-8 input is treated as UTF-8 |
| Western European | Windows-1252, ISO-8859-1, ISO-8859-15 | ISO-8859-15 includes the euro sign |
| Central European | Windows-1250, ISO-8859-2, ISO-8859-3, ISO-8859-4 | ISO-8859-3 is South European, ISO-8859-4 is Baltic |
| Cyrillic | Windows-1251, ISO-8859-5 | Russian, etc. |
| Other ISO-8859 | ISO-8859-6 (Arabic), ISO-8859-7 (Greek), ISO-8859-8 (Hebrew), ISO-8859-9 (Turkish), ISO-8859-10 (Nordic), ISO-8859-13 (Baltic), ISO-8859-14 (Celtic), ISO-8859-16 (Southeast European) | The series omits -11/-12 |
| Simplified Chinese | GBK | The alias `gb2312` is normalized to `gbk` |
| Traditional Chinese | Big5 | — |
| Japanese | Shift_JIS, EUC-JP, ISO-2022-JP | — |
| Korean | EUC-KR | — |

The conversion registry supports 26 encodings in total (including UTF-8 itself).

### Alias normalization

Encoding names and aliases are **case-insensitive** and normalize to canonical names:

| Input alias | Normalized result |
|----------|-----------|
| `gb2312`, `GB2312` | `gbk` |
| `sjis`, `x-sjis`, `shift-jis` | `shift_jis` |
| `latin1`, `latin-1` | `iso-8859-1` |
| `utf8`, `utf_8` | `utf-8` |
| `8859-1`, `iso88591` | `iso-8859-1` |
| `cp1252`, `windows1252` | `windows-1252` |

## GBK with a Meta Declaration

A GBK-encoded Chinese page that declares its encoding in `<meta charset>` is identified by basic detection:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/simplifiedchinese"
)

func main() {
	// GBK-encoded Chinese HTML (the meta tag declares charset=gbk)
	gbkHTML := `<html><head><meta charset="gbk">` +
		`<title>中文网页</title></head>` +
		`<body><article><h1>你好世界</h1>` +
		`<p>这是一段中文内容。</p></article></body></html>`

	// Encode the UTF-8 string to GBK bytes (simulating a real GBK page)
	gbkBytes, err := simplifiedchinese.GBK.NewEncoder().Bytes([]byte(gbkHTML))
	if err != nil {
		log.Fatal(err)
	}

	// Auto-detection: GBK from the meta charset, converted to UTF-8 before extraction
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

## Specifying the Encoding

When the meta tag is missing, the declaration is wrong, or the source encoding is known, set `Config.Encoding`:

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"

result, err := html.Extract(gbkBytes, cfg)
```

| Use case | Notes |
|----------|-------|
| Known source encoding | Take it from the HTTP `Content-Type` header and specify it |
| Legacy pages with no meta tag | GBK/Shift_JIS pages without `<meta charset>` fall back to windows-1252 and turn into mojibake |
| Declaration disagrees with the data | `Config.Encoding` wins over the meta declaration |

:::tip Config.Encoding skips all detection
With `Config.Encoding` set, the library reads no BOM, no meta declaration, and runs no statistical scoring — it decodes with the given charset. That is what makes it deterministic; conversely, a wrong value produces mojibake or an error immediately.
:::

### Undeclared pages decode to mojibake

:::warning A missing meta tag returns no error
For a GBK or Shift_JIS page without `<meta charset>`, basic detection falls back to windows-1252. Measured on such pages, the output is mojibake with `err == nil` — there is no error signal at all. Whether statistical scoring rescues the page depends on how recognizable its content is, so it is not a safety net. In production, set `Config.Encoding` explicitly or take the encoding from the HTTP response header.
:::

### Shift_JIS pages need the meta declaration

A Shift_JIS-encoded Japanese page is recognized by basic detection once it declares `<meta charset="shift_jis">`:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/japanese"
)

func main() {
	// Shift_JIS-encoded Japanese HTML (the meta tag declares charset=shift_jis)
	sjisHTML := `<html><head><meta charset="shift_jis">` +
		`<title>日本語ページ</title></head>` +
		`<body><article><h1>こんにちは</h1>` +
		`<p>東京の天気は晴れです。</p></article></body></html>`

	// Encode to Shift_JIS bytes
	sjisBytes, err := japanese.ShiftJIS.NewEncoder().Bytes([]byte(sjisHTML))
	if err != nil {
		log.Fatal(err)
	}

	// Basic detection reads the meta declaration, converts to UTF-8, then extracts
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

Remove the meta declaration from the same bytes and the title becomes mojibake (shaped like `“ъ–{ЊкѓyЃ[ѓW`) while `err` stays `nil`. If the source cannot be changed, specify the encoding instead:

```go
cfg := html.DefaultConfig()
cfg.Encoding = "shift_jis"

result, err := html.Extract(sjisBytes, cfg)
```

### Windows-1252

Western European encodings (characters such as `é` and `€`) can be specified directly:

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

	// Specify the Windows-1252 encoding explicitly
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

## Encoding Detection Failures

`encoding detection failed` appears only when you **force a wrong encoding**. There are two cases:

| Case | Error message |
|------|---------------|
| `"utf-8"` forced on data that is not valid UTF-8 | `encoding detection failed: declared charset "utf-8" but data is not valid UTF-8` |
| An unsupported encoding name on data that is not valid UTF-8 | `encoding detection failed: unsupported encoding "..."` |

```go
// The data is actually GBK, but is forced to decode as UTF-8
cfg := html.DefaultConfig()
cfg.Encoding = "utf-8"

_, err := html.Extract(gbkBytes, cfg)
if err != nil {
    log.Println(err)
    // encoding detection failed: declared charset "utf-8" but data is not valid UTF-8
}
```

:::warning Match on the message prefix; there is no sentinel
This error has no sentinel value, so `errors.Is` cannot match it — check for the `"encoding detection failed"` prefix instead. Undeclared data never produces it: the library decodes as windows-1252 and returns mojibake. A "retry on detection failure" fallback therefore cannot catch mojibake pages; determine the encoding from the source.
:::

## Audit Logging

With auditing enabled, a failed conversion is recorded as `AuditEventEncodingIssue` (info level):

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
	cfg.Encoding = "utf-8" // Force UTF-8 so GBK bytes fail to convert
	// LogEncodingIssues defaults to true (enabled by DefaultAuditConfig)

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// GBK bytes for "你好"; decoding as UTF-8 fails and is logged
	gbkBytes := []byte{0xC4, 0xE3, 0xBA, 0xC3}
	if _, err := p.Extract(gbkBytes); err != nil {
		fmt.Println("extract failed:", err)
		// extract failed: encoding detection failed: declared charset "utf-8" but data is not valid UTF-8
	}

	for _, entry := range p.GetAuditLog() {
		if entry.EventType == html.AuditEventEncodingIssue {
			fmt.Printf("[encoding issue] %s\n", entry.Message)
			// [encoding issue] declared charset "utf-8" but data is not valid UTF-8
		}
	}
}
```

:::tip When the event is recorded
`AuditEventEncodingIssue` is recorded only when conversion fails, which means a wrong forced encoding. Normal documents never produce it. The event is `info` level (the lowest): it says the decode may be unreliable, not that security is affected. To filter it out, use `NewLevelFilteredSink` with a minimum level of `warning`.
:::

## Next Steps

- [Content Extraction](./content-extraction) - Extraction pipeline and article detection
- [Error Handling](../performance/error-handling) - Sentinel errors and structured error handling
- [API Reference: Config](../../api-reference/core/config) - The Encoding field and all configuration options

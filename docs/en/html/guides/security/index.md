---
sidebar_label: "Security Overview"
title: "Security Overview - CyberGo html | Defense in Depth"
description: "CyberGo html security overview: input layer limits, sanitization, context cancellation, panic recovery, audit events, and the HighSecurityConfig preset."
sidebar_position: 10
---

# Security Overview

CyberGo html is a Go library for HTML content extraction and sanitization that processes untrusted input from the internet, so security is the first design constraint. The library ships multiple independent layers of protection following **defense in depth**: each layer stands on its own, and one layer failing does not disable the protection as a whole.

This page explains what each layer does and where its failure boundary lies; to configure an audit pipeline or review the launch checklist, see [Next Steps](#next-steps) at the end.

## Defense in Depth Architecture

The three layers are split by failure mode, not by code location: the input layer rejects before parsing, the processing layer sanitizes after parsing and honors cancellation and panics, and the audit layer only records and isolates.

```text
Input Layer Protection (reject before processing)
├── MaxInputSize        Byte-level size limit (default 50MB)
├── MaxDepth            DOM nesting depth limit (default 500, prevents stack overflow)
├── ProcessingTimeout   Single-document processing timeout (default 30s)
├── Path traversal detection  .. components in file paths
└── AllowedBaseDir      File read sandbox (OS handle resolution, prevents symlink/junction)

Processing Layer Protection (sanitization and cancellation)
├── HTML sanitization        Multi-dimensional filtering of tags / attributes / URLs / CSS
├── Cooperative context cancellation  ExtractWithContext responds to ctx.Done()
├── Panic recovery           recoverPanic generic wrapper, returns ErrInternalPanic
└── Goroutine leak protection  maxTimeoutGoroutines (concurrency limit 1000)

Audit Layer Protection (observability + isolation)
├── AuditSink panic isolation SEC-003 (audit subsystem is best-effort)
├── 8 audit event types      blocked_tag/blocked_attr/blocked_url/...
└── Raw value HTML escaping   Prevents audit logs from triggering XSS in SIEM dashboards
```

:::tip No coupling assumptions between layers
If the sanitizer misses a malicious URL, the input layer's `MaxInputSize` still blocks an oversized payload; if an `AuditSink` panics, `recoverPanic` still keeps the main flow from crashing.
:::

## Input Boundary Protection

### Input Size Limit

The default ceiling is 50MB (`DefaultMaxInputSize`), which blocks memory-exhaustion input. The configured value is additionally bounded by `maxConfigInputSize` (also 50MB), so it cannot be raised to a less safe value:

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = 10 * 1024 * 1024 // Tighten to 10MB
```

File reads get one more **pre-check**: after `os.Stat` reports the size, an oversized file is rejected before `io.ReadAll` pulls it into memory, so the process never loads a whole file only to discover it is over the limit.

### DOM Depth Limit

The default ceiling is 500 (`DefaultMaxDepth`); the configuration ceiling is also 500 (`maxConfigDepth`). Validation walks the tree **iteratively**, so deeply nested input cannot exhaust the call stack:

```go
cfg.MaxDepth = 200 // Stricter
```

:::warning Depth violations come from two sources
The `golang.org/x/net/html` parser itself fails at roughly 512 unclosed elements, returning `ErrInvalidHTML` (measured: 520 levels → `html: invalid HTML: open stack of elements exceeds 512 nodes`). Only after parsing succeeds does the library apply `MaxDepth` and return `ErrMaxDepthExceeded`. The default of 500 sits close to the parser threshold, so check both sentinel errors when diagnosing a depth problem.
:::

### Processing Timeout

A configurable per-document timeout bounds documents whose cost grows with input structure:

```go
cfg.ProcessingTimeout = 10 * time.Second
```

The timeout runs on a dedicated goroutine plus a context deadline and is capped by the process-wide counter `activeTimeoutGoroutines` (limit 1000), which prevents unbounded goroutine buildup under high concurrency. When an `ExtractWithContext` call also carries a caller context, the earlier deadline wins, but the **error type depends on which source fired** — there is no normalization:

| Source | Returned error |
|--------|----------------|
| The library's `ProcessingTimeout` fires (caller ctx still live) | `ErrProcessingTimeout` |
| The caller's ctx deadline fires first | `context.DeadlineExceeded` (passed through unchanged) |
| The caller calls `cancel()` | `context.Canceled` |
| `ProcessingTimeout = 0` (no limit) and ctx expires | `context.DeadlineExceeded` (no timeout goroutine is started) |

## Content Sanitization

Sanitization is controlled by `EnableSanitization` (default `true`). It edits the parsed DOM in place to remove potentially malicious content, and every interception is written to the audit log (auditing must be enabled).

:::warning Only disable sanitization for fully trusted input
Consider `EnableSanitization = false` only when the input is **fully trusted** internal data. Keep it on for user uploads, web scraping, and third-party API responses.
:::

### Removed Tags

The following tags are removed together with their entire subtree:

| Tag | Reason for removal |
|-----|-------------------|
| `<script>`, `<style>`, `<noscript>` | Script and style containers; can execute code or hide payloads |
| `<iframe>`, `<embed>`, `<object>` | External content embedding; a common XSS and phishing vector |
| `<input>`, `<button>` | Form controls; usable for CSRF or UI spoofing |
| `<svg>` | Can embed JavaScript and event handlers |
| `<math>` | MathML; abused to execute scripts in some browsers |

:::tip Why `<form>` is deliberately kept
Server-side frameworks (ASP.NET WebForms, JSF, JSP) wrap the entire `<body>` in a single `<form>`, so removing `<form>` would discard all visible page content. Text extraction neither renders nor submits forms, so the CSRF/UI-spoofing rationale that applies to `<input>`/`<button>` does not apply to the `<form>` container itself.
:::

### Removed Attributes

| Attribute category | Detection method | Examples |
|-------------------|------------------|----------|
| Event handlers | Prefix match `on*` | `onclick`, `onerror`, `onmouseover` |
| Form action override | Exact match | `formaction` (can hijack the form submission target) |
| Autofocus | Exact match | `autofocus` (can be used to induce clicks) |

Event handlers are matched by prefix (attribute names starting with `on`), which covers every current and future `on*` variant instead of relying on a fixed blocklist.

### Dangerous CSS Patterns

When a `style` attribute value contains any of the following substrings, the **entire style is stripped** (the current strategy discards the whole value once any pattern matches; safe properties are not kept):

- `expression(` — legacy IE dynamic expressions
- `behavior:` — IE behavior binding
- `-moz-binding:` — legacy Firefox XBL binding
- `javascript:` — protocol injection
- `vbscript:` — protocol injection

### Inspected URI Attributes

The values of these attributes enter the [URL Security Protection](#url-security-protection-in-depth) pipeline for scheme and data URL validation:

```text
href  src  cite  action  data  poster  background
longdesc  usemap  profile  xlink:href
```

:::tip Attributes already blocked are not validated again
`formaction` is already blocked outright under "Removed Attributes", so it never enters the URI validation pipeline.
:::

## URL Security Protection in Depth

URI attribute values pass through a fixed pipeline in `isSafeURIWithAudit`. The pipeline exists for one reason: browsers parse URLs far more leniently than `strings.HasPrefix`, and each step below mirrors a normalization a browser performs but a naive string comparison does not.

```text
Raw URI
  │
  ├─ 1. NFC normalization
  ├─ 2. TrimSpace
  ├─ 3. Strip C0 controls and spaces
  ├─ 4. Strip tab/LF/CR
  ├─ 5. ToLower
  ├─ 6. Length limit (non-data URLs ≤ 2000)
  ├─ 7. Dangerous scheme detection
  ├─ 8. Protocol-relative URL detection
  └─ 9. data URL whitelist
```

1. **NFC normalization**: folds fullwidth and composing characters so variants such as `ｊａｖａｓｃｒｉｐｔ：` cannot disguise a scheme.
2. **Leading/trailing whitespace**: removes Unicode whitespace so a leading space cannot defeat the prefix comparison.
3. **C0 controls and spaces**: browsers strip U+0000–U+001F before scheme resolution; without the same step, `\x01javascript:` slips past detection.
4. **tab / LF / CR**: browsers reassemble `java\tscript:` into `javascript:` before executing it.
5. **Case normalization**: schemes are case-insensitive, so `JavaScript:` equals `javascript:`.
6. **Length limit**: non-data URLs longer than 2000 characters are rejected; data URLs have a separate 100KB ceiling.
7. **Dangerous scheme detection**: `javascript:`, `vbscript:`, `file:`, plus a second ASCII fold for fullwidth Latin characters (U+FF01–U+FF5E).
8. **Protocol-relative forms**: `//javascript:` drops the `//` and leading whitespace, then runs the same scheme policy.
9. **data URL whitelist**: only explicit image, font, and PDF MIME types pass.

The order is what makes this work: every strip and normalization happens before scheme detection, so detection sees what the browser will eventually see. Plain printable-ASCII URIs take a fast path of direct scheme prefix checks; only URIs containing whitespace, control characters, or non-ASCII bytes run the full pipeline — the only place disguise techniques can appear.

### data URL Whitelist

Only three MIME categories are allowed for data URLs:

| Category | Allowed MIME types |
|----------|--------------------|
| Images | `image/gif`, `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/bmp`, `image/x-icon`, `image/vnd.microsoft.icon`, `image/avif`, `image/apng` |
| Fonts | `font/woff`, `font/woff2`, `font/ttf`, `font/otf`, `application/font-woff`, `application/font-woff2` |
| Documents | `application/pdf` |

Everything else is rejected:

- **`image/svg+xml`**: SVG can embed JavaScript; this is a patch on top of removing the `<svg>` tag.
- **Empty media type**: forms such as `data:;base64,<payload>` or `data:;,...` that declare no MIME type.
- **Oversized data URLs**: bounded by an internal 100KB ceiling so a large base64 blob cannot exhaust memory; the ceiling is not configurable.
- **Invalid base64 characters**: the base64 portion is validated byte by byte against the character set.

:::tip Audit logs truncate data URLs to 256 characters
A data URL may carry a large base64 payload; writing it in full wastes space and can leak embedded content, so `truncateAuditURL` cuts it before recording.
:::

### Paths That Bypass the Sanitizer

`ExtractAllLinks` and the raw-HTML video/audio scan read **unsanitized** text, so both are guarded by `containsDangerousScheme`: it reuses the sanitizer's normalization pipeline (NFC, trim, C0 stripping, tab/LF/CR stripping, fullwidth folding), so both paths enforce one scheme policy. A payload such as `javascript:alert(1).mp4`, disguised as a media URL, is blocked there.

## AllowedBaseDir Sandbox

When `ExtractFromFile` receives a file path from an untrusted source, `AllowedBaseDir` restricts reads to a designated directory. The mechanism lives in `readContained` / `realPath` / `pathWithin` in `processor.go`.

### Why OS File Handle Resolution Is Needed

`filepath.EvalSymlinks` **cannot** resolve Windows directory junctions and reparse points — both are creatable without privileges and are the main way to bypass path restrictions on Windows. The library instead:

1. Opens the target with `os.Open()`, obtaining an OS file handle
2. Resolves the real on-disk path from the **already-open handle** via `realPath(f)`
3. Checks containment with `pathWithin(realBase, realTarget)`
4. Reads the content with `io.ReadAll` from the **same verified handle**

Validation and reading share one handle, which closes the TOCTOU (check-time-to-use-time) window: swapping the path for a symlink after validation cannot affect the result, because the read uses the inode that was validated.

### Cross-Platform Real Path Resolution

| Platform | Resolution method | Redirect types covered |
|----------|------------------|------------------------|
| Linux | Read the link at `/proc/self/fd/<fd>` | Symlinks (race-free) |
| macOS / BSD | Read the link at `/dev/fd/<fd>` | Symlinks (race-free) |
| Other Unix | Fall back to `filepath.EvalSymlinks` | Symlinks (minor residual TOCTOU) |
| Windows | `GetFinalPathNameByHandleW` | Symlinks + junctions + all reparse points |

On Windows the returned path has the `\\?\` extended-length prefix stripped and is passed through `filepath.Clean` so it matches the form produced by `filepath.Abs`, which keeps the containment comparison exact.

### Protection Layers

File reads in `AllowedBaseDir` mode stack four independent checks:

1. **Path traversal detection**: look for `..` components after `filepath.Clean`
2. **OS handle sandbox**: `realPath` resolves the real path, `pathWithin` decides containment
3. **Size pre-check**: `os.Stat` on the verified handle rejects files over `MaxInputSize` before `io.ReadAll`
4. **Byte-level ceiling**: `validateInput` re-checks the byte count after reading

`AllowedBaseDir` constrains *which file* can be read; `MaxInputSize` constrains *how large* it can be. The two are orthogonal and do not replace each other.

:::warning An empty AllowedBaseDir disables the sandbox
`AllowedBaseDir` defaults to the empty string, meaning **no directory restriction** (only the `..` component check remains). Set it explicitly whenever the file path comes from user input.
:::

### Configuration Example

```go
cfg := html.DefaultConfig()
// Only allow reading files under /var/app/uploads and its subdirectories
cfg.AllowedBaseDir = "/var/app/uploads"

p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()

// OK: file is within the allowed directory
_, err = p.ExtractFromFile("/var/app/uploads/page.html")

// Rejected: points outside via symlink/junction
_, err = p.ExtractFromFile("/var/app/uploads/escape.txt") // if it is a junction → /etc
```

An out-of-bounds access records an `AuditEventPathTraversal` audit event and returns a `*FileError` wrapping "path outside allowed directory"; the error **does not include** the resolved real path, so the filesystem layout is not leaked.

## Panic Recovery and Isolation

Every public extraction method is wrapped by the generic `recoverPanic[T]`, which catches panics and converts them into `ErrInternalPanic`, so malicious input cannot crash the caller's process.

```go
func recoverPanic[T any](fn func() (T, error)) (result T, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("%w: %v", ErrInternalPanic, r)
		}
	}()
	return fn()
}
```

### Isolation Boundaries

| Boundary | Behavior | Location |
|----------|----------|----------|
| Single extraction | panic → `ErrInternalPanic` | `extract.go` `recoverPanic` |
| One batch item | Each item recovers independently; one panic does not affect the others | `batch.go` |
| Timeout goroutine | The worker goroutine in `withTimeout` recovers independently | `extract.go` |
| AuditSink write | The sink's own panic is swallowed (SEC-003) | `audit.go` `Record` |
| AuditSink close | `sink.Close` panic becomes `ErrInternalPanic`, returned as an error | `audit.go` `Close` |
| Pooled Processor creation | `sync.Pool.New` panic → `ErrInternalPanic` | `processor_pool.go` |

### SEC-003: The Audit Subsystem Is Best-Effort

The audit subsystem **must never** propagate a panic to public API callers. A caller-supplied `AuditSink` (hand-written, or wrapped in filters or fan-out) may panic on any path inside `Write()`. `Record` swallows such panics with `defer recover()` and discards the recovered value — the audit path has no safe reporting channel of its own; `Close`, which returns an error, wraps the value in `ErrInternalPanic`.

A custom `Sink` that panics therefore never reaches the caller through `Close()` or an extraction call.

### Goroutine Leak Protection

Each `withTimeout` call starts a worker goroutine that waits for the deadline. To keep goroutines from piling up without bound, the process-wide counter `activeTimeoutGoroutines` limits how many can be waiting at once to `maxTimeoutGoroutines` (1000); past the limit, new requests return `ErrTooManyConcurrentOps` immediately.

The cap bounds concurrency, not a fixed amount of memory — Go grows goroutine stacks on demand from a few KB.

### Audit Raw Value Log Injection Protection

With `AuditConfig.IncludeRawValues = true`, audit entries carry the raw values of blocked attributes and URLs. Those values go through HTML escaping (`&` `<` `>` `"` `'`) in `sanitizeRawValue`, so rendering the audit log in a browser or SIEM dashboard cannot trigger stored XSS.

## Audit System

The audit system records security events: 8 event types (blocked tag, blocked attribute, blocked URL, input violation, depth violation, timeout, encoding issue, path traversal), 3 levels (`info` / `warning` / `critical`), and 7 built-in Sink constructors. See [Audit Pipeline](./audit-pipeline) for the event-to-level mapping and Sink composition, and the [Audit System reference](../../api-reference/modules/audit) for full signatures.

## Security Configuration Decision Table

| Scenario | Recommended config | Notes |
|----------|-------------------|-------|
| Fully trusted internal data | `DefaultConfig()` + optional `EnableSanitization = false` | Performance first; disable sanitization only when no external input is confirmed |
| User-uploaded HTML | `HighSecurityConfig()` | Full protection: tightened limits + complete auditing |
| Processing external web pages | `DefaultConfig()` | Default sanitization already covers common threats |
| Processing user-supplied file paths | Set `AllowedBaseDir` | Enable the OS handle sandbox against symlink/junction escapes |
| High-throughput crawler | Lower `MaxInputSize` + tighten `ProcessingTimeout` | Keep malicious pages from stalling workers |

## High-Security Configuration

`HighSecurityConfig()` is a preset that tightens every limit and enables full auditing in one step:

```go
cfg := html.HighSecurityConfig()
// Changes relative to DefaultConfig():
//   MaxInputSize      = 10MB (default 50MB)
//   MaxDepth          = 100 (default 500)
//   ProcessingTimeout = 10s (default 30s)
//   WorkerPoolSize    = 2 (default 4)
//   MaxCacheEntries   = 500 (default 2000)
//   CacheTTL          = 30m (default 1h)
//   CacheCleanup      = 1m (default 5m)
//   Audit             = HighSecurityAuditConfig() (enabled + includes raw values)
```

## Error Handling

Security violations return sentinel errors, matched by category with `errors.Is`. Depth problems have two sources; the example below triggers each one:

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

func classify(err error) {
	switch {
	case err == nil:
		return
	case errors.Is(err, html.ErrInputTooLarge):
		fmt.Println("input too large")
	case errors.Is(err, html.ErrMaxDepthExceeded):
		fmt.Println("depth violation")
	case errors.Is(err, html.ErrInvalidHTML):
		fmt.Println("parse failure")
	case errors.Is(err, html.ErrInternalPanic):
		fmt.Println("internal panic recovered")
	}
}

func main() {
	// 600 unclosed <div> levels: the parser itself fails at 512 unclosed elements
	deep := []byte("<html><body>" + strings.Repeat("<div>", 600) + "</body></html>")
	_, err := html.Extract(deep)
	classify(err)
	// Output: parse failure

	// 300 levels stay below the parser threshold; the library's iterative depth
	// check rejects them against MaxDepth
	cfg := html.DefaultConfig()
	cfg.MaxDepth = 200

	data := []byte("<html><body>" +
		strings.Repeat("<div>", 300) + "deep" + strings.Repeat("</div>", 300) +
		"</body></html>")

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	_, err = p.Extract(data)
	classify(err)
	// Output: depth violation
}
```

:::tip Use SafePath for file errors
For a `*FileError`, call `SafePath()` to get the redacted path string instead of printing the raw error — that keeps the resolved real path out of your logs.
:::

## Next Steps

- [Audit Pipeline](./audit-pipeline) — 8 event types, built-in Sink comparison, tiered routing pipeline
- [Production Checklist](./production-checklist) — security checklist before deployment
- [API Reference: Audit System](../../api-reference/modules/audit) — complete API signatures

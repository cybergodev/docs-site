---
sidebar_label: "Security Overview"
title: "Security Overview - CyberGo html | Protection Overview"
description: "CyberGo html security overview: defense in depth (input/processing/audit), MaxInputSize/MaxDepth, sanitization, AllowedBaseDir sandbox, HighSecurityConfig."
sidebar_position: 10
---

# Security Overview

The HTML library processes untrusted input from the internet, so security is the first priority by design. The library has multiple independent layers of protection built in, following the **Defense in Depth** philosophy: each layer assumes other layers may fail, and a single layer being bypassed does not lead to total compromise.

This page is an overview of security features. If you want to jump straight to configuring the audit pipeline or reviewing the production checklist, go to [Next Steps](#next-steps) at the bottom.

## Defense in Depth Architecture

The library's security protections are distributed across three independent layers, each with its own failure modes and recovery strategies:

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
└── Goroutine leak protection  maxTimeoutGoroutines (limit 1000)

Audit Layer Protection (observability + isolation)
├── AuditSink panic isolation SEC-003 (audit subsystem is best-effort)
├── 8 audit event types      blocked_tag/blocked_attr/blocked_url/...
└── Raw value HTML escaping   Prevents audit logs from triggering XSS in SIEM dashboards
```

:::tip Why "independent" matters
The value of defense in depth lies in the assumption of no coupling between layers. For example, even if the sanitization layer misses a malicious URL (processing layer failure), the input layer's `MaxInputSize` still blocks oversized payloads; even if an AuditSink itself panics (audit layer failure), `recoverPanic` still ensures the main flow does not crash.
:::

## Input Boundary Protection

### Input Size Limit

Default maximum input is 50MB (`DefaultMaxInputSize`), preventing memory exhaustion attacks. The configuration upper bound is also constrained by `maxConfigInputSize` (also 50MB), meaning it cannot be raised to unsafe values through configuration:

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = 10 * 1024 * 1024 // Tighten to 10MB
```

File paths have an additional **pre-check**: after `os.Stat` retrieves the size, oversized files are rejected before `io.ReadAll` loads the content into memory, closing the memory peak window of "finish reading before discovering it's oversized."

### DOM Depth Limit

Default maximum depth is 500 (`DefaultMaxDepth`), preventing stack overflow bombs from recursively nested constructs:

```go
cfg.MaxDepth = 200 // Stricter
```

Depth validation uses **iterative** traversal rather than recursion, so it does not overflow its own stack from deeply nested input.

### Processing Timeout

Configurable processing timeout prevents malicious HTML from triggering exponential processing time:

```go
cfg.ProcessingTimeout = 10 * time.Second
```

The timeout mechanism is implemented via an independent goroutine + context deadline, protected by the `maxTimeoutGoroutines` (1000) limit to prevent goroutine runaway under high concurrency. Combined with `ExtractWithContext`, the caller's cancellation signal can be layered on top.

## Content Sanitization in Detail

Sanitization is controlled by `EnableSanitization` (default `true`). It modifies the parsed DOM tree in place to remove potentially malicious content. The entire flow is implemented in `internal/sanitize.go`, and every interception is written to the audit log.

:::warning When to turn off sanitization
Only consider `EnableSanitization = false` when the input is **fully trusted** internal data. It should always remain enabled when processing any HTML from user uploads, web scraping, or third-party APIs.
:::

### Removed Tags

The following tags are removed along with their entire subtrees:

| Tag | Reason for removal |
|-----|-------------------|
| `<script>`, `<style>`, `<noscript>` | Script and style containers, can execute code or hide payloads |
| `<iframe>`, `<embed>`, `<object>` | External content embedding, classic XSS and phishing vectors |
| `<input>`, `<button>` | Form controls, can be used for CSRF or UI spoofing |
| `<svg>` | Can embed JavaScript and event handlers |
| `<math>` | MathML, can be abused to execute scripts in some browsers |

:::tip Why `<form>` is not removed
The `<form>` tag is **intentionally preserved**. Server-side frameworks like ASP.NET WebForms, JSF, and JSP wrap the entire `<body>` inside a single `<form>`. Removing `<form>` would discard all visible page content. Text extraction scenarios neither render nor submit forms, so the CSRF/UI spoofing rationale that applies to `<input>`/`<button>` does not apply to the `<form>` container itself.
:::

### Removed Attributes

| Attribute category | Detection method | Examples |
|-------------------|------------------|----------|
| Event handlers | Prefix match `on*` | `onclick`, `onerror`, `onmouseover` |
| Form action override | Exact match | `formaction` (can hijack form submission target) |
| Autofocus | Exact match | `autofocus` (can be used for phishing click induction) |

Event handler detection uses prefix matching (attribute names starting with `on`), so it covers all current and future `on*` variants rather than relying on a fixed blocklist.

### CSS Dangerous Patterns

The value of `style` attributes is checked for the following dangerous substrings. If any is found, the **entire style is stripped** (retaining safe CSS properties for metadata extraction requires separate evaluation; the current strategy is to discard entirely once any danger is detected):

- `expression(` — legacy IE dynamic expressions
- `behavior:` — IE behavior binding
- `-moz-binding:` — legacy Firefox XBL binding
- `javascript:` — protocol injection
- `vbscript:` — protocol injection

### Inspected URI Attributes

The values of the following attributes enter the [URL Security Protection](#url-security-protection-in-depth) pipeline for protocol and data URL validation:

```text
href  src  cite  action  data  poster  background
longdesc  usemap  profile  xlink:href
```

:::tip Already-blocked attributes are not re-validated
`formaction` is already blocked entirely in "Removed Attributes" and does not enter the URI validation pipeline — avoiding redundant checks on the same attribute.
:::

## URL Security Protection in Depth

URI attribute values are validated through a multi-layer pipeline in `isSafeURIWithAudit`. Each layer addresses a known browser parsing behavior or attack bypass technique — none can be omitted.

### Multi-Layer Validation Pipeline

```text
Raw URI
  │
  ├─ 1. NFC normalization       Normalize fullwidth/composing characters
  ├─ 2. TrimSpace               Remove leading/trailing whitespace
  ├─ 3. Strip C0 controls+space  Remove leading/trailing U+0000–U+001F and spaces
  ├─ 4. Strip tab/LF/CR         Remove \t \n \r within the URL
  ├─ 5. ToLower                 Normalize case
  ├─ 6. Length limit            Non-data URLs constrained by MaxURLLength(2000)
  ├─ 7. Dangerous scheme detection  javascript: / vbscript: / file: + fullwidth variants
  ├─ 8. Protocol-relative URL detection  //javascript: etc.
  └─ 9. data URL whitelist      Images/fonts/PDF only, block svg and empty MIME
```

### Unicode Normalization (NFC)

The first step applies NFC normalization to the URI (`normalizeURIForSecurity`), preventing the use of Unicode variants to disguise dangerous protocols:

- Fullwidth characters `ｊａｖａｓｃｒｉｐｔ：` are mapped back to ASCII
- Composing characters and cross-script similar characters are normalized to a single representation

On top of this, `isDangerousScheme` also performs a dedicated ASCII folding for fullwidth Latin characters (U+FF01–U+FF5E) via `normalizeFullwidthToASCII` — double insurance. Even if certain browsers/parsers treat fullwidth forms as ASCII, the library can still identify them.

### Whitespace and Control Character Stripping

Browsers strip certain control characters when parsing URLs (following the WHATWG URL standard). The library must simulate the same stripping **before** protocol detection; otherwise attackers can use these characters to break up dangerous protocol names and bypass detection:

- **tab / LF / CR**: `java\tscript:` would be reassembled by browsers into `javascript:` and executed. The library uses `stripURLWhitespace` to remove these three bytes before protocol detection.
- **C0 control characters (U+0000–U+001F) + ASCII space**: browsers strip these from the beginning and end of the string before scheme parsing. `strings.TrimSpace` only covers Unicode whitespace, not most C0 control characters, so the library uses a dedicated `c0ControlOrSpace` set to explicitly strip them. Otherwise `\x01javascript:…` could fool all `strings.HasPrefix` checks.

### Dangerous Protocol Detection

| Protocol | Blocking method |
|----------|----------------|
| `javascript:` | Direct match + fullwidth character normalization |
| `vbscript:` | Same as above |
| `file:` | Same as above (local filesystem access) |
| `//javascript:`, `//vbscript:`, `//data:`, `//file:` | Protocol-relative forms detected separately |

Detection of protocol-relative forms (starting with `//`) first strips leading whitespace after `//`, then applies the same dangerous protocol determination, ensuring that variants like `// javascript:` cannot bypass detection.

### data URL Whitelist

data URLs only allow the following explicitly declared MIME types:

| Category | Allowed MIME types |
|----------|-------------------|
| Images | `image/gif`, `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/bmp`, `image/x-icon`, `image/vnd.microsoft.icon`, `image/avif`, `image/apng` |
| Fonts | `font/woff`, `font/woff2`, `font/ttf`, `font/otf`, `application/font-woff`, `application/font-woff2` |
| Documents | `application/pdf` |

Explicitly blocked:

- **`image/svg+xml`**: SVG can embed JavaScript, serving as a defense-in-depth patch after the tag itself is removed.
- **Empty media types**: e.g., `data:;base64,<payload>` or `data:;,...`. These forms could previously bypass the whitelist; they are now rejected outright.
- **Overly long data URLs**: constrained by an internal limit (100KB), preventing large base64 payloads from exhausting memory (this limit is not configurable).
- **Illegal base64 characters**: the base64 portion is validated byte-by-byte for character set legality.

:::tip Audit log truncates data URLs
data URLs may contain large base64 segments. Writing them in full to audit logs wastes space and may leak embedded sensitive content. Audit records truncate data URLs to 256 characters via `truncateAuditURL`.
:::

### Paths That Bypass the Sanitizer

A few code paths (such as `ExtractAllLinks`, and video/audio scanning in raw HTML) read **unsanitized** HTML. These paths are guarded by `containsDangerousScheme` — it reuses the exact same normalization pipeline as the sanitizer (NFC, trim, C0 stripping, tab/LF/CR stripping, fullwidth folding), ensuring that both paths enforce the **same protocol policy**. There is no inconsistency where the sanitizer blocks something but this path allows it.

For example, a payload like `javascript:alert(1).mp4` disguised as a media URL could previously pass simple validation because the first character `j` is a letter. It is now caught by `containsDangerousScheme`.

## AllowedBaseDir Sandbox Mechanism

When processing file paths from untrusted sources via `ExtractFromFile`, `AllowedBaseDir` limits the readable range to a specified directory. This mechanism is implemented by `readContained` / `realPath` / `pathWithin` in `processor.go`.

### Why OS File Handle Resolution Is Needed

Plain `filepath.EvalSymlinks` **cannot** resolve Windows directory junctions and reparse points — both of which can be created without any privileges and are the primary means of bypassing path restrictions on Windows. The library's approach:

1. `os.Open()` opens the target file, obtaining an OS file handle
2. `realPath(f)` resolves the real on-disk path from the **already-open handle**
3. `pathWithin(realBase, realTarget)` determines whether the real path falls within the allowed directory
4. Reads content via `io.ReadAll` from the **same verified handle**

Performing both validation and reading from the same handle closes the TOCTOU (check-time-to-use-time) race window — a path substitution via symlink after validation but before reading cannot affect the result, because the read uses the same inode that was validated.

### Cross-Platform Real Path Resolution

| Platform | Resolution method | Covered redirect types |
|----------|------------------|----------------------|
| Linux | Read the link at `/proc/self/fd/<fd>` | Symlinks (race-free) |
| macOS / BSD | Read the link at `/dev/fd/<fd>` | Symlinks (race-free) |
| Other Unix | Fallback to `filepath.EvalSymlinks` | Symlinks (slight residual TOCTOU) |
| Windows | `GetFinalPathNameByHandleW` | Symlinks + junctions + all reparse points |

After resolution on Windows, the `\\?\` extended-length prefix is stripped and the path is passed through `filepath.Clean` to match the output format of `filepath.Abs`, ensuring accurate subsequent containment comparison.

### Protection Layers

File reading in `AllowedBaseDir` mode stacks four independent checks:

1. **Path traversal detection**: checks for `..` components after `filepath.Clean`
2. **OS handle sandbox**: `realPath` resolves the real path, `pathWithin` determines containment
3. **Size pre-check**: `os.Stat` on the verified handle checks the size; rejects files exceeding `MaxInputSize` before `io.ReadAll`
4. **Byte-level limit**: after reading, `validateInput` re-checks the byte count

Even if a file is within the allowed directory, `AllowedBaseDir` constrains "which file can be read," and `MaxInputSize` constrains "how large the file can be." The two are orthogonal and do not substitute for each other.

:::warning Empty AllowedBaseDir = sandbox not enabled
`AllowedBaseDir` defaults to an empty string, meaning **no directory restriction** (only the `..` traversal check remains). As long as your file paths come from user input, you should explicitly set this.
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
result, err := p.ExtractFromFile("/var/app/uploads/page.html")

// Rejected: points outside via symlink/junction
_, err = p.ExtractFromFile("/var/app/uploads/escape.txt") // If it's a junction → /etc
```

Rejected out-of-bounds access logs an `AuditEventPathTraversal` audit event and returns a `*FileError` wrapping "path outside allowed directory." The error **does not include** the resolved real path (to avoid leaking the filesystem layout).

## Panic Recovery and Isolation

All public extraction methods are wrapped by the `recoverPanic[T]` generic function. Panics are caught and converted into `ErrInternalPanic` errors, ensuring that malicious input does not crash the caller's process.

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

### Multi-Layer Isolation Boundaries

| Isolation boundary | Behavior | Location |
|-------------------|----------|----------|
| Single extraction | panic → `ErrInternalPanic` | `extract.go` `recoverPanic` |
| Batch single item | Each item independently recovered; one item's panic does not affect others | `batch.go` |
| Timeout goroutine | The worker goroutine in `withTimeout` is independently recovered | `extract.go` |
| AuditSink write | Sink's own panic is swallowed (SEC-003) | `audit.go` `Record` |
| AuditSink close | `sink.Close` panic is converted to `ErrInternalPanic` and returned via error | `audit.go` `Close` |
| Pooled Processor creation | `sync.Pool.New` panic → `ErrInternalPanic` | `processor_pool.go` |

### SEC-003: Audit Subsystem Is Best-Effort

The audit subsystem **must never** propagate panics to public API callers. User-provided `AuditSink` implementations (which may be hand-written, may wrap filters/multiplexers) may panic on any path in their `Write()`. `Record` uses `defer recover()` to swallow such panics (the recovered value is discarded — the audit path itself has no safe reporting channel); `Close`, because it has an error return value, wraps the recovered value in `ErrInternalPanic` and returns it.

This means that even if your custom Sink has a bug, the idiomatic `defer processor.Close()` will not crash the process.

### Goroutine Leak Protection

Each `withTimeout` call spawns a worker goroutine waiting for the deadline. To prevent goroutine runaway under high concurrency, the global counter `activeTimeoutGoroutines` limits the concurrency to `maxTimeoutGoroutines` (1000). When the limit is exceeded, new requests return `ErrProcessingTimeout` immediately instead of accumulating goroutines indefinitely (estimating ~1MB stack per goroutine, 1000 ≈ 1GB upper bound).

### Audit Raw Value Log Injection Protection

When `AuditConfig.IncludeRawValues = true`, audit entries include the raw values of intercepted attributes/URLs. These values are HTML-escaped (`&` `<` `>` `"` `'`) via `sanitizeRawValue` to prevent stored XSS when audit logs are rendered in browsers or SIEM dashboards.

## Audit System

Security events are recorded through the audit system, supporting 8 event types, multiple built-in sinks, and level filtering. For full configuration, see [Audit System in Practice](./audit-pipeline).

| Event | Description |
|-------|-------------|
| `AuditEventBlockedTag` | Blocked HTML tag |
| `AuditEventBlockedAttr` | Blocked attribute |
| `AuditEventBlockedURL` | Blocked URL |
| `AuditEventInputViolation` | Input size violation |
| `AuditEventDepthViolation` | DOM depth violation |
| `AuditEventPathTraversal` | Path traversal attempt (including AllowedBaseDir out-of-bounds) |
| `AuditEventTimeout` | Processing timeout |
| `AuditEventEncodingIssue` | Encoding anomaly |

## Security Configuration Decision Table

| Scenario | Recommended config | Notes |
|----------|-------------------|-------|
| Fully trusted internal data | `DefaultConfig()` + optional `EnableSanitization = false` | Performance priority; only disable sanitization when confirmed no external input |
| User-uploaded HTML | `HighSecurityConfig()` | Full protection: tightened limits + complete auditing |
| Processing external web pages | `DefaultConfig()` | Default sanitization already covers common threats |
| Processing user-supplied file paths | Set `AllowedBaseDir` | Enable OS handle sandbox to prevent symlink/junction escape |
| High-throughput crawler | Reduce `MaxInputSize` + tighten `ProcessingTimeout` | Prevent malicious pages from stalling workers |

## High-Security Configuration

`HighSecurityConfig()` is a preset that tightens all limits and enables full auditing in one step:

```go
cfg := html.HighSecurityConfig()
// Automatically sets:
//   MaxInputSize      = 10MB (default 50MB)
//   MaxDepth          = 100 (default 500)
//   ProcessingTimeout = 10s (default 30s)
//   WorkerPoolSize    = 2 (default 4)
//   Audit             = HighSecurityAuditConfig() (enabled + includes raw values)
```

## Error Handling

All security violations return clear sentinel errors supporting `errors.Is` for category determination:

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body>Maliciously crafted ultra-deep nesting</body></html>`)
	_, err := html.Extract(data)
	if err != nil {
		switch {
		case errors.Is(err, html.ErrInputTooLarge):
			// Input exceeds limit, log and reject
			fmt.Println("Input too large")
		case errors.Is(err, html.ErrMaxDepthExceeded):
			// Possibly a recursive bomb
			fmt.Println("Depth violation")
		case errors.Is(err, html.ErrInternalPanic):
			// Panic recovered, investigate input and report
			fmt.Println("Internal panic recovered")
		}
	}
	// Output: Depth violation (example, actual result depends on input)
}
```

:::tip Use SafePath for file errors
For `*FileError`, use `SafePath()` to get a sanitized path string instead of printing the raw error — to avoid leaking the resolved real path into logs.
:::

## Next Steps

- [Audit System in Practice](./audit-pipeline) — 8 event types, built-in sink comparison, tiered routing pipeline
- [Production Checklist](./production-checklist) — security checklist before deployment
- [API Reference: Audit System](../../api-reference/modules/audit) — complete API signatures

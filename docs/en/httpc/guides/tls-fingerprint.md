---
sidebar_label: "TLS Fingerprinting"
title: "TLS Fingerprinting - CyberGo HTTPC | JA3/JA4 Spoofing"
description: "HTTPC TLS fingerprinting guide: Chrome/Firefox/Safari presets, JA3/JA4, HTTP/2 frames, per-connection randomization, package-level routing, pinning, SSRF."
sidebar_position: 105
---

# TLS Fingerprinting (Browser Spoofing)

`Security.TLSFingerprint` replaces HTTPC's transport layer with a browser emulation that covers three classes of fingerprint observation at once: the TLS ClientHello (**JA3/JA4**), the HTTP/2 frames (SETTINGS order and values, connection window, initial stream ID, pseudo-header order), and the ordered header block (browser-exact casing plus a version-matched User-Agent).

Everything above the transport keeps its HTTPC semantics: redirects, retries, middleware, streaming downloads, and cookie handling continue to work as usual.

## Quick Start

Client-level — every request on the client shares one preset:

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSFingerprint = "chrome-latest" // or "chrome-windows", "firefox-latest", ...
client, err := httpc.New(cfg)
```

Leave `TLSFingerprint` empty (the default) to keep the standard Go stack with no extra dependencies and no spoofing.

Package-level — route a single call to a fingerprinted client, no Client required:

```go
result, err := httpc.Get("https://example.com",
    httpc.WithTLSFingerprint("chrome-windows"))
```

`WithTLSFingerprint` is a package-level **routing option**: `httpc.Get/Post/Request/Download/...` extract it and hand the call to a dedicated fingerprinted client, leaving the shared default client and any other in-flight calls untouched. Notes:

- Meaningful only on package-level functions — on an explicit client instance it returns an error; use `Config.Security.TLSFingerprint` there instead
- An unknown preset fails the request with `ErrInvalidSecurity`
- Routed clients are cached by **canonical preset name** — preset-name matching is case-insensitive, so `chrome` and its uppercase spelling share one client — and built from `DefaultConfig()`, inheriting every secure default of the default client (SSRF protection, TLS, timeouts, retries)
- `httpc.CloseRoutedClients()` closes and releases every cached routed client

## Preset Names

Presets are browser profiles with optional OS suffixes (case-insensitive):

| Browser | Base / latest / pinned version | OS suffix | Notes |
|---------|--------------------------------|-----------|-------|
| Chrome | `chrome` / `chrome-latest` / `chrome-155` / `chrome-152` | `-windows` / `-macos` / `-linux` / `-android` / `-ios` | `chrome-152` is a retired-major pin |
| Firefox | `firefox` / `firefox-latest` / `firefox-158` / `firefox-148` | `-windows` / `-macos` / `-linux` / `-android` / `-ios` | `firefox-148` is a retired-major pin |
| Safari (iOS) | `safari-ios` (= `ios-safari-latest`) | — | Safari itself on iOS, sharing the same verified WebKit data as the other iOS presets |
| Legacy aliases | `android-chrome-latest` / `ios-chrome-latest` | — | Older compound aliases, still valid |

> **There is no desktop-Safari preset** — macOS Safari's ClientHello differs and no verified data exists for it yet.
>
> iOS presets (`*-ios`, including `safari-ios`) use real WebKit data (Safari 26.3 TLS + HTTP/2, byte-verified live), though the regular-header order is still a desktop approximation; Android presets (`*-android`) currently emit the desktop fingerprint bytes — placeholders pending real device captures.

Preset matching is case-insensitive and tolerates surrounding whitespace (`"  FireFox "` is valid); `safari` (no `-ios` suffix) and any version number outside the list (such as `chrome-153`) are invalid presets, rejected by validation.

## Scope

Fingerprinting makes the *transport layers* — TLS, HTTP/2 framing, ordered header block — indistinguishable from the spoofed browser under passive observation (JA3/JA4, the HTTP/2 fingerprint, header order). It does **not** reproduce browser-side JavaScript or behavioral signals — no pure HTTP client can — so it is not a substitute for a real browser or for an authorized challenge-solving step where a site requires one. Profiles are snapshots of one browser build and age as browsers ship; a weekly CI job (`.github/workflows/fingerprint-drift.yml`) watches for drift.

## Behavior Notes

- **Header set is authoritative**: the preset replaces same-named request headers (User-Agent, Accept, Accept-Language, ...) with the browser profile's values so the wire stays coherent with the spoofed ClientHello; custom headers pass through untouched. An explicitly set User-Agent does **not** override the preset on this path. Names are written with the browser's own casing (`sec-ch-ua*` lower-case, everything else Title-Case), on HTTP/1.1 as well as HTTP/2. `Result.Request.Headers` reports exactly these wire headers (the browser's UA and casing), not the engine-side defaults such as `httpc/1.0`.
- **Protocols — ALPN decides**: a server that speaks HTTP/2 gets HTTP/2, one that only speaks HTTP/1.1 gets HTTP/1.1, and no request is ever replayed — there is no manual fallback between the two. **HTTP/3 is never attempted**: a QUIC connection uses a separate TLS stack that bypasses `CertificatePinner`, and losing the pin silently is worse than not racing protocols. `Connection.EnableHTTP2=false` pins the path to HTTP/1.1 and rewrites the ClientHello's ALPN list to match.
- **Proxies keep working**: proxy pools, rotation, and circuit breaking continue to work (HTTP, HTTPS, SOCKS5/5h). Plain-HTTP targets through an HTTP proxy traverse a CONNECT tunnel; HTTPS proxies speak HTTP/1.1 CONNECT only and their certificate is verified against the system roots and the proxy hostname (`Security.InsecureSkipVerify` opts out, exactly as on the standard transport). The proxy is fixed per connection pool — rotation selects a different pool rather than re-pointing a live one.
- **Redirect coherence**: on every hop the profile's first-hop values are corrected the way a browser does — `sec-fetch-site` is recomputed against the previous hop's URL (`same-origin`/`same-site`/`cross-site`), `sec-fetch-user` is dropped after the first hop, and a 301/302/303 that downgrades a fetch-style request to GET keeps fetch-style headers instead of switching to navigation headers.
- **Certificate pinning works**: `CertificatePinner` runs on every fingerprinted handshake (see [TLS and Certificate Pinning](../security/tls-certpin)). `Security.TLSConfig` remains mutually exclusive with fingerprinting (a custom `tls.Config` cannot shape a spoofed ClientHello).
- **TLS metadata stays readable**: the fingerprint path converts the uTLS connection state to the standard library's `tls.ConnectionState` field by field (cipher suite, negotiated ALPN protocol, the peer certificate chain, whether the handshake resumed via PSK, ...), read exactly as on the standard path — the fingerprinted path is not a TLS-metadata blind spot.
- **Decompression**: the profile advertises `gzip, deflate, br, zstd` and the fingerprint stack decodes all of them (streaming preserved), handing the engine identity bodies — the engine cannot see the original `Content-Encoding`, so the decoded stream is capped by `MaxResponseBodySize` (`MaxDecompressedBodySize` does not apply on this path). Multi-token `Content-Encoding` chains are decoded in reverse order per RFC 9110 (the last-applied encoding is decoded first), and `deflate` accepts both zlib-wrapped and raw deflate streams (distinguished by header sniffing). An unknown `Content-Encoding` fails the request loudly instead of returning compressed bytes.
- **SSRF protection**: direct connections dial through a validating resolver — resolve once, filter to SSRF-allowed IPs, dial the validated IP literal (never the hostname) — the same dial-layer guarantee as the standard transport: no TOCTOU window, no mixed-record pass. A per-request pre-flight (repeated per redirect hop) fails blocked targets before any dial. Through a proxy the target cannot be pinned (the proxy resolves it), so the pre-flight is the enforcement — the same rule and the same trust-the-proxy residual as the standard path's proxied-target validation.

## Session Resumption

The Chrome profiles cache TLS session tickets per connection pool and resume repeat connections with a PSK, exactly like a real browser revisiting a host (verified live in `session_resumption_test.go`). Profiles whose ClientHello carries no `pre_shared_key` extension (Firefox, the iOS WebKit profiles) always full-handshake. Set `Security.TLSFingerprintDisableSessionTickets` to force a full handshake on every connection.

## Per-Connection Randomization

The Chrome profiles build a fresh ClientHello spec on every handshake and apply two **per-connection** mutations:

- **Extension-order shuffle**: the extension list is reshuffled the way Chrome itself does it — real Chrome's extension order varies from connection to connection
- **GREASE re-randomization**: the GREASE value in the `signature_algorithms` list is redrawn from the 16 GREASE code points on every connection

Adjacent connections from the same client therefore do **not** send byte-identical ClientHellos, matching a real browser. The Firefox profiles use the uTLS built-in hello, which is also built fresh on every connection. Each mutation touches only its own handshake's copy, so connections never observe each other's specs.

## Known Limitations

- Fingerprinted connections are not counted in pool metrics and skip `Connection.EnableDoH` (the backend resolves DNS itself).
- The fingerprint path's transport parameters are **fixed and not tunable**: idle-connection timeout 20s, read-idle timeout 10s, HTTP/2 PING timeout 10s, and pool sizes `MaxIdleConns` 512 / `MaxIdleConnsPerHost` 128 / `MaxConnsPerHost` 128 — `Connection.MaxIdleConns` and `Connection.MaxConnsPerHost` apply to the standard transport only. Request-level timeouts are unaffected and remain governed by the engine's deadline budget (the transport itself sets no timeout).
- Android presets (`*-android`) currently emit the desktop fingerprint bytes (placeholders pending real device captures); iOS presets use real WebKit data but the regular-header order is still a desktop approximation.

## Dependencies

The fingerprint data lives in this repository (`internal/fingerprint`): httpc builds the ClientHello spec, the HTTP/2 SETTINGS sequence, and the header tables, and hands them to [`bogdanfinn/tls-client`](https://github.com/bogdanfinn/tls-client) through its profile API — so a profile can target a browser build ahead of any upstream release. The transport itself (uTLS handshake, HTTP/2 framing, header order and casing) comes from that library, and [`andybalholm/brotli`](https://github.com/andybalholm/brotli) + [`klauspost/compress`](https://github.com/klauspost/compress) (zstd) handle decoding. Profile data was originally ported from [`enetx/surf`](https://github.com/enetx/surf) (MIT); httpc does not depend on that client library itself. Chrome 152–156 share one ClientHello (only the UA and brand strings differ per version), so the retired `chrome-152` pin and `chrome-155` have identical TLS fingerprints — the difference lives in the HTTP-layer headers.

## Next Steps

- [Proxy & Proxy Pool](./proxy) - Proxies keep working on the fingerprint path: pool rotation, CONNECT tunnels, and SOCKS5
- [TLS and Certificate Pinning](../security/tls-certpin) - Certificate pinning and mTLS, and how it composes on the fingerprint path
- [Security Overview](../security/) - The full defense-in-depth map of security features
- [Configuration API](../api-reference/client-config/config) - `SecurityConfig.TLSFingerprint` field reference
- [Request Options](../api-reference/core/options#withtlsfingerprint) - Package-level `WithTLSFingerprint` routing option

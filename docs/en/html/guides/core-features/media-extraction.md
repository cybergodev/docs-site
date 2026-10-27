---
sidebar_label: "Media Extraction"
title: "Media Extraction - CyberGo html | Video & Audio Guide"
description: "CyberGo html media extraction: the three video sources and two audio sources in Extract, VideoInfo and AudioInfo fields, Type values, and the .ogg overlap."
sidebar_position: 20
---

# Media Extraction

`Extract` collects videos and audio alongside text, storing them in `Result.Videos` and `Result.Audios`. This page covers where each comes from, how deduplication works, what the fields mean, and how `Type` is determined.

## Extraction Order

Video and audio extraction runs after DOM parsing and sanitization, after text formatting and statistics, as the final step of assembling the `Result`; the two media kinds share a single DOM traversal:

```text
DOM parsing → sanitization → text formatting and statistics → media extraction (three video sources / two audio sources, one DOM pass) → Result
```

Each URL is deduplicated per media kind, so the same address is collected once.

## Video (Three Sources)

| Order | Source | Scanned | Notes |
|------|------|----------|------|
| ① | Raw HTML scan | `src` of `iframe`/`embed`, `data` of `embed`/`object` | Scans the pre-sanitization raw HTML text: sanitization has already removed these embed tags from the DOM, so only the raw text still holds their addresses |
| ② | DOM traversal | `video`/`iframe`/`embed`/`object` elements | Reads element attributes and `<source>` children |
| ③ | Regex fallback | Bare video URLs in the HTML text | Covers references that never become media elements, such as addresses inside comments or JSON payloads |

The raw HTML scan and the regex fallback run only when the input is at most 1,000,000 bytes, and the regex matches at most 1000 entries per media kind; larger documents use the DOM traversal alone. Both paths also require a media marker in the raw HTML (a known media extension or an embed-platform pattern), so a plain document page does not trigger the scan.

### Video extensions matched by the regex fallback

```text
.mp4  .webm  .ogg  .mov  .avi  .wmv  .flv  .mkv  .m4v  .3gp
```

The regex matches only complete URLs starting with `http://` or `https://`, so filename fragments are not mistaken for resources.

## Audio (Two Sources)

| Order | Source | Scanned | Notes |
|------|------|----------|------|
| ① | DOM traversal | `audio` elements and their `<source>` children | Reads the `src` attribute or the `src`/`type` of a child `<source>` |
| ② | Regex fallback | Bare audio URLs in the HTML text | Same mechanism as the video fallback |

### Audio extensions matched by the regex fallback

```text
.mp3  .wav  .ogg  .m4a  .aac  .flac  .wma  .opus  .oga
```

:::warning .ogg lands in both Videos and Audios
OGG is a container that can carry video (Theora) or audio (Vorbis/Opus), and the extension alone cannot tell them apart. A `.ogg` URL is therefore classified as both video and audio and appears in `Result.Videos` and `Result.Audios`. The audio-only variant `.oga` appears in the audio list only.
:::

## Field Reference

### VideoInfo

| Field | Type | Description |
|-------|------|-------------|
| `URL` | `string` | Video source URL |
| `Type` | `string` | Container type: a MIME type (e.g. `video/mp4`) or `embed` for an embedded page |
| `Poster` | `string` | The `poster` attribute of `<video>` (cover image URL) |
| `Width` | `string` | Width attribute, as an unparsed string |
| `Height` | `string` | Height attribute, as an unparsed string |
| `Duration` | `string` | Duration attribute, as an unparsed string |

### AudioInfo

| Field | Type | Description |
|-------|------|-------------|
| `URL` | `string` | Audio source URL |
| `Type` | `string` | Container type: a MIME type (e.g. `audio/mpeg`) |
| `Duration` | `string` | Duration attribute, as an unparsed string |

### How Type Is Determined

`Type` follows this priority:

1. The markup declares a `type` → use the declared value: `<embed>`/`<object>` take their own `type`; `<video>`/`<audio>` take a child `<source type>` only when they have no `src` of their own and draw their source from the child. A server may serve a container that disagrees with the extension, so the declaration wins.
2. Otherwise the URL decides: a recognizable extension → the matching MIME type (`a.mp4` → `video/mp4`, `a.mp3` → `audio/mpeg`); a video URL matching an embed-platform pattern → `embed`. A `<video src="...">` or `<audio src="...">` that names its source directly takes this path too.
3. An `iframe` read through the DOM walk is recorded as `embed`, because a frame is not itself a media container. The premise is that its `src` is a video URL or a known embed-platform address, otherwise the iframe produces no record. This path requires the iframe to remain in the DOM; default sanitization removes iframes, so only input with `EnableSanitization = false` takes this path.
4. If none applies, the field is empty (e.g. `<video src="/stream/abc">`).

:::warning Documents over 1 MB lose media held in iframes
The raw HTML scan and the bare-URL scan are bounded by the 1,000,000-byte limit and stop above it. Default sanitization, in turn, removes `iframe`/`embed`/`object` from the DOM, so the DOM walk cannot reach those elements; only with `EnableSanitization = false` does an iframe stay in the DOM long enough to be traversed.

The combined effect: under the default configuration, video written inside an iframe in a document over 1 MB is **not collected** (measured: in a 1.44 MB document the YouTube iframe disappeared while `<video>` remained in the result). `<video>`/`<audio>` elements go through the DOM walk and are unaffected.

To handle embedded media in large documents, split the input or disable sanitization for trusted content.
:::

| Type value | Meaning | When it occurs |
|---------|------|----------|
| `embed` | An embedded page, not a media file | An `iframe`, or an `<embed>`/`<object>`/bare URL matching an embed-platform pattern (YouTube, Vimeo, Youku, Bilibili, and so on) |
| MIME type (e.g. `video/mp4`) | A video file container | A declared `<source type>`/`<embed type>`/`<object type>` value, or derived from the extension |
| Empty string | No type identified | The URL has no recognizable extension and the markup declares no `type` |

Embedding platforms recognized as `embed`:

| Platform | URL pattern |
|------|----------|
| YouTube | `youtube.com/embed/`, `youtube-nocookie.com/embed/` |
| Vimeo | `player.vimeo.com/video/` |
| Dailymotion | `dailymotion.com/embed/` |
| Youku | `player.youku.com/` |
| Tencent Video | `v.qq.com/` |
| Bilibili | `bilibili.com/` |

## Complete Example

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	// Three media scenarios:
	// 1. A YouTube iframe (Type = "embed", found by the raw HTML scan)
	// 2. A native video with a <source> child (Type from the type attribute)
	// 3. Audio with a <source> child (Type from the type attribute)
	data := []byte(`<html><body><article>
        <h1>Multimedia Page</h1>
        <p>This article covers video and audio techniques.</p>
        <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315"></iframe>
        <video poster="poster.jpg" width="640" height="360">
            <source src="https://example.com/trailer.mp4" type="video/mp4">
        </video>
        <audio>
            <source src="https://example.com/episode.mp3" type="audio/mpeg">
        </audio>
    </article></body></html>`)

	result, err := html.Extract(data)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Videos: %d\n", len(result.Videos))
	// Videos: 2

	for i, v := range result.Videos {
		fmt.Printf("  Video %d: %s\n", i+1, v.URL)
		fmt.Printf("    Type: %s", v.Type)
		if v.Poster != "" {
			fmt.Printf(", poster: %s", v.Poster)
		}
		if v.Width != "" || v.Height != "" {
			fmt.Printf(", size: %sx%s", v.Width, v.Height)
		}
		fmt.Println()
	}
	// Video 1: https://www.youtube.com/embed/dQw4w9WgXcQ
	//   Type: embed
	// Video 2: https://example.com/trailer.mp4
	//   Type: video/mp4, poster: poster.jpg, size: 640x360

	fmt.Printf("\nAudios: %d\n", len(result.Audios))
	// Audios: 1

	for i, a := range result.Audios {
		fmt.Printf("  Audio %d: %s (Type: %s)\n", i+1, a.URL, a.Type)
	}
	// Audio 1: https://example.com/episode.mp3 (Type: audio/mpeg)
}
```

Video records are deduplicated by URL; the raw HTML scan runs before the DOM walk, and for the same address the record of the path that hits first wins — the scan fills in only `URL` and `Type`, which is why the first video above carries no size or poster.

## Configuration Control

### Preserve* Options

| Config field | Default | Effect |
|----------|--------|------|
| `PreserveVideos` | `true` | When `false`, `Result.Videos` stays nil and is omitted from JSON |
| `PreserveAudios` | `true` | When `false`, `Result.Audios` stays nil and is omitted from JSON |

```go
cfg := html.DefaultConfig()

// Disable video and audio extraction (keep text, images, and links)
cfg.PreserveVideos = false
cfg.PreserveAudios = false

result, err := html.Extract(data, cfg)
// result.Videos → nil
// result.Audios → nil
```

### Preserve* vs Include*

The two groups are independent and drive different APIs:

| Option group | API affected | Effect |
|--------|-----------|------|
| `PreserveVideos`/`PreserveAudios` | `Extract` | Whether `Result.Videos`/`Result.Audios` are populated |
| `IncludeVideos`/`IncludeAudios` | `ExtractAllLinks` | Whether video/audio URLs appear in the link enumeration |

:::warning The two groups do not affect each other
Turning off `PreserveVideos` does not change `IncludeVideos` in `ExtractAllLinks`, and vice versa. Configure the option that matches the API you call.
:::

### TextOnlyConfig Preset

When you need text only, `TextOnlyConfig()` already turns off every `Preserve*` option:

```go
cfg := html.TextOnlyConfig()
// PreserveImages = false
// PreserveLinks = false
// PreserveVideos = false
// PreserveAudios = false

result, err := html.Extract(data, cfg)
// Skips all media extraction
```

The preset changes only those four fields; the `Include*` filters used by `ExtractAllLinks` keep their defaults.

## Next Steps

- [Content Extraction](./content-extraction) - Extraction pipeline and article detection
- [Output Formats](./output-formats) - Plain text, Markdown, and JSON compared
- [API Reference: Data Types](../../api-reference/types/type-defs) - Full VideoInfo/AudioInfo definitions

---
sidebar_label: "Media Extraction"
title: "Media Extraction - CyberGo html | Video & Audio Guide"
description: "CyberGo html media extraction guide: three-source video (raw HTML, DOM, regex fallback) and dual-source audio, VideoInfo/AudioInfo fields, Type file vs embed."
sidebar_position: 2
---

# Media Extraction Guide

Beyond text, images, and links, the library can also extract video and audio resources from HTML. This guide details the extraction mechanism and field meanings.

## Extraction Overview

When you call `Extract`, video and audio extraction runs after DOM parsing and before content formatting. The results are stored in `Result.Videos` and `Result.Audios`, respectively.

```text
DOM parsing → video extraction (3 sources) → audio extraction (2 sources) → formatting → Result
```

## Video Extraction (Three Sources)

Video extraction runs in the following order; each URL is deduplicated so nothing is captured twice:

| Order | Source | Scanned targets | Description |
|------|------|----------|------|
| ① | Raw HTML scan | `src`/`data` attributes of `iframe`/`embed`/`object` | Runs **before** safe sanitization, ensuring sanitized embed tags are not lost |
| ② | DOM traversal | `video`/`iframe`/`embed`/`object` elements | Traverses the parsed DOM tree, reading element attributes and `<source>` children |
| ③ | Regex fallback | Video file URLs | Scans the HTML text for bare video links |

:::tip Why scan the raw HTML
Embed tags such as `iframe`, `embed`, and `object` may be removed during safe sanitization. The library extracts these tags' media URLs from the raw HTML string **before** sanitization, ensuring embedded videos are not lost to cleaning.
:::

### Video extensions supported by the regex fallback

```
.mp4  .webm  .ogg  .mov  .avi  .wmv  .flv  .mkv  .m4v  .3gp
```

The regex only matches complete URLs starting with `http://` or `https://`, avoiding false matches on filename fragments.

## Audio Extraction (Two Sources)

| Order | Source | Scanned targets | Description |
|------|------|----------|------|
| ① | DOM traversal | `audio` elements and their `<source>` children | Reads the `src` attribute or the `src`/`type` of child `<source>` elements |
| ② | Regex fallback | Audio file URLs | Scans the HTML text for bare audio links |

### Audio extensions supported by the regex fallback

```
.mp3  .wav  .ogg  .m4a  .aac  .flac  .wma  .opus  .oga
```

:::warning The .ogg extension appears in both the video and audio lists
OGG is a container format that can carry video (Theora) or audio (Vorbis/Opus). A URL with the `.ogg` extension is detected as **both video and audio** and may appear in both `Result.Videos` and `Result.Audios`. The audio-only variant `.oga` appears only in the audio list.
:::

## Field Reference

### VideoInfo

| Field | Type | Description |
|------|------|------|
| `URL` | `string` | Video source URL |
| `Type` | `string` | Detected type: a MIME type (e.g. `video/mp4`) or `embed` (an iframe embedding a page) |
| `Poster` | `string` | The `poster` attribute of `<video>` (cover image URL) |
| `Width` | `string` | Width attribute (raw string, not parsed into a number) |
| `Height` | `string` | Height attribute (raw string, not parsed into a number) |
| `Duration` | `string` | Duration attribute (raw string, not parsed into a number) |

### AudioInfo

| Field | Type | Description |
|------|------|------|
| `URL` | `string` | Audio source URL |
| `Type` | `string` | Detected type: a MIME type (e.g. `audio/mpeg`) |
| `Duration` | `string` | Duration attribute (raw string, not parsed into a number) |

### How the Type field is determined

The `Type` field distinguishes two categories of video sources:

| Type value | Meaning | When it occurs |
|---------|------|----------|
| `embed` | A video page referenced by an iframe | Embedded players such as YouTube, Vimeo, Youku, and Bilibili |
| MIME type (e.g. `video/mp4`) | A video file container | A bare URL matched by the regex fallback, or the value of a `<source type="...">` attribute |
| Empty string | No type detected | `<video src="...">` specifying the source directly (when there is no `<source>` child) |

Embedding platforms supported by `embed` detection:

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
	// HTML containing three media scenarios:
	// 1. iframe YouTube embed (Type = "embed")
	// 2. Native video with a <source> child (Type from the type attribute)
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
	//   Type: embed, size: 560x315
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

## Configuration Control

### Preserve* Options

`PreserveVideos` and `PreserveAudios` control whether media is included in the `Extract` result:

| Config field | Default | Effect |
|----------|--------|------|
| `PreserveVideos` | `true` | When `false`, `Result.Videos` is an empty slice |
| `PreserveAudios` | `true` | When `false`, `Result.Audios` is an empty slice |

```go
cfg := html.DefaultConfig()

// Disable video and audio extraction (keep only text, images, and links)
cfg.PreserveVideos = false
cfg.PreserveAudios = false

result, err := html.Extract(data, cfg)
// result.Videos → []
// result.Audios → []
```

### Preserve* vs Include*

These two groups of options work independently and control different APIs:

| Option group | API controlled | Description |
|--------|-----------|------|
| `PreserveVideos`/`PreserveAudios` | `Extract` | Controls whether `Result.Videos`/`Result.Audios` are populated |
| `IncludeVideos`/`IncludeAudios` | `ExtractAllLinks` | Controls whether video/audio URLs are included in link enumeration |

:::warning The two are independent
Turning off `PreserveVideos` does not affect `IncludeVideos` in `ExtractAllLinks`, and vice versa. Configure the option that matches the API you are using.
:::

### TextOnlyConfig Performance Preset

When you only need text, `TextOnlyConfig()` already disables all `Preserve*` options, so no manual setup is required:

```go
cfg := html.TextOnlyConfig()
// PreserveImages = false
// PreserveLinks = false
// PreserveVideos = false
// PreserveAudios = false

result, err := html.Extract(data, cfg)
// Skips all media extraction for best performance
```

## Next Steps

- [Content Extraction](./content-extraction) - Extraction workflow and article recognition
- [Output Formats](./output-formats) - Plain text, Markdown, and JSON compared
- [API Reference: Data Types](../../api-reference/types/type-defs) - Full definitions of VideoInfo/AudioInfo

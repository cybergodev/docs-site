---
sidebar_label: "Basic Usage"
title: "Basic Usage - CyberGo html | Typical Scenario Examples"
description: "CyberGo html basic usage in six scenarios: text and file extraction, Markdown/JSON output, link grouping, media info, and batch concurrency with timeouts."
sidebar_position: 10
---

# Basic Usage

This page is a **copy-by-scenario** quick-reference index: each scenario shows only a minimal runnable skeleton you can copy and use right away; for principles and advanced configuration, follow the "Go deeper" link at the end of each section to the corresponding guide.

| Scenario | Core Calls | In-Depth Guide |
|----------|-----------|----------------|
| Text & plain text | `html.Extract` / `html.ExtractText` | [Content Extraction](../guides/core-features/content-extraction) |
| Extract from file | `html.ExtractFromFile` | [Content Extraction](../guides/core-features/content-extraction) |
| Markdown / JSON output | `html.ExtractToMarkdown` / `html.ExtractToJSON` | [Output Formats](../guides/core-features/output-formats) |
| Link extraction | `html.ExtractAllLinks` + `html.GroupLinksByType` | [Link Extraction](../guides/core-features/link-extraction) |
| Media information | `html.Extract` (`Videos` / `Audios`) | [Media Extraction](../guides/core-features/media-extraction) |
| Batch & timeout reuse | `html.New` + `ExtractBatchWithContext` | [Batch Processing](../guides/performance/batch-processing) |

## Text & Plain Text

`Extract` returns the complete `Result` in one call; when you only need plain text, use its close sibling `ExtractText`, which returns a `string` directly:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>Go Tutorial</title></head><body><article><h1>Getting Started with Go</h1><p>Go is a statically typed compiled language.</p><a href="https://go.dev">Go Official Site</a></article></body></html>`)

	result, err := html.Extract(data) // pass in bytes, get the full Result back
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title) // Output: Go Tutorial
	fmt.Println(result.Text)
	// Output: Getting Started with Go\n\nGo is a statically typed compiled language.\n\nGo Official Site

	text, err := html.ExtractText(data) // plain text only: returns a string directly
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(len(text) > 0) // Output: true (non-empty)
}
```

Go deeper: [Content Extraction](../guides/core-features/content-extraction)

## Extract from File

Use `ExtractFromFile` for files on disk — it ships with path traversal protection and file size limits:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	result, err := html.ExtractFromFile("article.html")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title) // Output: the <title> content of article.html
}
```

Go deeper: [Content Extraction](../guides/core-features/content-extraction)

## Markdown / JSON Output

Convert to Markdown when migrating content, and to JSON when transferring data between programs:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<article><h1>Getting Started with Go</h1><p>Go is a compiled language.</p><img src="gopher.png" alt="Gopher" /><a href="https://go.dev">Go Official Site</a></article>`)
	// To Markdown: images and links become ![]() and []() syntax automatically
	md, err := html.ExtractToMarkdown(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)
	// Output: Getting Started with Go\n\nGo is a compiled language.\n\n![Gopher](gopher.png)\n[Go Official Site](https://go.dev)
	jsonBytes, err := html.ExtractToJSON(data) // To JSON: keeps all metadata fields
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("JSON bytes:", len(jsonBytes))
	// JSON size depends on the content (includes text/title/images/links and more)
}
```

Go deeper: [Output Formats](../guides/core-features/output-formats)

## Link Extraction

A link extraction API independent of body extraction, which can also group links by type:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body><article><h1>Link Example</h1><p><a href="https://go.dev">Go Official Site</a></p></article></body></html>`)

	links, err := html.ExtractAllLinks(data) // covers a/img/video/css/js and other resources
	if err != nil {
		log.Fatal(err)
	}
	for _, link := range links {
		fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
	}
	// Output: [link] Go Official Site - https://go.dev
	groups := html.GroupLinksByType(links) // group by type
	fmt.Println("link group:", len(groups["link"]))
	// Output: link group: 1
}
```

Go deeper: [Link Extraction](../guides/core-features/link-extraction)

## Media Information

Video and audio information is returned alongside `Extract` — no separate call needed:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body><article><h1>Multimedia Page</h1>
<video poster="cover.jpg"><source src="https://example.com/video.mp4" type="video/mp4"></video>
<audio><source src="https://example.com/audio.mp3" type="audio/mpeg"></audio>
</article></body></html>`)
	result, err := html.Extract(data)
	if err != nil {
		log.Fatal(err)
	}
	for _, v := range result.Videos {
		fmt.Printf("Video: %s (%s)\n", v.URL, v.Type)
	}
	for _, a := range result.Audios {
		fmt.Printf("Audio: %s (%s)\n", a.URL, a.Type)
	}
	// Output:
	// Video: https://example.com/video.mp4 (video/mp4)
	// Audio: https://example.com/audio.mp3 (audio/mpeg)
}
```

Go deeper: [Media Extraction](../guides/core-features/media-extraction)

## Batch, Timeout & Processor Reuse

The typical server-side pattern: create a globally reusable `Processor`, extract batches concurrently, and use a context to cap the time of each batch:

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	p, err := html.New(html.DefaultConfig()) // concurrency-safe, globally reusable
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()
	pages := [][]byte{
		[]byte(`<html><body><article><h1>Page One</h1></article></body></html>`),
		[]byte(`<html><body><article><h1>Page Two</h1></article></body></html>`),
	}
	batch := p.ExtractBatchWithContext(ctx, pages) // items unfinished when the context expires count as Cancelled
	fmt.Printf("Success: %d, Failed: %d\n", batch.Success, batch.Failed)
	// Output: Success: 2, Failed: 0
}
```

Go deeper: [Batch Processing](../guides/performance/batch-processing) and [Processor & Cache](../guides/performance/processor-cache)

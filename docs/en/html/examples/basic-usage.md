---
sidebar_label: "Basic Usage"
title: "Basic Usage - CyberGo html | Scenario Examples"
description: "CyberGo html basic usage: text and plain-text extraction, reader mode Markdown, file input, Markdown/JSON output, links, media, and batch concurrency."
sidebar_position: 10
---

# Basic Usage

This page gives a minimal runnable example per scenario; principles and advanced configuration live in each section's "Go deeper" link.

| Scenario | Core calls | Guide |
|----------|------------|-------|
| Text & plain text | `html.Extract` / `html.ExtractText` | [Content Extraction](../guides/core-features/content-extraction) |
| Reader mode | `html.ReadPageToMarkdown` | [Reader Mode](../guides/core-features/reader-mode) |
| Extract from file | `html.ExtractFromFile` | [Content Extraction](../guides/core-features/content-extraction) |
| Markdown / JSON output | `html.ExtractToMarkdown` / `html.ExtractToJSON` | [Output Formats](../guides/core-features/output-formats) |
| Link extraction | `html.ExtractAllLinks` + `html.GroupLinksByType` | [Link Extraction](../guides/core-features/link-extraction) |
| Media information | `html.Extract` (`Videos` / `Audios`) | [Media Extraction](../guides/core-features/media-extraction) |
| Batch & timeout reuse | `html.New` + `ExtractBatchWithContext` | [Batch Processing](../guides/performance/batch-processing) |

## Text & Plain Text

`Extract` returns the full `Result` in one call; when you only need plain text, `ExtractText` returns a `string` directly:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>Go Tutorial</title></head><body><article><h1>Getting Started with Go</h1><p>Go is a statically typed compiled language.</p><a href="https://go.dev">Go Official Site</a></article></body></html>`)

	result, err := html.Extract(data) // pass bytes, get the full Result
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title) // Output: Go Tutorial
	fmt.Println(result.Text)
	// Output:
	// # Getting Started with Go
	//
	// Go is a statically typed compiled language.
	//
	// Go Official Site
	fmt.Println(result.Confidence, result.ExtractionMethod)
	// Output: 0.6 article (the body came from the scorer-selected <article>, but the text is short)

	text, err := html.ExtractText(data) // plain text only: returns a string
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(len(text) > 0) // Output: true
}
```

Go deeper: [Content Extraction](../guides/core-features/content-extraction)

## Reader Mode

When you need the whole page (navigation and footer sections included) instead of a single article, `ReadPageToMarkdown` returns a Markdown document in one call:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	page := []byte(`<html><head><title>Example Page</title></head><body>
  <header><nav><a href="/">Home</a></nav></header>
  <main><article><h1>Body Heading</h1><p>Body paragraph.</p></article></main>
  <footer><p>© 2026 Example</p></footer>
</body></html>`)

	md, err := html.ReadPageToMarkdown(page) // with links
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)
	// Output:
	// # Example Page
	//
	// # Header
	//
	// [Home](/)
	//
	// # Main Content
	//
	// # Body Heading
	//
	// Body paragraph.
	//
	// # Footer
	//
	// © 2026 Example

	plain, err := html.ReadPageToMarkdownText(page) // without links
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(len(plain) > 0) // Output: true
}
```

Go deeper: [Reader Mode](../guides/core-features/reader-mode)

## Extract from File

Use `ExtractFromFile` for files on disk; it includes path traversal protection and a file size limit:

```go
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/cybergodev/html"
)

func main() {
	// Write a sample file first (in real use this is usually an existing path)
	const path = "article.html"
	htmlDoc := `<html><head><title>Local File Sample</title></head><body><article><p>Body.</p></article></body></html>`
	if err := os.WriteFile(path, []byte(htmlDoc), 0o644); err != nil {
		log.Fatal(err)
	}

	result, err := html.ExtractFromFile(path)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title) // Output: Local File Sample
}
```

Go deeper: [Content Extraction](../guides/core-features/content-extraction)

## Markdown / JSON Output

Use Markdown for content migration and JSON for program-to-program transfer:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<article><h1>Getting Started with Go</h1><p>Go is a compiled language.</p><img src="gopher.png" alt="Gopher" /><a href="https://go.dev">Go Official Site</a></article>`)

	// To Markdown: images and links become ![]() and []() syntax
	md, err := html.ExtractToMarkdown(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)
	// Output:
	// # Getting Started with Go
	//
	// Go is a compiled language.
	//
	// ![Gopher](gopher.png)
	// [Go Official Site](https://go.dev)

	// To JSON: keeps every metadata field
	jsonBytes, err := html.ExtractToJSON(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("JSON bytes:", len(jsonBytes))
	// Output: JSON bytes: <count> (with fields such as text, title, word_count, images, and links)
}
```

Go deeper: [Output Formats](../guides/core-features/output-formats)

## Link Extraction

`ExtractAllLinks` works independently of body extraction and reports every resource the page references, by type:

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

Video and audio information comes back with `Extract`, so no separate call is needed:

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

A common server-side shape: create one shared `Processor`, extract in batches, and bound each batch with a context.

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

	p, err := html.New(html.DefaultConfig()) // concurrency-safe, safe to share
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	pages := [][]byte{
		[]byte(`<html><body><article><h1>Page One</h1></article></body></html>`),
		[]byte(`<html><body><article><h1>Page Two</h1></article></body></html>`),
	}
	batch := p.ExtractBatchWithContext(ctx, pages) // items not started when the context expires count as Cancelled
	fmt.Printf("Success: %d, Failed: %d\n", batch.Success, batch.Failed)
	// Output: Success: 2, Failed: 0
}
```

Go deeper: [Batch Processing](../guides/performance/batch-processing) and [Processor & Cache](../guides/performance/processor-cache)

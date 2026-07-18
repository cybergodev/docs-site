---
sidebar_label: "Basic Usage"
title: "Basic Usage - CyberGo html | Runnable Examples"
description: "CyberGo html basic usage examples: content and file extraction, plain text, Markdown output, link grouping, Processor reuse, and concurrent batch code."
sidebar_position: 1
---

# Basic Usage

## Basic Extraction

Extract title, text, and media information from HTML bytes:

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/html"
)

func main() {
    data := []byte(`<html>
        <head><title>Go Tutorial</title></head>
        <body>
            <article>
                <h1>Getting Started with Go</h1>
                <p>Go is an open-source programming language developed by Google.</p>
                <img src="gopher.png" alt="Gopher mascot" />
                <a href="https://go.dev">Go Official Site</a>
            </article>
        </body>
    </html>`)

    result, err := html.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Title:", result.Title)
    fmt.Println("Text:", result.Text)
    fmt.Println("Words:", result.WordCount)
    fmt.Println("Reading Time:", result.ReadingTime)
    // Output:
    // Title: Go Tutorial
    // Text: Getting Started with Go
    //
    //       Go is an open-source programming language developed by Google.
    //
    //       Go Official Site
    // Words: 16
    // Reading Time: 4.8s
}
```

## Extract from File

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title)
```

## Text-Only Extraction

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

## Markdown Output

```go
md, err := html.ExtractToMarkdown(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(md)
```

## Link Extraction

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
    log.Fatal(err)
}

for _, link := range links {
    fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
}

// Group by type
groups := html.GroupLinksByType(links)
for typ, items := range groups {
    fmt.Printf("%s: %d items\n", typ, len(items))
}
```

## Using Processor

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()

// Reuse Processor for multiple pages
for _, page := range pages {
    result, err := p.Extract(page)
    if err != nil {
        log.Printf("Processing failed: %v", err)
        continue
    }
    fmt.Println(result.Title)
}

// View statistics
stats := p.GetStatistics()
fmt.Printf("Processed: %d, Cache hits: %d\n",
    stats.TotalProcessed, stats.CacheHits)
```

## With Timeout Control

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    log.Fatal(err)
}
```

## Batch Processing

```go
pages := [][]byte{page1, page2, page3}

p, _ := html.New(html.DefaultConfig())
defer p.Close()

batch := p.ExtractBatch(pages)
fmt.Printf("Success: %d, Failed: %d\n", batch.Success, batch.Failed)

for i, result := range batch.Results {
    if result != nil {
        fmt.Printf("Page %d: %s\n", i, result.Title)
    }
}
```

## JSON Output

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

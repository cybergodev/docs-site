---
sidebar_label: "JSONL Data Pipeline"
title: "JSONL Data Pipeline - CyberGo JSON | ETL & Streaming"
description: "CyberGo JSON JSONL data pipelines: StreamLinesInto streaming, ToJSONL/ToJSONLString batch format conversion, StreamJSONLFile and ForeachFile for large files."
sidebar_position: 40
---

# JSONL Data Pipelines

This page shows how to build JSONL (newline-delimited JSON) data pipelines with CyberGo JSON: streaming reads, field transformation, batch format conversion, and large-file handling.

## Streaming Reads with Conversion

Use the generic `StreamLinesInto[T]` to read a JSONL stream line by line into structs, transform fields in the callback, and write everything back as JSONL in bulk with `ToJSONLString`.

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

// LogEntry represents one line of JSON log
type LogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
}

// EnrichedLog is the transformed log (fields renamed plus a new category)
type EnrichedLog struct {
	Timestamp string `json:"ts"`
	Level     string `json:"level"`
	Message   string `json:"msg"`
	Category  string `json:"category"`
}

func main() {
	// Simulated JSONL log stream (in practice it could come from a file or network)
	jsonlStream := `{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"service started"}
{"timestamp":"2024-01-01T10:00:05Z","level":"ERROR","message":"database connection failed"}
{"timestamp":"2024-01-01T10:00:10Z","level":"WARN","message":"response time exceeded threshold"}
{"timestamp":"2024-01-01T10:00:15Z","level":"INFO","message":"reconnected successfully"}`

	reader := strings.NewReader(jsonlStream)

	// 1. Stream-read and transform each log line
	var enriched []any
	entries, err := json.StreamLinesInto[LogEntry](reader, func(lineNum int, entry LogEntry) error {
		// Categorize by level
		category := "normal"
		if entry.Level == "ERROR" {
			category = "critical"
		} else if entry.Level == "WARN" {
			category = "warning"
		}

		enriched = append(enriched, EnrichedLog{
			Timestamp: entry.Timestamp,
			Level:     entry.Level,
			Message:   entry.Message,
			Category:  category,
		})
		return nil
	})
	if err != nil {
		panic(err)
	}

	// 2. Convert back to JSONL in bulk
	output, err := json.ToJSONLString(enriched)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Processed %d log lines\n", len(entries))
	fmt.Print(output)
}

// Output:
// Processed 4 log lines
// {"ts":"2024-01-01T10:00:00Z","level":"INFO","msg":"service started","category":"normal"}
// {"ts":"2024-01-01T10:00:05Z","level":"ERROR","msg":"database connection failed","category":"critical"}
// {"ts":"2024-01-01T10:00:10Z","level":"WARN","msg":"response time exceeded threshold","category":"warning"}
// {"ts":"2024-01-01T10:00:15Z","level":"INFO","msg":"reconnected successfully","category":"normal"}
```

## Processing JSONL Files

`Processor.StreamJSONLFile` processes a JSONL file line by line, handing the callback an `*IterableValue` (`GetData()` returns the line's `map[string]any`, suited to non-fixed fields). Aggregate results become JSONL bytes in bulk via `ToJSONL`. (The legacy `NDJSONProcessor` is deprecated; see [JSONL Streaming](../streaming/jsonl#ndjsonprocessor).)

```go
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/cybergodev/json"
)

func main() {
	// Create a temp JSONL file so the example runs standalone
	tmpDir, err := os.MkdirTemp("", "cybergo-pipeline-*")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(tmpDir)

	jsonlPath := filepath.Join(tmpDir, "events.jsonl")
	jsonData := `{"event":"login","user":"alice","ts":"2024-01-01T10:00:00Z"}
{"event":"logout","user":"alice","ts":"2024-01-01T11:00:00Z"}
{"event":"login","user":"bob","ts":"2024-01-01T12:00:00Z"}
{"event":"purchase","user":"bob","ts":"2024-01-01T12:30:00Z"}`
	if err := os.WriteFile(jsonlPath, []byte(jsonData), 0644); err != nil {
		panic(err)
	}

	// 1. Process line by line with Processor.StreamJSONLFile
	//    (item.GetData() returns the line's map[string]any)
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	loginCount := 0
	err = p.StreamJSONLFile(jsonlPath, func(lineNum int, item *json.IterableValue) error {
		obj := item.GetData().(map[string]any)
		event, _ := obj["event"].(string)
		user, _ := obj["user"].(string)
		fmt.Printf("Line %d: %s by %s\n", lineNum, event, user)
		if event == "login" {
			loginCount++
		}
		return nil
	})
	if err != nil {
		panic(err)
	}

	// 2. Convert the aggregate result to JSONL (batch format conversion)
	summary := []any{
		map[string]any{"metric": "logins", "count": loginCount},
		map[string]any{"metric": "total_events", "count": 4},
	}
	jsonlBytes, err := json.ToJSONL(summary)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Login events: %d\n", loginCount)
	fmt.Printf("Aggregated result:\n%s", string(jsonlBytes))
}

// Output:
// Line 1: login by alice
// Line 2: logout by alice
// Line 3: login by bob
// Line 4: purchase by bob
// Login events: 2
// Aggregated result:
// {"metric":"logins","count":2}
// {"metric":"total_events","count":4}
```

## Parallel Pipeline: StreamJSONLParallel + JSONLWriter Output

With many lines and heavy per-line work (transformation, validation, enrichment), `StreamJSONLParallel` consumes the stream with multiple workers; after collecting results in original line order, `JSONLWriter.WriteRaw` writes them back as JSONL without re-encoding:

```go
package main

import (
	"bytes"
	"fmt"
	"slices"
	"strings"
	"sync"

	"github.com/cybergodev/json"
)

func main() {
	// Simulated event-log stream (in practice from a large file — swap
	// strings.NewReader for the *os.File from os.Open)
	jsonlStream := `{"event":"login","user":"alice","ts":"10:00"}
{"event":"page_view","user":"alice","ts":"10:01"}
{"event":"login","user":"bob","ts":"10:02"}
{"event":"purchase","user":"bob","ts":"10:03"}
{"event":"login","user":"carol","ts":"10:04"}`

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 1. Filter and transform in parallel: keep only login events, rewritten
	//    as {user, at}. The callback runs concurrently across workers: lock
	//    when writing shared state; store by lineNum and restore order afterwards
	var mu sync.Mutex
	logins := make(map[int][]byte)

	err = p.StreamJSONLParallel(strings.NewReader(jsonlStream), 4, func(lineNum int, item *json.IterableValue) error {
		if item.GetString("event") != "login" {
			return nil // Skip non-target events; return item.Break() to stop the whole stream cleanly
		}
		encoded, err := json.Marshal(map[string]any{
			"user": item.GetString("user"),
			"at":   item.GetString("ts"),
		})
		if err != nil {
			return err // Returning an error stops dispatching and is reported verbatim
		}
		mu.Lock()
		logins[lineNum] = encoded
		mu.Unlock()
		return nil
	})
	if err != nil {
		panic(err)
	}

	// 2. Write results in original line order (WriteRaw writes already-encoded
	// lines, only appending newlines)
	lineNums := make([]int, 0, len(logins))
	for n := range logins {
		lineNums = append(lineNums, n)
	}
	slices.Sort(lineNums)

	var out bytes.Buffer
	writer := json.NewJSONLWriter(&out)
	for _, n := range lineNums {
		if err := writer.WriteRaw(logins[n]); err != nil {
			panic(err)
		}
	}

	fmt.Printf("Filtered %d login events (wrote %d lines)\n", len(logins), writer.Stats().LinesProcessed)
	fmt.Print(out.String())
}

// Output:
// Filtered 3 login events (wrote 3 lines)
// {"at":"10:00","user":"alice"}
// {"at":"10:02","user":"bob"}
// {"at":"10:04","user":"carol"}
```

:::tip Parallel pipeline essentials
- **Ordering**: parallel callbacks have no guaranteed execution order, but `lineNum` always maps to the original line number — collect by line number, sort, then write to preserve order.
- **Worker count**: given explicitly by the second argument (4 in the example); for timeout/cancellation use `StreamJSONLParallelWithContext(ctx, reader, workers, fn)`.
- **Throughput**: versus serial `StreamJSONL`, the gain depends on per-line cost — light extraction-only callbacks improve little, while heavy enrichment/validation callbacks improve markedly.
:::

## Traversing Large JSON Array Files

For a **large JSON array in a single file** (not JSONL), `ForeachFile` provides callback-based element-by-element traversal. Note its memory semantics: the **entire file is loaded into memory first** (`ForeachFileChunked`'s "chunking" only changes how the in-memory data is grouped for iteration — it loads fully too); for constant-memory processing of very large arrays use `StreamIterator` (see [Large File Handling](../streaming/large-files#streaming-and-parallel-iterators)), or convert the data to JSONL and use the `StreamJSONL` family.

```go
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/cybergodev/json"
)

func main() {
	tmpDir, err := os.MkdirTemp("", "cybergo-big-*")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(tmpDir)

	// Create a large JSON array file (simulating a big dataset)
	arrayPath := filepath.Join(tmpDir, "records.json")
	records := []any{
		map[string]any{"id": 1, "amount": 100, "currency": "USD"},
		map[string]any{"id": 2, "amount": 250, "currency": "EUR"},
		map[string]any{"id": 3, "amount": 80, "currency": "USD"},
		map[string]any{"id": 4, "amount": 500, "currency": "GBP"},
		map[string]any{"id": 5, "amount": 120, "currency": "USD"},
	}
	if err := json.SaveToFile(arrayPath, records); err != nil {
		panic(err)
	}

	// Traverse the array element by element with ForeachFile
	// (the whole file is loaded into memory first — suits datasets that fit in RAM)
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	totalUSD := 0
	err = p.ForeachFile(arrayPath, func(key any, item *json.IterableValue) error {
		currency := item.GetString("currency")
		amount := item.GetInt("amount")
		if currency == "USD" {
			totalUSD += amount
		}
		return nil // return item.Break() to interrupt early
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("Total USD: %d\n", totalUSD)
}

// Output: Total USD: 320
```

:::tip
- **JSONL files** (one independent JSON object per line): use `StreamJSONLFile` or `StreamLinesInto[T]` (the legacy `NDJSONProcessor` is deprecated).
- **Large JSON array files** (a single JSON array with many elements): use `StreamIterator` for constant-memory element-by-element decoding; `ForeachFile` also traverses item by item, but loads the entire file into memory first — it suits small-to-medium arrays.
:::

## Next Steps

- [JSONL Streaming](../streaming/jsonl) — The complete JSONL guide
- [Large File Handling](../streaming/large-files) — Streaming large files in detail
- [Basic Examples](./index) — Basic JSONL read/write usage
- [Cheat Sheet](../getting-started/cheatsheet) — Quick API reference

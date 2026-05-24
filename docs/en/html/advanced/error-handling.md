---
title: "Error Handling - HTML"
description: "Error handling guide for CyberGo HTML, covering error categories, errors.Is sentinel matching, errors.As structured extraction, and batch failure patterns."
---

# Error Handling

## Error Categories

HTML library errors fall into the following categories:

| Category | Sentinel Errors | Description |
|----------|----------------|-------------|
| Input errors | `ErrInputTooLarge`, `ErrInvalidHTML` | Input content issues |
| Config errors | `ErrInvalidConfig`, `ErrMultipleConfigs` | Configuration issues |
| File errors | `ErrFileNotFound`, `ErrInvalidFilePath` | File operation issues |
| Processing errors | `ErrProcessingTimeout`, `ErrMaxDepthExceeded` | Processing issues |
| System errors | `ErrProcessorClosed`, `ErrInternalPanic` | Internal state issues |

## errors.Is Pattern

Use `errors.Is` to match error types:

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        slog.Warn("Input too large, please reduce document size")
    case errors.Is(err, html.ErrInvalidHTML):
        slog.Warn("Invalid HTML, please check input")
    case errors.Is(err, html.ErrProcessingTimeout):
        slog.Warn("Processing timeout, document may be too complex")
    case errors.Is(err, html.ErrFileNotFound):
        slog.Warn("File not found")
    case errors.Is(err, html.ErrMaxDepthExceeded):
        slog.Warn("DOM depth too deep, possibly maliciously crafted")
    case errors.Is(err, html.ErrInternalPanic):
        slog.Error("Internal panic recovered, please report this issue")
    default:
        slog.Error("Unknown error", "err", err)
    }
}
```

## errors.As Pattern

Extract structured error information:

```go
var inputErr *html.InputError
var configErr *html.ConfigError
var fileErr *html.FileError

if errors.As(err, &inputErr) {
    fmt.Printf("Size %d exceeds limit %d\n", inputErr.Size, inputErr.MaxSize)
}

if errors.As(err, &configErr) {
    fmt.Printf("Field %s value %v invalid: %s\n", configErr.Field, configErr.Value, configErr.Message)
}

if errors.As(err, &fileErr) {
    fmt.Printf("File operation: %s\n", fileErr.SafePath())
}
```

## Context Cancellation

Use `WithContext` variants for cancellation support:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
        // Timeout
    } else if ctx.Err() == context.Canceled {
        // Manual cancellation
    }
}
```

## Batch Errors

Batch processing results include partial successes and failures:

```go
batch := p.ExtractBatch(pages)

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("Item %d failed: %v\n", i, err)
    }
}

fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n",
    batch.Success, batch.Failed, batch.Cancelled)
```

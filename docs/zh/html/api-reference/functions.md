---
title: "包函数 - CyberGo HTML | 便捷提取 API"
description: "CyberGo HTML 包级便捷函数：Extract、ExtractText、ExtractToMarkdown 等，内部用 sync.Pool 复用 Processor，适合一次性调用与快速集成。"
---

# 包函数

包级函数适合一次性调用场景，内部使用 `sync.Pool` 复用 Processor，无需手动管理生命周期。

## 内容提取

### Extract

从 HTML 字节中提取内容，返回完整的 `Result`。

```go
func Extract(htmlBytes []byte, cfg ...Config) (*Result, error)
```

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `htmlBytes` | `[]byte` | HTML 内容 |
| `cfg` | `...Config` | 可选配置，最多一个 |

**示例**：

```go
result, err := html.Extract(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title, result.Text)
```

### ExtractFromFile

从 HTML 文件提取内容。

```go
func ExtractFromFile(filePath string, cfg ...Config) (*Result, error)
```

## 文本提取

### ExtractText

仅提取纯文本内容。

```go
func ExtractText(htmlBytes []byte, cfg ...Config) (string, error)
```

### ExtractTextFromFile

从文件提取纯文本。

```go
func ExtractTextFromFile(filePath string, cfg ...Config) (string, error)
```

## 上下文版本

所有函数都支持带 `context.Context` 的版本，用于取消和超时控制：

| 函数 | 签名 |
|------|------|
| `ExtractWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (*Result, error)` |
| `ExtractFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (*Result, error)` |
| `ExtractTextWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` |
| `ExtractTextFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` |

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## 输出格式

| 函数 | 签名 | 说明 |
|------|------|------|
| `ExtractToMarkdown` | `(htmlBytes []byte, cfg ...Config) (string, error)` | HTML → Markdown |
| `ExtractToMarkdownFromFile` | `(filePath string, cfg ...Config) (string, error)` | 文件 → Markdown |
| `ExtractToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` | 带上下文 |
| `ExtractToMarkdownFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` | 文件+上下文 |
| `ExtractToJSON` | `(htmlBytes []byte, cfg ...Config) ([]byte, error)` | HTML → JSON |
| `ExtractToJSONFromFile` | `(filePath string, cfg ...Config) ([]byte, error)` | 文件 → JSON |
| `ExtractToJSONWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)` | 带上下文 |
| `ExtractToJSONFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)` | 文件+上下文 |

详细用法和示例详见 [输出格式](./output)。

## 链接提取

| 函数 | 签名 | 说明 |
|------|------|------|
| `ExtractAllLinks` | `(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | 提取所有链接 |
| `ExtractAllLinksFromFile` | `(filePath string, cfg ...Config) ([]LinkResource, error)` | 从文件提取链接 |
| `ExtractAllLinksWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | 带上下文 |
| `ExtractAllLinksFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)` | 文件+上下文 |

详细用法和示例详见 [链接提取](./links)。

## 批量处理

| 函数 | 签名 | 说明 |
|------|------|------|
| `ExtractBatch` | `(htmlContents [][]byte, cfg ...Config) *BatchResult` | 批量提取 |
| `ExtractBatchWithContext` | `(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult` | 带上下文 |
| `ExtractBatchFiles` | `(filePaths []string, cfg ...Config) *BatchResult` | 批量文件提取 |
| `ExtractBatchFilesWithContext` | `(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult` | 文件+上下文 |

详细用法和示例详见 [批量处理](./batch)。

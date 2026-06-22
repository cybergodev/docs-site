---
title: "パッケージ関数 - CyberGo HTML | 便利な抽出 API"
description: "CyberGo HTML パッケージ関数：Extract、ExtractText、ExtractToMarkdown など。内部の sync.Pool で Processor を再利用し、単発呼び出しや迅速な統合に適しています。"
---

# パッケージ関数

パッケージレベル関数は一回限りの呼び出しに適しており、内部で `sync.Pool` を使って Processor を再利用するため、ライフサイクルの手動管理が不要です。

## コンテンツ抽出

### Extract

HTML バイトからコンテンツを抽出し、完全な `Result` を返します。

```go
func Extract(htmlBytes []byte, cfg ...Config) (*Result, error)
```

**パラメータ**：

| パラメータ | 型 | 説明 |
|------|------|------|
| `htmlBytes` | `[]byte` | HTML コンテンツ |
| `cfg` | `...Config` | オプションの設定、最大 1 つ |

**例**：

```go
result, err := html.Extract(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title, result.Text)
```

### ExtractFromFile

HTML ファイルからコンテンツを抽出します。

```go
func ExtractFromFile(filePath string, cfg ...Config) (*Result, error)
```

## テキスト抽出

### ExtractText

プレーンテキストコンテンツのみを抽出します。

```go
func ExtractText(htmlBytes []byte, cfg ...Config) (string, error)
```

### ExtractTextFromFile

ファイルからプレーンテキストを抽出します。

```go
func ExtractTextFromFile(filePath string, cfg ...Config) (string, error)
```

## コンテキスト付きバージョン

すべての関数は `context.Context` を受け取るバージョンをサポートしており、キャンセルとタイムアウト制御に使用します：

| 関数 | シグネチャ |
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

## 出力フォーマット

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `ExtractToMarkdown` | `(htmlBytes []byte, cfg ...Config) (string, error)` | HTML → Markdown |
| `ExtractToMarkdownFromFile` | `(filePath string, cfg ...Config) (string, error)` | ファイル → Markdown |
| `ExtractToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` | コンテキスト付き |
| `ExtractToMarkdownFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` | ファイル+コンテキスト |
| `ExtractToJSON` | `(htmlBytes []byte, cfg ...Config) ([]byte, error)` | HTML → JSON |
| `ExtractToJSONFromFile` | `(filePath string, cfg ...Config) ([]byte, error)` | ファイル → JSON |
| `ExtractToJSONWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)` | コンテキスト付き |
| `ExtractToJSONFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)` | ファイル+コンテキスト |

詳細な使い方と例は [出力フォーマット](./output) を参照してください。

## リンク抽出

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `ExtractAllLinks` | `(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | すべてのリンクを抽出 |
| `ExtractAllLinksFromFile` | `(filePath string, cfg ...Config) ([]LinkResource, error)` | ファイルからリンクを抽出 |
| `ExtractAllLinksWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | コンテキスト付き |
| `ExtractAllLinksFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)` | ファイル+コンテキスト |

詳細な使い方と例は [リンク抽出](./links) を参照してください。

## バッチ処理

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `ExtractBatch` | `(htmlContents [][]byte, cfg ...Config) *BatchResult` | バッチ抽出 |
| `ExtractBatchWithContext` | `(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult` | コンテキスト付き |
| `ExtractBatchFiles` | `(filePaths []string, cfg ...Config) *BatchResult` | バッチファイル抽出 |
| `ExtractBatchFilesWithContext` | `(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult` | ファイル+コンテキスト |

詳細な使い方と例は [バッチ処理](./batch) を参照してください。

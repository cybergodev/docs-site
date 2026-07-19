---
sidebar_label: "インターフェース定義"
title: "インターフェース定義 - CyberGo html | コアインターフェース参照"
description: "CyberGo html コアインターフェース：Extractor、StatsProvider、ContentNode、Scorer、AuditSink。機能拡張や統合テストに活用します。"
sidebar_position: 1
---

# インターフェース定義

HTML ライブラリは以下のコアインターフェースを定義しています：

## Extractor

HTML コンテンツ抽出のメインインターフェース。`Processor` はこのインターフェースを実装しています。

```go
type Extractor interface {
    // コア抽出
    Extract(htmlBytes []byte) (*Result, error)
    ExtractWithContext(ctx context.Context, htmlBytes []byte) (*Result, error)
    ExtractFromFile(filePath string) (*Result, error)
    ExtractFromFileWithContext(ctx context.Context, filePath string) (*Result, error)

    // テキスト抽出
    ExtractText(htmlBytes []byte) (string, error)
    ExtractTextFromFile(filePath string) (string, error)
    ExtractTextWithContext(ctx context.Context, htmlBytes []byte) (string, error)
    ExtractTextFromFileWithContext(ctx context.Context, filePath string) (string, error)

    // フォーマット出力
    ExtractToMarkdown(htmlBytes []byte) (string, error)
    ExtractToMarkdownFromFile(filePath string) (string, error)
    ExtractToJSON(htmlBytes []byte) ([]byte, error)
    ExtractToJSONFromFile(filePath string) ([]byte, error)
    ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
    ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
    ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
    ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)

    // バッチ処理
    ExtractBatch(htmlContents [][]byte) *BatchResult
    ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
    ExtractBatchFiles(filePaths []string) *BatchResult
    ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult

    // リンク抽出
    ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
    ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
    ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
    ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)

    // ライフサイクル
    Close() error
}
```

## StatsProvider

統計情報とキャッシュ管理のインターフェース。

```go
type StatsProvider interface {
    GetStatistics() Statistics
    ClearCache()
    ResetStatistics()
}
```

## ContentNode

HTML ノードの抽象インターフェース、コンテンツスコアリングアルゴリズムで使用されます。

```go
type ContentNode interface {
    Type() string                    // ノードタイプ ("element", "text", "comment" など)
    Data() string                    // タグ名またはテキストコンテンツ
    AttrValue(key string) string     // 属性値
    Attrs() []NodeAttr               // すべての属性
    FirstChild() ContentNode         // 最初の子ノード
    NextSibling() ContentNode        // 次の兄弟ノード
    Parent() ContentNode             // 親ノード
}
```

## Scorer

コンテンツスコアリングアルゴリズムのインターフェース。カスタム記事認識戦略に使用します。

```go
type Scorer interface {
    Score(node ContentNode) int          // ノードの関連性スコアを計算
    ShouldRemove(node ContentNode) bool  // ノードを削除すべきか判断
}
```

:::warning 警告
単一の `Processor` が複数の並行 `Extract` 呼び出しで共有されると、`Score`/`ShouldRemove` が**複数の goroutine から同時に**呼び出される可能性があります。したがって、すべての `Scorer` 実装は**自身で並列安全性を保証**する必要があります。

ライブラリの組み込みデフォルトスコアラーは読み取り専用で本質的に並列安全ですが、**可変状態（キャッシュやカウンターなど）を保持するカスタム `Scorer` は自身でロックと同期を行う**必要があります。
:::

`Config.Scorer` フィールドからカスタムスコアラーを注入します：

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
    // カスタムスコアリングロジック
    return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
    // カスタム削除ロジック
    return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

## AuditSink

監査ログ出力のインターフェース。

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

組み込み Sink 実装の詳細は [監査システム](../modules/audit) を参照してください。

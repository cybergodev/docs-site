---
title: "インターフェース定義 - HTML"
description: "CyberGo HTML ライブラリのコアインターフェース定義 API リファレンス。Extractor（完全な抽出インターフェース）、StatsProvider（統計とキャッシュ管理）、ContentNode（HTML ノード抽象化）、Scorer（カスタムスコアリング戦略）、AuditSink（監査出力）を含み、機能拡張や統合テストに活用でき、ライブラリのアーキテクチャ設計と拡張メカニズムの理解に役立ちます。"
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

組み込み Sink 実装の詳細は [監査システム](./audit) を参照してください。

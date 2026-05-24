---
title: "テストとカスタム拡張 - HTML"
description: "CyberGo HTML テストとカスタム拡張ガイド。カスタム Scorer スコアラーの実装、ContentNode インターフェースの走査、テストモードの設定、mock HTML データの準備、Extractor インターフェースのモック、一般的な拡張シナリオの完全な実行可能コード例を含み、信頼性の高いテスト体制と拡張機能の構築をサポートします。"
---

# テストとカスタム拡張

このガイドでは、コンテンツスコアリングアルゴリズムのカスタマイズ方法と、HTML ライブラリを使用するコードのテスト方法を紹介します。

## カスタム Scorer

`Scorer` インターフェースは 2 つのコアな意思決定を制御します：本文コンテンツの認識方法と、どのノードを削除すべきか。

### インターフェース定義

```go
type Scorer interface {
    Score(node ContentNode) int
    ShouldRemove(node ContentNode) bool
}
```

- `Score`：ノードにスコアを付ける。スコアが高いほど本文コンテナとして選ばれる可能性が高い
- `ShouldRemove`：`true` を返すと、抽出前にそのノードを削除

### デフォルトの動作

`Scorer` を設定しない場合、組み込みのデフォルトスコアラーが使用されます。ノードの特徴（テキスト密度、段落比率、タグのセマンティクスなど）に基づいてスコアを計算します。

### カスタム Scorer の実装

```go
package main

import (
    "fmt"
    "log"
    "strings"

    "github.com/cybergodev/html"
)

// blogScorer ブログ系サイトに最適化されたスコアラー
type blogScorer struct{}

func (s blogScorer) Score(node html.ContentNode) int {
    if node == nil {
        return 0
    }

    score := 0
    class := strings.ToLower(node.AttrValue("class"))
    id := strings.ToLower(node.AttrValue("id"))
    tag := node.Data()

    // ポジティブシグナル：記事関連の class/id
    if containsAny(class, "article", "post", "content", "entry") {
        score += 50
    }
    if containsAny(id, "article", "post", "content") {
        score += 60
    }

    // セマンティックタグのボーナス
    switch tag {
    case "article":
        score += 80
    case "main":
        score += 70
    case "section":
        score += 30
    }

    // ネガティブシグナル
    if containsAny(class, "sidebar", "comment", "footer", "nav", "menu") {
        score -= 50
    }
    if containsAny(id, "sidebar", "comments", "footer") {
        score -= 60
    }

    return score
}

func (s blogScorer) ShouldRemove(node html.ContentNode) bool {
    if node == nil {
        return false
    }

    // ナビゲーションとフッターを削除
    switch node.Data() {
    case "nav", "footer", "header":
        return true
    }

    // 広告とコメントエリアを削除
    class := strings.ToLower(node.AttrValue("class"))
    return containsAny(class, "ad", "advertisement", "comment", "social-share")
}

func containsAny(s string, keywords ...string) bool {
    for _, kw := range keywords {
        if strings.Contains(s, kw) {
            return true
        }
    }
    return false
}

func main() {
    cfg := html.DefaultConfig()
    cfg.Scorer = blogScorer{}

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    data := []byte(`<html><body>
        <article class="post"><h1>テスト記事</h1><p>本文コンテンツ</p></article>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(result.Text)
}
```

## ContentNode インターフェース

`ContentNode` は `Scorer` インターフェースで使用されるノードの抽象化であり、基盤となる HTML パーサーの具体的な型を隠蔽します：

```go
type ContentNode interface {
    Type() string                        // "element", "text", "comment" など
    Data() string                        // タグ名またはテキストコンテンツ
    AttrValue(key string) string         // 属性値の取得
    Attrs() []NodeAttr                   // すべての属性の取得
    FirstChild() ContentNode             // 最初の子ノード
    NextSibling() ContentNode            // 次の兄弟ノード
    Parent() ContentNode                 // 親ノード
}
```

### ノードの走査

```go
func (s myScorer) Score(root html.ContentNode) int {
    score := 0
    // 子ノードを走査
    for child := root.FirstChild(); child != nil; child = child.NextSibling() {
        if child.Type() == "element" {
            // ネストされたテキスト密度を確認
            textLen := countTextLength(child)
            if textLen > 200 {
                score += 10
            }
        }
    }
    return score
}
```

## テストモード

### キャッシュの無効化

テストでは通常キャッシュが不要なため、無効化すると毎回「クリーン」な状態になります：

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 0 // キャッシュを無効化
```

### クリーニングの無効化

信頼できる入力に対してはセキュリティクリーニングを無効化し、テスト HTML が変更されないようにします：

```go
cfg := html.DefaultConfig()
cfg.EnableSanitization = false
```

:::warning テストのみに限定
プロダクション環境では必ず `EnableSanitization = true` を維持してください。
:::

### TextOnlyConfig の使用

プレーンテキスト抽出ロジックのテストでは、`TextOnlyConfig` を使用してノイズを減らします：

```go
result, err := html.Extract(data, html.TextOnlyConfig())
```

## テストの作成

### 抽出結果のテスト

```go
func TestExtractTitle(t *testing.T) {
    data := []byte(`<html><head><title>テストタイトル</title></head>
        <body><p>本文コンテンツ</p></body></html>`)

    result, err := html.Extract(data)
    require.NoError(t, err)
    assert.Equal(t, "テストタイトル", result.Title)
    assert.Contains(t, result.Text, "本文コンテンツ")
}
```

### カスタム Scorer のテスト

```go
func TestBlogScorer(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.Scorer = blogScorer{}
    cfg.MaxCacheEntries = 0 // キャッシュを無効化

    p, err := html.New(cfg)
    require.NoError(t, err)
    defer p.Close()

    data := []byte(`<html><body>
        <nav><a href="/">ホーム</a></nav>
        <article class="post">
            <h1>ブログタイトル</h1>
            <p>ブログ本文コンテンツ</p>
        </article>
        <aside class="sidebar">サイドバー</aside>
    </body></html>`)

    result, err := p.Extract(data)
    require.NoError(t, err)
    assert.Contains(t, result.Text, "ブログ本文コンテンツ")
    assert.NotContains(t, result.Text, "サイドバー")
    assert.NotContains(t, result.Text, "ホーム")
}
```

### エラー処理のテスト

```go
func TestInputTooLarge(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.MaxInputSize = 100 // 極小制限

    largeData := make([]byte, 200)
    _, err := html.Extract(largeData, cfg)

    assert.ErrorIs(t, err, html.ErrInputTooLarge)
}
```

### 監査ログのテスト

```go
func TestAuditLog(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.Audit = html.DefaultAuditConfig()
    cfg.Audit.Enabled = true
    cfg.MaxCacheEntries = 0

    p, _ := html.New(cfg)
    defer p.Close()

    data := []byte(`<html><body><script>alert(1)</script><p>本文</p></body></html>`)
    p.Extract(data)

    entries := p.GetAuditLog()
    t.Logf("監査イベント: %d 件", len(entries))
    for _, e := range entries {
        t.Logf("  [%s] %s", e.EventType, e.Message)
    }
}
```

## よくある拡張シナリオ

### 特定サイト向けのカスタム抽出

```go
func newSiteScorer(site string) html.Scorer {
    switch site {
    case "github.com":
        return githubScorer{}
    case "medium.com":
        return mediumScorer{}
    default:
        return nil // デフォルトスコアラーを使用
    }
}
```

### ノード属性の分布を集計

```go
func analyzeStructure(node html.ContentNode) map[string]int {
    counts := make(map[string]int)
    walk(node, counts)
    return counts
}

func walk(node html.ContentNode, counts map[string]int) {
    if node == nil {
        return
    }
    if node.Type() == "element" {
        counts[node.Data()]++
    }
    walk(node.FirstChild(), counts)
    walk(node.NextSibling(), counts)
}
```

## 次のステップ

- [API リファレンス：インターフェース](../api-reference/interfaces) - Scorer と ContentNode の完全な定義
- [API リファレンス：設定](../api-reference/config) - Scorer 設定フィールド
- [FAQ](../faq) - よくある質問

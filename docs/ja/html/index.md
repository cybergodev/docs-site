---
title: "HTML 抽出ライブラリ - CyberGo HTML | 高性能 Go ライブラリ"
description: "CyberGo HTML は高性能な Go 製 HTML 抽出・クリーニングライブラリで、記事認識、エンコーディング自動検出、並列バッチ、プラグイン可能な監査を提供し、テキスト・Markdown・JSON 出力をサポートします。"
---

# HTML

プロダクション向け HTML コンテンツ抽出ツール。自動エンコーディング検出（15+ エンコーディング）、スマート記事認識、リンク/メディア抽出、マルチフォーマット出力をサポート。

## 特徴

- **スマート記事認識** - ページのメインコンテンツを自動識別・抽出し、ナビゲーションや広告などのノイズを除去
- **コンテンツクリーニング** - HTML を自動クリーニングし、危険なタグや属性を削除して XSS 攻撃を防止
- **メタデータ抽出** - タイトル、画像、リンク、動画、音声などの構造化情報を自動抽出
- **マルチフォーマット出力** - プレーンテキスト、Markdown、JSON の 3 種類の出力フォーマット
- **自動エンコーディング検出** - UTF-8、GBK、Shift_JIS、Windows-1252 など 15+ エンコーディングをサポート
- **バッチ処理** - 並列バッチ抽出、組み込み Processor オブジェクトプール再利用
- **リンク抽出** - 独立したリンク抽出 API、タイプ別グループ化をサポート
- **監査システム** - プラグイン可能な監査パイプライン、マルチ Sink、イベントフィルタリングをサポート
- **セキュリティ保護** - 入力サイズ制限、深度制限、パストラバーサル防御、パニックリカバリ

## インストール

```bash
go get github.com/cybergodev/html
```

## クイックスタート

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/html"
)

func main() {
    data := []byte(`<html><head><title>サンプル</title></head>
        <body><h1>タイトル</h1><p>本文コンテンツ</p></body></html>`)

    result, err := html.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println(result.Title) // 出力: サンプル
    fmt.Println(result.Text)  // 出力: タイトル\n\n本文コンテンツ
}
```

## アーキテクチャ概要

HTML ライブラリは 3 つのコアタイプを中心に構築されています：

```text
                Config
                  │
                  ▼
             Processor ──→ Result
              │    │         │
              │    │         ├── Text / Title
              │    │         ├── Images / Videos / Audios
              │    │         ├── Links
              │    │         └── WordCount / ReadingTime
              │    │
              │    ├── Cache（キャッシュ）
              │    ├── Statistics（統計）
              │    └── AuditLog（監査）
              │
              ├── Scorer（カスタムスコアリング ── 拡張可能）
              └── AuditSink（監査出力 ── 拡張可能）
```

| タイプ | 役割 | 説明 |
|------|------|------|
| `Config` | 設定 | すべての動作を制御するセンター、4 種類のプリセットを提供 |
| `Processor` | エンジン | ステートフルな処理エンジン、キャッシュ・統計・監査を管理 |
| `Result` | 結果 | 抽出された構造化出力、テキストとすべてのメタデータを含む |

### Processor vs パッケージ関数

| | パッケージ関数 | Processor |
|---|---|---|
| 呼び出し方 | `html.Extract(data)` | `p, _ := html.New(cfg); p.Extract(data)` |
| キャッシュ | なし（内部一時プールを使用） | あり、TTL と容量を設定可能 |
| 統計 | なし | あり、ヒット率などの指標を照会可能 |
| 監査 | なし | あり、監査パイプラインを設定可能 |
| ライフサイクル | 管理不要 | `defer p.Close()` が必要 |
| 並列安全性 | あり | あり |

:::tip 選択のヒント
- **一度きりの抽出**（CLI ツール、スクリプト）→ パッケージ関数
- **サーバーでの高頻度呼び出し**（Web サービス、クローラー）→ Processor
- **監査/モニタリングが必要** → Processor
:::

| 段階 | ページ | 学べる内容 |
|------|------|----------|
| 入門 | [クイックスタート](./getting-started) | インストール、基本的な使い方、2 つの呼び出し方 |
| コア | [コンテンツ抽出](./guides/content-extraction) | Extract ファミリー、Config 設定、Result の読み方 |
| フォーマット | [出力フォーマット](./guides/output-formats) | Markdown / JSON 出力、カスタムテンプレート |
| パフォーマンス | [キャッシュと再利用](./guides/processor-cache) | Processor ライフサイクル、キャッシュチューニング、バッチ処理 |
| 拡張 | [リンク抽出](./guides/link-extraction) | リンク抽出、グループ化、リソース発見 |
| セキュリティ | [監査パイプライン](./guides/audit-pipeline) | 監査システム、カスタム Sink、セキュリティモニタリング |
| 応用 | [テストとカスタマイズ](./guides/testing-custom) | カスタム Scorer、ContentNode、テストモード |
| リファレンス | [チートシート](./cheatsheet) | よく使う API 一覧 |

## 次のステップ

- [クイックスタート](./getting-started) - 5 分で始めるチュートリアル
- [チートシート](./cheatsheet) - よく使う操作のクイックリファレンス
- [API リファレンス](./api-reference/) - 完全な API ドキュメント

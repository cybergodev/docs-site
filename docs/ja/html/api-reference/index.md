---
title: "API リファレンス - CyberGo HTML | 全モジュール索引"
description: "CyberGo HTML 全 API 索引：パッケージ関数と Processor の二つの呼び出し方式で、抽出、出力、リンク、バッチ、設定、監査、型など全モジュールを案内します。"
---

# API リファレンス

HTML ライブラリは以下のコアコンポーネントを提供します：

| コンポーネント | 説明 | ドキュメント |
|------|------|------|
| パッケージ関数 | 一回限りの呼び出しに適した便利関数 | [パッケージ関数](./functions) |
| Processor | リソースとキャッシュを再利用するプロセッサインスタンス | [Processor](./processor) |
| Config | 設定構造体とプリセット | [設定](./config) |
| 出力フォーマット | Markdown、JSON 出力 | [出力フォーマット](./output) |
| リンク抽出 | 独立したリンク抽出 API | [リンク抽出](./links) |
| バッチ処理 | 並列バッチ抽出 | [バッチ処理](./batch) |
| インターフェース | Extractor、StatsProvider など | [インターフェース定義](./interfaces) |
| 型 | Result、ImageInfo など | [型定義](./types) |
| 定数とエラー | デフォルト値、センチネルエラー | [定数とエラー](./constants) |
| 監査システム | 監査パイプラインと Sink | [監査システム](./audit) |

## API 概要

### 2 つの呼び出しモード

```text
┌─────────────────────────────────────────┐
│           パッケージ関数（便利モード）               │
│  html.Extract(data) → *Result, error    │
│  内部で sync.Pool を使って Processor を再利用       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         Processor（インスタンスモード）             │
│  p, _ := html.New(cfg)                  │
│  defer p.Close()                        │
│  result, err := p.Extract(data)         │
│  ✓ キャッシュ再利用  ✓ 統計収集  ✓ 監査ログ      │
└─────────────────────────────────────────┘
```

### 関数の命名規則

| パターン | 命名 | 例 |
|------|------|------|
| 基本 | `Extract*` | `Extract`, `ExtractText` |
| ファイルから | `Extract*FromFile` | `ExtractFromFile` |
| コンテキスト付き | `Extract*WithContext` | `ExtractWithContext` |
| ファイル+コンテキスト | `Extract*FromFileWithContext` | `ExtractFromFileWithContext` |

### モジュール情報

- **モジュールパス**: `github.com/cybergodev/html`
- **Go バージョン**: 1.25+
- **依存関係**: `golang.org/x/net`, `golang.org/x/text`

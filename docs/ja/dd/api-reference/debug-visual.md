---
title: "デバッグ出力 - CyberGo DD | Print/JSON/Text/Exit"
description: "CyberGo DD デバッグビジュアライゼーション出力関数完全 API ドキュメント。Print フォーマット印刷、JSON 構造化出力、Text プレーンテキスト出力、Exit 致命的終了などクイックデバッグ関数を含み、パッケージレベル関数で直接呼び出し可能。Logger インスタンスを作成せずに使用でき、開発デバッグプロセスを大幅に簡素化。"
---

# デバッグ出力

DD はクイックデバッグ出力関数群を提供し、開発・デバッグ段階でのデータ可視化に使用します。

## パッケージレベル デバッグ関数

`dd.` プレフィックスで直接呼び出し：

### Print シリーズ

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `Print` | `(args ...any)` | グローバルロガーの Writer に出力（LevelInfo、セキュリティフィルタリング対象） |
| `Println` | `(args ...any)` | Print と同じ（内部 Log() で自動改行、セキュリティフィルタリング対象） |
| `Printf` | `(format string, args ...any)` | フォーマット出力（LevelInfo、セキュリティフィルタリング対象） |

```go
dd.Print("値:", 42, true)
dd.Println("Print と同じ動作")
dd.Printf("ユーザー: %s, ID: %d", name, id)
```

:::tip セキュリティフィルタリング
`Print` シリーズの関数は機密データフィルタリングを経るため、機密情報を含む可能性のあるデバッグデータの出力に適しています。
:::

### JSON 出力

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `JSON` | `(data ...any)` | コンパクト JSON フォーマットで stdout に出力（呼び出し元情報付き） |
| `JSONF` | `(format string, args ...any)` | フォーマット文字列をコンパクト JSON として stdout に出力（呼び出し元情報付き） |

```go
user := map[string]any{"name": "admin", "role": "super"}
dd.JSON(user)
// 出力: main.go:42 {"name":"admin","role":"super"}
```

:::warning セキュリティフィルタリングなし
`JSON`/`JSONF` は生データを直接出力し、**セキュリティフィルタリングを経ません**。本番環境では使用しないでください。
:::

### Text 出力

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `Text` | `(data ...any)` | pretty-print フォーマットで stdout に出力 |
| `Textf` | `(format string, args ...any)` | フォーマットテキストを stdout に出力 |

```go
dd.Text(complexData)
dd.Textf("処理結果: %+v", result)
```

### Exit 関数

| 関数 | シグネチャ | 説明 |
|------|------|------|
| `Exit` | `(data ...any)` | 呼び出し元情報付きテキスト出力後に終了（exit code 0）、複雑な型は自動 pretty-print、セキュリティフィルタリングなし |
| `Exitf` | `(format string, args ...any)` | 呼び出し元情報付きフォーマット出力後に終了（exit code 0）、セキュリティフィルタリングなし |

```go
dd.Exit("デバッグブレークポイント", someData)
// 呼び出し元情報付きテキストを出力（複雑な型は自動 pretty-print）して os.Exit(0) を呼び出し
```

## Logger メソッド

Logger インスタンスも同名のメソッドを提供します（Exit/Exitf を除き、パッケージレベル関数のみ利用可能）：

```go
logger := dd.Default()

// Print シリーズは設定された Writer に書き込み（セキュリティフィルタリング対象）
logger.Print("インスタンスメソッド")

// JSON/Text は stdout に直接出力（セキュリティフィルタリングなし）
logger.JSON(data)
logger.Text(data)
```

:::warning Logger メソッドとパッケージレベル関数の違い
`logger.Print()` は現在の Logger インスタンスに設定された Writer に出力しセキュリティフィルタリングを経ます。`dd.Print()` はグローバルロガーの Writer に出力しセキュリティフィルタリングを経ます。両者の動作は似ていますが出力先が異なる場合があります。`logger.JSON()` と `logger.Text()` は `dd.JSON()` と `dd.Text()` と同様に stdout に直接出力し、**セキュリティフィルタリングを経ません**。
:::

## 適用シナリオ

| シナリオ | 推奨関数 |
|------|----------|
| 値のクイック出力 | `dd.Print()` |
| 構造体の確認 | `dd.JSON()` |
| フォーマット出力 | `dd.Text()` |
| デバッグブレークポイント | `dd.Exit()` |
| 機密情報を含む可能性あり | `dd.Print()`（自動フィルタリング） |
| パフォーマンス分析データ | `dd.JSON()` |

:::danger デバッグ専用
これらの関数は開発デバッグ用に設計されており、**本番コードでは使用すべきではありません**。本番環境では `Info`、`Error` などの標準ログメソッドを使用してください。
:::

## 次のステップ

- [Logger](./logger) -- Logger デバッグメソッド
- [パッケージ関数](./functions) -- グローバル関数
- [テスト補助](./recorder) -- LoggerRecorder テストツール

---
title: "監査システム実践 - CyberGo HTML | パイプライン構築"
description: "CyberGo HTML 監査システム実践：基本有効化から多層パイプラインまで、イベント、内蔵 Sink 比較、レベルフィルタ、カスタム Sink、本番監視のベストプラクティスです。"
---

# 監査システム実践

監査システムは HTML 処理中のセキュリティイベントを記録し、潜在的なリスクのモニタリングと調査に役立ちます。

## クイック有効化

最もシンプルな設定、3 行で監査を有効化：

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

p, _ := html.New(cfg)
defer p.Close()
```

有効化後、セキュリティイベントは標準エラーに `[AUDIT] JSON` フォーマットで出力されます。

## 監査イベントタイプ

| イベント | 定数 | レベル | トリガー条件 |
|------|------|------|----------|
| ブロックされたタグ | `blocked_tag` | warning | 危険なタグが削除された（例：`<script>`） |
| ブロックされた属性 | `blocked_attr` | warning | 危険な属性が削除された（例：`onclick`） |
| ブロックされた URL | `blocked_url` | warning | 危険な URL がブロックされた |
| 入力違反 | `input_violation` | critical | 入力がサイズ制限を超過 |
| 深度違反 | `depth_violation` | warning | DOM ネストが制限を超過 |
| 処理タイムアウト | `timeout` | warning | 単一処理がタイムアウト |
| エンコーディングの問題 | `encoding_issue` | info | エンコーディング検出に失敗 |
| パストラバーサル | `path_traversal` | critical | ファイルパスに `..` が含まれる |

## 監査レベル

```text
info < warning < critical
```

- **info**：情報イベント（エンコーディングの問題）、アラート不要
- **warning**：注意が必要な異常（タイムアウト、深度違反）
- **critical**：セキュリティ脅威（入力違反、パストラバーサル）

## 組み込み Sink タイプ

### LoggerAuditSink（デフォルト）

標準エラーに出力、`[AUDIT]` プレフィックス付き：

```go
// デフォルトで stderr に出力
sink := html.NewLoggerAuditSink()

// カスタム Writer に出力
sink := html.NewLoggerAuditSinkWithWriter(os.Stdout)
```

### WriterAuditSink

JSON Lines を `io.Writer` に書き込み、ファイルへの永続化に適しています：

```go
file, _ := os.Create("audit.jsonl")
defer file.Close()

sink := html.NewWriterAuditSink(file)
```

出力フォーマット（1 行に 1 つの JSON）：

```json
{"timestamp":"2026-04-30T10:00:00Z","event_type":"blocked_tag","level":"warning","message":"Blocked dangerous HTML tag: script","tag":"script"}
```

### ChannelAuditSink

チャネルに非同期送信、外部システムとの統合に適しています：

```go
sink := html.NewChannelAuditSink(100)

// 監査イベントを消費
go func() {
    for entry := range sink.Channel() {
        sendToSIEM(entry)
    }
}()

// 破棄されたイベントを確認（チャネルが満杯時は自動的に破棄）
fmt.Printf("破棄: %d\n", sink.DroppedCount())
```

### MultiSink

複数の Sink にファンアウトします：

```go
sink := html.NewMultiSink(
    html.NewWriterAuditSink(file),
    html.NewLoggerAuditSink(),
)
```

### FilteredSink

条件でイベントをフィルタリングします：

```go
// critical レベルのイベントのみ記録
sink := html.NewFilteredSink(
    fileSink,
    func(e html.AuditEntry) bool {
        return e.Level == html.AuditLevelCritical
    },
)
```

### LevelFilteredSink

最低レベルでフィルタリングします：

```go
// warning 以上のみ記録
sink := html.NewLevelFilteredSink(fileSink, html.AuditLevelWarning)
```

## 監査パイプラインの構築

### シナリオ 1：ファイルへの永続化

```go
func newAuditPipeline() html.AuditSink {
    file, _ := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
    return html.NewWriterAuditSink(file)
}

cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = newAuditPipeline()
```

### シナリオ 2：レベル別ルーティング

critical イベントはアラートシステムに送信、その他はファイルに書き込み：

```go
func newTieredPipeline() html.AuditSink {
    file, _ := os.Create("audit.jsonl")

    return html.NewMultiSink(
        // すべてのイベントをファイルに書き込み
        html.NewWriterAuditSink(file),
        // critical イベントは追加でアラートを送信
        html.NewFilteredSink(
            html.NewChannelAuditSink(50),
            func(e html.AuditEntry) bool {
                return e.Level == html.AuditLevelCritical
            },
        ),
    )
}
```

### シナリオ 3：高セキュリティモード

`HighSecurityConfig` と `HighSecurityAuditConfig` を使用：

```go
cfg := html.HighSecurityConfig()
cfg.Audit = html.HighSecurityAuditConfig()
cfg.Audit.Sink = html.NewMultiSink(
    html.NewWriterAuditSink(file),
    html.NewLoggerAuditSink(),
)

p, _ := html.New(cfg)
```

高セキュリティモードの監査の特徴：
- 監査が自動的に有効化
- すべてのイベントタイプを記録
- 生の値を含む（`IncludeRawValues = true`）、フォレンジック分析に役立つ
- 生の値の最大長は 500 文字

## 監査ログの照会

Processor メソッドで収集済みのイベントを照会します：

```go
p, _ := html.New(cfg)
defer p.Close()

// コンテンツを処理
p.Extract(data)

// 監査ログを取得
entries := p.GetAuditLog()
for _, entry := range entries {
    fmt.Printf("[%s] %s: %s\n", entry.Level, entry.EventType, entry.Message)
}

// ログをクリア
p.ClearAuditLog()
```

:::tip メモリ内ログは Processor インスタンスに限定
`GetAuditLog()` が返すのは Processor のメモリに収集されたイベントです。永続化するには Sink を設定してください。
:::

## カスタム Sink

`AuditSink` インターフェースを実装して、監査イベントを任意の宛先に送信します：

```go
type slackSink struct {
    webhook string
}

func (s *slackSink) Write(entry html.AuditEntry) {
    if entry.Level != html.AuditLevelCritical {
        return // critical のみ送信
    }
    msg := fmt.Sprintf("[AUDIT] %s: %s", entry.EventType, entry.Message)
    http.Post(s.webhook, "text/plain", strings.NewReader(msg))
}

func (s *slackSink) Close() error {
    return nil
}
```

## 次のステップ

- [API リファレンス：監査システム](../api-reference/audit) - 完全な API シグネチャ
- [セキュリティ](../security/) - セキュリティ機能の概要
- [本番チェックリスト](../security/production-checklist) - デプロイ前のチェック

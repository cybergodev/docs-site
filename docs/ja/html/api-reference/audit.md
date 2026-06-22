---
title: "監査システム - CyberGo HTML | プラグイン監査 API"
description: "CyberGo HTML プラグイン監査 API：AuditConfig、8 種の監査イベント、3 段階、AuditEntry、Logger・Channel・Writer・Multi・Filtered・LevelFiltered の 6 Sink を提供します。"
---

# 監査システム

HTML ライブラリはプラグイン可能な監査パイプラインを内蔵し、セキュリティイベントと処理異常を記録します。

## AuditConfig

```go
type AuditConfig struct {
    Enabled            bool       `json:"enabled"`             // 監査を有効化
    LogBlockedTags     bool       `json:"log_blocked_tags"`    // ブロックされたタグを記録
    LogBlockedAttrs    bool       `json:"log_blocked_attrs"`   // ブロックされた属性を記録
    LogBlockedURLs     bool       `json:"log_blocked_urls"`    // ブロックされた URL を記録
    LogInputViolations bool       `json:"log_input_violations"` // 入力違反を記録
    LogDepthViolations bool       `json:"log_depth_violations"` // 深度違反を記録
    LogTimeouts        bool       `json:"log_timeouts"`        // タイムアウトを記録
    LogEncodingIssues  bool       `json:"log_encoding_issues"` // エンコーディングの問題を記録
    LogPathTraversal   bool       `json:"log_path_traversal"`  // パストラバーサルの試行を記録
    Sink               AuditSink  `json:"-"`                   // 監査出力先（JSON シリアライズに含まれない）
    IncludeRawValues   bool       `json:"include_raw_values"`  // 生の値を含める
    MaxRawValueLength  int        `json:"max_raw_value_length"` // 生の値の最大長
}
```

## プリセット監査設定

### DefaultAuditConfig

デフォルトの監査設定（デフォルトで無効、すべてのログフラグは true）。

```go
func DefaultAuditConfig() AuditConfig
```

| フィールド | デフォルト値 |
|------|--------|
| `Enabled` | `false` |
| `LogBlockedTags` | `true` |
| `LogBlockedAttrs` | `true` |
| `LogBlockedURLs` | `true` |
| `LogInputViolations` | `true` |
| `LogDepthViolations` | `true` |
| `LogTimeouts` | `true` |
| `LogEncodingIssues` | `true` |
| `LogPathTraversal` | `true` |
| `IncludeRawValues` | `false` |
| `MaxRawValueLength` | `200` |

### HighSecurityAuditConfig

高セキュリティ監査設定。すべてのログと生の値の記録を有効化。

```go
func HighSecurityAuditConfig() AuditConfig
```

| フィールド | デフォルト値 |
|------|--------|
| `Enabled` | `true` |
| `LogBlockedTags` | `true` |
| `LogBlockedAttrs` | `true` |
| `LogBlockedURLs` | `true` |
| `LogInputViolations` | `true` |
| `LogDepthViolations` | `true` |
| `LogTimeouts` | `true` |
| `LogEncodingIssues` | `true` |
| `LogPathTraversal` | `true` |
| `IncludeRawValues` | `true` |
| `MaxRawValueLength` | `500` |

## 型定義

```go
type AuditEventType string  // 監査イベントタイプ
type AuditLevel string      // 監査重大度レベル
```

## 監査イベントタイプ

| 定数 | 値 | 説明 |
|------|------|------|
| `AuditEventBlockedTag` | `"blocked_tag"` | ブロックされたタグ |
| `AuditEventBlockedAttr` | `"blocked_attr"` | ブロックされた属性 |
| `AuditEventBlockedURL` | `"blocked_url"` | ブロックされた URL |
| `AuditEventInputViolation` | `"input_violation"` | 入力違反 |
| `AuditEventDepthViolation` | `"depth_violation"` | 深度違反 |
| `AuditEventTimeout` | `"timeout"` | 処理タイムアウト |
| `AuditEventEncodingIssue` | `"encoding_issue"` | エンコーディングの問題 |
| `AuditEventPathTraversal` | `"path_traversal"` | パストラバーサルの試行 |

## 監査レベル

| 定数 | 値 | 説明 |
|------|------|------|
| `AuditLevelInfo` | `"info"` | 情報レベル |
| `AuditLevelWarning` | `"warning"` | 警告レベル |
| `AuditLevelCritical` | `"critical"` | 重大レベル |

## AuditEntry

監査ログエントリ。

```go
type AuditEntry struct {
    Timestamp time.Time      `json:"timestamp"`          // イベント時刻
    EventType AuditEventType `json:"event_type"`         // イベントタイプ
    Level     AuditLevel     `json:"level"`              // 監査レベル
    Message   string         `json:"message"`            // イベントの説明
    Tag       string         `json:"tag,omitempty"`      // 関連タグ
    Attribute string         `json:"attribute,omitempty"` // 関連属性
    URL       string         `json:"url,omitempty"`      // 関連 URL
    InputSize int            `json:"input_size,omitempty"` // 入力サイズ
    MaxSize   int            `json:"max_size,omitempty"` // サイズ制限
    Depth     int            `json:"depth,omitempty"`    // DOM 深度
    MaxDepth  int            `json:"max_depth,omitempty"` // 深度制限
    Path      string         `json:"path,omitempty"`     // ファイルパス
    RawValue  string         `json:"raw_value,omitempty"` // 生の値
    Metadata  map[string]any `json:"metadata,omitempty"` // 追加メタデータ
}
```

## AuditSink インターフェース

すべての Sink タイプはこのインターフェースを実装します。

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

## Sink タイプ

### LoggerAuditSink

標準エラーに出力、`[AUDIT]` プレフィックス付き。

```go
func NewLoggerAuditSink() *LoggerAuditSink
func NewLoggerAuditSinkWithWriter(w io.Writer) *LoggerAuditSink
```

### ChannelAuditSink

バッファ付きチャネルに送信、非同期処理に適しています。

```go
func NewChannelAuditSink(bufferSize int) *ChannelAuditSink

func (s *ChannelAuditSink) Channel() <-chan AuditEntry
func (s *ChannelAuditSink) DroppedCount() int64
```

```go
sink := html.NewChannelAuditSink(100)
go func() {
    for entry := range sink.Channel() {
        log.Println(entry.Message)
    }
}()
```

### WriterAuditSink

JSON Lines フォーマットで `io.Writer` に書き込みます。

```go
func NewWriterAuditSink(w io.Writer) *WriterAuditSink
```

### MultiSink

複数の Sink にファンアウトします。

```go
func NewMultiSink(sinks ...AuditSink) *MultiSink
```

### FilteredSink

述語関数でエントリをフィルタリングします。

```go
func NewFilteredSink(sink AuditSink, filter func(AuditEntry) bool) *FilteredSink
```

### LevelFilteredSink

最低レベルでフィルタリングします。

```go
func NewLevelFilteredSink(sink AuditSink, minLevel AuditLevel) *LevelFilteredSink
```

## 例

```go
// 多層監査パイプラインの構築
writerSink := html.NewWriterAuditSink(auditFile)
levelSink := html.NewLevelFilteredSink(writerSink, html.AuditLevelWarning)
multiSink := html.NewMultiSink(levelSink, html.NewLoggerAuditSink())

cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = multiSink

p, _ := html.New(cfg)
defer p.Close()

// 処理後に監査ログを取得
entries := p.GetAuditLog()
for _, e := range entries {
    fmt.Printf("[%s] %s: %s\n", e.Level, e.EventType, e.Message)
}
```

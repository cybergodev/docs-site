---
title: "セキュリティ概要 - CyberGo HTML | 保護機能の概要"
description: "CyberGo HTML セキュリティ概要：入力サイズ制限、DOM 深度制限、パストラバーサル防御、パニックリカバリ、タイムアウト、コンテンツクリーニング、監査で errors.Is/As 判定をサポートします。"
---

# セキュリティ概要

HTML ライブラリは設計段階からセキュリティを最優先し、多層防御メカニズムを内蔵しています。

## セキュリティ機能

### 入力サイズ制限

デフォルトの最大入力は 50MB で、メモリ枯渇を防止します：

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB に調整
```

### DOM 深度制限

デフォルトの最大深度は 500 で、再帰爆弾攻撃を防止します：

```go
cfg.MaxDepth = 200 // 制限を厳格化
```

### パストラバーサル防御

ファイル操作はパストラバーサルの試行（例：`../../../etc/passwd`）を自動的に検出してブロックし、監査システムに記録します。

### パニックリカバリ

すべての抽出操作に組み込みの panic リカバリメカニズムがあり、`ErrInternalPanic` エラーを返すため、悪意のある入力によってサービスがクラッシュすることはありません。

### 処理タイムアウト

処理タイムアウトを設定可能で、悪意のある HTML による無限処理を防止します：

```go
cfg.ProcessingTimeout = 10 * time.Second
```

### コンテンツクリーニング

オプションのコンテンツクリーニング機能で、潜在的に悪意のあるタグや属性を除去します：

```go
cfg.EnableSanitization = true
```

## 監査システム

セキュリティ監査の詳細な設定は [監査システム](../api-reference/audit) を参照してください。

監査システムは以下のセキュリティイベントを記録できます：

| イベント | 説明 |
|------|------|
| `AuditEventBlockedTag` | ブロックされた HTML タグ |
| `AuditEventBlockedAttr` | ブロックされた属性 |
| `AuditEventBlockedURL` | ブロックされた URL |
| `AuditEventInputViolation` | 入力サイズ違反 |
| `AuditEventDepthViolation` | DOM 深度違反 |
| `AuditEventPathTraversal` | パストラバーサルの試行 |
| `AuditEventTimeout` | 処理タイムアウト |
| `AuditEventEncodingIssue` | エンコーディング異常 |

## 高セキュリティ設定

```go
cfg := html.HighSecurityConfig()
// 自動的に有効化：制限の縮小、より短いタイムアウト、完全な監査
```

## エラー処理

すべてのセキュリティ違反は明確なエラーを返し、`errors.Is` / `errors.As` による判定をサポートします：

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // 記録して拒否
    case errors.Is(err, html.ErrMaxDepthExceeded):
        // 悪意のある構成の可能性
    case errors.Is(err, html.ErrInternalPanic):
        // パニックリカバリ、入力を確認
    }
}
```

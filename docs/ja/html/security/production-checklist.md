---
title: "本番チェックリスト - CyberGo HTML | 本番前点検"
description: "CyberGo HTML 本番セキュリティチェックリスト：HighSecurityConfig プリセット、Processor ライフサイクル、監査・モニタリング、タイムアウト、エラー処理、リソース・ファイルの注意点です。"
---

# 本番チェックリスト

## 基本設定

- [ ] `HighSecurityConfig()` またはカスタムセキュリティ設定を使用
- [ ] ビジネス要件に応じて適切な `MaxInputSize` を設定
- [ ] 長時間のブロッキングを防止するため `ProcessingTimeout` を設定
- [ ] DOM 深度を制限するため `MaxDepth` を設定
- [ ] コンテンツクリーニングのため `EnableSanitization` を有効化

## Processor ライフサイクル

- [ ] `defer p.Close()` で Processor を確実に解放
- [ ] クローズ後に Processor を使用しない
- [ ] シングルトン Processor でのリソース再利用を検討

```go
p, err := html.New(html.HighSecurityConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

## 監査とモニタリング

- [ ] 監査システムを有効化
- [ ] 適切な監査レベルフィルタリングを設定
- [ ] `WriterAuditSink` で監査ログを永続化
- [ ] `GetStatistics()` のエラーカウントをモニタリング
- [ ] `ErrInternalPanic` エラーと `AuditEventPathTraversal` 監査イベントに注目

```go
auditFile, _ := os.OpenFile("audit.jsonl", os.O_APPEND|os.O_CREATE, 0644)
defer auditFile.Close()

cfg := html.HighSecurityConfig()
cfg.Audit.Sink = html.NewWriterAuditSink(auditFile)
```

## コンテキストとタイムアウト

- [ ] すべての抽出操作で `WithContext` バージョンを使用
- [ ] 適切なコンテキストタイムアウトを設定
- [ ] バッチ操作ではキャンセル付きのコンテキストを使用

```go
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
result, err := html.ExtractWithContext(ctx, data)
```

## エラー処理

- [ ] ビジネスエラーとセキュリティエラーを区別
- [ ] すべての `ErrInputTooLarge` と `ErrMaxDepthExceeded` を記録
- [ ] `ErrInternalPanic` の発生頻度をモニタリング
- [ ] `ErrFileNotFound` では元のエラーメッセージではなく `SafePath()` を確認

## リソース管理

- [ ] バッチ操作は 1 回あたり 10000 件を超えない
- [ ] `WorkerPoolSize` を適切に設定
- [ ] 定期的に `ClearCache()` を呼び出してキャッシュを解放
- [ ] メモリ使用量とキャッシュヒット率をモニタリング

## ファイル処理

- [ ] ファイルパスの提供元を検証（ユーザーによるパス制御を防止）
- [ ] ファイル読み取りディレクトリを制限
- [ ] ファイルサイズを確認してから処理

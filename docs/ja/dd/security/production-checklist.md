---
sidebar_label: "本番チェックリスト"
title: "本番チェックリスト - CyberGo DD | セキュリティリリースチェック"
description: "CyberGo DD 本番デプロイ前のセキュリティチェックリスト。基本設定検証、機密データフィルタの有効化とテスト、監査ログ確認、ローテーション戦略、HMAC 署名設定、ベンチマークチューニング等で安全なコンプライアンス運用を確保し、本番リリースの信頼性を向上。"
sidebar_position: 3
---

# 本番チェックリスト

リリース前に以下のセキュリティ設定を項目ごとにチェックし、ログシステムの安全性と信頼性を確保してください。

## 基本設定

- [ ] **ログレベル** -- 本番環境では `LevelInfo` 以上に設定
- [ ] **出力フォーマット** -- `FormatJSON` を使用してログ収集と分析を容易に
- [ ] **ファイルローテーション** -- 適切なサイズ制限と保持ポリシーを設定
- [ ] **バッファフラッシュ** -- プログラム終了前に `Flush()` または `Close()` を確実に呼び出し

```go
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
})
defer logger.Close()
```

## セキュリティフィルタリング

- [ ] **機密データフィルタリングを有効化** -- `DefaultSecurityConfig()` 以上を使用
- [ ] **カスタムパターン** -- 業務に応じた特定の機密フィールドパターンを追加
- [ ] **フィルタリング統計のモニタリング** -- 定期的にフィルタリング統計をチェックし、異常を発見

```go
logger.SetSecurityConfig(dd.DefaultSecurityConfig())
```

## ファイルセキュリティ

- [ ] **ログ権限** -- ファイル権限 `0600`、ディレクトリ権限 `0700`（ライブラリデフォルト；ディレクトリには実行ビットが必要でないと入れない）
- [ ] **パス検証** -- ログパスがユーザー入力で制御されないことを確認
- [ ] **シンボリックリンク** -- 本番環境でシンボリックリンクを禁止
- [ ] **ディスク容量** -- ローテーションポリシーでディスク満杯を防止

## 監査と整合性

- [ ] **監査ログ** -- セキュリティイベント記録のために監査ログを有効化
- [ ] **整合性署名** -- HMAC 署名を有効にし、ログの改ざんを防止
- [ ] **監査ログの独立保存** -- 監査ログと業務ログを別々に保存

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
```

## パフォーマンス

- [ ] **サンプリング戦略** -- 高スループット環境でのログサンプリングの有効化を検討
- [ ] **バッファ書き込み** -- `BufferedWriter` で I/O 回数を削減
- [ ] **同期書き込みの認識** -- デフォルトの書き込みパスは同期；高スループットシナリオでは `BufferedWriter` でシステムコールを削減
- [ ] **メモリモニタリング** -- ログ関連のメモリ使用量を監視

## ライフサイクル

- [ ] **グレースフルシャットダウン** -- `Close()` ではなく `Shutdown(ctx)` を使用（注意：`Shutdown` は内部でフィルター goroutine を待機しませんが、`Close` は `WaitForFilterGoroutines` を呼び出します。切り替え前に `logger.WaitForFilterGoroutines(...)` を明示的に呼び出し、writer クローズ後にフィルター goroutine がアクセスすることによる競合を回避してください）
- [ ] **タイムアウト設定** -- 適切なシャットダウンタイムアウトを設定（推奨 5-10 秒）
- [ ] **グローバルロガー** -- 繰り返し作成するのではなく `SetDefault()` で置き換え

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
logger.Shutdown(ctx)
```

## コンプライアンスチェック

- [ ] **HIPAA** -- 医療業界では `HealthcareConfig()` を使用
- [ ] **PCI-DSS** -- 金融業界では `FinancialConfig()` を使用
- [ ] **GDPR** -- 個人識別情報（PII）を記録しないことを確認
- [ ] **データ保持** -- 規制に準拠したログ保持期間を設定

## モニタリングとアラート

- [ ] **書き込みエラー** -- `SetWriteErrorHandler` で書き込み失敗をモニタリング
- [ ] **フィルター goroutine** -- `ActiveFilterGoroutines()` の数を監視
- [ ] **監査統計** -- 定期的に監査イベント統計をチェック
- [ ] **エラーコードアラート** -- `PATH_TRAVERSAL`、`REDOS_PATTERN` などのセキュリティエラーコードにアラートを設定

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    metrics.WriteErrors.Inc()
    alert("ログ書き込み失敗: " + err.Error())
})
```

## 次のステップ

- [セキュリティ概要](./) -- セキュリティ機能総覧
- [セキュリティフィルタ API](../api-reference/security-audit/security) -- 設定リファレンス
- [パフォーマンス最適化](../advanced/performance) -- パフォーマンスチューニング

---
title: 本番チェックリスト - CyberGo env | セキュリティリリースチェック
description: CyberGo env ライブラリの本番環境デプロイ前セキュリティチェックの完全なチェックリスト。設定ファイルの権限管理、キーと値の検証ルール設定、監査ログの有効化確認、機密データの安全な処理方法、エラー処理戦略、パフォーマンスとセキュリティパラメータのチューニングなど、重要なセキュリティチェック項目を網羅し、Go アプリケーションが本番環境で継続的に安全かつ安定して稼働することを確保します。
---

# 本番チェックリスト

アプリケーションを本番環境にデプロイする前のチェックリストです。

::: tip セキュリティの概念
セキュリティアーキテクチャとコア機能の詳細は [セキュリティ概要](/ja/env/security/) を参照してください。
:::

## デプロイ前のチェック

### ファイルのセキュリティ

- [ ] `.env.production` ファイルが存在する
- [ ] ファイル権限が `600` またはそれより厳格である
- [ ] 機密ファイルが `.gitignore` に追加されている
- [ ] 設定ファイルにプレースホルダーが含まれていない（例：`change-me`、`xxx`）

```bash
# 権限の確認
ls -la .env.production
# 以下のように表示されるべき: -rw------- (600)

# 権限の修正
chmod 600 .env.production
```

### 設定のバリデーション

- [ ] すべての必須キーが設定されている
- [ ] 機密値が空でない
- [ ] 値の形式が正しい（URL、ポート番号など）
- [ ] ハードコードされたシークレットがない

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{
    "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD",
    "API_KEY", "API_URL",
}
cfg.FailOnMissingFile = true
```

## セキュリティ設定のチェック

### 監査ログ

- [ ] 監査ログが有効になっている
- [ ] ログディレクトリが書き込み可能である
- [ ] ログファイルの権限が正しい

```go
auditFile, _ := os.OpenFile("/var/log/app/audit.log",
    os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
```

### 機密データの処理

- [ ] 機密値の取得に `GetSecure` を使用している
- [ ] 適切に `Close()` を呼び出してリソースを解放している
- [ ] ログに元の機密値を出力していない

```go
secret := loader.GetSecure("DB_PASSWORD")
defer secret.Close()
log.Printf("Password length: %d", secret.Length())
```

### アクセス制御

- [ ] `AllowedKeys` ホワイトリストを設定している（推奨）
- [ ] `ValidateValues` を有効にしている
- [ ] サイズ制限を適切に設定している

```go
cfg.AllowedKeys = []string{"APP_NAME", "DB_HOST", "API_KEY"}
cfg.ValidateValues = true
cfg.MaxVariables = 100
```

## デプロイ時のチェック

- [ ] 設定ファイルを安全な場所から読み込んでいる
- [ ] アプリケーション起動時に設定を検証している
- [ ] 設定エラー時にアプリケーションが起動を拒否する
- [ ] 機密情報がログに出力されていない

## デプロイ後のチェック

- [ ] アプリケーションが正常に動作している
- [ ] 監査ログが正常に書き込まれている
- [ ] 機密情報の漏洩がない
- [ ] 設定関連のエラーを監視している

## クイックチェックスクリプト

```bash
#!/bin/bash
# pre-deploy-check.sh

set -e

echo "=== Pre-deployment Config Check ==="

# ファイルの存在確認
[ -f ".env.production" ] || { echo "ERROR: .env.production not found"; exit 1; }

# 権限の確認
PERMS=$(stat -c %a .env.production 2>/dev/null || stat -f %Lp .env.production)
[ "$PERMS" = "600" ] || [ "$PERMS" = "400" ] || echo "WARNING: permissions are $PERMS"

# プレースホルダーの確認
grep -qE "(change-?me|placeholder|xxx|YOUR_)" .env.production && \
    { echo "ERROR: Found placeholder values"; exit 1; }

# 必須キーの確認
for key in DB_HOST DB_PORT DB_USER DB_PASSWORD API_KEY; do
    grep -q "^$key=" .env.production || { echo "ERROR: Missing $key"; exit 1; }
done

echo "=== All checks passed ==="
```

## 関連ドキュメント

- [セキュリティ概要](/ja/env/security/) - セキュリティアーキテクチャとコア機能
- [SecureValue API](/ja/env/api-reference/secure-value) - セキュア値処理
- [定数とエラー](/ja/env/api-reference/constants) - 禁止キーリスト

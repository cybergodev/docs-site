---
sidebar_label: "本番チェックリスト"
title: "本番チェックリスト - CyberGo env | セキュリティリリースチェック"
description: "CyberGo env 本番デプロイのセキュリティチェックリスト。.env ファイル 600 権限と .gitignore 保護、RequiredKeys/AllowedKeys 必須キー検証、監査ログ有効化、SecureValue 処理、性能パラメータチューニングを扱い、安全なリリースを保証します。"
sidebar_position: 2
---

# 本番チェックリスト

アプリケーションを本番環境にデプロイする前のチェックリスト。

::: tip セキュリティコンセプト
セキュリティアーキテクチャとコア機能の詳細については [セキュリティ概要](/ja/env/security/) を参照してください。
:::

## デプロイ前チェック

### ファイルセキュリティ

- [ ] `.env.production` ファイルが存在する
- [ ] ファイル権限が `600` またはそれより厳格
- [ ] 機密ファイルが `.gitignore` に追加されている
- [ ] 設定ファイルにプレースホルダー（`change-me`、`xxx` など）が含まれていない

```bash
# 権限の確認
ls -la .env.production
# 以下のように表示されるべき: -rw------- (600)

# 権限の修正
chmod 600 .env.production
```

### 設定の検証

- [ ] すべての必須キーが設定されている
- [ ] 機密値が空でない
- [ ] 値のフォーマットが正しい（URL、ポートなど）
- [ ] ハードコードされたシークレットがない

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{
    "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD",
    "API_KEY", "API_URL",
}
cfg.FailOnMissingFile = true
```

## セキュリティ設定チェック

### 監査ログ

- [ ] 監査ログが有効になっている
- [ ] ログディレクトリが書き込み可能
- [ ] ログファイルの権限が正しい

```go
auditFile, _ := os.OpenFile("/var/log/app/audit.log",
    os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
```

### 機密データの処理

- [ ] 機密値に `GetSecure` を使用している
- [ ] `Close()` をタイムリーに呼び出してリソースを解放している
- [ ] ログに元の機密値を出力していない

```go
secret := loader.GetSecure("DB_PASSWORD")
defer secret.Close()
log.Printf("Password length: %d", secret.Length())
```

### アクセス制御

- [ ] `AllowedKeys` ホワイトリストを設定（推奨）
- [ ] `ValidateValues` を有効化
- [ ] サイズ制限を適切に設定

```go
cfg.AllowedKeys = []string{"APP_NAME", "DB_HOST", "API_KEY"}
cfg.ValidateValues = true
cfg.MaxVariables = 100
```

## デプロイ時チェック

- [ ] 設定ファイルが安全な場所から読み込まれている
- [ ] アプリケーション起動時に設定を検証
- [ ] 設定エラー時にアプリケーションが起動を拒否
- [ ] 機密情報がログに出力されていない

## デプロイ後チェック

- [ ] アプリケーションが正常に動作している
- [ ] 監査ログが正常に書き込まれている
- [ ] 機密情報の漏洩がない
- [ ] 設定関連のエラーを監視

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
- [SecureValue API](/ja/env/api-reference/secure-value) - セキュア値の処理
- [定数とエラー](/ja/env/api-reference/constants) - 禁止キーリスト

---
title: "セキュリティ概要 - CyberGo DD | ログセキュリティ"
description: "CyberGo DD ログライブラリのセキュリティ機能の包括的な概要。機密データの自動検出とマスキングフィルタリングメカニズム、ファイルパスセキュリティ検証と防護戦略、非同期監査イベント記録とチェーン追跡能力、HMAC 整合性署名改ざん防止技術、コンプライアンス設定ベストプラクティスガイドを含み、データフィルタリングから監査追跡までログシステムの安全な運用を全面的に保障。"
---

# セキュリティ概要

DD ログライブラリは多層セキュリティ防護メカニズムを組み込みで提供し、データフィルタリングから監査追跡までログの安全性を全面的に保障します。

## セキュリティ階層

| 階層 | メカニズム | 説明 |
|------|------|------|
| データ層 | 機密データフィルタリング | パスワード、キーなどを自動マスキング |
| パス層 | パスセキュリティ検証 | パストラバーサル、シンボリックリンク攻撃を防止 |
| パターン層 | ReDoS 防護 | 危険な正規表現パターンを検出 |
| 監査層 | 監査ログ | 全セキュリティイベントを記録 |
| 整合性層 | HMAC 署名 | ログの改ざんを防止 |

## 機密データフィルタリング

DD は機密データの自動検出とマスキングを組み込みで提供：

```go
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})

// password フィールドは自動マスキング
logger.InfoWith("ログイン",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // 出力: [REDACTED]
)
```

カスタムパターンのサポート：

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,
    `(?i)api[_-]?key\s*[:=]\s*\S+`,
    `\b\d{16,19}\b`,  // クレジットカード番号
)
```

詳細は [セキュリティフィルタ API](../api-reference/security) を参照。

## パスセキュリティ

FileWriter は多層のパスセキュリティ検証を組み込みで提供：

| 防護 | 説明 |
|------|------|
| パストラバーサル | `../` などのパストラバーサルを拒否 |
| Null バイト | null バイトインジェクションを拒否 |
| オーバーロングエンコーディング | UTF-8 オーバーロングエンコーディングを検出 |
| シンボリックリンク | シンボリックリンクを設定で禁止可能 |
| ハードリンク | ハードリンクを設定で禁止可能 |
| パス長さ | パスの最大長を制限 |

```go
// パストラバーサル攻撃は自動拒否
fw, err := dd.NewFileWriter("../../../etc/passwd", dd.DefaultFileWriterConfig())
// err: PATH_TRAVERSAL
```

## コンプライアンス設定

DD は業界コンプライアンスプリセットを提供：

| プリセット | コンプライアンス基準 | 適用業界 |
|------|----------|----------|
| `HealthcareConfig()` | HIPAA | 医療 |
| `FinancialConfig()` | PCI-DSS | 金融 |
| `GovernmentConfig()` | 政府基準 | 公共部門 |

```go
// HIPAA 準拠
logger, _ := dd.New(dd.Config{
    Security: dd.HealthcareConfig(),
})
```

## 監査ログ

全セキュリティイベントは監査ログで追跡可能：

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

audit.LogSecurityViolation("sql_injection", "SQL インジェクション", map[string]any{
    "input": "' OR 1=1 --",
})
```

詳細は [監査ログ API](../api-reference/audit) を参照。

## ログ整合性

HMAC 署名でログの改ざんを防止：

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
signature := signer.Sign(logMessage)
// 検証時: signer.Verify(signedEntry)
```

詳細は [整合性署名 API](../api-reference/integrity) を参照。

## 次のステップ

- [本番チェックリスト](./production-checklist) -- リリース前セキュリティチェック
- [セキュリティフィルタ API](../api-reference/security) -- SensitiveDataFilter 詳解
- [監査ログ API](../api-reference/audit) -- AuditLogger 詳解

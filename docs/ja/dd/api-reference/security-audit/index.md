---
sidebar_label: "概要"
title: "セキュリティと監査 - CyberGo DD | API 概要"
description: "CyberGo DD セキュリティおよび監査 API の概要。SensitiveDataFilter による機密データフィルタリング、AuditLogger による非同期監査ログ、IntegritySigner による HMAC 整合性署名の 3 つのコアコンポーネントの役割、関係、適用シナリオを説明します。"
sidebar_position: 1
---

# セキュリティと監査

DD のセキュリティ体系は、データマスキングから監査トレーサビリティまでの全体的な流れをカバーする、3 つの独立しながらも補完し合うコンポーネントで構成されています。

## コンポーネント概要

| コンポーネント | 役割 | 典型的なユースケース |
|---------------|------|---------------------|
| [SensitiveDataFilter](./security) | ログ内の機密情報を自動検出してマスキング | パスワード、API キー、クレジットカード番号の漏洩防止 |
| [AuditLogger](./audit) | セキュリティ関連イベントを非同期で記録 | コンプライアンス監査、セキュリティ分析、侵入検知 |
| [IntegritySigner](./integrity) | HMAC 署名によるログの改ざん防止 | ログ改ざん防止、事後調査、コンプライアンス証憑 |

## 3 つのコンポーネントの関係

```text
ログ書き込みフロー:

  Logger.InfoWith(...)
       │
       ├─→ SensitiveDataFilter ──→ フィールド値をマスキング（パスワード → [REDACTED]）
       │         │
       │         └─→ AuditLogger ──→ マスキングイベントを非同期記録（どのログで何がフィルタリングされたか）
       │
       └─→ フォーマット出力
AuditLogger（IntegritySigner はオプション）──→ 監査イベントを HMAC 署名（改ざん防止）
```

- **SensitiveDataFilter** はログ書き込み**前**に機密データをインターセプトします
- **AuditLogger** はセキュリティイベントを非同期で記録し、メインログのパフォーマンスに影響を与えません
- **IntegritySigner** は**通常のログ書き込みパスには組み込まれていません**：**監査イベント**のみに署名します（`AuditConfig.IntegritySigner` 経由で接続）、またはユーザーが `Sign`/`SignFields` を手動で呼び出して任意の内容に署名します

## クイック選択

| ニーズ | 推奨コンポーネント |
|--------|-------------------|
| パスワード/キーの漏洩防止 | [SensitiveDataFilter](./security) |
| 誰がいつ何をしたかを記録 | [AuditLogger](./audit) |
| ログが改ざんされていないことを保証 | [IntegritySigner](./integrity) |
| HIPAA/PCI-DSS コンプライアンス | 3 つすべてを組み合わせて使用 — [業界コンプライアンス設定](../../guides/security/compliance)を参照 |

## 関連ガイド

- [機密データフィルタリング](../../guides/security/sensitive-filtering) -- 自動マスキング設定チュートリアル
- [監査ログ](../../guides/security/audit-logging) -- セキュリティ監査の実践ガイド
- [HMAC 署名の実践](../../guides/security/integrity) -- 整合性署名の応用
- [業界コンプライアンス設定](../../guides/security/compliance) -- HIPAA/PCI-DSS プリセット
- [本番チェックリスト](../../guides/security/production-checklist) -- リリース前セキュリティチェック

## 次のステップ

- [セキュリティフィルタリング](./security) -- SensitiveDataFilter 完全 API
- [監査ログ](./audit) -- AuditLogger 完全 API
- [整合性署名](./integrity) -- IntegritySigner 完全 API

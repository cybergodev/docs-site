---
title: "セキュリティ概要 - CyberGo env | セキュリティアーキテクチャ"
description: "CyberGo env セキュリティアーキテクチャの包括的な概要。SecureValue メモリロック保護と mlock システムコールメカニズム、キーと値の検証フィルタリングルール設定、DefaultForbiddenKeys 禁止キー名リスト、機密データ IsSensitiveKey 自動検出、セキュリティレベルプリセット設定、監査ログ追跡などのコアセキュリティ機能を解説します。"
---

# セキュリティ概要

環境変数には機密情報が格納されることが多く、安全な取り扱いが極めて重要です。このドキュメントでは、env ライブラリのセキュリティアーキテクチャとコア機能の概要を説明します。

## セキュリティアーキテクチャ

```text
┌──────────────────────────────────────────────────────────────┐
│                          アプリケーション層                      │
├──────────────────────────────────────────────────────────────┤
│   SecureValue   │    マスク    │    ゼロクリア    │   メモリロック        │
├──────────────────────────────────────────────────────────────┤
│                          Loader 層                            │
├──────────────────────────────────────────────────────────────┤
│     キー検証      │   値検証   │   禁止キー   │   サイズ制限         │
├──────────────────────────────────────────────────────────────┤
│                          解析層                              │
├──────────────────────────────────────────────────────────────┤
│    フォーマット検出     │  展開チェック  │       パス検証                  │
└──────────────────────────────────────────────────────────────┘
```

## コアセキュリティ機能

| 機能 | 説明 | ドキュメント |
|------|------|------|
| **SecureValue** | 機密値のメモリ保護、自動ゼロクリア | [SecureValue API](/ja/env/api-reference/secure-value) |
| **禁止キー** | システム重要変数の変更を防止 | [定数とエラー](/ja/env/api-reference/constants#defaultforbiddenkeys) |
| **機密キー検出** | 機密設定キーの自動識別 | [定数とエラー](/ja/env/api-reference/constants#sensitivekeypatterns) |
| **値検証** | 制御文字、ヌルバイトなどの検出 | [Config API](/ja/env/api-reference/config) |
| **監査ログ** | 完全な操作追跡 | [コンポーネントファクトリー](/ja/env/api-reference/factory#オーディットプロセッサーファクトリー) |

## SecureValue の紹介

機密データの場合、`GetString` ではなく `GetSecure` を使用します：

```go
// 非推奨
password := env.GetString("DB_PASSWORD")

// 推奨
secret := env.GetSecure("DB_PASSWORD")
defer secret.Close()
password := secret.String()
```

**コア機能：**
- **メモリロック** - ディスクへのスワップを防止（Linux/macOS/FreeBSD）
- **自動ゼロクリア** - `Close()` 時にメモリを安全に消去
- **マスク表示** - `Masked()` はログ出力に使用
- **スレッドセーフ** - 並行読み取りをサポート

::: tip 完全な API
詳細は [SecureValue API](/ja/env/api-reference/secure-value) を参照してください。
:::

## キー/値検証

### キー検証

デフォルトのキー名ルール：`^[A-Za-z][A-Za-z0-9_]*$`

- アルファベットで始まる
- アルファベット、数字、アンダースコアのみ含む
- 長さは `MaxKeyLength` を超えない

### 禁止キー

組み込み禁止キーにより、システム重要変数の変更を防止します：

| カテゴリ | 例 | リスク |
|------|------|------|
| システムパス | `PATH`, `LD_LIBRARY_PATH` | コマンド/ライブラリハイジャック |
| 動的リンク | `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` | 悪意あるライブラリの注入 |
| Shell | `SHELL`, `IFS`, `BASH_ENV` | Shell ハイジャック |
| 言語ランタイム | `PYTHONPATH`, `NODE_PATH` | モジュールハイジャック |

::: tip 完全なリスト
完全な禁止キーリストについては [DefaultForbiddenKeys](/ja/env/api-reference/constants#defaultforbiddenkeys) を参照してください。
:::

### 値検証

値検証を有効にすると、潜在的な危険を検出します：

```go
cfg := env.ProductionConfig()
cfg.ValidateValues = true  // 制御文字、ヌルバイトなどを検出
```

## ファイルセキュリティの基礎

### ファイル権限

```bash
# 所有者のみ読み書き可能
chmod 600 .env

# またはより厳格に（読み取り専用）
chmod 400 .env
```

### Git で無視

```bash
.env
.env.local
.env.*.local
*.pem
*.key
```

## 設定セキュリティレベル

| プリセット | 用途 | 特徴 |
|------|------|------|
| `DevelopmentConfig()` | 開発環境 | 緩やかな制限、YAML 構文サポート |
| `TestingConfig()` | テスト環境 | 既存変数の上書き、テスト分離 |
| `ProductionConfig()` | 本番環境 | 厳格な検証 + 監査ログ、既存変数の上書きなし |

```go
// 本番環境の推奨設定
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT", "DB_HOST", "API_KEY"}
```

## 関連ドキュメント

- [SecureValue API](/ja/env/api-reference/secure-value) - セキュア値処理の完全な API
- [定数とエラー](/ja/env/api-reference/constants) - 禁止キーの完全なリスト、機密キーパターン
- [本番チェックリスト](/ja/env/security/production-checklist) - リリース前のセキュリティチェック

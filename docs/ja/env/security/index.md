---
title: セキュリティ概要 - CyberGo env | セキュリティアーキテクチャ
description: CyberGo env 環境変数管理ライブラリのセキュリティアーキテクチャの包括的な概要。SecureValue メモリロック保護メカニズム、キーと値の内容検証とフィルタリングルール、禁止キー名リスト、設定セキュリティレベルの設定、機密データの自動検出、監査ログ追跡などのコアセキュリティ機能を含み、Go アプリケーションの環境変数のライフサイクル全体におけるセキュリティを確保します。
---

# セキュリティ概要

環境変数には機密情報が保存されることが多く、安全な処理が極めて重要です。このドキュメントでは env ライブラリのセキュリティアーキテクチャとコア機能について概要を説明します。

## セキュリティアーキテクチャ

```text
┌──────────────────────────────────────────────────────────────┐
│                        アプリケーション層                       │
├──────────────────────────────────────────────────────────────┤
│   SecureValue   │    マスク    │    ゼロクリア    │   メモリロック  │
├──────────────────────────────────────────────────────────────┤
│                         Loader 層                             │
├──────────────────────────────────────────────────────────────┤
│   キー検証      │   値の検証   │   禁止キー   │   サイズ制限     │
├──────────────────────────────────────────────────────────────┤
│                          パース層                              │
├──────────────────────────────────────────────────────────────┤
│  フォーマット検出  │  展開チェック  │     パス検証               │
└──────────────────────────────────────────────────────────────┘
```

## コアセキュリティ機能

| 機能 | 説明 | ドキュメント |
|------|------|------|
| **SecureValue** | 機密値のメモリ保護、自動ゼロクリア | [SecureValue API](/ja/env/api-reference/secure-value) |
| **禁止キー** | システム重要変数の変更を防止 | [定数とエラー](/ja/env/api-reference/constants#defaultforbiddenkeys) |
| **機密キー検出** | 機密設定キーの自動識別 | [定数とエラー](/ja/env/api-reference/constants#sensitivekeypatterns) |
| **値の検証** | 制御文字、ヌルバイトなどの検出 | [Config API](/ja/env/api-reference/config) |
| **監査ログ** | 完全な操作追跡 | [コンポーネントファクトリー](/ja/env/api-reference/factory#監査プロセッサファクトリー) |

## SecureValue の紹介

機密データには `GetString` ではなく `GetSecure` を使用します：

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

## キー/値の検証

### キーのバリデーション

デフォルトのキー名ルール：`^[A-Za-z][A-Za-z0-9_]*$`

- 英字で始まる
- 英字、数字、アンダースコアのみを含む
- 長さは `MaxKeyLength` を超えない

### 禁止キー

組み込みの禁止キーにより、システム重要変数の変更を防止します：

| カテゴリ | 例 | リスク |
|------|------|------|
| システムパス | `PATH`, `LD_LIBRARY_PATH` | コマンド/ライブラリのハイジャック |
| 動的リンク | `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` | 悪意のあるライブラリの注入 |
| Shell | `SHELL`, `IFS`, `BASH_ENV` | Shell のハイジャック |
| 言語ランタイム | `PYTHONPATH`, `NODE_PATH` | モジュールのハイジャック |

::: tip 完全なリスト
完全な禁止キーリストは [DefaultForbiddenKeys](/ja/env/api-reference/constants#defaultforbiddenkeys) を参照してください。
:::

### 値の検証

値の検証を有効にして潜在的な危険を検出します：

```go
cfg := env.ProductionConfig()
cfg.ValidateValues = true  // 制御文字、ヌルバイトなどを検出
```

## ファイルセキュリティの基本

### ファイル権限

```bash
# 所有者のみ読み書き可能
chmod 600 .env

# またはより厳格に（読み取り専用）
chmod 400 .env
```

### Git で除外

```bash
.env
.env.local
.env.*.local
*.pem
*.key
```

## 設定のセキュリティレベル

| プリセット | 用途 | 特徴 |
|------|------|------|
| `DevelopmentConfig()` | 開発環境 | 緩やかな制限、YAML 構文をサポート |
| `TestingConfig()` | テスト環境 | 既存変数の上書き、テスト分離 |
| `ProductionConfig()` | 本番環境 | 厳格な検証 + 監査ログ、既存変数を上書きしない |

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

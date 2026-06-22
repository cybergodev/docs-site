---
title: "クイックスタート - CyberGo env | 5分で始める入門ガイド"
description: "CyberGo env の5分クイックスタート。go get インストールから .env 読み込み、型安全読み取り、構造体マッピング、変数展開まで、実行可能なコード例付きで素早く習得できます。"
---

# クイックスタート

5 分で env ライブラリを使い始めましょう。インストールから実際の使用まで。

## インストール

```bash
go get github.com/cybergodev/env
```

::: tip 要件
Go 1.25+
:::

## .env ファイルの作成

プロジェクトのルートディレクトリに `.env` ファイルを作成します：

```bash
# データベース設定
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=secret

# アプリケーション設定
DEBUG=true
APP_NAME=myapp
LOG_LEVEL=info

# 複数値（カンマ区切り）
ALLOWED_HOSTS=localhost,example.com,api.example.com
```

## 最もシンプルな使い方

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // .env ファイルを読み込み、システム環境に適用
    if err := env.Load(".env"); err != nil {
        panic(err)
    }

    // 環境変数の取得
    host := env.GetString("DB_HOST", "localhost")
    port := env.GetInt("DB_PORT", 5432)

    fmt.Printf("Server: %s:%d\n", host, port)
}
```

## 値の読み取り - すべての型

### 基本型

```go
// === デフォルト値あり ===

// 文字列 - 見つからない場合はデフォルト値 "localhost" を返す
host := env.GetString("HOST", "localhost")

// 整数 (int64) - 見つからない場合はデフォルト値 8080 を返す
port := env.GetInt("PORT", 8080)

// ブール値 - 見つからない場合はデフォルト値 false を返す
debug := env.GetBool("DEBUG", false)

// 時間間隔 - 見つからない場合はデフォルト値 30s を返す
timeout := env.GetDuration("TIMEOUT", 30*time.Second)


// === デフォルト値なし ===

// 文字列 - 見つからない場合は空文字列 "" を返す
host := env.GetString("HOST")

// 整数 (int64) - 見つからない場合は 0 を返す
port := env.GetInt("PORT")

// ブール値 - 見つからない場合は false を返す
debug := env.GetBool("DEBUG")

// 時間間隔 - 見つからない場合は 0 を返す
timeout := env.GetDuration("TIMEOUT")
```

::: tip キー名の解決
ライブラリは複数のキー名アクセスメソッドをサポートしています：

```go
// JSON: {"app": {"name": "myapp"}}
// 格納形式: APP_NAME=myapp

// 以下のメソッドで値にアクセス可能
name := env.GetString("APP_NAME")      // フラット化キー名（推奨）
name := env.GetString("app.name")      // ドットパス（自動変換）
name := env.GetString("APP.NAME")      // 大文字ドットパス
```

**解決ルール：**
1. **完全一致**：キー名 `KEY` を優先的に検索
2. **大文字変換**：小文字キー名は大文字バージョンを試行 `key` → `KEY`
3. **パス解決**：ドットパスをアンダースコアに変換 `app.name` → `APP_NAME`
:::

### ブール値のサポート

`GetBool` は以下の値をサポートします（大文字小文字を区別しない）：

| 真の値 | 偽の値 |
|------|------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

### スライス型

```go
// 文字列スライス
hosts := env.GetSlice[string]("HOSTS", []string{"localhost"})

// 整数スライス（int, int64, uint, uint64 をサポート）
ports := env.GetSlice[int64]("PORTS", []int64{80, 443})
portsInt := env.GetSlice[int]("PORTS")  // int 型もサポート

// 浮動小数点スライス
rates := env.GetSlice[float64]("RATES", []float64{0.1, 0.2})

// ブールスライス
flags := env.GetSlice[bool]("FLAGS", []bool{true, false})

// Duration スライス
timeouts := env.GetSlice[time.Duration]("TIMEOUTS")
```

**解析順序：**
1. インデックスキー `KEY_0`, `KEY_1`, `KEY_2`... を優先的に検索
2. インデックスキーがない場合、カンマ区切りで `KEY` の値を解析

```go
// メソッド 1：インデックスキー（推奨）
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// メソッド 2：カンマ区切り
// PORTS=80,443,8080
ports := env.GetSlice[int64]("PORTS")  // [80, 443, 8080]
```

### 検索と確認

```go
// キーが存在するか確認
value, exists := env.Lookup("API_KEY")
if !exists {
    // キーが存在しない
}

// すべてのキーを取得
keys := env.Keys()

// すべてのキーと値のペアを取得
all := env.All()

// 変数の数を取得
count := env.Len()
```

### セキュア値

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // 元の値を取得（平文が必要な場合のみ呼び出し、例: 暗号化、API呼び出し）
    value := secret.Reveal()

    // ログ用マスク（漏洩防止）
    log.Printf("API Key: %s", secret.Masked())  // 出力: [SECURE:32 bytes]
}
```

## 構造体マッピング

タグを使用して環境変数を構造体にマッピングします：

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/env"
)

type Config struct {
    Host     string        `env:"DB_HOST" envDefault:"localhost"`
    Port     int64         `env:"DB_PORT" envDefault:"5432"`
    Password string        `env:"DB_PASSWORD"`
    Debug    bool          `env:"DEBUG" envDefault:"false"`
    Timeout  time.Duration `env:"TIMEOUT" envDefault:"30s"`
    Hosts    []string      `env:"ALLOWED_HOSTS" envSeparator:","`
}

func main() {
    env.Load(".env")

    var cfg Config
    if err := env.ParseInto(&cfg); err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", cfg)
}
```

::: details 詳細
[構造体マッピング](/ja/env/guides/struct-mapping) ガイドを参照してください。
:::

## 設定プリセット

ライブラリは4つのプリセット設定を提供し、異なるシナリオに対応します：

| プリセット | 用途 | 特徴 |
|------|------|------|
| `DefaultConfig()` | 汎用シナリオ | 安全なデフォルト値、ほとんどの場合に適しています |
| `DevelopmentConfig()` | 開発環境 | 緩やかな制限、上書きを許可 |
| `TestingConfig()` | テスト環境 | コンパクトな制限、上書きを許可、ユニットテストに適しています |
| `ProductionConfig()` | 本番環境 | 厳格な検証 + 監査ログ |

```go
// 開発環境 - 緩やかな制限
cfg := env.DevelopmentConfig()

// テスト環境 - コンパクトな制限
cfg := env.TestingConfig()

// 本番環境 - 厳格な検証 + 監査ログ
cfg := env.ProductionConfig()
```

### プリセットの詳細比較

| 機能 | Default | Development | Testing | Production |
|------|---------|-------------|---------|------------|
| 既存変数の上書き | ✗ | ✓ | ✓ | ✗ |
| ファイル不在時のエラー | ✗ | ✗ | ✗ | ✓ |
| 監査ログ | ✗ | ✗ | ✗ | ✓ |
| YAML 構文 | ✗ | ✓ | ✗ | ✗ |
| ファイルサイズ制限 | 2MB | 10MB | 64KB | 64KB |
| 最大変数数 | 500 | 500 | 50 | 50 |
| 禁止キーチェック | ✓ | ✓ | ✓ | ✓ |
| 値の検証 | ✓ | ✓ | ✓ | ✓ |

::: tip 選択のヒント
- **開発環境**：`DevelopmentConfig()` を使用、緩やかな制限で迅速なイテレーションが可能
- **テスト環境**：`TestingConfig()` を使用、上書きを許可しテスト分離が可能
- **本番環境**：`ProductionConfig()` を使用、監査と厳格な検証を有効化
:::

## マルチ環境設定

### 環境別読み込み

```go
// 環境に応じて設定ファイルを決定
goEnv := os.Getenv("GO_ENV")
if goEnv == "" {
    goEnv = "development"
}

// 1 回の呼び出しですべての設定ファイルを読み込み（順番に、後から読み込んだものが先のものを上書き）
env.Load(".env", ".env."+goEnv, ".env.local")
```

### Loader インスタンスの使用

より詳細な制御が必要な場合、Loader インスタンスを使用します：

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // 設定の作成
    cfg := env.ProductionConfig()
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    // ローダーの作成
    loader, err := env.New(cfg)
    if err != nil {
        panic(err)
    }
    defer loader.Close()

    // ファイルの読み込み（順番に、後から読み込んだものが先のものを上書き）
    if err := loader.LoadFiles(".env", ".env.production"); err != nil {
        panic(err)
    }

    // 必須キーの検証
    if err := loader.Validate(); err != nil {
        panic(err)
    }

    // 使用
    host := loader.GetString("DB_HOST")
    fmt.Println("Host:", host)
}
```

## マルチファイルとマルチフォーマット

### マルチファイル読み込み

順番に読み込み、後から読み込んだものが先のものを上書きします：

```go
// パッケージレベル関数
env.Load(".env", "config.json", "config.yaml")

// Loader インスタンス
loader.LoadFiles(".env", ".env.local")
```

### マルチフォーマットサポート

ファイル形式を自動検出：

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

::: details サポートされる形式
| 形式 | 拡張子 | 検出メソッド |
|------|--------|----------|
| .env | `.env` | ファイル拡張子 |
| JSON | `.json` | ファイル拡張子 |
| YAML | `.yaml`, `.yml` | ファイル拡張子 |
:::

## エラー処理

```go
import "errors"

err := loader.LoadFiles(".env")
if err != nil {
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        // ファイルが存在しない
    case errors.Is(err, env.ErrFileTooLarge):
        // ファイルが大きすぎる
    case errors.Is(err, env.ErrForbiddenKey):
        // 禁止キー
    case errors.Is(err, env.ErrInvalidKey):
        // 無効なキー形式
    default:
        // その他のエラー
    }
}
```

::: details 詳細なエラー情報の取得
```go
// 解析エラーの詳細
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("ファイル %s の %d 行目: %v\n", parseErr.File, parseErr.Line, parseErr.Err)
}

// ファイルエラーの詳細
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("ファイル %s の操作 %s に失敗: %v\n", fileErr.Path, fileErr.Op, fileErr.Err)
}

// セキュリティエラーの詳細
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("セキュリティエラー: %s - %s\n", secErr.Action, secErr.Reason)
}
```
:::

## 次のステップ

<div class="vp-features">

### さらに学ぶ
- [構造体マッピング](/ja/env/guides/struct-mapping) - 詳細な設定バインディング
- [シリアライズ](/ja/env/guides/serialization) - 設定のシリアライズとデシリアライズ
- [マルチフォーマット設定](/ja/env/guides/multi-format) - JSON/YAML 詳解
- [テストシナリオ](/ja/env/guides/testing) - テストでの使用メソッド

### API リファレンス
- [パッケージ関数](/ja/env/api-reference/functions) - パッケージレベル関数の完全なリスト
- [Loader API](/ja/env/api-reference/loader) - ローダーメソッド
- [Config API](/ja/env/api-reference/config) - 設定オプション

### セキュリティ
- [セキュリティ概要](/ja/env/security/) - セキュリティアーキテクチャとベストプラクティス
- [SecureValue API](/ja/env/api-reference/secure-value) - セキュア値処理

</div>

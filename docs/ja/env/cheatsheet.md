---
title: "チートシート - CyberGo env | よく使う API 速査"
description: "CyberGo env のよく使う API チートシート。ファイル読み込み、型読み取り、検証、SecureValue、シリアライズ、監査ログなど高頻度操作のコアコードを1ページにまとめました。"
---

# チートシート

このライブラリについて基本的な理解があることを前提に、高頻度で使用されるコードスニペットを素早く参照できます。

## 設定の読み込み

```go
// パッケージレベルで読み込み
env.Load(".env")                                        // .env ファイルを読み込み
env.Load(".env", ".env.local", "config.json")          // マルチファイル

// ローダーで読み込み
loader, _ := env.New()
loader.LoadFiles("config.json")                         // JSON
loader.LoadFiles("config.yaml")                         // YAML
loader.LoadFiles(".env", ".env.local", "config.json")   // マルチファイル
```

## 値の読み取り

```go
// 基本型
env.GetString("KEY", "default")
env.GetInt("PORT", 8080)              // int64 を返す
env.GetBool("DEBUG", false)
env.GetDuration("TIMEOUT", 30*time.Second)

// スライス（KEY_0,KEY_1 インデックス形式またはカンマ区切りをサポート）
env.GetSlice[string]("HOSTS", []string{"localhost"})
env.GetSlice[int64]("PORTS", []int64{80})
env.GetSlice[int]("PORTS", []int{80})          // int もサポート
env.GetSlice[float64]("RATES", []float64{0.1})

// Loader からスライスを取得
env.GetSliceFrom[string](loader, "HOSTS")
env.GetSliceFrom[int64](loader, "PORTS")

// クエリ
val, ok := env.Lookup("KEY")
keys := env.Keys()
all := env.All()
count := env.Len()

// セキュア値
secret := env.GetSecure("PASSWORD")
if secret != nil {
    defer secret.Release()  // または secret.Close()
    value := secret.Reveal()
    masked := secret.Masked()
}
```

## キー名の解決

```go
// JSON: {"app": {"name": "myapp"}}
// 格納形式: APP_NAME=myapp

// 以下のメソッドでアクセス可能
env.GetString("APP_NAME")      // フラット化キー名（推奨）
env.GetString("app.name")      // ドットパス
env.GetString("APP.NAME")      // 大文字ドットパス

// 配列インデックス
env.GetString("servers.0.host")  // SERVERS_0_HOST
```

| 入力 | 変換結果 |
|------|--------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

## 構造体マッピング

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS" envSeparator:","`
    Ignored string   `env:"-"`
}

cfg := Config{}
env.ParseInto(&cfg)
```

## 設定プリセット

| プリセット | 用途 | 特徴 |
|------|------|------|
| `DefaultConfig()` | 汎用 | 安全なデフォルト値 |
| `DevelopmentConfig()` | 開発 | 緩やかな制限、YAML 構文サポート、10MB ファイル上限 |
| `TestingConfig()` | テスト | 既存変数の上書き、テスト分離、64KB ファイル上限 |
| `ProductionConfig()` | 本番 | 厳格な検証 + 監査、既存変数の上書きなし、64KB ファイル上限 |

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT"}
```

## Loader インスタンス

```go
loader, _ := env.New(cfg)
defer loader.Close()

loader.LoadFiles(".env")
loader.GetString("KEY")
loader.Set("KEY", "value")
loader.Delete("KEY")
loader.Keys()
loader.All()
loader.Validate()
loader.Apply()  // os.Environ に適用
loader.Len()    // 変数の数
loader.LoadTime() // 最終読み込み時刻
loader.IsApplied() // システム環境に適用済みかどうか
loader.IsClosed()  // クローズ済みかどうか
loader.Config()    // 設定を取得
```

## エラー処理

```go
import "errors"

// センチネルエラー
errors.Is(err, env.ErrFileNotFound)
errors.Is(err, env.ErrFileTooLarge)
errors.Is(err, env.ErrForbiddenKey)
errors.Is(err, env.ErrInvalidKey)
errors.Is(err, env.ErrClosed)
errors.Is(err, env.ErrAlreadyInitialized)

// 構造化エラー
var parseErr *env.ParseError
errors.As(err, &parseErr)
// parseErr.File, parseErr.Line

var fileErr *env.FileError
errors.As(err, &fileErr)
// fileErr.Path, fileErr.Size, fileErr.Limit

var secErr *env.SecurityError
errors.As(err, &secErr)
// secErr.Action, secErr.Reason
```

## セキュリティツール

```go
// 機密値
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
}

// マスク
log.Printf("Key: %s", secret.Masked())
log.Printf("Key: %s", env.MaskValue("API_KEY", "secret"))

// 検出
env.IsSensitiveKey("PASSWORD")  // true
env.IsMemoryLockSupported()     // Linux/macOS/Windows: true

// クリア
env.ClearBytes(sensitiveData)
clean := env.SanitizeForLog(msg)

// キー名マスク
masked := env.MaskKey("DB_PASSWORD")  // "DB***"
```

## マルチ環境

```go
goEnv := os.Getenv("GO_ENV")
if goEnv == "" { goEnv = "development" }
env.Load(".env", ".env."+goEnv, ".env.local")  // 1 回の呼び出し、後が前を上書き
```

## マルチフォーマット

```go
// 読み込み
loader.LoadFiles("config.env", "config.json", "config.yaml")

// フォーマット検出
format := env.DetectFormat("config.json")  // FormatJSON

// シリアライズ
env.Marshal(data, env.FormatEnv)
env.Marshal(data, env.FormatJSON)
env.Marshal(data, env.FormatYAML)

// デシリアライズ
env.UnmarshalMap(data, env.FormatEnv)
env.UnmarshalMap(data, env.FormatAuto)  // 自動検出
```

## .env 構文

```bash
# コメント
KEY=value
KEY="value with spaces"
KEY='literal ${noexpand}'
KEY=${OTHER_KEY}           # 変数参照
KEY=${MISSING:-default}    # デフォルト値（変数が存在しない場合に使用）
KEY=${MISSING:=default}    # デフォルト値（変数が存在しない場合に使用、:- と同じ）
KEY=${MISSING:?error}      # エラープロンプト（変数が存在しないまたは空の場合にエラー）
export KEY=value           # bash スタイル
KEY=$$                     # ドル記号のエスケープ
```

## ブール値

| 真の値 | 偽の値 |
|------|------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

## 時間形式

```bash
TIMEOUT=30s
INTERVAL=5m
DURATION=1h30m
```

## 制限定数

| 制限項目 | デフォルト値 | ハードリミット |
|--------|--------|----------|
| ファイルサイズ | 2 MB | 100 MB |
| 行の長さ | 1 KB | 64 KB |
| キーの長さ | 64 | 1024 |
| 値の長さ | 4 KB | 1 MB |
| 変数数 | 500 | 10000 |
| 展開深度 | 5 | 20 |

## テスト

```go
func TestExample(t *testing.T) {
    cfg := env.TestingConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.Set("KEY", "value")
    // テスト...
}

func TestMain(m *testing.M) {
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("warning: %v", err)
    }
    os.Exit(m.Run())
}
```

## 組み込み禁止キー

以下のキー名はデフォルトで設定が禁止されています：

| カテゴリ | キー名 |
|------|------|
| システムパス | `PATH` |
| Linux 動的リンク | `LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_DEBUG`, `LD_AUDIT`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| 言語ランタイム | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

## インターフェース型

```go
// 細粒度インターフェース
// env.EnvFileLoader    // LoadFiles
// env.EnvGetter        // GetString, Lookup, Keys, All
// env.EnvSetter        // Set, Delete
// env.EnvApplicator    // Apply
// env.EnvCloser        // Close

// 複合インターフェース
// env.EnvLoader        // 上記すべてを組み合わせ
```

## 関連ドキュメント

- [クイックスタート](/ja/env/getting-started) - 完全なチュートリアル
- [パッケージ関数](/ja/env/api-reference/functions) - 詳細な API
- [Loader API](/ja/env/api-reference/loader) - Loader メソッド
- [Config API](/ja/env/api-reference/config) - 設定オプション
- [エラー処理](/ja/env/advanced/error-handling) - エラー処理パターン

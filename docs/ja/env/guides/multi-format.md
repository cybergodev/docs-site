---
title: "マルチフォーマット設定 - CyberGo env | .env/JSON/YAML"
description: "CyberGo env ライブラリのマルチフォーマット設定ファイル読み込み完全ガイド。.env、JSON、YAML 3種類のフォーマットの自動検出と混合読み込みをサポート。キー値マージ優先順位ルール、フォーマット相互変換ユーティリティ関数、JSON/YAML 専用設定オプションを詳解。Go 開発者がマイクロサービスやコンテナ化シナリオで環境設定を柔軟に管理・切り替えるのに役立つ。"
---

# マルチフォーマット設定

env ライブラリは `.env`、JSON、YAML 3種類の設定フォーマットをサポートし、フォーマットの自動検出と読み込みが可能です。

## フォーマット検出

### 自動検出ルール

| 拡張子 | フォーマット | 定数 |
|--------|------|------|
| `.env` | .env フォーマット | `FormatEnv` |
| `.json` | JSON | `FormatJSON` |
| `.yaml`, `.yml` | YAML | `FormatYAML` |
| その他 | 自動 | `FormatAuto` |

### DetectFormat 函数

```go
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat("app.yml")        // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv
format = env.DetectFormat("unknown")        // FormatAuto

fmt.Println(format.String())  // "json", "yaml", "dotenv", "auto"
```

## マルチフォーマットファイルの読み込み

### 単一フォーマット

```go
loader.LoadFiles("config.env")
loader.LoadFiles("settings.json")
loader.LoadFiles("secrets.yaml")
```

### ミックスフォーマット

```go
// 各ファイルのフォーマットを自動検出
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

### 上書き順序

後から読み込んだファイルが前のものを上書き：

```go
// 順序: base -> env -> json -> yaml
loader.LoadFiles(
    ".env",           // 基本設定
    "config.json",    // .env を上書き
    "secrets.yaml",   // config.json を上書き
)
```

## JSON フォーマット

### ファイル構造

```json
{
    "APP_NAME": "myapp",
    "APP_PORT": "8080",
    "DEBUG": "true",
    "DATABASE": {
        "HOST": "localhost",
        "PORT": "5432"
    }
}
```

::: tip 注意
ネストされたオブジェクトは `DATABASE_HOST`、`DATABASE_PORT` のようにフラット化されます。
:::

### キー名の解決

JSON/YAML のネストされた構造はフラット化されて保存されます。ライブラリは複数のキー名アクセス方式をサポートしています：

```go
loader.LoadFiles("config.json")

// JSON: {"database": {"host": "localhost", "port": 5432}}
// 保存: DATABASE_HOST=localhost, DATABASE_PORT=5432

// 方式1：フラット化キー名（推奨）
host := loader.GetString("DATABASE_HOST")   // localhost
port := loader.GetInt("DATABASE_PORT")      // 5432

// 方式2：ドットパス（自動変換）
host := loader.GetString("database.host")   // localhost
port := loader.GetInt("database.port")      // 5432

// 方式3：大文字ドットパス
host := loader.GetString("DATABASE.HOST")   // localhost
```

**解決ルール：**

| 入力キー名 | 変換結果 |
|----------|--------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"`（完全一致） |
| `"database.host"` | `"DATABASE_HOST"`（ドットをアンダースコアに変換） |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"`（配列インデックス） |

::: tip 推奨される使用方法
- **コードではフラット化キー名を使用**：`GetString("DATABASE_HOST")` - 明確、効率的
- **設定ファイル内では読みやすいパス**：JSON/YAML は自然なネスト構造を使用
:::

**フラット化ルール：**

| JSON パス | 保存キー |
|-----------|--------|
| `database.host` | `DATABASE_HOST` |
| `database.port` | `DATABASE_PORT` |
| `app.server.name` | `APP_SERVER_NAME` |
| `servers.0.host` | `SERVERS_0_HOST` |

### 配列アクセス

JSON 配列はインデックス付きキーにフラット化されます：

```json
{
    "servers": [
        { "host": "server1.example.com", "port": 8080 },
        { "host": "server2.example.com", "port": 8081 }
    ]
}
```

```go
// フラット化されたキー名で配列要素にアクセス
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// ループで全ホストを取得
var hosts []string
for i := 0; ; i++ {
    h := loader.GetString(fmt.Sprintf("SERVERS_%d_HOST", i))
    if h == "" {
        break
    }
    hosts = append(hosts, h)
}
// hosts = ["server1.example.com", "server2.example.com"]
```

### JSON 解析設定

```go
cfg := env.DefaultConfig()

// null 値を空文字列に変換（デフォルト true）
cfg.JSONNullAsEmpty = true

// 数値を文字列に変換（デフォルト true）
cfg.JSONNumberAsString = true

// 真偽値を文字列に変換（デフォルト true）
cfg.JSONBoolAsString = true

// 最大ネスト深度（デフォルト 10）
cfg.JSONMaxDepth = 20
```

### 型変換例

```json
{
    "PORT": 8080,
    "DEBUG": true,
    "TIMEOUT": 30,
    "RATES": [0.1, 0.2, 0.3]
}
```

```go
// JSONNumberAsString = true（デフォルト）
port := loader.GetString("PORT")  // "8080"（文字列）
port := loader.GetInt("PORT")     // 8080（整数）

// JSONBoolAsString = true（デフォルト）
debug := loader.GetString("DEBUG")  // "true"（文字列）
debug := loader.GetBool("DEBUG")    // true（真偽値）
```

## YAML フォーマット

### ファイル構造

```yaml
# アプリケーション設定
APP_NAME: myapp
APP_PORT: "8080"
DEBUG: true

# データベース設定
DATABASE:
  HOST: localhost
  PORT: "5432"
  USER: postgres
  PASSWORD: secret

# リスト値
ALLOWED_HOSTS:
  - localhost
  - example.com
```

### キー名の解決

YAML のネストされた構造は JSON と同じフラット化ルールを使用します：

```go
loader.LoadFiles("config.yaml")

// フラット化されたキー名でアクセス
host := loader.GetString("DATABASE_HOST")        // localhost
user := loader.GetString("DATABASE_USER")        // postgres
```

### 配列アクセス

YAML リストはインデックス付きキーにフラット化されます：

```yaml
servers:
  - host: server1.example.com
    port: 8080
  - host: server2.example.com
    port: 8081
```

```go
// フラット化されたキー名でアクセス
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// リスト全体を取得
hosts := env.GetSliceFrom[string](loader, "ALLOWED_HOSTS") // ["localhost", "example.com"]
```

### YAML 解析設定

```go
cfg := env.DefaultConfig()

// null/~ 值转为空字符串（默认 true）
cfg.YAMLNullAsEmpty = true

// 数値を文字列に変換（デフォルト true）
cfg.YAMLNumberAsString = true

// 真偽値を文字列に変換（デフォルト true）
cfg.YAMLBoolAsString = true

// 最大ネスト深度（デフォルト 10）
cfg.YAMLMaxDepth = 15
```

### 型変換例

```yaml
PORT: 8080
DEBUG: true
TIMEOUT: 30
RATES:
  - 0.1
  - 0.2
  - 0.3
```

```go
// YAMLNumberAsString = true（デフォルト）
port := loader.GetString("PORT")  // "8080"（文字列）
port := loader.GetInt("PORT")     // 8080（整数）

// YAMLBoolAsString = true（デフォルト）
debug := loader.GetString("DEBUG")  // "true"（文字列）
debug := loader.GetBool("DEBUG")    // true（真偽値）

// リストアクセス
rates := env.GetSliceFrom[float64](loader, "RATES")  // [0.1, 0.2, 0.3]
```

## .env フォーマット

### ファイル構造

```bash
# コメント
APP_NAME=myapp
APP_PORT=8080
DEBUG=true

# 引用符
MESSAGE="Hello World"
LITERAL='literal ${noexpand}'

# 変数展開
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# デフォルト値
LOG_LEVEL=${LOG_LEVEL:-info}
```

### 変数展開

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // デフォルトで有効

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

// .env 内容:
// BASE_URL=https://api.example.com
// API_URL=${BASE_URL}/v1

apiURL := loader.GetString("API_URL")
// 出力: https://api.example.com/v1
```

### 展开语法

| 構文 | 説明 |
|------|------|
| `${VAR}` | 変数参照 |
| `${VAR:-default}` | 変数が存在しない場合にデフォルト値を使用 |

```bash
# 展開例
HOST=localhost
PORT=8080

# 他の変数を参照
URL=http://${HOST}:${PORT}

# デフォルト値
TIMEOUT=${TIMEOUT:-30s}
DEBUG=${DEBUG:-false}
```

### export 構文

```bash
# export プレフィックスをサポート（AllowExportPrefix = true の場合）
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
```

### YAML スタイル構文

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true  // YAML スタイルを有効化
```

```bash
# YAML スタイルのキーと値のペアをサポート
KEY: value
ANOTHER_KEY: "quoted value"
```

## 混合設定パターン

### 開発/本番の分離

```text
config/
├── base.json          # 基本設定
├── development.env    # 開発オーバーライド
├── production.yaml    # 本番オーバーライド
└── local.env          # ローカルオーバーライド（コミットしない）
```

```go
func loadConfig(loader *env.Loader) error {
    // 1. 基本設定
    if err := loader.LoadFiles("config/base.json"); err != nil {
        return err
    }

    // 2. 環境設定
    env := os.Getenv("APP_ENV")
    if env == "" {
        env = "development"
    }

    switch env {
    case "production":
        if err := loader.LoadFiles("config/production.yaml"); err != nil {
            return err
        }
    default:
        if err := loader.LoadFiles("config/development.env"); err != nil {
            return err
        }
    }

    // 3. ローカルオーバーライド（任意）
    if _, err := os.Stat("config/local.env"); err == nil {
        if err := loader.LoadFiles("config/local.env"); err != nil {
            return err
        }
    }

    return nil
}
```

### 機能別分割

```text
config/
├── app.json       # アプリケーション設定
├── database.yaml  # データベース設定
├── redis.env      # Redis 配置
└── secrets.json   # シークレット設定
```

```go
loader.LoadFiles(
    "config/app.json",
    "config/database.yaml",
    "config/redis.env",
    "config/secrets.json",
)
```

### 設定の優先順位

```text
コマンドライン引数 > 環境変数 > ローカル設定 > 環境設定 > 基本設定
```

## シリアライズ

### Marshal

設定を指定フォーマットにシリアライズ：

```go
data := map[string]string{
    "HOST": "localhost",
    "PORT": "8080",
}

// .env フォーマット（デフォルト）
envStr, _ := env.Marshal(data)
// HOST=localhost
// PORT=8080

// JSON フォーマット
jsonStr, _ := env.Marshal(data, env.FormatJSON)
// {"HOST":"localhost","PORT":"8080"}

// YAML フォーマット
yamlStr, _ := env.Marshal(data, env.FormatYAML)
// HOST: localhost
// PORT: "8080"
```

### Marshal 構造体

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

cfg := Config{Host: "localhost", Port: 8080}

// .env に変換
envStr, _ := env.Marshal(cfg, env.FormatEnv)

// JSON に変換
jsonStr, _ := env.Marshal(cfg, env.FormatJSON)

// YAML に変換
yamlStr, _ := env.Marshal(cfg, env.FormatYAML)
```

### UnmarshalMap

map にデシリアライズ：

```go
// .env から
envData := "HOST=localhost\nPORT=8080"
data, _ := env.UnmarshalMap(envData, env.FormatEnv)

// JSON から
jsonData := `{"HOST":"localhost","PORT":"8080"}`
data, _ := env.UnmarshalMap(jsonData, env.FormatJSON)

// YAML から
yamlData := "HOST: localhost\nPORT: \"8080\""
data, _ := env.UnmarshalMap(yamlData, env.FormatYAML)

// 自動フォーマット検出
data, _ := env.UnmarshalMap(jsonData, env.FormatAuto)
```

### UnmarshalStruct

構造体にデシリアライズ：

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

var cfg Config

// .env から
env.UnmarshalStruct("HOST=localhost\nPORT=8080", &cfg, env.FormatEnv)

// JSON から
env.UnmarshalStruct(`{"HOST":"localhost","PORT":"8080"}`, &cfg, env.FormatJSON)

// YAML から
env.UnmarshalStruct("HOST: localhost\nPORT: \"8080\"", &cfg, env.FormatYAML)
```

## カスタムフォーマット

### パーサーの登録

```go
// フォーマット定数の定義
const FormatTOML env.FileFormat = 100

// EnvParser インターフェースの実装
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // TOML 解析を実装
    result := make(map[string]string)
    // ...
    return result, nil
}

// パーサーの登録
func init() {
    env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}
```

詳細は [カスタムパーサー](/ja/env/guides/custom-parser) を参照してください。

## 完全な例

```go
package main

import (
    "fmt"
    "log"
    "os"

    "github.com/cybergodev/env"
)

func main() {
    // ローダーの作成
    cfg := env.DefaultConfig()
    cfg.ExpandVariables = true

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // ミックスフォーマット設定の読み込み
    err = loader.LoadFiles(
        "config/base.json",       // JSON 基本設定
        "config/database.yaml",   // YAML データベース設定
        "config/app.env",         // .env アプリケーション設定
    )
    if err != nil {
        log.Fatal(err)
    }

    // 設定の読み取り
    fmt.Printf("App: %s\n", loader.GetString("APP_NAME"))
    fmt.Printf("DB Host: %s\n", loader.GetString("DATABASE_HOST"))
    fmt.Printf("DB Port: %d\n", loader.GetInt("DATABASE_PORT"))

    // 現在の設定をエクスポート
    all := loader.All()
    exported, _ := env.Marshal(all, env.FormatEnv)
    fmt.Println("\nExported config:")
    fmt.Println(exported)
}
```

## 関連ドキュメント

- [シリアライズ](/ja/env/guides/serialization) - シリアライズ/デシリアライズの詳細
- [ComponentFactory API](/ja/env/api-reference/factory) - フォーマット検出とパーサー登録
- [カスタムパーサー](/ja/env/guides/custom-parser) - カスタムフォーマットの追加
- [Config API](/ja/env/api-reference/config) - JSON/YAML 解析設定

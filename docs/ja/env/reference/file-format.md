---
title: ファイルフォーマット - CyberGo env | .env/JSON/YAML 構文
description: CyberGo env 環境変数管理ライブラリがサポートする設定ファイルフォーマットの完全なリファレンスドキュメント。.env キーと値のペアフォーマット、JSON オブジェクトフォーマット、YAML 階層フォーマットの構文ルール、コメント方式、データ型サポート、エンコーディング処理、自動フォーマット検出メカニズムの詳細解説を含みます。
---

# ファイルフォーマット

env ライブラリは複数の設定ファイルフォーマットをサポートしています：`.env`、JSON、YAML。

## .env フォーマット

### 基本構文

```bash
# コメント
KEY=value

# 値の中に等号を含む場合
URL=https://example.com?foo=bar

# 空行は無視される

# 無効：キーにスペースは使用不可
# MY KEY=value
```

### クォート

```bash
# ダブルクォート：スペースを保持、エスケープをサポート
MESSAGE="Hello World"
PATH="/usr/local/bin"

# シングルクォート：そのまま保持、エスケープなし
LITERAL='no ${expansion} here'

# クォートなし
SIMPLE=value

# 空の値
EMPTY=
EMPTY=""
EMPTY=''
```

### エスケープ文字

ダブルクォート内でエスケープをサポートします：

```bash
# 改行
MULTILINE="line1\nline2"

# タブ
TABBED="col1\tcol2"

# クォート
QUOTED="He said \"Hello\""

# バックスラッシュ
PATH="C:\\Users\\name"

# ドル記号
PRICE="Price: \$100"
```

### 変数展開

`ExpandVariables` を有効にするとサポートされます：

```bash
# 他の変数を参照
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# 省略構文
URL=$BASE_URL/path

# デフォルト値
HOST=${HOST:-localhost}
PORT=${PORT:-8080}

# ネストされた展開
SERVICE=${CLUSTER:-default}-${REGION:-us-east}
```

### export 構文

`AllowExportPrefix` を有効にするとサポートされます：

```bash
# Bash スタイルのエクスポート
export KEY=value
export ANOTHER="quoted value"
```

### YAML スタイル

`AllowYamlSyntax` を有効にするとサポートされます：

```bash
# YAML スタイルのキーと値のペア
KEY: value
ANOTHER: "quoted value"
```

### 複数行の値

```bash
# ダブルクォート内の改行
PRIVATE_KEY="-----BEGIN KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END KEY-----"

# \n エスケープを使用
LINES="line1\nline2\nline3"
```

## JSON フォーマット

### 基本構造

```json
{
    "APP_NAME": "my-app",
    "APP_VERSION": "1.0.0",
    "DEBUG": true,
    "PORT": 8080
}
```

### ネストされたオブジェクト

ネストされたオブジェクトはフラット化されます：

```json
{
    "database": {
        "host": "localhost",
        "port": 5432
    }
}
```

結果：

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

### 配列

配列はインデックス付きキーにフラット化されます：

```json
{
    "ALLOWED_HOSTS": ["localhost", "example.com"],
    "PORTS": [80, 443, 8080]
}
```

結果：

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
PORTS_0=80
PORTS_1=443
PORTS_2=8080
```

::: tip 配列要素へのアクセス
`GetSlice[T]` 関数またはドットパスを使用してインデックス付きキーにアクセスします：
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
詳細は [GetSlice ドキュメント](/ja/env/api-reference/functions#getslice-t) を参照してください。
:::

### 型変換オプション

```go
cfg := env.DefaultConfig()

// null を空文字列に変換
cfg.JSONNullAsEmpty = true

// 数値を文字列に変換
cfg.JSONNumberAsString = true

// ブール値を文字列に変換
cfg.JSONBoolAsString = true
```

### 深度制限

```go
cfg.JSONMaxDepth = 10  // 最大ネスト深度
```

## YAML フォーマット

### 基本構造

```yaml
APP_NAME: my-app
APP_VERSION: "1.0.0"
DEBUG: true
PORT: 8080
```

### ネストされた構造

```yaml
database:
  host: localhost
  port: 5432
  credentials:
    user: admin
    password: secret
```

フラット化結果：

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_CREDENTIALS_USER=admin
DATABASE_CREDENTIALS_PASSWORD=secret
```

### リスト

リストはインデックス付きキーにフラット化されます：

```yaml
allowed_hosts:
  - localhost
  - example.com
  - api.example.com
```

結果：

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
ALLOWED_HOSTS_2=api.example.com
```

### 複数行文字列

```yaml
# リテラルブロック（改行を保持）
description: |
  Line 1
  Line 2
  Line 3

# 折りたたみブロック（改行がスペースになる）
summary: >
  This is a long
  summary that will
  be on one line.
```

### 型変換オプション

```go
cfg := env.DefaultConfig()

cfg.YAMLNullAsEmpty = true
cfg.YAMLNumberAsString = true
cfg.YAMLBoolAsString = true
cfg.YAMLMaxDepth = 10
```

## フォーマット検出

### 自動検出

```go
// 拡張子に基づく検出
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv

// 一致する拡張子がない場合は FormatAuto を返す（デフォルトで .env パーサーを使用）
format = env.DetectFormat("config")  // FormatAuto
```

### フォーマット定数

```go
const (
    FormatAuto  FileFormat = iota  // 自動検出
    FormatEnv                      // .env フォーマット
    FormatJSON                     // JSON フォーマット
    FormatYAML                     // YAML フォーマット
)
```

### フォーマット文字列

```go
format := env.FormatJSON
fmt.Println(format.String())  // 出力: json
```

## ベストプラクティス

### フォーマットの選択

| シーン | 推奨フォーマット |
|------|----------|
| シンプルな設定 | `.env` |
| 複雑なネスト設定 | JSON または YAML |
| 他のツールとの共有 | JSON |
| 人間の可読性を優先 | YAML |
| Docker/K8s 環境 | `.env` |

### ファイルの命名

```bash
.env              # デフォルト設定
.env.local        # ローカル上書き（コミットしない）
.env.development  # 開発環境
.env.staging      # ステージング環境
.env.production   # 本番環境
.env.test         # テスト環境
```

### 混合使用

```go
// 異なるフォーマットを混合して使用可能
loader.LoadFiles(
    "base.env",           // 基本設定
    "database.json",      // データベース設定
    "secrets.yaml",       // 機密設定
    ".env.local",         // ローカル上書き
)
```

### Git で除外

```bash
# 機密設定を除外
.env.local
.env.*.local
.env.production
secrets.yaml

# テンプレートは保持
!.env.example
```

## 関連ドキュメント

- [マルチフォーマット設定](/ja/env/guides/multi-format) - マルチフォーマット読み込みガイド
- [ComponentFactory API](/ja/env/api-reference/factory) - DetectFormat 関数リファレンス
- [Config API](/ja/env/api-reference/config) - JSON/YAML パースオプション

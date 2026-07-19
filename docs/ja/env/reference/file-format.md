---
sidebar_label: "ファイル形式"
title: "ファイルフォーマット - CyberGo env | .env/JSON/YAML 構文"
description: "CyberGo env 設定ファイルフォーマットリファレンス。.env・JSON・YAML の3形式の構文規則、クォートと export 接頭辞、変数展開 ${VAR}、複数行文字列、ネスト・配列のフラット化、UTF-8 エンコーディング、DetectFormat 自動検出を詳解します。"
sidebar_position: 1
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

# 無効：キーに空白を含めることはできない
# MY KEY=value
```

### 引用符

```bash
# ダブルクォート：空白を保持、エスケープをサポート
MESSAGE="Hello World"
PATH="/usr/local/bin"

# シングルクォート：エスケープを処理しない（バックスラッシュ序列をそのまま保持）
# 注意：シングルクォートは変数展開を阻止しない——展開は引用符が剥がれた後に統一的に行われる
LITERAL='no escaping here: \n stays literal'

# 引用符なし
SIMPLE=value

# 空の値
EMPTY=
EMPTY=""
EMPTY=''
```

### エスケープ文字

ダブルクォート内でエスケープをサポート：

```bash
# 改行
MULTILINE="line1\nline2"

# タブ
TABBED="col1\tcol2"

# 引用符
QUOTED="He said \"Hello\""

# バックスラッシュ
PATH="C:\\Users\\name"

# ドル記号
PRICE="Price: \$100"
```

### 変数展開

`ExpandVariables` を有効にするとサポート：

```bash
# 他の変数を参照
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# 簡略構文
URL=$BASE_URL/path

# デフォルト値
HOST=${HOST:-localhost}
PORT=${PORT:-8080}

# ネストされた展開
SERVICE=${CLUSTER:-default}-${REGION:-us-east}
```

### export 構文

`AllowExportPrefix` を有効にするとサポート：

```bash
# Bash スタイルのエクスポート
export KEY=value
export ANOTHER="quoted value"
```

### YAML スタイル

`AllowYamlSyntax` を有効にするとサポート：

```bash
# YAML スタイルのキーと値のペア
KEY: value
ANOTHER: "quoted value"
```

### 複数行の値

`.env` パーサーは行単位でスキャンし、各行を個別に解析します。**複数行にまたがる引用符文字列はサポートされていません**——ダブルクォート値は 1 行内で閉じる必要があり、そうでない場合は `ErrInvalidValue` が返されます。改行が必要な場合は `\n` エスケープを使用してください（ダブルクォート内でのみ有効、シングルクォートはエスケープを処理しません）：

```bash
# ダブルクォート内の \n は改行文字として解析される
LINES="line1\nline2\nline3"
# 実際の値は 3 行のテキスト: line1 / line2 / line3

# PRIVATE_KEY などの複数行証明書は \n で結合することを推奨
PRIVATE_KEY="-----BEGIN KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END KEY-----"
```

本当にまたがる文字列が必要な場合は、[JSON または YAML フォーマット](#フォーマット検出)を使用するか、カスタムパーサーで複数行サポートを拡張してください。

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

配列はインデックスキーにフラット化されます：

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
`GetSlice[T]` 関数またはドットパスを使用してインデックスキーにアクセスします：
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
詳細は [GetSlice ドキュメント](/ja/env/api-reference/functions#getslice-t)を参照してください。
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

### 深さ制限

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

リストはインデックスキーにフラット化されます：

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

::: warning 注意
YAML ブロックスカラー（リテラルブロック `|` とフォールドブロック `>`）は**現在サポートされていません**。パーサーは `|`/`>` を通常のスカラー文字として保存し、後続のインデント行はキーと値の解析を壊します。
:::

改行を保持する必要がある値は、ダブルクォートと `\n` エスケープを使用してください：

```yaml
description: "Line1\nLine2\nLine3"
```

またはカスタムパーサーでブロックスカラーのサポートを拡張してください。

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
// 拡張子に基づいて検出
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

| シナリオ | 推奨フォーマット |
|------|----------|
| シンプルな設定 | `.env` |
| 複雑なネスト設定 | JSON または YAML |
| 他のツールと共有 | JSON |
| 人間の可読性を優先 | YAML |
| Docker/K8s 環境 | `.env` |

### ファイル命名

```bash
.env              # デフォルト設定
.env.local        # ローカルオーバーライド（コミットしない）
.env.development  # 開発環境
.env.staging      # ステージング環境
.env.production   # 本番環境
.env.test         # テスト環境
```

### 組み合わせて使用

```go
// 異なるフォーマットを混合して使用可能
loader.LoadFiles(
    "base.env",           // 基本設定
    "database.json",      // データベース設定
    "secrets.yaml",       // 機密設定
    ".env.local",         // ローカルオーバーライド
)
```

### Git で無視

```bash
# 機密設定を無視
.env.local
.env.*.local
.env.production
secrets.yaml

# テンプレートを保持
!.env.example
```

## 関連ドキュメント

- [多フォーマット設定](/ja/env/guides/multi-format) - 多フォーマット読み込みガイド
- [ComponentFactory API](/ja/env/api-reference/factory) - DetectFormat 関数リファレンス
- [Config API](/ja/env/api-reference/config) - JSON/YAML 解析オプション

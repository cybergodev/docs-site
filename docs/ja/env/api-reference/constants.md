---
title: 定数とエラー - CyberGo env | センチネルエラーとセキュリティ定数
description: CyberGo env 環境変数管理ライブラリの定数とエラーの完全リファレンスドキュメント。セキュリティ制限定数、センチネルエラー定義、構造化エラータイプ、定義済み変数、セキュリティユーティリティ関数の詳細な説明を含み、errors.Is と errors.As の標準パターンと組み合わせて、Go 開発者が各種エラーシーンと異常状況を正しく識別・処理できるようにサポートします。
---

# 定数とエラー

ライブラリで定義される定数、エラータイプ、センチネルエラー、定義済み変数。

## セキュリティ制限定数

### デフォルト制限

```go
const (
    // DefaultMaxFileSize - 単一ファイルの最大バイト数
    DefaultMaxFileSize int64 = 2 * 1024 * 1024  // 2 MB

    // DefaultMaxLineLength - 1 行の最大長
    DefaultMaxLineLength int = 1024  // 1 KB

    // DefaultMaxKeyLength - キー名の最大長
    DefaultMaxKeyLength int = 64

    // DefaultMaxValueLength - 値の最大長
    DefaultMaxValueLength int = 4096  // 4 KB

    // DefaultMaxVariables - ファイルごとの最大変数数
    DefaultMaxVariables int = 500

    // DefaultMaxExpansionDepth - 変数展開の最大深度
    DefaultMaxExpansionDepth int = 5
)
```

### ハードリミット

::: warning 注意
以下はライブラリ内部のハードリミット（非公開）で、`Config.Validate()` の内部チェックに使用されます。ユーザーはこれらの定数を直接参照できませんが、`cfg.Validate()` が自動的に制限を超えていないかチェックします。
:::

| 定数 | 値 | 説明 |
|------|-----|------|
| HardMaxFileSize | 100 MB | ファイルサイズのハードリミット |
| HardMaxLineLength | 64 KB | 行の長さのハードリミット |
| HardMaxKeyLength | 1024 | キーの長さのハードリミット |
| HardMaxValueLength | 1 MB | 値の長さのハードリミット |
| HardMaxVariables | 10000 | 変数数のハードリミット |
| HardMaxExpansionDepth | 20 | 展開深度のハードリミット |

設定検証でハードリミットを超過したかチェック：

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 200 * 1024 * 1024  // 100MB 上限を超過

if err := cfg.Validate(); err != nil {
    // エラーを返す: MaxFileSize exceeds hard limit
}
```

## センチネルエラー

### ファイルエラー

```go
var ErrFileNotFound = errors.New("file not found")
var ErrFileTooLarge = errors.New("file exceeds maximum size limit")
```

チェック方法：

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    // ファイルが存在しない
}
if errors.Is(err, env.ErrFileTooLarge) {
    // ファイルが大きすぎる
}
```

### パースエラー

```go
var ErrLineTooLong = errors.New("line exceeds maximum length limit")
var ErrInvalidKey = errors.New("invalid key format")
var ErrDuplicateKey = errors.New("duplicate key encountered")
```

### セキュリティエラー

```go
var ErrForbiddenKey = errors.New("key is forbidden for security reasons")
var ErrSecurityViolation = errors.New("security policy violation")
var ErrNullByte = errors.New("null byte detected in input")
var ErrControlChar = errors.New("control character detected in input")
var ErrInvalidValue = errors.New("invalid value content")
```

禁止キーのチェック：

```go
err := loader.Set("PATH", "value")
if errors.Is(err, env.ErrForbiddenKey) {
    // 禁止キーの設定を試行
}
```

### 展開エラー

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### 制限エラー

```go
var ErrMaxVariables = errors.New("maximum number of variables exceeded")
```

### ステータスエラー

```go
var ErrClosed = errors.New("loader has been closed")
var ErrInvalidConfig = errors.New("invalid configuration")
var ErrAlreadyInitialized = errors.New("default loader already initialized")
var ErrMissingRequired = errors.New("required key is missing")
```

**チェック方法：**

```go
// ローダーがクローズ済みかチェック
if errors.Is(err, env.ErrClosed) {
    // ローダーはクローズ済み
}

// デフォルトローダーが既に初期化されているかチェック
if errors.Is(err, env.ErrAlreadyInitialized) {
    // デフォルトローダーが既に存在、Load() を繰り返し呼び出し不可
}

// 必須キーが不足しているかチェック
if errors.Is(err, env.ErrMissingRequired) {
    // 必須キーが不足
}
```

### アダプタエラー

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

カスタム検証器が `KeyValidator` インターフェースのみを実装し、完全な `Validator` インターフェースを実装していない場合、`ValidateRequired` の呼び出しでこのエラーが返されます。

**チェック方法：**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // カスタム検証器は必須キー検証をサポートしていない
    // 完全な Validator インターフェースの実装が必要
}
```

::: tip 解決方法
`KeyValidator` のみではなく、`Validator` インターフェース（`ValidateKey`、`ValidateValue`、`ValidateRequired` の 3 つのメソッドを含む）を実装してください。
:::

## エラータイプ

### ParseError

解析エラー。位置情報を含みます：

```go
type ParseError struct {
    File    string  // ファイル名
    Line    int     // 行番号
    Content string  // エラー内容（マスク済み）
    Err     error   // 元のエラー
}
```

使用例：

```go
err := loader.LoadFiles(".env")
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("解析エラー %s:%d: %v\n",
        parseErr.File, parseErr.Line, parseErr.Err)
}
```

### ValidationError

検証エラー：

```go
type ValidationError struct {
    Field   string  // フィールド名
    Value   string  // 値（マスク済み）
    Rule    string  // ルール
    Message string  // メッセージ
}
```

### SecurityError

セキュリティエラー：

```go
type SecurityError struct {
    Action  string  // 操作
    Reason  string  // 原因
    Key     string  // キー名（マスク済み）
    Details string  // 追加詳細
}
```

使用例：

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("セキュリティエラー: %s - %s\n", secErr.Action, secErr.Reason)
}
```

### FileError

ファイル操作エラー：

```go
type FileError struct {
    Path  string  // ファイルパス
    Op    string  // 操作（open, stat, size_check）
    Err   error   // 元のエラー
    Size  int64   // ファイルサイズ（Size チェック時）
    Limit int64   // 制限（Size チェック時）
}
```

使用例：

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("ファイル %s のサイズ %d が制限 %d を超過\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}
```

### ExpansionError

変数展開エラー：

```go
type ExpansionError struct {
    Key   string  // キー名
    Depth int     // 現在の深度
    Limit int     // 制限
    Chain string  // 展開チェーン
}
```

### JSONError

JSON 解析エラー：

```go
type JSONError struct {
    Path    string  // ファイルパス
    Message string  // エラーメッセージ
    Err     error   // 元のエラー
}
```

### YAMLError

YAML 解析エラー：

```go
type YAMLError struct {
    Path    string  // ファイルパス
    Line    int     // 行番号
    Column  int     // 列番号
    Message string  // エラーメッセージ
    Err     error   // 元のエラー
}
```

### MarshalError

シリアライズエラー：

```go
type MarshalError struct {
    Field   string  // フィールド名
    Message string  // エラーメッセージ
}

func IsMarshalError(err error) bool  // チェック関数
```

## 定義済み変数

### DefaultForbiddenKeys

組み込み禁止キーリスト。システム重要変数の変更を防止します：

::: warning 注意
`defaultForbiddenKeys` はライブラリ内部変数（非公開）で、`env.DefaultForbiddenKeys` で直接アクセスできません。以下は内部使用の完全なリストで、参考用です。
:::

| カテゴリ | 禁止キー |
|------|--------|
| システムパス | `PATH` |
| 動的リンカー (Linux) | `LD_PRELOAD`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64`, `LD_AUDIT`, `LD_DEBUG` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| 言語ランタイム | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

**リスクの説明：**

| キー | リスクタイプ | 説明 |
|----|----------|------|
| `PATH` | コマンドハイジャック | コマンド検索パスの変更 |
| `LD_PRELOAD` | ライブラリ注入 | 悪意のある動的ライブラリの事前読み込み |
| `LD_LIBRARY_PATH` | ライブラリハイジャック | ライブラリ検索パスの変更 |
| `DYLD_INSERT_LIBRARIES` | ライブラリ注入 | macOS ライブラリ注入 |
| `PYTHONPATH` | モジュールハイジャック | Python モジュール検索パスの変更 |
| `IFS` | 解析攻撃 | フィールドセパレータの変更 |

**使用例：**

```go
// 禁止キーの設定を試行すると ErrForbiddenKey が返される
err := loader.Set("PATH", "/malicious/path")
if errors.Is(err, env.ErrForbiddenKey) {
    // キーは禁止されている
}

// 追加の禁止キーを設定
cfg := env.DefaultConfig()
cfg.ForbiddenKeys = []string{"MY_SENSITIVE_VAR"}
```

### SensitiveKeyPatterns

機密キーパターンリスト。機密設定の自動検出に使用されます。キー名にこれらのパターンが含まれる場合（大文字小文字を区別しない）、機密として識別されます：

::: warning 注意
`sensitiveKeyPatterns` はライブラリ内部変数（非公開）で、`IsSensitiveKey()` 関数を通じて間接的にアクセスします。以下は主要な機密パターンカテゴリで、参考用です。
:::

**主要な機密パターンカテゴリ：**

| カテゴリ | パターン例 |
|------|----------|
| 認証と認可 | `PASSWORD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE` |
| API とキー | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY` |
| 暗号化とセキュリティ | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY` |
| 金融と PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN` |
| 暗号通貨 | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| データベース | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD` |
| クラウドサービス | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

**マッチングルール：**
- 大文字小文字を区別しない
- キー名がいずれかのパターンを含む場合、機密として識別

**使用例：**

```go
// キーが機密かチェック
if env.IsSensitiveKey("DB_PASSWORD") {
    // 安全な方法で処理
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

### DefaultKeyPattern

デフォルトキー名検証パターン：

```go
var DefaultKeyPattern *regexp.Regexp = nil
```

::: tip パフォーマンス最適化
`nil` 値で高速バイトレベル検証を有効化（約 10 倍のパフォーマンス向上）。
デフォルト検証ルール：文字で始まり、文字・数字・アンダースコアのみを含む。
:::

**カスタムパターン：**

```go
import "regexp"

cfg := env.DefaultConfig()
// 大文字で始まるもののみ許可
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
```

## セキュリティユーティリティ関数

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

キー名が機密パターンにマッチするかを確認します。

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // 機密キー、安全な方法で処理
    secret := env.GetSecure("DB_PASSWORD")
    defer secret.Release()
}
```

### MaskValue

```go
func MaskValue(key, value string) string
```

キーの機密性に基づいてマスクされた値を返します。

```go
// 機密キー - [MASKED:N chars] 形式を返す
masked := env.MaskValue("API_KEY", "secret123")
// 戻り値: [MASKED:9 chars]

// 非機密キー - 元の値を返す（20 文字を超える場合は切り詰め）
masked := env.MaskValue("APP_NAME", "myapp")
// 戻り値: myapp
masked := env.MaskValue("DESCRIPTION", "this is a very long description text")
// 戻り値: this is a very lo...
```

### MaskKey

```go
func MaskKey(key string) string
```

キー名をマスクしてログ出力に使用します。

```go
masked := env.MaskKey("DB_PASSWORD")
// 戻り値: DB***
```

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

文字列内の潜在的な機密内容をマスクします。50 文字を超える文字列は切り詰められます。

**パラメータ：**
- `s` - 元の文字列

**戻り値：**
- `string` - マスクされた文字列

```go
// 長い文字列は切り詰められる
log := "This is a very long log message that exceeds 50 characters and will be truncated"
clean := env.MaskSensitiveInString(log)
// 戻り値: "This is a very long log message that exceeds 50..."

// 短い文字列はそのまま
short := "Short message"
clean := env.MaskSensitiveInString(short)
// 戻り値: "Short message"
```

::: warning 注意
この関数は主に長い文字列の切り詰めに使用されます。機密キー値ペアを自動的にマスクするには、`SanitizeForLog` を使用してください。
:::

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

文字列内の機密キー値ペア情報をサニタイズします。`key=value` 形式の機密値を自動検出してマスクします。

**パラメータ：**
- `s` - 元の文字列

**戻り値：**
- `string` - サニタイズ後の文字列

**検出される機密キーパターン：**
- `password=`, `secret=`, `token=`, `auth=`, `credential=`, `passphrase=`, `session=`, `cookie=`
- `api_key=`, `apikey=`, `access_key=`, `secret_key=`, `private_key=`, `public_key=`
- `encrypt_key=`, `decrypt_key=`, `signing_key=`
- `ssn=`, `credit_card=`, `card_number=`, `cvv=`, `cvc=`
- `mnemonic=`, `seed=`, `recovery=`, `wallet=`
- `connection_string=`, `database_url=`, `db_password=`

```go
// 機密キー値ペアを自動マスク
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// 戻り値: "Connected with password=[MASKED] api_key=[MASKED]"

// 非機密キー値ペアはそのまま
msg := "Config loaded: app_name=myapp port=8080"
clean := env.SanitizeForLog(msg)
// 戻り値: "Config loaded: app_name=myapp port=8080"
```

::: tip 使用シーン
ログ出力、エラーメッセージ、デバッグ情報など、機密キー値ペアの自動フィルタリングが必要なシーンに適しています。
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

バイトスライスを安全にゼロクリアします。

```go
sensitive := []byte("secret-data")
// 使用...
env.ClearBytes(sensitive)
// sensitive はすべて 0 になる
```

## FileFormat 定数

ファイル形式タイプ：

```go
type FileFormat int

const (
    FormatAuto  FileFormat = iota  // 自動検出
    FormatEnv                      // .env 形式
    FormatJSON                     // JSON 形式
    FormatYAML                     // YAML 形式
)
```

使用例：

```go
// 形式を検出
format := env.DetectFormat("config.json")  // FormatJSON

// 形式を指定してシリアライズ
data, _ := env.Marshal(cfg, env.FormatJSON)

// 形式の文字列表現
fmt.Println(format.String())  // "json"
```

## エラーチェックパターン

### errors.Is パターン

センチネルエラーのチェック：

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // ファイルが存在しない
case errors.Is(err, env.ErrFileTooLarge):
    // ファイルが大きすぎる
case errors.Is(err, env.ErrForbiddenKey):
    // 禁止キー
case errors.Is(err, env.ErrClosed):
    // ローダーがクローズ済み
}
```

### errors.As パターン

詳細なエラー情報の取得：

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("解析エラー %s の %d 行目\n", parseErr.File, parseErr.Line)
}

var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("ファイル %s のサイズ %d が制限 %d を超過\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}

var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("セキュリティエラー: %s - %s\n", secErr.Action, secErr.Reason)
}
```

## 完全なエラー処理例

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"

    "github.com/cybergodev/env"
)

func main() {
    cfg := env.ProductionConfig()
    cfg.FailOnMissingFile = true

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        switch {
        case errors.Is(err, env.ErrFileNotFound):
            log.Fatal("設定ファイルが存在しません")

        case errors.Is(err, env.ErrFileTooLarge):
            log.Fatal("設定ファイルが大きすぎます")

        case errors.Is(err, env.ErrClosed):
            log.Fatal("ローダーはクローズ済みです")

        default:
            var parseErr *env.ParseError
            if errors.As(err, &parseErr) {
                log.Fatalf("解析エラー %s:%d - %v",
                    parseErr.File, parseErr.Line, parseErr.Err)
            }

            var fileErr *env.FileError
            if errors.As(err, &fileErr) {
                log.Fatalf("ファイルエラー %s - %v", fileErr.Path, fileErr.Err)
            }

            var secErr *env.SecurityError
            if errors.As(err, &secErr) {
                log.Fatalf("セキュリティエラー: %s - %s", secErr.Action, secErr.Reason)
            }

            var jsonErr *env.JSONError
            if errors.As(err, &jsonErr) {
                log.Fatalf("JSON エラー %s: %s", jsonErr.Path, jsonErr.Message)
            }

            var yamlErr *env.YAMLError
            if errors.As(err, &yamlErr) {
                log.Fatalf("YAML エラー %s:%d:%d - %s",
                    yamlErr.Path, yamlErr.Line, yamlErr.Column, yamlErr.Message)
            }

            log.Fatal(err)
        }
    }

    // 必須キーの検証
    if err := loader.Validate(); err != nil {
        var valErr *env.ValidationError
        if errors.As(err, &valErr) {
            log.Fatalf("検証失敗: %s - %s", valErr.Field, valErr.Message)
        }
        log.Fatal(err)
    }
}
```

## 関連ドキュメント

- [SecureValue API](/ja/env/api-reference/secure-value) - セキュリティユーティリティ関数の完全な API
- [Config API](/ja/env/api-reference/config) - 設定オプションと制限設定
- [セキュリティ概要](/ja/env/security/) - セキュリティアーキテクチャとコア機能
- [本番チェックリスト](/ja/env/security/production-checklist) - リリース前セキュリティチェック

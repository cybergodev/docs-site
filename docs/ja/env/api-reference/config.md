---
title: "Config API - CyberGo env | 設定詳細"
description: "CyberGo env の Config 構造体 API リファレンス。ファイル検索パス、セキュリティ制限、キー検証、変数展開、監査設定、Development/Production プリセットを解説します。"
---

# Config API

`Config` 構造体の完全な設定オプションリファレンス。

## 構造体定義

Config はネストされた構造体で構成を整理し、同時に Go のフィールド昇格により後方互換性を維持します：

```go
type Config struct {
    FileConfig       // ファイル読み込みの挙動
    ValidationConfig // キーと値の検証
    LimitsConfig     // サイズと数量の制限
    JSONConfig       // JSON 解析オプション
    YAMLConfig       // YAML 解析オプション
    ParsingConfig    // 汎用解析の挙動
    ComponentConfig  // カスタムコンポーネントと詳細オプション
}
```

**2 種類のアクセス方法：**

```go
// 旧方式（フィールド昇格により、依然として有効）
cfg.Filenames = []string{".env"}
cfg.MaxFileSize = 1024

// 新しい方法（推奨、より明確）
cfg.FileConfig.Filenames = []string{".env"}
cfg.LimitsConfig.MaxFileSize = 1024
```

### ネストされた構造体

```go
// FileConfig はファイル読み込みの挙動を制御
type FileConfig struct {
    Filenames         []string // 読み込むファイルのリスト
    FailOnMissingFile bool     // ファイルが存在しない場合にエラーにするか
    OverwriteExisting bool     // 既存の環境変数を上書きするかどうか
    AutoApply         bool     // os.Environ に自動適用するか
}

// ValidationConfig はキーと値の検証を制御
type ValidationConfig struct {
    RequiredKeys   []string       // 必須キー名のリスト
    AllowedKeys    []string       // 許可キー名のホワイトリスト
    ForbiddenKeys  []string       // 追加の禁止キーリスト
    KeyPattern     *regexp.Regexp // キー名マッチパターン
    ValidateValues bool           // 値の安全性を検証するか
    ValidateUTF8   bool           // 値が有効な UTF-8 か検証
}

// LimitsConfig はサイズと数量の制限を制御
type LimitsConfig struct {
    MaxFileSize       int64 // 単一ファイルの最大バイト数
    MaxVariables      int   // ファイルごとの最大変数数
    MaxLineLength     int   // 単一行の最大長
    MaxKeyLength      int   // キー名の最大長
    MaxValueLength    int   // 値の最大長
    MaxExpansionDepth int   // 変数展開の最大深度
}

// JSONConfig は JSON 解析の挙動を制御
type JSONConfig struct {
    JSONNullAsEmpty    bool // null を空文字列に変換
    JSONNumberAsString bool // 数値を文字列に変換
    JSONBoolAsString   bool // 真偽値を文字列に変換
    JSONMaxDepth       int  // 最大ネスト深度
}

// YAMLConfig は YAML 解析の挙動を制御
type YAMLConfig struct {
    YAMLNullAsEmpty    bool // null/~ を空文字列に変換
    YAMLNumberAsString bool // 数値を文字列に変換
    YAMLBoolAsString   bool // 真偽値を文字列に変換
    YAMLMaxDepth       int  // 最大ネスト深度
}

// ParsingConfig は汎用解析の挙動を制御
type ParsingConfig struct {
    AllowExportPrefix bool // export KEY=value 構文を許可
    AllowYamlSyntax   bool // YAML スタイルの値を許可
    ExpandVariables   bool // ${VAR} 変数展開を行うか
}

// ComponentConfig はカスタムコンポーネントと詳細オプション
type ComponentConfig struct {
    CustomValidator Validator        // カスタムキー/値バリデーター
    CustomExpander  VariableExpander // カスタム変数エキスパンダー
    CustomAuditor   AuditLogger      // カスタム監査ロガー
    FileSystem      FileSystem       // カスタムファイルシステム（テスト用）
    AuditHandler    AuditHandler     // カスタム監査ハンドラー
    AuditEnabled    bool             // 監査ログを有効化
    Prefix          string           // このプレフィックスを持つ変数のみ処理
}
```

## 設定フィールド

### ファイル処理

これらのフィールドはファイル読み込みの動作を制御します。

#### `Filenames` []string

読み込むファイルパスのリスト。**デフォルト `[".env"]`**。

```go
cfg.Filenames = []string{".env", ".env.local"}
```

---

#### `FailOnMissingFile` bool

ファイルが存在しない場合にエラーを返すかどうか。**デフォルト `false`**（サイレントにスキップ）。

```go
cfg.FailOnMissingFile = true  // ファイルが存在しない場合はエラー
```

---

#### `OverwriteExisting` bool

既存の環境変数を上書きするかどうか。**デフォルト `false`**。

```go
cfg.OverwriteExisting = true  // 上書きを許可
```

---

#### `AutoApply` bool

読み込み後、システム環境に自動適用（`os.Environ`）。**デフォルト `false`**。

```go
cfg.AutoApply = true  // 読み込み後に自動適用
```

::: tip 注意
パッケージレベルの `Load()` 関数は自動的に `AutoApply = true` を設定します。`New()` で Loader を作成する場合は手動で設定する必要があります。
:::

### 変数展開

#### `ExpandVariables` bool

`${VAR}` 構文の変数展開を有効化。**デフォルト `true`**。

```go
cfg.ExpandVariables = true
```

サポートされる展開構文：

| 構文 | 説明 |
|------|------|
| `${VAR}` | 変数を参照 |
| `${VAR:-default}` | 変数が存在しない、または空の場合にデフォルト値を使用 |
| `${VAR:=default}` | 変数が存在しない、または空の場合にデフォルト値を設定 |
| `${VAR:?error}` | 変数が存在しない、または空の場合にエラーを報告 |

### セキュリティ制限

#### `MaxFileSize` int64

単一ファイルの最大バイト数。**デフォルト 2MB**，ハードリミット 100MB。

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 MB
```

| 設定 | デフォルト値 | ハードリミット |
|------|--------|----------|
| `MaxFileSize` | 2MB (2097152) | 100MB |

---

#### `MaxLineLength` int

単一行の最大長。**デフォルト 1024**，ハードリミット 64KB。

```go
cfg.MaxLineLength = 2048
```

| 設定 | デフォルト値 | ハードリミット |
|------|--------|----------|
| `MaxLineLength` | 1024 | 65536 (64KB) |

---

#### `MaxKeyLength` int

キー名の最大長。**デフォルト 64**，ハードリミット 1024。

```go
cfg.MaxKeyLength = 128
```

| 設定 | デフォルト値 | ハードリミット |
|------|--------|----------|
| `MaxKeyLength` | 64 | 1024 |

---

#### `MaxValueLength` int

値の最大長。**デフォルト 4096**，ハードリミット 1MB。

```go
cfg.MaxValueLength = 8192
```

| 設定 | デフォルト値 | ハードリミット |
|------|--------|----------|
| `MaxValueLength` | 4096 | 1048576 (1MB) |

---

#### `MaxVariables` int

ファイルごとの最大変数数。**デフォルト 500**，ハードリミット 10000。

```go
cfg.MaxVariables = 1000
```

| 設定 | デフォルト値 | ハードリミット |
|------|--------|----------|
| `MaxVariables` | 500 | 10000 |

---

#### `MaxExpansionDepth` int

変数展開の最大深度。**デフォルト 5**，ハードリミット 20。

```go
cfg.MaxExpansionDepth = 10
```

| 設定 | デフォルト値 | ハードリミット |
|------|--------|----------|
| `MaxExpansionDepth` | 5 | 20 |

### キー検証

#### `KeyPattern` *regexp.Regexp

カスタムキー名マッチパターン。**デフォルト `nil`**（高速なバイトレベル検証を使用）。

::: tip パフォーマンス最適化
`nil` 値で高速なバイトレベル検証を有効化（約 10 倍の性能向上）。デフォルト検証ルール：英字で始まり、英字・数字・アンダースコアのみを含む。
:::

```go
import "regexp"

// カスタムパターン
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
```

---

#### `AllowedKeys` []string

許可キー名のホワイトリスト。空の場合はすべてのキーを許可（禁止キーを除く）。

```go
cfg.AllowedKeys = []string{"APP_NAME", "APP_VERSION", "PORT"}
```

---

#### `ForbiddenKeys` []string

追加の禁止キーリスト（組み込み禁止キーに追加）。

```go
cfg.ForbiddenKeys = []string{"CUSTOM_DANGEROUS_VAR"}
```

::: tip 組み込み禁止キー
ライブラリは `PATH`、`LD_PRELOAD`、`LD_LIBRARY_PATH`、`DYLD_INSERT_LIBRARIES` などのシステム重要変数を禁止しています。詳細は [定数とエラー](/ja/env/api-reference/constants#defaultforbiddenkeys) を参照してください。
:::

---

#### `RequiredKeys` []string

必須キー名のリスト。`Validate()` 呼び出し時にチェックされます。

```go
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
```

---

#### `ValidateValues` bool

値の安全性を検証（制御文字、ヌルバイトなど）。**デフォルト `true`**。

::: warning セキュリティの推奨
常に有効にすることを推奨。特殊なケース（制御文字を含む値を保存する必要がある場合）のみ無効化してください。
:::

```go
cfg.ValidateValues = true  // デフォルトで有効
```

---

#### `ValidateUTF8` bool

値が有効な UTF-8 エンコーディングか検証します。**デフォルト `false`**。

```go
cfg.ValidateUTF8 = true  // UTF-8 検証を有効化
```

### 解析オプション

#### `AllowExportPrefix` bool

`export KEY=value` 構文を許可します。**デフォルト `true`**。

```go
cfg.AllowExportPrefix = false  // export プレフィックスを禁止
```

---

#### `AllowYamlSyntax` bool

YAML スタイル構文を許可（`KEY: value`）。**デフォルト `false`**。

```go
cfg.AllowYamlSyntax = true
```

### JSON オプション

#### `JSONNullAsEmpty` bool

JSON `null` を空文字列に変換。**デフォルト `true`**。

```go
cfg.JSONNullAsEmpty = true
```

---

#### `JSONNumberAsString` bool

JSON 数値を文字列に変換。**デフォルト `true`**。

```go
cfg.JSONNumberAsString = true
```

---

#### `JSONBoolAsString` bool

JSON 真偽値を文字列に変換。**デフォルト `true`**。

```go
cfg.JSONBoolAsString = true
```

---

#### `JSONMaxDepth` int

JSON の最大ネスト深度。**デフォルト 10**。

```go
cfg.JSONMaxDepth = 20
```

### YAML オプション

#### `YAMLNullAsEmpty` bool

YAML `null`/`~` を空文字列に変換。**デフォルト `true`**。

```go
cfg.YAMLNullAsEmpty = true
```

---

#### `YAMLNumberAsString` bool

YAML 数値を文字列に変換。**デフォルト `true`**。

```go
cfg.YAMLNumberAsString = true
```

---

#### `YAMLBoolAsString` bool

YAML 真偽値を文字列に変換。**デフォルト `true`**。

```go
cfg.YAMLBoolAsString = true
```

---

#### `YAMLMaxDepth` int

YAML の最大ネスト深度。**デフォルト 10**。

```go
cfg.YAMLMaxDepth = 15
```

### 監査

#### `AuditEnabled` bool

監査ログを有効化します。**デフォルト `false`**。

```go
cfg.AuditEnabled = true
```

---

#### `AuditHandler` AuditHandler

カスタム監査ハンドラー。

```go
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

::: tip 詳細は
[監査ログ](/ja/env/guides/audit-logging) で完全な監査設定の説明を参照。
:::

### 詳細オプション

#### `Prefix` string

このプレフィックスを持つ変数のみ処理。**デフォルト `""`**（すべての変数を処理）。

```go
cfg.Prefix = "MYAPP_"  // MYAPP_ で始まる変数のみ読み込み
```

---

#### `FileSystem` FileSystem

カスタムファイルシステムインターフェース（テスト用）。

```go
cfg.FileSystem = &MockFileSystem{}
```

---

#### `CustomValidator` Validator

カスタムキー/値バリデーター。組み込みバリデーターを上書き。

```go
cfg.CustomValidator = &MyValidator{}
```

---

#### `CustomExpander` VariableExpander

カスタム変数エキスパンダー。組み込みエキスパンダーを上書き。

```go
cfg.CustomExpander = &MyExpander{}
```

---

#### `CustomAuditor` AuditLogger

カスタム監査ロガー。組み込み監査ロガーを上書き。

```go
cfg.CustomAuditor = &MyAuditLogger{}
```

---

## ファクトリー関数

### DefaultConfig

```go
func DefaultConfig() Config
```

安全なデフォルト設定を返す。

**デフォルト値：**

| フィールド | 値 |
|------|-----|
| `Filenames` | `[".env"]` |
| `FailOnMissingFile` | `false` |
| `OverwriteExisting` | `false` |
| `AutoApply` | `false` |
| `ExpandVariables` | `true` |
| `MaxFileSize` | 2MB |
| `MaxLineLength` | 1024 |
| `MaxKeyLength` | 64 |
| `MaxValueLength` | 4096 |
| `MaxVariables` | 500 |
| `MaxExpansionDepth` | 5 |
| `ValidateValues` | `true` |
| `KeyPattern` | `nil` (高速検証) |
| `AllowExportPrefix` | `true` |
| `AllowYamlSyntax` | `false` |
| `JSONNullAsEmpty` | `true` |
| `JSONNumberAsString` | `true` |
| `JSONBoolAsString` | `true` |
| `JSONMaxDepth` | 10 |
| `YAMLNullAsEmpty` | `true` |
| `YAMLNumberAsString` | `true` |
| `YAMLBoolAsString` | `true` |
| `YAMLMaxDepth` | 10 |
| `ValidateUTF8` | `false` |
| `AuditEnabled` | `false` |
| `Prefix` | `""` |

---

### DevelopmentConfig

```go
func DevelopmentConfig() Config
```

開発環境設定を返す（緩やかな制限）。

**デフォルト設定との差分：**
- `OverwriteExisting`: `true`
- `AllowYamlSyntax`: `true`
- `MaxFileSize`: 10MB

::: tip セキュリティ保証
`ValidateValues` すべてのプリセット設定で常に維持 `true`（デフォルト値と同じ），セキュリティが環境の影響を受けないことを保証。
:::

```go
cfg := env.DevelopmentConfig()
cfg.Filenames = []string{".env.development"}
loader, _ := env.New(cfg)
```

---

### TestingConfig

```go
func TestingConfig() Config
```

テスト環境設定を返す。

**デフォルト設定との差分：**
- `OverwriteExisting`: `true`
- `MaxFileSize`: 64KB
- `MaxVariables`: 50

```go
func TestSomething(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}
    loader, _ := env.New(cfg)
    defer loader.Close()
}
```

---

### ProductionConfig

```go
func ProductionConfig() Config
```

本番環境設定を返す（厳格な検証 + 監査）。

**デフォルト設定との差分：**
- `FailOnMissingFile`: `true`
- `AuditEnabled`: `true`
- `MaxFileSize`: 64KB
- `MaxVariables`: 50

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
loader, _ := env.New(cfg)
```

---

### プリセットの詳細比較

| 機能 | Default | Development | Testing | Production |
|------|---------|-------------|---------|------------|
| 既存変数の上書き | ✗ | ✓ | ✓ | ✗ |
| ファイル不存在時にエラー | ✗ | ✗ | ✗ | ✓ |
| 監査ログ | ✗ | ✗ | ✗ | ✓ |
| YAML 構文 | ✗ | ✓ | ✗ | ✗ |
| ファイルサイズ制限 | 2MB | 10MB | 64KB | 64KB |
| 最大変数数 | 500 | 500 | 50 | 50 |
| 禁止キーチェック | ✓ | ✓ | ✓ | ✓ |
| 値検証 | ✓ | ✓ | ✓ | ✓ |

::: tip 選択のヒント
- **開発環境**：`DevelopmentConfig()` を使用、緩やかな制限で迅速なイテレーションが可能
- **テスト環境**：`TestingConfig()` を使用、上書きを許可しテスト分離が可能
- **本番環境**：`ProductionConfig()` を使用、監査と厳格な検証を有効化
:::

---

## 方法

### Validate

```go
func (c *Config) Validate() error
```

設定の有効性を検証。すべての制限値が有効範囲内にあるか確認。

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 1000

if err := cfg.Validate(); err != nil {
    // 設定が無効
}
```

**検証ルール：**
- すべての制限値は正の数である必要がある
- すべての制限値はハードリミットを超えることはできない
- `KeyPattern` nil でない場合，有効なキー名にマッチする必要がある（如 `TEST_KEY`）、空文字列にマッチしてはならない、数字で始まるキー名にマッチしてはならない
- `JSONMaxDepth` 和 `YAMLMaxDepth` 1-100 の範囲内である必要がある

---

### IsZero

```go
func (c *Config) IsZero() bool
```

Config が未初期化のゼロ値かどうかを確認。`DefaultConfig()` を使用すべきかを判断するために使用します。

**戻り値：**
- `bool` - ゼロ値設定かどうか

**検出範囲：**
- 数値制限（MaxFileSize、MaxVariables など）
- ブールフィールド（ValidateValues、AutoApply など）
- ポインタ・インターフェースフィールド（KeyPattern、FileSystem など）
- スライスフィールド（Filenames、RequiredKeys など）

::: warning 注意
部分的に初期化された Config はゼロ値として検出されない場合があります。常に `DefaultConfig()` からカスタム設定を開始することを推奨します：

```go
// 推奨
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}

// 非推奨（一部フィールドがゼロ値）
var cfg env.Config
cfg.Filenames = []string{".env.production"}
```
:::

---

## 使用例

### 基本設定

```go
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env", ".env.local"}
cfg.OverwriteExisting = true

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()
```

### 本番環境設定

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "DB_PORT", "API_KEY"}
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()

if err := loader.LoadFiles(".env"); err != nil {
    log.Fatal(err)
}

if err := loader.Validate(); err != nil {
    log.Fatal("必須設定が不足:", err)
}
```

### プレフィックスフィルタリング

```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_"  // MYAPP_KEY1, MYAPP_KEY2 のみ読み込み
cfg.Filenames = []string{".env"}

loader, _ := env.New(cfg)
// loader には MYAPP_ で始まる変数のみ含まれる
```

### カスタム検証

```go
import "regexp"

cfg := env.DefaultConfig()
// 大文字で始まるもののみ許可
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
// カスタム禁止キーを追加
cfg.ForbiddenKeys = []string{"DEBUG", "TRACE"}

loader, _ := env.New(cfg)
```

---

## 関連ドキュメント

- [Loader API](/ja/env/api-reference/loader) - ローダーメソッド
- [定数とエラー](/ja/env/api-reference/constants) - 制限定数とエラー型
- [監査ログ](/ja/env/guides/audit-logging) - 監査設定ガイド

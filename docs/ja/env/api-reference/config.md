---
title: "Config API - CyberGo env | 設定詳細"
description: "CyberGo env ライブラリ Config 設定構造体 API リファレンス。ファイル検索パス、セキュリティ制限パラメータ、キー値検証オプション、変数展開設定、監査ログ設定、および定義済み設定テンプレートを含む。Development と Production プリセットを提供し、異なる環境要件に対応。"
---

# Config API

`Config` 構造体の完全な設定オプションリファレンス。

## 構造体定義

Config 使用ネストされた構造体组织配置，同時に Go のフィールド昇格により後方互換性を維持：

```go
type Config struct {
    FileConfig       // ファイル読み込み行为
    ValidationConfig // 键和值検証
    LimitsConfig     // 大小和数量限制
    JSONConfig       // JSON 解析选项
    YAMLConfig       // YAML 解析选项
    ParsingConfig    // 通用解析行为
    ComponentConfig  // 自定义组件和高级选项
}
```

**两种访问方式：**

```go
// 旧方式（通过字段提升，仍然有效）
cfg.Filenames = []string{".env"}
cfg.MaxFileSize = 1024

// 新方式（推荐，更清晰）
cfg.FileConfig.Filenames = []string{".env"}
cfg.LimitsConfig.MaxFileSize = 1024
```

### ネストされた構造体

```go
// FileConfig 控制ファイル読み込み行为
type FileConfig struct {
    Filenames         []string // 要加载的文件列表
    FailOnMissingFile bool     // 文件不存在时是否报错
    OverwriteExisting bool     // 既存の環境変数を上書きするかどうか
    AutoApply         bool     // 是否自动应用到 os.Environ
}

// ValidationConfig 控制键和值検証
type ValidationConfig struct {
    RequiredKeys   []string       // 必須キー名のリスト
    AllowedKeys    []string       // 許可キー名のホワイトリスト
    ForbiddenKeys  []string       // 追加の禁止キーリスト
    KeyPattern     *regexp.Regexp // キー名マッチパターン
    ValidateValues bool           // 是否値の安全性を検証
    ValidateUTF8   bool           // 是否検証值为有效 UTF-8
}

// LimitsConfig 控制大小和数量限制
type LimitsConfig struct {
    MaxFileSize       int64 // 単一ファイルの最大バイト数
    MaxVariables      int   // ファイルごとの最大変数数
    MaxLineLength     int   // 単一行の最大長
    MaxKeyLength      int   // キー名の最大長
    MaxValueLength    int   // 値の最大長
    MaxExpansionDepth int   // 変数展開の最大深度
}

// JSONConfig 控制 JSON 解析行为
type JSONConfig struct {
    JSONNullAsEmpty    bool // null 转为空字符串
    JSONNumberAsString bool // 数字转为字符串
    JSONBoolAsString   bool // 布尔值转为字符串
    JSONMaxDepth       int  // 最大嵌套深度
}

// YAMLConfig 控制 YAML 解析行为
type YAMLConfig struct {
    YAMLNullAsEmpty    bool // null/~ 转为空字符串
    YAMLNumberAsString bool // 数字转为字符串
    YAMLBoolAsString   bool // 布尔值转为字符串
    YAMLMaxDepth       int  // 最大嵌套深度
}

// ParsingConfig 控制通用解析行为
type ParsingConfig struct {
    AllowExportPrefix bool // export KEY=value 構文を許可
    AllowYamlSyntax   bool // 允许 YAML 风格值
    ExpandVariables   bool // 是否展开 ${VAR} 引用
}

// ComponentConfig 自定义组件和高级选项
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

## 配置字段

### 文件处理

これらのフィールドはファイル読み込みの動作を制御します。

#### `Filenames` []string

要加载的ファイルパスのリスト。**默认 `[".env"]`**。

```go
cfg.Filenames = []string{".env", ".env.local"}
```

---

#### `FailOnMissingFile` bool

ファイルが存在しない場合にエラーを返すかどうか。**デフォルト `false`**（サイレントにスキップ）。

```go
cfg.FailOnMissingFile = true  // 文件不存在时报错
```

---

#### `OverwriteExisting` bool

既存の環境変数を上書きするかどうか。**默认 `false`**。

```go
cfg.OverwriteExisting = true  // 允许覆盖
```

---

#### `AutoApply` bool

加载后システム環境に自動適用（`os.Environ`）。**默认 `false`**。

```go
cfg.AutoApply = true  // 加载后自动应用
```

::: tip 注意
パッケージレベルの `Load()` 関数は自動的に `AutoApply = true` を設定します。`New()` で Loader を作成する場合は手動で設定する必要があります。
:::

### 变量展开

#### `ExpandVariables` bool

启用 `${VAR}` 语法变量展开。**默认 `true`**。

```go
cfg.ExpandVariables = true
```

サポートされる展開構文：

| 语法 | 说明 |
|------|------|
| `${VAR}` | 引用变量 |
| `${VAR:-default}` | 変数が存在しない、または空の場合にデフォルト値を使用 |
| `${VAR:=default}` | 変数が存在しない、または空の場合にデフォルト値を設定 |
| `${VAR:?error}` | 変数が存在しない、または空の場合にエラーを報告 |

### 安全限制

#### `MaxFileSize` int64

単一ファイルの最大バイト数。**默认 2MB**，ハードリミット 100MB。

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 MB
```

| 配置 | 默认值 | ハードリミット |
|------|--------|----------|
| `MaxFileSize` | 2MB (2097152) | 100MB |

---

#### `MaxLineLength` int

単一行の最大長。**默认 1024**，ハードリミット 64KB。

```go
cfg.MaxLineLength = 2048
```

| 配置 | 默认值 | ハードリミット |
|------|--------|----------|
| `MaxLineLength` | 1024 | 65536 (64KB) |

---

#### `MaxKeyLength` int

キー名の最大長。**默认 64**，ハードリミット 1024。

```go
cfg.MaxKeyLength = 128
```

| 配置 | 默认值 | ハードリミット |
|------|--------|----------|
| `MaxKeyLength` | 64 | 1024 |

---

#### `MaxValueLength` int

値の最大長。**默认 4096**，ハードリミット 1MB。

```go
cfg.MaxValueLength = 8192
```

| 配置 | 默认值 | ハードリミット |
|------|--------|----------|
| `MaxValueLength` | 4096 | 1048576 (1MB) |

---

#### `MaxVariables` int

ファイルごとの最大変数数。**默认 500**，ハードリミット 10000。

```go
cfg.MaxVariables = 1000
```

| 配置 | 默认值 | ハードリミット |
|------|--------|----------|
| `MaxVariables` | 500 | 10000 |

---

#### `MaxExpansionDepth` int

変数展開の最大深度。**默认 5**，ハードリミット 20。

```go
cfg.MaxExpansionDepth = 10
```

| 配置 | 默认值 | ハードリミット |
|------|--------|----------|
| `MaxExpansionDepth` | 5 | 20 |

### 键検証

#### `KeyPattern` *regexp.Regexp

自定义キー名マッチパターン。**默认 `nil`**（使用快速字节级検証）。

::: tip 性能优化
`nil` 值启用快速字节级検証（约 10 倍性能提升）。默认検証规则：以字母开头，只包含字母、数字、下划线。
:::

```go
import "regexp"

// 自定义模式
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
库内置禁止 `PATH`、`LD_PRELOAD`、`LD_LIBRARY_PATH`、`DYLD_INSERT_LIBRARIES` 等系统关键变量。詳細は [常量与错误](/ja/env/api-reference/constants#defaultforbiddenkeys)。
:::

---

#### `RequiredKeys` []string

必須キー名のリスト。`Validate()` 呼び出し時にチェックされます。

```go
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
```

---

#### `ValidateValues` bool

値の安全性を検証（制御文字、ヌルバイトなど）。**默认 `true`**。

::: warning 安全建议
常に有効にすることを推奨，仅在特殊场景（制御文字を含む値を保存する必要がある場合）时禁用。
:::

```go
cfg.ValidateValues = true  // 默认已启用
```

---

#### `ValidateUTF8` bool

値が有効な UTF-8 エンコーディングか検証します。**デフォルト `false`**。

```go
cfg.ValidateUTF8 = true  // 启用 UTF-8 検証
```

### 解析选项

#### `AllowExportPrefix` bool

允许 `export KEY=value` 语法。**默认 `true`**。

```go
cfg.AllowExportPrefix = false  // 禁止 export 前缀
```

---

#### `AllowYamlSyntax` bool

YAML スタイル構文を許可（`KEY: value`）。**默认 `false`**。

```go
cfg.AllowYamlSyntax = true
```

### JSON 选项

#### `JSONNullAsEmpty` bool

JSON `null` 值转为空字符串。**默认 `true`**。

```go
cfg.JSONNullAsEmpty = true
```

---

#### `JSONNumberAsString` bool

JSON 数字转为字符串。**默认 `true`**。

```go
cfg.JSONNumberAsString = true
```

---

#### `JSONBoolAsString` bool

JSON 布尔值转为字符串。**默认 `true`**。

```go
cfg.JSONBoolAsString = true
```

---

#### `JSONMaxDepth` int

JSON 最大嵌套深度。**默认 10**。

```go
cfg.JSONMaxDepth = 20
```

### YAML 选项

#### `YAMLNullAsEmpty` bool

YAML `null`/`~` 值转为空字符串。**默认 `true`**。

```go
cfg.YAMLNullAsEmpty = true
```

---

#### `YAMLNumberAsString` bool

YAML 数字转为字符串。**默认 `true`**。

```go
cfg.YAMLNumberAsString = true
```

---

#### `YAMLBoolAsString` bool

YAML 布尔值转为字符串。**默认 `true`**。

```go
cfg.YAMLBoolAsString = true
```

---

#### `YAMLMaxDepth` int

YAML 最大嵌套深度。**默认 10**。

```go
cfg.YAMLMaxDepth = 15
```

### 审计

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
[审计日志](/ja/env/guides/audit-logging) 完全な監査設定の説明を取得。
:::

### 高级选项

#### `Prefix` string

このプレフィックスを持つ変数のみ処理。**默认 `""`**（すべての変数を処理）。

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

## 工厂函数

### DefaultConfig

```go
func DefaultConfig() Config
```

安全なデフォルト設定を返す。

**默认值：**

| 字段 | 值 |
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
| `KeyPattern` | `nil` (快速検証) |
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

| 功能 | Default | Development | Testing | Production |
|------|---------|-------------|---------|------------|
| 既存変数の上書き | ✗ | ✓ | ✓ | ✗ |
| ファイル不存在時にエラー | ✗ | ✗ | ✗ | ✓ |
| 审计日志 | ✗ | ✗ | ✗ | ✓ |
| YAML 语法 | ✗ | ✓ | ✗ | ✗ |
| ファイルサイズ制限 | 2MB | 10MB | 64KB | 64KB |
| 最大变量数 | 500 | 500 | 50 | 50 |
| 禁止键检查 | ✓ | ✓ | ✓ | ✓ |
| 值検証 | ✓ | ✓ | ✓ | ✓ |

::: tip 選択のヒント
- **开发环境**：使用 `DevelopmentConfig()`，緩やかな制限で迅速なイテレーションが可能
- **测试环境**：使用 `TestingConfig()`，上書きを許可しテスト分離が可能
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
    // 配置无效
}
```

**検証规则：**
- すべての制限値は正の数である必要がある
- すべての制限値はハードリミットを超えることはできない
- `KeyPattern` nil でない場合，有効なキー名にマッチする必要がある（如 `TEST_KEY`）、空文字列にマッチしてはならない、数字で始まるキー名にマッチしてはならない
- `JSONMaxDepth` 和 `YAMLMaxDepth` 1-100 の範囲内である必要がある

---

### IsZero

```go
func (c *Config) IsZero() bool
```

Config が未初期化のゼロ値かどうかを確認。用于判断是否应使用 `DefaultConfig()`。

**戻り値：**
- `bool` - ゼロ値設定かどうか

**检测范围：**
- 数值限制（MaxFileSize、MaxVariables 等）
- 布尔字段（ValidateValues、AutoApply 等）
- 指针/接口字段（KeyPattern、FileSystem 等）
- 切片字段（Filenames、RequiredKeys 等）

::: warning 注意
部分的に初期化された Config はゼロ値として検出されない場合があります。建议始终从 `DefaultConfig()` 开始カスタム設定：

```go
// 推荐
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}

// 不推荐（部分字段为零值）
var cfg env.Config
cfg.Filenames = []string{".env.production"}
```
:::

---

## 使用示例

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
cfg.Prefix = "MYAPP_"  // 只加载 MYAPP_KEY1, MYAPP_KEY2 等
cfg.Filenames = []string{".env"}

loader, _ := env.New(cfg)
// loader 中只有 MYAPP_ 开头的变量
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
- [常量与错误](/ja/env/api-reference/constants) - 制限定数とエラー型
- [审计日志](/ja/env/guides/audit-logging) - 監査設定ガイド

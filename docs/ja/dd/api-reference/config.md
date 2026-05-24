---
title: "設定 - CyberGo DD | Config 詳解"
description: "CyberGo DD Config 構造体完全 API ドキュメント。DefaultConfig/DevelopmentConfig/JSONConfig プリセット設定関数、OutputTarget 出力先設定、フィールド検証ルール、サンプリング制御、フォーマットオプション、Validate 検証メソッドを含み、柔軟で型安全なロガーの動作カスタマイズ機能を提供。"
---

# 設定

DD は `Config` 構造体でロガーの動作を設定し、複数のプリセット設定ファクトリ関数を提供します。

## プリセット設定ファクトリ

```go
// デフォルト設定：INFO レベル、テキストフォーマット
cfg := dd.DefaultConfig()

// 開発設定：DEBUG レベル、動的 caller 検出
cfg := dd.DevelopmentConfig()

// JSON 設定：JSON フォーマット出力
cfg := dd.JSONConfig()
```

| ファクトリ関数 | 戻り値の型 | レベル | フォーマット | 適用シナリオ |
|----------|----------|------|------|----------|
| `DefaultConfig()` | `Config` | Info | Text | 本番環境 |
| `DevelopmentConfig()` | `Config` | Debug | Text | 開発環境 |
| `JSONConfig()` | `Config` | Debug | JSON | ログ収集 |

:::tip セキュリティフィルタリングはデフォルトで有効
全てのプリセット設定（`DefaultConfig`、`DevelopmentConfig`、`JSONConfig`）はデフォルトでセキュリティフィルタリングが有効で、パスワード、API Key、クレジットカード番号などの機密データを自動マスキングします。
:::

## Config 構造体

```go
type Config struct {
    // ログレベル
    Level          LogLevel         // ログレベル（デフォルト LevelInfo）
    Format         LogFormat        // 出力フォーマット（FormatText / FormatJSON）

    // 時間設定
    TimeFormat     string           // 時間フォーマット（デフォルト ISO 8601）
    IncludeTime    bool             // 時間を含むか（デフォルト true）
    IncludeLevel   bool             // レベルを含むか（デフォルト true）

    // 呼び出し元情報
    DynamicCaller  bool             // 動的呼び出し元検出（デフォルト true）
    FullPath       bool             // フルパスを表示するか（デフォルト false）

    // 出力先
    Targets        []OutputTarget   // 出力先リスト

    // JSON 設定
    JSON           *JSONOptions     // JSON 出力オプション

    // セキュリティ設定
    Security       *SecurityConfig  // セキュリティ設定

    // フィールド検証
    FieldValidation *FieldValidationConfig

    // ライフサイクルハンドラー
    FatalHandler      FatalHandler       // Fatal レベル カスタム処理関数
    WriteErrorHandler WriteErrorHandler  // 書き込みエラーコールバック

    // 拡張性
    ContextExtractors []ContextExtractor // コンテキストエクストラクタリスト
    Hooks             *HookRegistry      // フックレジストリ
    Sampling          *SamplingConfig    // サンプリング設定
}
```

### Clone

```go
func (c *Config) Clone() Config
```

設定のディープコピーを作成し、元の設定に影響を与えずに安全に変更できます。

```go
base := dd.DefaultConfig()
custom := base.Clone()
custom.Level = dd.LevelDebug
```

### Validate

```go
func (c Config) Validate() error
```

設定の妥当性を検証し、出力先、レベル、フォーマットなどが有効かチェックします。

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
if err := cfg.Validate(); err != nil {
    log.Fatal(err)
}
```

## 出力先

### OutputType

出力先タイプの列挙型。

```go
type OutputType int
```

| 定数 | 値 | 説明 |
|------|----|------|
| `OutputConsole` | `0` | コンソール出力（stdout） |
| `OutputFile` | `1` | ファイル出力 |
| `OutputCustom` | `2` | カスタム Writer |

### OutputTarget

出力先設定。単一出力先を記述します。

```go
type OutputTarget struct {
    Type       OutputType     // 出力タイプ
    Path       string         // ファイルパス（OutputFile 時に有効）
    MaxSizeMB  int            // ファイルサイズ上限 MB（OutputFile 時に有効）
    MaxBackups int            // バックアップ保持数（OutputFile 時に有効）
    MaxAge     time.Duration  // 古いファイルの保持期間（OutputFile 時に有効）
    Compress   bool           // gzip 圧縮するか（OutputFile 時に有効）
    Writer     io.Writer      // カスタム Writer（OutputCustom 時に有効）
}
```

### 出力先コンストラクタ

```go
func ConsoleOutput() OutputTarget
func FileOutput(path string) OutputTarget
func CustomOutput(w io.Writer) OutputTarget
```

```go
// コンソール出力
cfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// ファイル出力
cfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/app.log")}

// カスタム Writer
cfg.Targets = []dd.OutputTarget{dd.CustomOutput(customWriter)}

// マルチ出力先
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
}
```

## JSON 設定オプション

### JSONOptions

JSON 出力フォーマット設定。

```go
type JSONOptions struct {
    PrettyPrint bool           // 出力を整形するか（デフォルト false）
    Indent      string         // インデント文字列（デフォルト "  "）
    FieldNames  *JSONFieldNames // カスタム JSON フィールド名
}
```

### JSONFieldNames

JSON 出力のフィールド名をカスタマイズ。異なるログ収集システムへの適応に使用します。

```go
type JSONFieldNames struct {
    Timestamp string  // タイムスタンプフィールド名（デフォルト "timestamp"）
    Level     string  // レベルフィールド名（デフォルト "level"）
    Caller    string  // 呼び出し元フィールド名（デフォルト "caller"）
    Message   string  // メッセージフィールド名（デフォルト "message"）
    Fields    string  // フィールドコンテナ名（デフォルト "fields"）
}
```

使用例：

```go
cfg := dd.DefaultJSONOptions()
cfg.FieldNames = &dd.JSONFieldNames{
    Timestamp: "ts",
    Level:     "lvl",
    Message:   "msg",
}
```

### DefaultJSONOptions

```go
func DefaultJSONOptions() *JSONOptions
```

デフォルトの JSON 出力オプションを返します。

```go
cfg := dd.JSONConfig()
// デフォルト JSONOptions を含む
```

## SamplingConfig

サンプリング設定。高スループット環境でログ量を削減するために使用します。

```go
type SamplingConfig struct {
    Enabled    bool          // サンプリングを有効にするか
    Initial    int           // サンプリング前に常に記録するメッセージ数
    Thereafter int           // サンプリング率（値が 10 の場合、10 件に 1 件を記録）
    Tick       time.Duration // カウンターのリセット間隔（0 はリセットなし）
}
```

```go
cfg := dd.DefaultConfig()
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,
    Thereafter: 10,
    Tick:       time.Minute,
}
logger, _ := dd.New(cfg)
```

## FieldValidationConfig

フィールド検証設定。フィールドキー名の命名規則を制御します。

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode      // 検証モード
    Convention               FieldNamingConvention    // 命名規則
    AllowCommonAbbreviations bool                      // 一般的な略語（ID、URL など）を許可
    EnableSecurityValidation bool                      // セキュリティ検証を有効化（Log4Shell、ホモグラフ攻撃など）
}
```

### FieldValidationMode

| 定数 | 説明 |
|------|------|
| `FieldValidationNone` | 検証を無効化（デフォルト） |
| `FieldValidationWarn` | 非準拠フィールドを警告するが受け付ける |
| `FieldValidationStrict` | 非準拠フィールドを拒否し、エラーを出力 |

`String()` メソッドを実装し、モード名を返します。

### FieldNamingConvention

| 定数 | 説明 | 例 |
|------|------|------|
| `NamingConventionAny` | 任意のフォーマットを受け付け（デフォルト） | - |
| `NamingConventionSnakeCase` | snake_case | `user_id`, `created_at` |
| `NamingConventionCamelCase` | camelCase | `userId`, `createdAt` |
| `NamingConventionPascalCase` | PascalCase | `UserId`, `CreatedAt` |
| `NamingConventionKebabCase` | kebab-case | `user-id`, `created-at` |

`String()` メソッドを実装し、命名規則名を返します。

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

フィールドキー名が設定された命名規則に準拠しているか検証します。

## フィールド検証設定

### DefaultFieldValidationConfig

```go
func DefaultFieldValidationConfig() *FieldValidationConfig
```

デフォルト設定：検証は無効。

### StrictSnakeCaseConfig

```go
func StrictSnakeCaseConfig() *FieldValidationConfig
```

厳格 snake_case 検証。フィールド名は `snake_case` フォーマットでなければなりません。

### StrictCamelCaseConfig

```go
func StrictCamelCaseConfig() *FieldValidationConfig
```

厳格 camelCase 検証。フィールド名は `camelCase` フォーマットでなければなりません。

### 使用方法

```go
logger, _ := dd.New(dd.Config{
    Level:           dd.LevelInfo,
    FieldValidation: dd.StrictSnakeCaseConfig(),
})

// 有効
logger.InfoWith("ok", dd.String("user_name", "admin"))

// 無効（snake_case ではない）
logger.InfoWith("fail", dd.String("userName", "admin"))
```

## 設定例

### 本番環境

```go
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
    Security: dd.DefaultSecurityConfig(),
})
```

### 開発環境

```go
logger, _ := dd.New(dd.DevelopmentConfig())
```

### マルチ出力先

```go
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## 次のステップ

- [Logger](./logger) -- 設定を使用してロガーを作成
- [出力先](./writers) -- FileWriter、BufferedWriter、MultiWriter
- [セキュリティフィルタ](./security) -- SecurityConfig 詳解
- [フックシステム](./hooks) -- HooksConfig 詳解

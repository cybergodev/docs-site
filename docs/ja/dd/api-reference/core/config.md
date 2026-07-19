---
sidebar_label: "設定"
title: "設定 - CyberGo DD | Config 詳解"
description: "CyberGo DD Config 構造体 API ドキュメント。DefaultConfig/DevelopmentConfig/JSONConfig プリセット、OutputTarget 出力先、検証ルール、サンプリング、フォーマット、Validate 検証を含む型安全なロガー設定。"
sidebar_position: 4
---

# 設定

DD は `Config` 構造体でロガーの動作を設定し、複数のプリセット設定ファクトリ関数を提供します。

## プリセット設定ファクトリ

```go
// デフォルト設定：INFO レベル、テキストフォーマット
cfg := dd.DefaultConfig()
```

```go
// 開発設定：DEBUG レベル、動的 caller 検出
cfgDev := dd.DevelopmentConfig()
```

```go
// JSON 設定：JSON フォーマット出力
cfgJSON := dd.JSONConfig()
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

    // 監査設定
    Audit             *AuditConfig       // 監査ログ設定（セキュリティイベント）
}
```

:::tip Audit フィールド
`Audit` を設定すると、機密データのマスキング、レート制限イベント、セキュリティ違反が [AuditLogger](../security-audit/audit) 経由で監査イベントとして記録されます。[監査ログ](../security-audit/audit) を参照してください。
:::

### Clone

```go
func (c *Config) Clone() Config
```

設定のコピーを作成し、元の設定に影響を与えずに安全に変更できます。nil レシーバに対してはゼロ値 `Config{}` を返します。

コピーストラテジ（ソースコード `Clone` コメントと一致）：

- **ディープコピー**：`Targets`（スライス）、`JSON`（`JSONFieldNames` を含む）、`Security`、`Hooks`、`Sampling`、`Audit`
- **シャローコピー**：`FatalHandler`、`WriteErrorHandler`、`FieldValidation`（関数/ポインタを共有）
- **ハイブリッド**：`ContextExtractors` スライスはコピーされるが、エクストラクタインスタンス自体は共有

```go
base := dd.DefaultConfig()
custom := base.Clone()
custom.Level = dd.LevelDebug
```

### Validate

```go
func (c Config) Validate() error
```

設定の妥当性を検証し、最初に遭遇したエラーを返します。`dd.New(cfg)` 内部で自動的に呼び出されます；`New` に渡す前に手動で呼び出して問題を早期発見することもできます。

検証項目：

- `Level` は `[LevelDebug, LevelFatal]` の範囲内でなければなりません
- `Format` は `FormatText` または `FormatJSON` でなければなりません
- `IncludeTime=true` かつ `TimeFormat` が空でない場合、Go 時間リファレンスレイアウト（`time.RFC3339` など）を検証します
- `Targets` 総数は 100 を超えてはなりません（超過時は `ErrMaxWritersExceeded` を返します）
- 各 `Targets` 要素：`OutputCustom` は nil でない `Writer` を持つ必要があり、`OutputFile` は空でない `Path` を持つ必要があります

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

:::tip FileOutput のデフォルトローテーションパラメータ
`FileOutput` が返す `OutputTarget` にはデフォルトのローテーション値が事前入力されています：`MaxSizeMB=100`、`MaxBackups=10`、`MaxAge=30 * 24 * time.Hour`（30 日）、`Compress=false`。カスタマイズが必要な場合は戻り値の対応フィールドを直接変更します：

```go
target := dd.FileOutput("logs/app.log")
target.MaxSizeMB = 50               // 50 MB で分割
target.MaxBackups = 5               // 5 個のバックアップを保持
target.MaxAge = 7 * 24 * time.Hour  // 7 日間保持
target.Compress = true              // 古いログを gzip 圧縮
```

:::

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

ポインタレシーバメソッド `(*JSONFieldNames).IsComplete() bool` を実装しています。5つのフィールド名がすべて空でない場合に `true` を返し、すべてのフィールド名が完全にカスタマイズされているかを検証するために使用できます。

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

デフォルトの `JSONOptions` 出力オプションを返します：デフォルトでは整形出力せず（インデントは 2 つのスペース）、フィールド名はデフォルト値を使用します。

```go
opts := dd.DefaultJSONOptions()
opts.PrettyPrint = true

logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    JSON:   opts,
})
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
| `FieldValidationStrict` | 非準拠時は stderr にエラーを出力（ログエントリは拒否されずそのまま書き込まれます） |

`String()` メソッドを実装し、モード名を返します。

### FieldNamingConvention

| 定数 | 説明 | 例 |
|------|------|------|
| `NamingConventionAny` | 任意のフォーマットを受け付け（デフォルト） | - |
| `NamingConventionSnakeCase` | snake_case | `user_id`, `created_at` |
| `NamingConventionCamelCase` | camelCase | `userId`, `createdAt` |
| `NamingConventionPascalCase` | PascalCase | UserId, CreatedAt |
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

// 命名非準拠（snake_case ではない、ログは依然書き込まれ、エラーは stderr に出力）
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
- [出力先](../output-integration/writers) -- FileWriter、BufferedWriter、MultiWriter
- [セキュリティフィルタ](../security-audit/security) -- SecurityConfig 詳解
- [フックシステム](../security-audit/hooks) -- HooksConfig 詳解
- [監査ログ](../security-audit/audit) -- AuditConfig 詳解

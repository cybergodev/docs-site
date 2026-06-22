---
title: "Config 設定 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Config リファレンス：DefaultConfig、SecurityConfig、PrettyConfig、キャッシュ、サイズ制限、エンコード設定で Go アプリの JSON 挙動を完全にカスタマイズします。"
---

# Config

Config は Processor とすべての JSON 操作の動作をカスタマイズするために使用します。

## Config 構造体

```go
type Config struct {
    // ===== キャッシュ設定 =====
    MaxCacheSize int           `json:"max_cache_size"` // キャッシュエントリの最大数
    CacheTTL     time.Duration `json:"cache_ttl"`      // キャッシュ有効期限
    EnableCache  bool          `json:"enable_cache"`   // キャッシュを有効にするか
    CacheResults bool          `json:"cache_results"`  // 操作結果をキャッシュするか

    // ===== サイズ制限 =====
    MaxJSONSize  int64 `json:"max_json_size"`  // JSON の最大サイズ（バイト）
    MaxPathDepth int   `json:"max_path_depth"` // パスの最大深度
    MaxBatchSize int   `json:"max_batch_size"` // 一括操作の最大数

    // ===== セキュリティ制限 =====
    MaxNestingDepthSecurity   int   `json:"max_nesting_depth"`           // 最大ネスト深度
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"` // セキュリティ検証の最大サイズ
    MaxObjectKeys             int   `json:"max_object_keys"`             // オブジェクトの最大キー数
    MaxArrayElements          int   `json:"max_array_elements"`          // 配列の最大要素数
    FullSecurityScan          bool  `json:"full_security_scan"`          // 完全セキュリティスキャンを有効化

    // ===== 並行性 =====
    MaxConcurrency    int `json:"max_concurrency"`    // 最大並行数
    ParallelThreshold int `json:"parallel_threshold"` // 並列処理の閾値

    // ===== 処理オプション =====
    EnableValidation bool `json:"enable_validation"` // 検証を有効化
    StrictMode       bool `json:"strict_mode"`       // 厳格モード
    CreatePaths      bool `json:"create_paths"`      // パスを自動作成
    CleanupNulls     bool `json:"cleanup_nulls"`     // null 値をクリーンアップ
    CompactArrays    bool `json:"compact_arrays"`    // 配列を圧縮
    ContinueOnError  bool `json:"continue_on_error"` // 一括操作でエラー時に継続

    // ===== 入力/出力オプション =====
    AllowComments    bool `json:"allow_comments"`     // コメントを許可
    PreserveNumbers  bool `json:"preserve_numbers"`   // 数値精度を維持
    ValidateInput    bool `json:"validate_input"`     // 入力を検証
    ValidateFilePath bool `json:"validate_file_path"` // ファイルパスを検証
    SkipValidation   bool `json:"skip_validation"`    // 検証をスキップ（信頼できる入力）

    // ===== エンコードオプション =====
    Pretty          bool            `json:"pretty"`           // フォーマット出力
    Indent          string          `json:"indent"`           // インデント文字列
    Prefix          string          `json:"prefix"`           // プレフィックス
    EscapeHTML      bool            `json:"escape_html"`      // HTML エスケープ
    SortKeys        bool            `json:"sort_keys"`        // キーのソート
    ValidateUTF8    bool            `json:"validate_utf8"`    // UTF-8 検証
    MaxDepth        int             `json:"max_depth"`        // エンコード最大深度
    DisallowUnknown bool            `json:"disallow_unknown"` // 未知フィールドを禁止
    FloatPrecision  int             `json:"float_precision"`  // 浮動小数点精度（-1 で自動）
    FloatTruncate   bool            `json:"float_truncate"`   // 浮動小数点の切り捨て
    DisableEscaping bool            `json:"disable_escaping"` // エスケープを無効化
    EscapeUnicode   bool            `json:"escape_unicode"`   // Unicode エスケープ
    EscapeSlash     bool            `json:"escape_slash"`     // スラッシュエスケープ
    EscapeNewlines  bool            `json:"escape_newlines"`  // 改行文字エスケープ
    EscapeTabs      bool            `json:"escape_tabs"`      // タブ文字エスケープ
    IncludeNulls    bool            `json:"include_nulls"`    // null 値を含める
    CustomEscapes   map[rune]string `json:"custom_escapes,omitempty"` // カスタムエスケープマッピング

    // ===== オブザーバビリティ =====
    EnableMetrics     bool `json:"enable_metrics"`      // メトリクス収集を有効化
    EnableHealthCheck bool `json:"enable_health_check"` // ヘルスチェックを有効化

    // ===== 大規模ファイル処理 =====
    ChunkSize       int64 `json:"chunk_size"`       // チャンクサイズ
    MaxMemory       int64 `json:"max_memory"`       // 最大メモリ使用量
    BufferSize      int   `json:"buffer_size"`      // バッファサイズ
    SamplingEnabled bool  `json:"sampling_enabled"` // サンプリングを有効化
    SampleSize      int   `json:"sample_size"`      // サンプル数

    // ===== JSONL 設定 =====
    JSONLBufferSize    int   `json:"jsonl_buffer_size"`     // JSONL バッファサイズ
    JSONLMaxLineSize   int   `json:"jsonl_max_line_size"`   // JSONL 最大行サイズ
    JSONLSkipEmpty     bool  `json:"jsonl_skip_empty"`      // 空行をスキップ
    JSONLSkipComments  bool  `json:"jsonl_skip_comments"`   // コメント行をスキップ
    JSONLContinueOnErr bool  `json:"jsonl_continue_on_err"` // エラー時に継続
    JSONLWorkers       int   `json:"jsonl_workers"`         // JSONL 並列ワーカー数
    JSONLChunkSize     int   `json:"jsonl_chunk_size"`      // JSONL チャンクサイズ
    JSONLMaxMemory     int64 `json:"jsonl_max_memory"`      // JSONL 最大メモリ

    // ===== マージオプション =====
    MergeMode MergeMode `json:"merge_mode"` // マージ戦略

    // ===== 拡張ポイント（JSON タグなし、シリアライズ対象外） =====
    CustomEncoder               CustomEncoder                // カスタムエンコーダ
    CustomTypeEncoders          map[reflect.Type]TypeEncoder // カスタム型エンコーダ
    CustomValidators            []Validator                  // カスタムバリデータ
    AdditionalDangerousPatterns []DangerousPattern           // 追加危険パターン
    DisableDefaultPatterns      bool                         // デフォルト警告レベルパターンを無効化
    Hooks                       []Hook                       // 操作フック
    CustomPathParser            PathParser                   // カスタムパスパーサー
}
```

## 設定プリセット

### DefaultConfig

シグネチャ：`func DefaultConfig() Config`

デフォルト設定を返します。ほとんどのユースケースに適しています。

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**デフォルト値**

| フィールド | 値 | 説明 |
|------|-----|------|
| MaxJSONSize | 100MB | JSON サイズ制限 |
| MaxNestingDepthSecurity | 200 | ネスト深度 |
| MaxPathDepth | 50 | パス深度 |
| MaxSecurityValidationSize | 10MB | セキュリティ検証サイズ上限 |
| MaxObjectKeys | 100000 | オブジェクト最大キー数 |
| MaxArrayElements | 100000 | 配列最大要素数 |
| MaxConcurrency | 50 | 並行数 |
| MaxBatchSize | 2000 | 一括操作数 |
| CacheTTL | 5 分 | キャッシュ有効期限 |
| MaxCacheSize | 128 | キャッシュエントリ最大数 |
| EnableCache | true | キャッシュ有効 |
| CacheResults | true | 操作結果をキャッシュ |
| EnableValidation | true | 検証有効 |
| StrictMode | false | 非厳格モード |
| FullSecurityScan | false | サンプリングセキュリティスキャン（全量ではない） |
| ValidateInput | true | 入力検証 |
| ValidateFilePath | true | ファイルパス検証 |
| CreatePaths | true | パス自動作成 |
| Pretty | false | フォーマット出力しない |
| EscapeHTML | true | HTML エスケープ |
| ValidateUTF8 | true | UTF-8 検証 |
| IncludeNulls | true | null を含める |
| EscapeNewlines | true | 改行文字エスケープ |
| EscapeTabs | true | タブ文字エスケープ |
| FloatPrecision | -1 | 自動精度 |
| MaxDepth | 100 | エンコード深度 |
| Indent | "  " | デフォルトインデント |
| ChunkSize | 1MB | チャンクサイズ |
| MaxMemory | 100MB | 最大メモリ |
| BufferSize | 64KB | バッファサイズ |
| SamplingEnabled | true | サンプリング有効 |
| SampleSize | 1000 | サンプル数 |
| JSONLBufferSize | 64KB | JSONL バッファサイズ |
| JSONLMaxLineSize | 1MB | JSONL 最大行サイズ |
| JSONLSkipEmpty | true | 空行をスキップ |
| JSONLSkipComments | false | コメントをスキップしない |
| JSONLContinueOnErr | false | エラー時に停止 |
| JSONLWorkers | 4 | 並列ワーカー数 |
| JSONLChunkSize | 1000 | JSONL チャンクサイズ |
| JSONLMaxMemory | 100MB | JSONL 最大メモリ |
| MergeMode | MergeUnion | ユニオンマージ |

### SecurityConfig

シグネチャ：`func SecurityConfig() Config`

セキュリティ設定を返します。信頼できない入力の処理に適しています。

```go
// 以下の用途に推奨：
// - パブリック API と Web サービス
// - ユーザー送信データ
// - 外部 Webhook
// - 認証エンドポイント
// - 金融データ処理
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**セキュリティ設定の特徴**

| フィールド | 値 | 説明 |
|------|-----|------|
| MaxNestingDepthSecurity | 30 | 控えめなネスト深度 |
| MaxSecurityValidationSize | 10MB | セキュリティ検証サイズ |
| MaxObjectKeys | 5000 | 控えめなキー数制限 |
| MaxArrayElements | 5000 | 控えめな要素制限 |
| MaxJSONSize | 10MB | 控えめなサイズ制限 |
| MaxPathDepth | 30 | 控えめなパス深度 |
| FullSecurityScan | true | 完全セキュリティスキャン |
| StrictMode | true | 厳格モード |
| EnableValidation | true | 検証有効 |
| EnableCache | true | キャッシュ有効 |
| MaxCacheSize | 256 | キャッシュサイズ |
| CacheTTL | 3 分 | 短い TTL |

### PrettyConfig

シグネチャ：`func PrettyConfig() Config`

フォーマット出力設定を返します。

```go
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

## 設定メソッド

### Clone

シグネチャ：`func (c *Config) Clone() *Config`

設定のディープコピーを作成します。

```go
cfg := json.DefaultConfig()
cfgCopy := cfg.Clone()
cfgCopy.EnableValidation = true // 元の設定には影響しない
```

### Validate

シグネチャ：`func (c *Config) Validate() error`

設定を検証し、無効な値を自動修正します。このメソッドは Config を**インプレースで変更**し、無効なフィールドを対応する最小有効値に修正します。

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1 // 無効な値
if err := cfg.Validate(); err != nil {
    panic(err)
}
// MaxJSONSize はインプレースで最小値に修正される
```

### ValidateWithWarnings

シグネチャ：`func (c *Config) ValidateWithWarnings() []ConfigWarning`

設定を検証し、修正警告リストを返します。

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1
warnings := cfg.ValidateWithWarnings()
for _, w := range warnings {
    fmt.Printf("%s: %s\n", w.Field, w.Reason)
}
```

### ConfigWarning 型

`ConfigWarning` は設定検証中に自動修正された情報を表します。

```go
type ConfigWarning struct {
    Field    string // 修正されたフィールド名
    OldValue any    // 元の値（無効な値の場合は nil の可能性あり）
    NewValue any    // 修正後の値
    Reason   string // 修正理由
}
```

### SecurityLimits 型

`SecurityLimits` は Config 内のセキュリティ関連制限フィールドを集約します。

```go
type SecurityLimits struct {
    MaxNestingDepth           int   `json:"max_nesting_depth"`
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"`
    MaxObjectKeys             int   `json:"max_object_keys"`
    MaxArrayElements          int   `json:"max_array_elements"`
    MaxJSONSize               int64 `json:"max_json_size"`
    MaxPathDepth              int   `json:"max_path_depth"`
}
```

### AddHook

シグネチャ：`func (c *Config) AddHook(hook Hook)`

操作フックを追加します。

```go
cfg := json.DefaultConfig()
cfg.AddHook(json.LoggingHook(slog.Default()))
```

### AddValidator

シグネチャ：`func (c *Config) AddValidator(validator Validator)`

カスタムバリデータを追加します。

```go
cfg := json.DefaultConfig()
cfg.AddValidator(&MyValidator{})
```

### AddDangerousPattern

シグネチャ：`func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

追加セキュリティパターンを追加します。

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

## 使用例

### 基本的な使い方

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### セキュリティ設定

```go
// 信頼できない入力の処理
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### フォーマット出力

```go
// JSON のフォーマット
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

### カスタム設定

```go
cfg := json.DefaultConfig()

// セキュリティ設定
cfg.MaxJSONSize = 10 * 1024 * 1024 // 10MB
cfg.MaxNestingDepthSecurity = 50
cfg.EnableValidation = true

// フック
cfg.Hooks = []json.Hook{json.LoggingHook(slog.Default())}

// バリデータ
cfg.CustomValidators = []json.Validator{&MyValidator{}}

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### クローンと変更

```go
// デフォルト設定をベースにバリアントを作成
base := json.DefaultConfig()

// バリアント 1：開発用設定
devCfg := base.Clone()
devCfg.EnableMetrics = true

// バリアント 2：本番用設定
prodCfg := base.Clone()
prodCfg.EnableValidation = true
```

## 設定定数

```go
const (
    // サイズ制限
    DefaultMaxJSONSize       = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth   = 200
    DefaultMaxPathDepth      = 50
    DefaultMaxDepth          = 100                 // エンコード/デコードのデフォルトネスト深度（Config.MaxDepth）
    DefaultMaxConcurrency    = 50
    DefaultMaxBatchSize      = 2000
    DefaultMaxSecuritySize   = 10 * 1024 * 1024   // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultParallelThreshold = 10

    // キャッシュ
    DefaultCacheTTL = 5 * time.Minute
)
```

::: info 内部定数
パス検証の長さ制限（`maxPathLength`）などの定数は内部実装に移行し、公開 API としてエクスポートされなくなりました。関連するデフォルト値は `Config` 構造体のフィールドデフォルト値として反映されています。
:::

---

## マージモード

`MergeMode` は `MergeJSON` と `MergeMany` 関数のマージ戦略を制御します。

### MergeUnion（デフォルト）

すべてのキー/要素をマージし、競合時は上書き値を使用します。

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeUnion
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 結果: {"a": 1, "b": 3, "c": 4}
```

### MergeIntersection

両方のオブジェクトに存在するキーのみを保持します。

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 結果: {"b": 3}
```

### MergeDifference

ベースオブジェクトに存在し、上書きオブジェクトに存在しないキーのみを保持します。

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 結果: {"a": 1}
```

---

## セキュリティの推奨事項

| 設定項目 | 推奨値 | 説明 |
|--------|--------|------|
| MaxJSONSize | 10-100MB | サーバーのメモリに応じて調整 |
| MaxNestingDepthSecurity | 30-50 | 深度ネスト攻撃を防止 |
| MaxPathDepth | 30-50 | パスの複雑さを制限 |
| EnableValidation | true | 常に有効化 |
| FullSecurityScan | true（信頼できない入力） | 完全セキュリティスキャン |

## 関連

- [Processor](./processor/) - プロセッサメソッド
- [定数とエラー](./constants) - 設定定数
- [セキュリティ概要](../security/) - セキュリティベストプラクティス
- [インターフェース定義](./interfaces) - 拡張インターフェース

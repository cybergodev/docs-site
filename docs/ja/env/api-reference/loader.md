---
title: "Loader API - CyberGo env | ローダー詳細"
description: "CyberGo env の Loader API リファレンス。コア型が多フォーマット読み込み、型安全読み取り、キー操作、検証、シリアライズ、Close ライフサイクルを提供し、すべてスレッドセーフです。"
---

# Loader API

`Loader` 型の完全なメソッドリファレンス。Loader は env ライブラリのコアとなる型で、環境変数の読み込み、保存、アクセス機能を提供します。

::: tip スレッドセーフ
Loader のすべてのメソッドはスレッドセーフで、複数の goroutine から並行して呼び出し可能です。
:::

## 型定義

```go
type Loader struct {
    // プライベートフィールドを含む
}

// コンパイル時インターフェース実装チェック
var _ EnvLoader = (*Loader)(nil)
var _ io.Closer = (*Loader)(nil)
```

---

## 作成

### New

```go
func New(cfg ...Config) (*Loader, error)
```

新しいローダーインスタンスを作成。

**パラメータ：**
- `cfg` - オプションの設定。指定しない場合やゼロ値の Config を渡した場合、自動的に `DefaultConfig()` を使用

**戻り値：**
- `*Loader` - ローダーインスタンス
- `error` - 設定検証エラー

**動作：**
- 設定の有効性を検証
- 内部コンポーネントを作成（検証器、監査ロガー、変数エキスパンダー）
- `cfg.Filenames` が空でない場合、ファイルを自動読み込み
- `cfg.AutoApply` が true の場合、システム環境に自動適用

```go
// デフォルト設定を使用
loader, err := env.New()

// カスタム設定を使用
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env"}
cfg.AutoApply = true
loader, err := env.New(cfg)

if err != nil {
    panic(err)
}
defer loader.Close()
```

---

## ファイル読み込み

### LoadFiles

```go
func (l *Loader) LoadFiles(filenames ...string) error
```

1つ以上の設定ファイルを読み込み。

**パラメータ：**
- `filenames` - ファイルパスのリスト、空の場合はデフォルトで `.env` を読み込み

**戻り値：**
- `error` - 読み込みエラー

**動作：**
- 順番に読み込み，後から読み込んだものが前のものを上書き（`OverwriteExisting` 設定に制御される）
- ファイルフォーマットを自動検出（.env、JSON、YAML）
- `FailOnMissingFile` 設定に基づいてファイルが存在しない場合の動作を決定
- `AutoApply` が true の場合、読み込み後に自動適用

```go
// デフォルトの .env ファイルを読み込み
err := loader.LoadFiles()

// 指定されたファイルを読み込み
err := loader.LoadFiles(".env", ".env.local")

// ミックスフォーマット
err := loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

**エラー型：**
- `ErrFileNotFound` - ファイルが存在しない（`FailOnMissingFile=true` の場合）
- `ErrFileTooLarge` - ファイルサイズが制限を超過
- `ErrClosed` - ローダークローズ済み
- `*ParseError` - 解析エラー
- `*JSONError` - JSON 解析エラー
- `*YAMLError` - YAML 解析エラー

**フォーマット検出ルール：**

| 拡張子 | フォーマット |
|--------|------|
| `.env` | FormatEnv |
| `.json` | FormatJSON |
| `.yaml`, `.yml` | FormatYAML |
| その他 | FormatAuto（.env パーサーを使用） |

---

## 値の取得

### キー名の解決

すべての取得メソッドがスマートキー名解決をサポート：

| 入力キー名 | 解決結果 |
|----------|----------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"`（完全一致） |
| `"database.host"` | `"DATABASE_HOST"`（ドットをアンダースコアに変換） |
| `"app.name"` | `"APP_NAME"`（大文字 + アンダースコア） |
| `"servers.0.host"` | `"SERVERS_0_HOST"`（配列インデックス） |

**解決順序：**
1. 完全一致 - キー名を直接検索
2. 大文字変換 - 単純キーの大文字バージョンを試行
3. パス解決 - ドットパスをアンダースコア形式に変換
4. インデックスフォールバック - インデックスアクセス時にカンマ区切り値にフォールバック

---

### GetString

```go
func (l *Loader) GetString(key string, defaultValue ...string) string
```

文字列値の取得。ドットパス解決をサポート。

**パラメータ：**
- `key` - キー名（完全一致、大文字変換、ドットパスをサポート）
- `defaultValue` - オプションのデフォルト値

**戻り値：**
- `string` - 値またはデフォルト値（未検出かつデフォルト値がない場合は空文字列を返す）

```go
// 基本用法
host := loader.GetString("HOST", "localhost")

// ドットパスアクセス（JSON/YAML ネスト構造）
dbHost := loader.GetString("database.host", "localhost")
appName := loader.GetString("app.name")

// デフォルト値がない場合は空文字列を返す
value := loader.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func (l *Loader) GetInt(key string, defaultValue ...int64) int64
```

整数値の取得。ドットパス解決をサポート。

**パラメータ：**
- `key` - キー名（ドットパスをサポート）
- `defaultValue` - オプションのデフォルト値、`int64` 型

**戻り値：**
- `int64` - 値またはデフォルト値（未検出かつデフォルト値がない場合は 0 を返す）

```go
port := loader.GetInt("PORT", 8080)
maxConn := loader.GetInt("database.max_connections", 10)

// デフォルト値がない場合は 0 を返す
value := loader.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func (l *Loader) GetBool(key string, defaultValue ...bool) bool
```

ブール値の取得。ドットパス解決をサポート。

**パラメータ：**
- `key` - キー名（ドットパスをサポート）
- `defaultValue` - オプションのデフォルト値

**戻り値：**
- `bool` - 値またはデフォルト値（未検出かつデフォルト値がない場合は false を返す）

**サポートされる値：**
- 真の値：`true`, `1`, `yes`, `on`, `enabled`
- 偽の値：`false`, `0`, `no`, `off`, `disabled`

```go
debug := loader.GetBool("DEBUG", false)
cacheEnabled := loader.GetBool("cache.enabled", true)

// デフォルト値がない場合は false を返す
value := loader.GetBool("NON_EXISTENT")  // false
```

---

### GetUint64

```go
func (l *Loader) GetUint64(key string, defaultValue ...uint64) uint64
```

符号なし整数値の取得。ドットパス解決をサポート。

**パラメータ：**
- `key` - キー名（ドットパスをサポート）
- `defaultValue` - オプションのデフォルト値、`uint64` 型

**戻り値：**
- `uint64` - 値またはデフォルト値（未検出かつデフォルト値がない場合は 0 を返す）

```go
port := loader.GetUint64("PORT", 8080)
maxSize := loader.GetUint64("MAX_SIZE", 1024)

// デフォルト値がない場合は 0 を返す
value := loader.GetUint64("NON_EXISTENT")  // 0
```

---

### GetFloat64

```go
func (l *Loader) GetFloat64(key string, defaultValue ...float64) float64
```

浮動小数点数値の取得。ドットパス解決をサポート。

**パラメータ：**
- `key` - キー名（ドットパスをサポート）
- `defaultValue` - オプションのデフォルト値、`float64` 型

**戻り値：**
- `float64` - 値またはデフォルト値（未検出かつデフォルト値がない場合は 0 を返す）

```go
rate := loader.GetFloat64("RATE", 0.5)
threshold := loader.GetFloat64("THRESHOLD")

// デフォルト値がない場合は 0 を返す
value := loader.GetFloat64("NON_EXISTENT")  // 0
```

---

### GetDuration

```go
func (l *Loader) GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

時間間隔値の取得。ドットパス解決をサポート。

**パラメータ：**
- `key` - キー名（ドットパスをサポート）
- `defaultValue` - オプションのデフォルト値

**戻り値：**
- `time.Duration` - 値またはデフォルト値（未検出かつデフォルト値がない場合は 0 を返す）

**サポートフォーマット：** `ns`, `us`, `ms`, `s`, `m`, `h`（例：`30s`, `5m`, `1h30m`）

```go
timeout := loader.GetDuration("TIMEOUT", 30*time.Second)
ttl := loader.GetDuration("cache.ttl", 5*time.Minute)

// デフォルト値がない場合は 0 を返す
value := loader.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

セキュア値を取得します（機密データ保護）。

**パラメータ：**
- `key` - キー名

**戻り値：**
- `*SecureValue` - セキュア値の**防御的コピー**、呼び出し側が解放に責任を持つ。キーが存在しない、またはローダーがクローズ済みの場合は nil を返す

```go
secret := loader.GetSecure("API_SECRET")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()
    masked := secret.Masked()  // [SECURE:32 bytes]
}
```

::: warning 重要
使用後にリソースを解放するため、必ず `Release()` または `Close()` を呼び出す必要があります。
:::

::: tip 防御的コピー
`GetSecure` が返すのは元の値のコピーで、親 Loader から独立しています。呼び出し側は `Release()` または `Close()` を呼び出して解放する責任があります。
:::

::: tip 詳細は
[SecureValue API](/ja/env/api-reference/secure-value) 完全なドキュメントを取得。
:::

---

### スライス値の取得

Loader にはスライス取得メソッドがありません（Go はジェネリックメソッドをサポートしていません）。独立したジェネリック関数 `GetSliceFrom[T]` を使用して Loader インスタンスからスライスを取得してください：

```go
// 独立したジェネリック関数を使用
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})
portsInt := env.GetSliceFrom[int](loader, "PORTS")  // int もサポート
```

**サポートされる型：** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

::: tip 詳細は
[パッケージ関数 - GetSliceFrom](/ja/env/api-reference/functions#getslicefrom-t) で完全なドキュメントを確認。
:::

---

### Lookup

```go
func (l *Loader) Lookup(key string) (string, bool)
```

キーが存在するか確認して値を取得。ドットパス解決をサポート。

**パラメータ：**
- `key` - キー名（ドットパスをサポート）

**戻り値：**
- `string` - 値（先頭と末尾の空白は削除される）
- `bool` - 存在するかどうか

```go
value, exists := loader.Lookup("API_KEY")
if !exists {
    // キーが存在しない
}

// ドット表記パス
if value, exists := loader.Lookup("database.host"); exists {
    fmt.Println(value)
}

// インデックスアクセス（カンマ区切り値にフォールバック）
// HOSTS=localhost,example.com
if value, exists := loader.Lookup("hosts.0"); exists {
    fmt.Println(value)  // "localhost"
}
```

---

## 設定と削除

### Set

```go
func (l *Loader) Set(key, value string) error
```

環境変数の設定。

**パラメータ：**
- `key` - キー名
- `value` - 値

**戻り値：**
- `error` - 設定エラー

**動作：**
- キー名の有効性を検証
- `ValidateValues` が true の場合、値の安全性を検証
- `OverwriteExisting` が false でキーが既に存在する場合、スキップ（nil を返す）
- `AutoApply` が true の場合、同時にシステム環境に設定

```go
err := loader.Set("CUSTOM_KEY", "value")
if err != nil {
    // エラーを処理
}
```

**エラー型：**
- `ErrInvalidKey` - キー名が無効
- `ErrForbiddenKey` - キーが禁止されています
- `ErrClosed` - ローダークローズ済み

---

### Delete

```go
func (l *Loader) Delete(key string) error
```

環境変数の削除。

**パラメータ：**
- `key` - キー名

**戻り値：**
- `error` - 削除エラー

**動作：**
- 変数がシステム環境に適用済みの場合，同時にシステム環境から削除

```go
err := loader.Delete("TEMP_KEY")
if err != nil {
    panic(err)
}
```

---

## コレクション操作

### Keys

```go
func (l *Loader) Keys() []string
```

すべてのキー名を取得。

**戻り値：**
- `[]string` - キー名リスト、ローダークローズ済みの場合は nil を返す

```go
keys := loader.Keys()
for _, key := range keys {
    fmt.Println(key)
}
```

---

### All

```go
func (l *Loader) All() map[string]string
```

すべてのキーと値のペアを取得。

**戻り値：**
- `map[string]string` - キーと値のマッピング、ローダークローズ済みの場合は nil を返す

```go
all := loader.All()
for key, value := range all {
    fmt.Printf("%s=%s\n", key, value)
}
```

---

### Len

```go
func (l *Loader) Len() int
```

変数の数を取得。

**戻り値：**
- `int` - 変数の数、ローダークローズ済みの場合は 0 を返す

```go
count := loader.Len()
fmt.Printf("%d 個の変数をロードしました\n", count)
```

---

## システムへの適用

### Apply

```go
func (l *Loader) Apply() error
```

変数をシステム環境に適用（`os.Environ`）。

**戻り値：**
- `error` - 適用エラー

**動作：**
- 読み込まれたすべての変数を反復処理
- `OverwriteExisting` 設定に基づいて既存のシステム環境変数を上書きするかどうかを決定
- 適用後は `os.Getenv()` でアクセス可能

```go
err := loader.Apply()
if err != nil {
    panic(err)
}

// その後 os.Getenv() でもアクセス可能
host := os.Getenv("HOST")
```

---

### IsApplied

```go
func (l *Loader) IsApplied() bool
```

変数がシステム環境に適用済みか確認。

**戻り値：**
- `bool` - 適用済みかどうか

```go
if loader.IsApplied() {
    // 変数は os.Environ に適用済み
}
```

---

## ステータスクエリ

### LoadTime

```go
func (l *Loader) LoadTime() time.Time
```

最後にファイルを読み込んだ時間を返す。

**戻り値：**
- `time.Time` - 読み込み時刻、未読み込みの場合はゼロ値を返す

```go
loadTime := loader.LoadTime()
if !loadTime.IsZero() {
    fmt.Printf("最終読み込み時刻: %v\n", loadTime)
}
```

---

### Config

```go
func (l *Loader) Config() Config
```

ローダーの設定を返す。

**戻り値：**
- `Config` - 設定（読み取り専用として扱うこと）

::: warning 注意
返された Config は読み取り専用と見なすべきです。`KeyPattern`、`AllowedKeys`、`ForbiddenKeys`、`RequiredKeys` などのフィールドを変更するとローダーの動作に影響する可能性があります。安全に変更可能なコピーが必要な場合は、必要なフィールドを手動でコピーしてください。
:::

```go
cfg := loader.Config()
fmt.Printf("最大ファイルサイズ: %d\n", cfg.MaxFileSize)
```

---

## 検証とマッピング

### Validate

```go
func (l *Loader) Validate() error
```

検証必需键存在するかどうか。

**戻り値：**
- `error` - 検証エラー

**動作：**
- `Config.RequiredKeys` で指定されたすべてのキーが存在するかどうかをチェック

```go
cfg := env.DefaultConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
    // 必須キーが不足
    var missingErr *env.ValidationError
    if errors.As(err, &missingErr) {
        fmt.Printf("不足: %s\n", missingErr.Field)
    }
}
```

---

### ParseInto

```go
func (l *Loader) ParseInto(v any) error
```

環境変数を構造体にマッピング。

**パラメータ：**
- `v` - 構造体ポインタ

**戻り値：**
- `error` - マッピングエラー

**サポートされるタグ：**
- `env:"KEY"` - 指定環境変数名
- `env:"-"` - このフィールドを無視
- `envDefault:"value"` - デフォルト値を指定
- `envSeparator:","` - スライスのセパレータを指定

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS" envSeparator:","`
    Ignored string   `env:"-"`
}

var cfg Config
err := loader.ParseInto(&cfg)
if err != nil {
    panic(err)
}
```

---

## リソースの解放

### Close

```go
func (l *Loader) Close() error
```

リソースを解放しストレージをクリア。

**戻り値：**
- `error` - クローズエラー

**動作：**
- 保存されたすべての機密データを安全にゼロクリア
- ローダーが所有している場合 ComponentFactory，同時にファクトリーをクローズ
- 安全にクローズ、複数回呼び出しでも nil を返す

```go
loader, _ := env.New(cfg)
defer loader.Close()

// 使用 loader...
```

::: warning クローズ後の動作
クローズ後のすべての操作はエラーまたはゼロ値を返します：
- `LoadFiles` → `ErrClosed`
- `GetString` → 空の値を返す
- `Set` → `ErrClosed`
- `Keys` → nil を返す
- `Len` → 0 を返す
:::

---

### IsClosed

```go
func (l *Loader) IsClosed() bool
```

ローダーがクローズ済みか確認。

**戻り値：**
- `bool` - 是否クローズ済み

```go
if loader.IsClosed() {
    // ローダーはクローズ済み
}
```

---

## 完全な例

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/cybergodev/env"
)

func main() {
    // 作成本番環境設定
    cfg := env.ProductionConfig()
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
    cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

    // ローダーの作成
    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // ファイルを読み込み
    if err := loader.LoadFiles(".env", ".env.production"); err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Fatal("設定ファイルが存在しません")
        }
        log.Fatal(err)
    }

    // 必須キーを検証
    if err := loader.Validate(); err != nil {
        log.Fatal("必須設定が不足:", err)
    }

    // 設定の読み取り
    host := loader.GetString("DB_HOST")
    port := loader.GetInt("DB_PORT", 5432)
    debug := loader.GetBool("DEBUG", false)
    timeout := loader.GetDuration("TIMEOUT", 30*time.Second)

    fmt.Printf("Server: %s:%d\n", host, port)
    fmt.Printf("Debug: %v, Timeout: %v\n", debug, timeout)

    // 機密データ
    secret := loader.GetSecure("API_KEY")
    if secret != nil {
        defer secret.Release()
        fmt.Printf("API Key length: %d\n", secret.Length())
    }

    // システム環境に適用
    if err := loader.Apply(); err != nil {
        log.Fatal(err)
    }

    // すべての変数
    fmt.Printf("Loaded %d variables\n", loader.Len())
    fmt.Printf("Load time: %v\n", loader.LoadTime())
}
```

## 関連ドキュメント

- [パッケージ関数](/ja/env/api-reference/functions) - パッケージレベル便利関数
- [Config API](/ja/env/api-reference/config) - 設定オプション
- [SecureValue API](/ja/env/api-reference/secure-value) - セキュア値処理
- [インターフェース定義](/ja/env/api-reference/interfaces) - すべてのインターフェース定義

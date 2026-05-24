---
title: "ComponentFactory API - CyberGo env | コンポーネントファクトリー"
description: "CyberGo env ライブラリ ComponentFactory コンポーネントファクトリー API 完全リファレンス。Loader と Parser が共有するコンポーネントインスタンスの作成と管理、監査ハンドラー、検証器、ファイルシステムアダプター、RegisterParser カスタムパーサー登録を含む。コンポーネントライフサイクル制御 Close とスレッドセーフな並発アクセスを提供。"
---

# ComponentFactory API

`ComponentFactory` は Loader と Parser が共有するコンポーネントを作成・管理し、明確なライフサイクル管理を提供します。

## 型定義

```go
type ComponentFactory struct {
    // プライベートフィールドを含む
}
```

**コアとなる責務：**
- 検証器、監査ロガー、変数エキスパンダーの共有インスタンスを作成
- コンポーネントライフサイクルを管理
- カスタムパーサーからの内部コンポーネントへのアクセスをサポート

**スレッドセーフ：** ComponentFactory のすべてのメソッドはスレッドセーフです。

---

## 方法

### Validator

```go
func (f *ComponentFactory) Validator() Validator
```

検証器コンポーネントを返します。キー名と値の検証に使用します。

```go
// カスタムパーサー内で使用
validator := factory.Validator()

if err := validator.ValidateKey("MY_KEY"); err != nil {
    // キー名が無効
}

if err := validator.ValidateValue("some value"); err != nil {
    // 値に不正な内容が含まれている（ヌルバイト、制御文字など）
}
```

---

### Auditor

```go
func (f *ComponentFactory) Auditor() FullAuditLogger
```

監査ログコンポーネントを返します。完全な監査ログ機能を提供します。

```go
auditor := factory.Auditor()
_ = auditor.Log(env.ActionSet, "KEY", "value set", true)
_ = auditor.LogError(env.ActionSet, "KEY", "validation failed")
_ = auditor.LogWithFile(env.ActionLoad, "KEY", ".env", "loaded", true)
_ = auditor.LogWithDuration(env.ActionParse, "", "parsed", true, time.Since(start))
```

---

### Expander

```go
func (f *ComponentFactory) Expander() VariableExpander
```

変数エキスパンダーコンポーネントを返します。`${VAR}` 構文の変数展開に使用します。

```go
expander := factory.Expander()
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

### Close

```go
func (f *ComponentFactory) Close() error
```

ファクトリーが保持するリソースを解放します。クローズ後はファクトリーおよびそれを通じて作成されたコンポーネントは使用しないでください。

**動作：**
- 安全にクローズ、複数回呼び出しでも nil を返す
- 監査ロガーのリソースを解放
- アトミック操作でスレッドセーフを保証

```go
// 通常、Loader が自動的に管理
loader, _ := env.New(cfg)
defer loader.Close()  // 自動的に ComponentFactory をクローズ
```

---

### IsClosed

```go
func (f *ComponentFactory) IsClosed() bool
```

ファクトリーがクローズ済みか確認。

```go
if factory.IsClosed() {
    // ファクトリークローズ済み、使用不可
}
```

---

## 作成方法

### 自動作成（推奨）

Loader 作成時に ComponentFactory は自動的に作成・管理されます：

```go
cfg := env.DefaultConfig()
loader, _ := env.New(cfg)
// Loader 内部で自動的に ComponentFactory を作成
defer loader.Close()  // ファクトリーを自動クローズ
```

### カスタムパーサー内での使用

カスタムパーサーの登録時、ComponentFactory を通じて検証器と監査ロガーを取得：

```go
type CustomParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func newCustomParser(cfg env.Config, factory *env.ComponentFactory) *CustomParser {
    return &CustomParser{
        cfg:       cfg,
        validator: factory.Validator(),
        auditor:   factory.Auditor(),
    }
}

// カスタムフォーマット定数の定義（100以上の値を使用して衝突を回避することを推奨）
const FormatCustom env.FileFormat = 100

// パーサーの登録
env.RegisterParser(FormatCustom, func(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return newCustomParser(cfg, factory), nil
})
```

---

## ライフサイクル管理

```text
Config 作成
     ↓
env.New(cfg)
     ↓
自动作成 ComponentFactory
     ↓
    ┌───────┼───────┐
    ↓       ↓       ↓
Validator  Auditor  Expander
    ↓       ↓       ↓
    └───────┼───────┘
            ↓
      Loader/Parser
            ↓
      Close() 释放
```

::: warning 注意
- 各 Loader は通常独自の ComponentFactory を所有
- Close() 呼び出し後、そのファクトリーを通じて作成されたすべてのコンポーネントは使用しないでください
- ファクトリーはスレッドセーフで、並行アクセス可能
:::

---

## 監査ハンドラーファクトリー

### NewJSONAuditHandler

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

JSON フォーマットの監査ハンドラーを作成し、構造化ログを出力します。

**パラメータ：**
- `w` - 出力先（`os.Stdout`、ファイルなど）

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**出力例：**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration":1234567}
```

---

### NewLogAuditHandler

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

標準ログフォーマットの監査ハンドラーを作成します。

**パラメータ：**
- `logger` - 標準 log.Logger インスタンス

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**出力例：**
```text
[AUDIT] 2024/01/15 10:30:00 load .env success (1.23ms)
```

---

### NewChannelAuditHandler

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

チャネル監査ハンドラーを作成し、監査イベントの非同期処理に使用します。

**パラメータ：**
- `ch` - 監査イベントチャネル

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// 非同期処理監査イベント
go func() {
    for event := range ch {
        fmt.Printf("Audit: %+v\n", event)
    }
}()
```

---

### NewNopAuditHandler

```go
func NewNopAuditHandler() *NopAuditHandler
```

空操作監査ハンドラーを作成し、監査ログを無効化します。

```go
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewNopAuditHandler() // ログを記録しない
```

---

### NewCloseableChannelHandler

```go
func NewCloseableChannelHandler(bufferSize int) *CloseableChannelHandler
```

独自のバッファチャネルを持つクローズ可能な監査ハンドラーを作成します。`ChannelAuditHandler` が外部チャネルを受け取るのに対し、`CloseableChannelHandler` は独自のバッファチャネルを作成・所有します。`Close()` を呼び出すとハンドラーをクローズしチャネルを閉じます。`Channel()` でイベントを受信します。

**パラメータ：**
- `bufferSize` - バッファチャネルのサイズ

```go
handler := env.NewCloseableChannelHandler(64)
defer handler.Close()

go func() {
    for event := range handler.Channel() {
        fmt.Printf("Audit: %+v\n", event)
    }
}()
```

---

## ファイルシステム

### OSFileSystem

デフォルトのファイルシステム実装、オペレーティングシステムのファイル操作をラップ：

```go
type OSFileSystem struct{}
```

**実装インターフェース：** `FileSystem`

```go
// 方法列表
func (fs OSFileSystem) Open(name string) (File, error)
func (fs OSFileSystem) OpenFile(name string, flag int, perm os.FileMode) (File, error)
func (fs OSFileSystem) Stat(name string) (os.FileInfo, error)
func (fs OSFileSystem) MkdirAll(path string, perm os.FileMode) error
func (fs OSFileSystem) Remove(name string) error
func (fs OSFileSystem) Rename(oldpath, newpath string) error
func (fs OSFileSystem) Getenv(key string) string
func (fs OSFileSystem) Setenv(key, value string) error
func (fs OSFileSystem) Unsetenv(key string) error
func (fs OSFileSystem) LookupEnv(key string) (string, bool)
```

---

### DefaultFileSystem

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

グローバルデフォルトファイルシステムインスタンス。

---

### 使用カスタムファイルシステム

テスト時にファイルシステムをモック：

```go
type MockFileSystem struct {
    files map[string]string
    env   map[string]string
}

func (m *MockFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MockFile{content: content}, nil
}

func (m *MockFileSystem) Getenv(key string) string {
    return m.env[key]
}

func (m *MockFileSystem) Setenv(key, value string) error {
    m.env[key] = value
    return nil
}

func (m *MockFileSystem) Unsetenv(key string) error {
    delete(m.env, key)
    return nil
}

func (m *MockFileSystem) LookupEnv(key string) (string, bool) {
    val, ok := m.env[key]
    return val, ok
}

func (m *MockFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

func (m *MockFileSystem) Stat(name string) (os.FileInfo, error) {
    if _, ok := m.files[name]; !ok {
        return nil, os.ErrNotExist
    }
    return nil, nil
}

func (m *MockFileSystem) MkdirAll(path string, perm os.FileMode) error {
    return nil
}

func (m *MockFileSystem) Remove(name string) error {
    delete(m.files, name)
    return nil
}

func (m *MockFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

// 使用
cfg := env.TestingConfig()
cfg.FileSystem = &MockFileSystem{
    files: map[string]string{".env": "KEY=value"},
    env:   make(map[string]string),
}
```

---

## フォーマット検出

### DetectFormat

```go
func DetectFormat(filename string) FileFormat
```

ファイル拡張子によりフォーマットを検出。

**パラメータ：**
- `filename` - ファイル名またはパス

**戻り値：**
- `FileFormat` - 検出されたフォーマット

**検出ルール：**

| 拡張子 | 返されるフォーマット |
|--------|----------|
| `.env` | `FormatEnv` |
| `.json` | `FormatJSON` |
| `.yaml`, `.yml` | `FormatYAML` |
| その他 | `FormatAuto` |

```go
format := env.DetectFormat("config.json")   // FormatJSON
format := env.DetectFormat("settings.yaml") // FormatYAML
format := env.DetectFormat("app.yml")       // FormatYAML
format := env.DetectFormat(".env")          // FormatEnv
format := env.DetectFormat(".env.local")    // FormatAuto (実際は .env として処理)
format := env.DetectFormat("unknown.txt")   // FormatAuto
```

**LoadFiles での使用：**

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
// 各ファイルのフォーマットを自動検出対応するパーサーを使用
```

---

### FileFormat 定数

```go
const (
    FormatAuto  FileFormat = iota  // 自動検出
    FormatEnv                      // .env フォーマット
    FormatJSON                     // JSON フォーマット
    FormatYAML                     // YAML フォーマット
)
```

**カスタムフォーマット：**

```go
// カスタムフォーマット定数の定義（100以上の値を使用して衝突を回避することを推奨）
const (
    FormatTOML  env.FileFormat = 100
    FormatINI   env.FileFormat = 101
    FormatXML   env.FileFormat = 102
)
```

---

### FileFormat.String

```go
func (f FileFormat) String() string
```

フォーマットの文字列表現を返します。

```go
fmt.Println(env.FormatJSON.String())  // "json"
fmt.Println(env.FormatYAML.String())  // "yaml"
fmt.Println(env.FormatEnv.String())   // "dotenv"
fmt.Println(env.FormatAuto.String())  // "auto"
fmt.Println(env.FileFormat(999).String())  // "unknown"
```

---

## パーサー登録

### RegisterParser

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

カスタムフォーマット解析器を登録します。

**パラメータ：**
- `format` - ファイルフォーマット定数
- `factory` - パーサーファクトリー関数

**戻り値：**
- `error` - 登録失敗時にエラーを返す

**エラーケース：**
- 組み込みフォーマット（FormatEnv、FormatJSON、FormatYAML）は上書き不可
- フォーマットが既に登録済み

**注意事項：**
- `env.New()` を呼び出す前に登録する必要がある
- 組み込みフォーマットとの衝突を避けるため100以上の値を使用することを推奨
- ファクトリー関数はスレッドセーフなパーサーを返すべき

```go
// 1. カスタムフォーマット定数を定義
const FormatTOML env.FileFormat = 100

// 2. パーサーインターフェースを実装
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // TOML 解析ロジックの実装
    result := make(map[string]string)
    // ... 解析コード
    return result, nil
}

// 3. パーサーの登録
err := env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
    return &TOMLParser{
        cfg:       cfg,
        validator: f.Validator(),
        auditor:   f.Auditor(),
    }, nil
})
if err != nil {
    panic(err)
}

// 4. カスタムフォーマットを使用
func main() {
    // 登録は New の前に完了する必要がある
    loader, _ := env.New(env.DefaultConfig())
    defer loader.Close()

    // .toml ファイルが読み込めるようになります
    loader.LoadFiles("config.toml")
}
```

---

### ForceRegisterParser

```go
func ForceRegisterParser(format FileFormat, factory ParserFactory) error
```

強制パーサー登録。組み込みパーサーの上書きを許可します。

**パラメータ：**
- `format` - ファイルフォーマット定数
- `factory` - パーサーファクトリー関数

**戻り値：**
- `error` - 登録失敗時にエラーを返す（`factory` が nil の場合）

::: danger 警告
慎重に使用してください。置き換えるパーサーが同じセキュリティチェック（キー検証、値検証、サイズ制限など）を実装していない場合、組み込みパーサーの上書きはセキュリティ脆弱性を招く可能性があります。

以下の高度なユースケースに適しています：
- 組み込みパーサーにカスタムセキュリティチェックを追加
- フォーマット拡張の実装（HEREDOC、複数行値など）
- モックパーサーを使用したテスト
:::

```go
// デフォルト .env パーサーを上書き（高度な用途）
err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
    return &MyCustomEnvParser{
        validator: f.Validator(),
        auditor:   f.Auditor(),
    }, nil
})
```

---

### ParserFactory 型

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

パーサーファクトリー関数シグネチャ。

**パラメータ：**
- `cfg` - 設定オブジェクト、制限とセキュリティ設定を含む
- `factory` - コンポーネントファクトリー、検証器と監査ロガーを取得可能

**戻り値：**
- `EnvParser` - パーサーインスタンス
- `error` - 作成エラー

---

### EnvParser 接口

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

パーサーが実装しなければならないインターフェース。

**パラメータ：**
- `r` - ファイルコンテンツリーダー
- `filename` - ファイル名（エラー情報用）

**戻り値：**
- `map[string]string` - 解析されたキーと値のペア
- `error` - 解析エラー

---

## 組み込みパーサー

ライブラリは3種類のフォーマットパーサーを組み込みで提供：

### DotEnv Parser

`.env` フォーマットパーサー、サポート：
- `KEY=value` 構文
- `export KEY=value` 構文
- 单引号 `'value'` 和双引号 `"value"`
- 変数展開 `${VAR}` および `${VAR:-default}`
- 注释 `#`

### JSON Parser

JSON フォーマットパーサー、サポート：
- キーと値のペアオブジェクト
- ネストされた構造（フラット化処理）
- 数値、文字列、真偽値の変換
- 配列（`KEY_0`, `KEY_1`... にフラット化）

### YAML Parser

YAML フォーマットパーサー、サポート：
- 键值对
- ネストされた構造（フラット化処理）
- 複数のスカラータイプ
- リスト（インデックスキーにフラット化）

---

## 完全な例

### カスタムパーサーの登録

```go
package main

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// カスタム INI パーサー
type INIParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *INIParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    content, err := io.ReadAll(r)
    if err != nil {
        return nil, err
    }

    result := make(map[string]string)
    lines := strings.Split(string(content), "\n")
    var section string

    for lineNum, line := range lines {
        line = strings.TrimSpace(line)

        // 空行とコメントをスキップ
        if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
            continue
        }

        // Section [section]
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            section = strings.Trim(line, "[]")
            continue
        }

        // Key=Value
        if idx := strings.Index(line, "="); idx > 0 {
            key := strings.TrimSpace(line[:idx])
            value := strings.TrimSpace(line[idx+1:])

            // section プレフィックスを追加
            if section != "" {
                key = section + "_" + key
            }

            // キーを検証
            if err := p.validator.ValidateKey(key); err != nil {
                _ = p.auditor.LogError(env.ActionParse, key, err.Error())
                return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
            }

            result[strings.ToUpper(key)] = value
        }
    }

    _ = p.auditor.Log(env.ActionParse, "", fmt.Sprintf("parsed %d variables from %s", len(result), filename), true)
    return result, nil
}

func main() {
    // カスタムフォーマットを定義
    const FormatINI env.FileFormat = 101

    // パーサーの登録
    err := env.RegisterParser(FormatINI, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &INIParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err)
    }

    // カスタムフォーマットを使用
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // .ini ファイルが読み込めるようになりました
    // loader.LoadFiles("config.ini")

    fmt.Println("INI parser registered")
}
```

### カスタムファイルシステム

```go
package main

import (
    "fmt"
    "os"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// メモリファイルシステム（テスト用）
type MemoryFileSystem struct {
    files map[string]string
    env   map[string]string
}

func NewMemoryFileSystem() *MemoryFileSystem {
    return &MemoryFileSystem{
        files: make(map[string]string),
        env:   make(map[string]string),
    }
}

func (m *MemoryFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MemoryFile{reader: strings.NewReader(content)}, nil
}

func (m *MemoryFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

func (m *MemoryFileSystem) Stat(name string) (os.FileInfo, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MemoryFileInfo{name: name, size: int64(len(content))}, nil
}

func (m *MemoryFileSystem) MkdirAll(path string, perm os.FileMode) error {
    return nil
}

func (m *MemoryFileSystem) Remove(name string) error {
    delete(m.files, name)
    return nil
}

func (m *MemoryFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

func (m *MemoryFileSystem) Getenv(key string) string {
    return m.env[key]
}

func (m *MemoryFileSystem) Setenv(key, value string) error {
    m.env[key] = value
    return nil
}

func (m *MemoryFileSystem) Unsetenv(key string) error {
    delete(m.env, key)
    return nil
}

func (m *MemoryFileSystem) LookupEnv(key string) (string, bool) {
    val, ok := m.env[key]
    return val, ok
}

// MemoryFile 实现 env.File
type MemoryFile struct {
    reader *strings.Reader
}

func (f *MemoryFile) Read(p []byte) (n int, err error)  { return f.reader.Read(p) }
func (f *MemoryFile) Write(p []byte) (n int, err error) { return 0, os.ErrUnsupported }
func (f *MemoryFile) Close() error                      { return nil }
func (f *MemoryFile) Stat() (os.FileInfo, error)        { return nil, os.ErrUnsupported }
func (f *MemoryFile) Sync() error                       { return nil }

// MemoryFileInfo 实现 os.FileInfo
type MemoryFileInfo struct {
    name string
    size int64
}

func (i *MemoryFileInfo) Name() string       { return i.name }
func (i *MemoryFileInfo) Size() int64        { return i.size }
func (i *MemoryFileInfo) Mode() os.FileMode  { return 0644 }
func (i *MemoryFileInfo) ModTime() time.Time { return time.Time{} }
func (i *MemoryFileInfo) IsDir() bool        { return false }
func (i *MemoryFileInfo) Sys() interface{}   { return nil }

// 使用示例
func main() {
    // メモリファイルシステムを作成
    fs := NewMemoryFileSystem()
    fs.files[".env"] = "APP_NAME=myapp\nPORT=8080\n"

    // カスタムファイルシステムを使用するよう設定
    cfg := env.TestingConfig()
    cfg.FileSystem = fs

    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.LoadFiles(".env")

    fmt.Println(loader.GetString("APP_NAME"))  // myapp
    fmt.Println(loader.GetInt("PORT"))         // 8080
}
```

---

## 関連ドキュメント

- [インターフェース定義](/ja/env/api-reference/interfaces) - すべてのインターフェース定義
- [カスタムパーサー](/ja/env/guides/custom-parser) - カスタムパーサーガイド
- [テストシナリオ](/ja/env/guides/testing) - カスタムファイルシステムを使用したテスト

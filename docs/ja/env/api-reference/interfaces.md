---
title: インターフェース定義 - CyberGo env | コアインターフェース階層
description: CyberGo env 環境変数管理ライブラリのすべてのインターフェース型定義リファレンスドキュメント。細粒度インターフェース設計により依存性注入と柔軟な組み合わせをサポート。キーと値の検証器 Validator、監査プロセッサ AuditHandler、ファイルパーサー EnvParser、セキュアストレージ、ファイルシステムアダプターなどコア Go インターフェースの詳細な説明と使用方法を含みます。
---

# インターフェース定義

env ライブラリは細粒度インターフェース設計を採用し、依存性注入と柔軟な組み合わせをサポートしています。

## コアインターフェース

### EnvLoader

すべてのサブインターフェースを組み合わせた完全なローダーインターフェース：

```go
type EnvLoader interface {
    EnvFileLoader
    EnvGetter
    EnvSetter
    EnvApplicator
    EnvCloser
}
```

---

### EnvFileLoader

ファイル読み込みインターフェース：

```go
type EnvFileLoader interface {
    LoadFiles(filenames ...string) error
}
```

**用途：** ファイル読み込み機能のみが必要なシーン。

```go
func loadConfig(loader env.EnvFileLoader) error {
    return loader.LoadFiles(".env")
}
```

---

### EnvGetter

読み取りアクセスインターフェース：

```go
type EnvGetter interface {
    GetString(key string, defaultValue ...string) string
    Lookup(key string) (string, bool)
    Keys() []string
    All() map[string]string
}
```

**用途：** 読み取り専用の設定アクセス（最小インターフェース）。

```go
func readConfig(getter env.EnvGetter) {
    host := getter.GetString("HOST", "localhost")
    value, exists := getter.Lookup("API_KEY")
    keys := getter.Keys()
}
```

::: warning 注意
`GetInt`、`GetBool`、`GetDuration`、`GetSecure`、`Len` は `EnvGetter` インターフェースの一部では**ありません**。
これらのメソッドは `*Loader` 型に実装されていますが、最小インターフェースには含まれていません。

完全な読み取り機能が必要な場合は、直接 `*Loader` 型を使用してください：

```go
func readFullConfig(loader *env.Loader) {
    port := loader.GetInt("PORT", 8080)      // ✓ 利用可能
    debug := loader.GetBool("DEBUG", false)  // ✓ 利用可能
    count := loader.Len()                     // ✓ 利用可能
}
```
:::

---

### EnvSetter

書き込みアクセスインターフェース：

```go
type EnvSetter interface {
    Set(key, value string) error
    Delete(key string) error
}
```

**用途：** 設定/削除機能のみが必要なシーン。

```go
func updateConfig(setter env.EnvSetter) error {
    if err := setter.Set("KEY", "value"); err != nil {
        return err
    }
    return setter.Delete("TEMP_KEY")
}
```

---

### EnvApplicator

システム環境への適用インターフェース：

```go
type EnvApplicator interface {
    Apply() error
}
```

**用途：** 読み込んだ変数を `os.Environ` に適用。

```go
func applyToSystem(applicator env.EnvApplicator) error {
    return applicator.Apply()
}
```

---

### EnvCloser

リソース解放インターフェース：

```go
type EnvCloser interface {
    Close() error
}
```

**用途：** ローダーのリソースを解放。

---

## バリデーションインターフェース

### Validator

バリデーションを組み合わせたインターフェース：

```go
type Validator interface {
    KeyValidator
    ValueValidator
    RequiredValidator
}
```

::: tip 注意
`Validator` は `RequiredValidator` を埋め込むことで `ValidateRequired` メソッドを提供します。`KeyValidator` のみを実装したカスタム検証器は、`ValidateRequired` 呼び出し時に `ErrValidateRequiredUnsupported` を返します。
:::

---

### RequiredValidator

必須キー検証インターフェース：

```go
type RequiredValidator interface {
    ValidateRequired(keys map[string]bool) error
}
```

すべての必須キーが存在するか検証します。

---

### KeyValidator

キー検証インターフェース：

```go
type KeyValidator interface {
    ValidateKey(key string) error
}
```

キー名がルールに準拠しているか検証します（長さ、形式、禁止キーなど）。

---

### ValueValidator

値検証インターフェース：

```go
type ValueValidator interface {
    ValidateValue(value string) error
}
```

値が安全かどうか検証します（ヌルバイト、制御文字の有無など）。

---

## 監査インターフェース

### AuditLogger

最小監査ログインターフェース（`internal.AuditLogger` のエイリアス）：

```go
type AuditLogger interface {
    LogError(action AuditAction, key, errMsg string) error
}
```

**用途：** 最小インターフェースで、カスタム監査ロガーの実装が容易。完全な監査機能が必要な場合は `FullAuditLogger` を使用してください。

---

### FullAuditLogger

監査ログインターフェースを拡張し、完全な監査ログ機能を提供します：

```go
type FullAuditLogger interface {
    AuditLogger
    Log(action AuditAction, key, reason string, success bool) error
    LogWithFile(action AuditAction, key, file, reason string, success bool) error
    LogWithDuration(action AuditAction, key, reason string, success bool, duration time.Duration) error
    Close() error
}
```

**用途：** 完全な監査ログ機能。`ComponentFactory.Auditor()` はこのインターフェースを返します。

**メソッド説明：**

| メソッド | 用途 |
|------|------|
| `LogError` | エラーイベントの記録（AuditLogger から継承） |
| `Log` | 一般的な監査イベントの記録 |
| `LogWithFile` | ファイル情報を含むイベントの記録 |
| `LogWithDuration` | 処理時間を含むイベントの記録 |
| `Close` | 監査ログのクローズ |

---

### AuditHandler

監査プロセッサインターフェース（Config.AuditHandler の設定に使用）：

```go
type AuditHandler interface {
    Log(event AuditEvent) error
    Close() error
}
```

**用途：** このインターフェースを実装することで、監査イベントの処理方法をカスタマイズできます。`AuditLogger` インターフェースとは異なり、`AuditHandler` は `Log` と `Close` の 2 つのメソッドが必要で、監査イベントの受信処理とリソース解放に使用されます。

**組み込み実装：**
- `JSONAuditHandler` - JSON 形式ログを出力
- `LogAuditHandler` - 標準 log パッケージを使用して出力
- `ChannelAuditHandler` - チャネルに送信
- `NopAuditHandler` - 何もしないプロセッサ

---

## 変数展開インターフェース

### VariableExpander

変数展開インターフェース：

```go
type VariableExpander interface {
    Expand(s string) (string, error)
}
```

**用途：** カスタム変数展開ロジック。

```go
// ${VAR} と ${VAR:-default} の展開ロジックを実装
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

## パースインターフェース

### EnvParser

パーサーインターフェース：

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**パラメータ：**
- `r` - ファイル内容のリーダー
- `filename` - ファイル名（エラーメッセージに使用）

**戻り値：**
- `map[string]string` - 解析後のキーと値のペア
- `error` - 解析エラー

**用途：** カスタムファイル形式パーサー。

---

## ストレージインターフェース

### EnvStorage

環境変数ストレージインターフェース：

```go
type EnvStorage interface {
    Get(key string) (string, bool)
    Set(key, value string)
    Delete(key string)
    Keys() []string
    Len() int
    ToMap() map[string]string
    Clear()
}
```

**用途：** カスタムストレージバックエンド。

**メソッド説明：**

| メソッド | 用途 |
|------|------|
| `Get` | 値を取得。値と存在するかどうかを返す |
| `Set` | キーと値のペアを設定 |
| `Delete` | キーを削除 |
| `Keys` | すべてのキー名を返す |
| `Len` | キーと値のペアの数を返す |
| `ToMap` | すべてのキーと値のペアのコピーを返す |
| `Clear` | すべてのデータをクリア |

---

## シリアライズインターフェース

### Marshaler

カスタムシリアライズインターフェース：

```go
type Marshaler interface {
    MarshalEnv() ([]byte, error)
}
```

**用途：** カスタム型のシリアライズ。

```go
type LogLevel string

func (l LogLevel) MarshalEnv() ([]byte, error) {
    return []byte(string(l)), nil
}

// 使用
level := LogLevel("debug")
env.Marshal(level)  // MarshalEnv を呼び出し
```

---

### Unmarshaler

カスタムデシリアライズインターフェース：

```go
type Unmarshaler interface {
    UnmarshalEnv(data map[string]string) error
}
```

**用途：** カスタム型のデシリアライズ。

```go
type Config struct {
    Host string
    Port int
}

func (c *Config) UnmarshalEnv(data map[string]string) error {
    c.Host = data["HOST"]
    port, _ := strconv.Atoi(data["PORT"])
    c.Port = port
    return nil
}

// 使用
var cfg Config
env.UnmarshalInto(data, &cfg)  // UnmarshalEnv を呼び出し
```

---

## ファイルシステムインターフェース

### FileSystem

ファイルシステム抽象インターフェース：

```go
type FileSystem interface {
    Open(name string) (File, error)
    OpenFile(name string, flag int, perm os.FileMode) (File, error)
    Stat(name string) (os.FileInfo, error)
    MkdirAll(path string, perm os.FileMode) error
    Remove(name string) error
    Rename(oldpath, newpath string) error
    Getenv(key string) string
    Setenv(key, value string) error
    Unsetenv(key string) error
    LookupEnv(key string) (string, bool)
}
```

**用途：** テスト時にファイルシステムをモック化。

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

func (m *MockFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

func (m *MockFileSystem) Stat(name string) (os.FileInfo, error) {
    if _, ok := m.files[name]; !ok {
        return nil, os.ErrNotExist
    }
    return nil, nil
}

func (m *MockFileSystem) MkdirAll(path string, perm os.FileMode) error { return nil }
func (m *MockFileSystem) Remove(name string) error                     { delete(m.files, name); return nil }
func (m *MockFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

func (m *MockFileSystem) Getenv(key string) string            { return m.env[key] }
func (m *MockFileSystem) Setenv(key, value string) error      { m.env[key] = value; return nil }
func (m *MockFileSystem) Unsetenv(key string) error           { delete(m.env, key); return nil }
func (m *MockFileSystem) LookupEnv(key string) (string, bool) { val, ok := m.env[key]; return val, ok }

// 使用
cfg := env.TestingConfig()
cfg.FileSystem = &MockFileSystem{
    files: map[string]string{".env": "KEY=value"},
    env:   make(map[string]string),
}
```

---

### File

ファイルインターフェース：

```go
type File interface {
    io.Reader
    io.Writer
    io.Closer
    Stat() (os.FileInfo, error)
    Sync() error
}
```

**メソッド説明：**

| メソッド | 用途 |
|------|------|
| `Read` | データの読み取り |
| `Write` | データの書き込み |
| `Close` | ファイルのクローズ |
| `Stat` | ファイル情報の取得 |
| `Sync` | ディスクへの同期 |

---

### DefaultFileSystem

デフォルトのファイルシステム実装：

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

実際のオペレーティングシステムのファイルシステムと環境変数を使用します：

```go
cfg := env.DefaultConfig()
cfg.FileSystem = env.DefaultFileSystem  // デフォルト値
```

---

## 監査ハンドラー

### JSONAuditHandler

JSON 形式の監査ログを出力します：

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

**パラメータ：**
- `w` - 出力先（例：`os.Stdout`、ファイル）

```go
handler := env.NewJSONAuditHandler(os.Stdout)
```

**出力例：**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","key":"API_KEY","success":true}
```

---

### LogAuditHandler

標準 log パッケージを使用して出力します：

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

**パラメータ：**
- `logger` - 標準 log.Logger インスタンス

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
handler := env.NewLogAuditHandler(logger)
```

**出力例：**
```text
[AUDIT] 2024/01/15 10:30:00 load .env success
```

---

### ChannelAuditHandler

チャネルに送信します：

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

**パラメータ：**
- `ch` - 監査イベントチャネル

```go
ch := make(chan env.AuditEvent, 100)
handler := env.NewChannelAuditHandler(ch)

// 非同期処理
go func() {
    for event := range ch {
        processAuditEvent(event)
    }
}()
```

---

### NopAuditHandler

何もしないプロセッサ（すべてのイベントを破棄）：

```go
func NewNopAuditHandler() *NopAuditHandler
```

```go
handler := env.NewNopAuditHandler()
```

---

## 監査型

### AuditAction

操作タイプ定数：

```go
type AuditAction = internal.Action

const (
    ActionLoad       AuditAction = "load"        // ファイル読み込み
    ActionParse      AuditAction = "parse"       // 解析操作
    ActionGet        AuditAction = "get"         // 変数の読み取り
    ActionSet        AuditAction = "set"         // 変数の設定
    ActionDelete     AuditAction = "delete"      // 変数の削除
    ActionValidate   AuditAction = "validate"    // 検証操作
    ActionExpand     AuditAction = "expand"      // 変数展開
    ActionSecurity   AuditAction = "security"    // セキュリティイベント
    ActionError      AuditAction = "error"       // エラーイベント
    ActionFileAccess AuditAction = "file_access" // ファイルアクセス
)
```

---

### AuditEvent

監査イベント構造：

```go
type AuditEvent = internal.Event
```

**フィールド：**

| フィールド | 型 | 説明 |
|------|------|------|
| `Timestamp` | `time.Time` | タイムスタンプ |
| `Action` | `AuditAction` | 操作タイプ |
| `Key` | `string` | キー名（マスク済み） |
| `File` | `string` | ファイル名 |
| `Reason` | `string` | 原因/説明 |
| `Success` | `bool` | 成功したかどうか |
| `Masked` | `bool` | マスク済みかどうか |
| `Details` | `string` | 詳細 |
| `Duration` | `int64` | 処理時間（ナノ秒） |

---

## ComponentFactory

コンポーネントファクトリー。共有コンポーネントを管理します：

```go
type ComponentFactory struct {
    // プライベートフィールドを含む
}
```

### メソッド

```go
func (f *ComponentFactory) Validator() Validator
func (f *ComponentFactory) Auditor() FullAuditLogger
func (f *ComponentFactory) Expander() VariableExpander
func (f *ComponentFactory) Close() error
func (f *ComponentFactory) IsClosed() bool
```

**用途：** 内部使用。Loader 作成時に自動的に管理されます。詳細は [ComponentFactory API](/ja/env/api-reference/factory) を参照してください。

---

## 完全なサンプル

### カスタム監査プロセッサの実装

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/env"
)

// カスタム監査プロセッサ
type CustomAuditHandler struct {
    events []env.AuditEvent
}

func (h *CustomAuditHandler) Log(event env.AuditEvent) error {
    h.events = append(h.events, event)
    return nil
}

func (h *CustomAuditHandler) Close() error {
    return nil
}

func main() {
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    handler := &CustomAuditHandler{}
    cfg.AuditHandler = handler

    loader, _ := env.New(cfg)
    defer loader.Close()
    // loader を使用...

    // 監査イベントを確認
    for _, event := range handler.events {
        fmt.Printf("%s: %s - %s\n", event.Action, event.Key, event.Reason)
    }
}
```

### 細粒度インターフェースの使用

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

// 読み取り機能のみ必要
func printConfig(getter env.EnvGetter) {
    for _, key := range getter.Keys() {
        value, _ := getter.Lookup(key)
        fmt.Printf("%s = %s\n", key, value)
    }
}

// 書き込み機能のみ必要
func setDefaults(setter env.EnvSetter) error {
    return setter.Set("DEFAULT_KEY", "default_value")
}

// 読み込み機能のみ必要
func loadConfig(loader env.EnvFileLoader) error {
    return loader.LoadFiles(".env")
}

func main() {
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // 細粒度インターフェースを使用
    loadConfig(loader)
    setDefaults(loader)
    printConfig(loader)
}
```

## 関連ドキュメント

- [Loader API](/ja/env/api-reference/loader) - Loader インスタンスメソッド
- [ComponentFactory API](/ja/env/api-reference/factory) - コンポーネントファクトリー
- [カスタムパーサー](/ja/env/guides/custom-parser) - カスタムパーサーガイド

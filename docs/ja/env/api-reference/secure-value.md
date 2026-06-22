---
title: "SecureValue API - CyberGo env | セキュア値ストレージ"
description: "CyberGo env の SecureValue API リファレンス。mlock メモリロック、Release ゼロクリア、Masked マスク、IsSensitiveKey 検出でパスワードやトークンを安全に保存します。"
---

# SecureValue API

`SecureValue` 型は機密データの安全な保存に使用され、メモリロック、自動ゼロクリア、マスク機能を提供します。

## スレッドセーフ

`SecureValue` のすべてのメソッドはスレッドセーフで、複数の goroutine から並発して使用できます：

- **読み取りメソッド**（`String()`、`Bytes()`、`Length()`、`Masked()`）は読み取りロックを使用、並発読み取りをサポート
- **クローズメソッド**（`Close()`、`Release()`）は書き込みロックを使用、安全なゼロクリアを保証
- **状態チェック**（`IsClosed()`、`IsMemoryLocked()`）はアトミック操作を使用

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // 並発読み取りは安全
    go func() { fmt.Println(secret.Masked()) }()
    go func() { fmt.Println(secret.Length()) }()
}
```

::: warning 注意
`Close()` と `Release()` は1回のみ呼び出してください。繰り返し呼び出しは安全ですが効果はありません。
:::

## 作成

### NewSecureValue

```go
func NewSecureValue(value string) *SecureValue
```

セキュア値ラッパーを作成します。

**パラメータ：**
- `value` - 保護する文字列値

**戻り値：**
- `*SecureValue` - セキュア値オブジェクト

**動作：**
- オブジェクトプールで割り当てを削減
- GC ファイナライザを設定して自動ゼロクリア
- メモリロックが有効な場合、メモリのロックを試行（失敗時はサイレントに無視）

```go
secret := env.NewSecureValue("my-secret-password")
defer secret.Release()  // または Close()
```

---

### NewSecureValueStrict

```go
func NewSecureValueStrict(value string) (*SecureValue, error)
```

セキュア値を作成します。メモリロックに失敗した場合はエラーを返します。

**パラメータ：**
- `value` - 保護する文字列値

**戻り値：**
- `*SecureValue` - セキュア値オブジェクト
- `error` - メモリロックエラー（ストリクトモードのみ）

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("my-secret")
if err != nil {
    // メモリロックに失敗
    log.Printf("Warning: %v", err)
}
if secret != nil {
    defer secret.Release()
}
```

---

### GetSecure (Loader 方法)

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

ローダーからセキュア値を取得します。

**パラメータ：**
- `key` - キー名

**戻り値：**
- `*SecureValue` - セキュア値の**防御的コピー**、呼び出し側が解放に責任を持つ。キーが存在しない、またはローダーがクローズ済みの場合は nil を返す

```go
secret := loader.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    // 使用 secret
}
```

::: tip 防御的コピー
`GetSecure` が返すのは元の値のコピーで、親 Loader から独立しています。呼び出し側は `Release()` または `Close()` を呼び出して解放する責任があります。
:::

---

## 方法

### String

```go
func (sv *SecureValue) String() string
```

マスク表現を返します。安全なログ出力とフォーマット用。`fmt.Stringer` インターフェースを実装し、`fmt.Printf`、`log.Println`、エラーラッピングによる秘密鍵の意図しない漏洩を防止します。

**戻り値：**
- `string` - マスク表現（例：`[SECURE:32 bytes locked]`）、nil の場合は `[NIL]` を返す

```go
secret := env.GetSecure("PASSWORD")
if secret != nil {
    log.Printf("Password: %s", secret)  // 安全、マスク表現を出力
    // log.Printf("Password: %s", secret.Masked()) と同等
}
```

::: warning 注意
`String()` が返すのは**マスク表現**であり、平文の値ではありません。平文の値を取得する必要がある場合は、`Reveal()` を使用してください。
:::

---

### Reveal

```go
func (sv *SecureValue) Reveal() string
```

平文の値を返します。呼び出し側が返された文字列の安全な処理に責任を持ちます。ログ記録、シリアライズ、永続化ストレージへの保存を避けてください。暗号化操作、API 呼び出しなどの安全な処理で実際の値が必要な場合にのみ使用してください。

**戻り値：**
- `string` - 平文の値、クローズ済みまたは nil の場合は空文字列を返す

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    plaintext := secret.Reveal()  // 平文の値を取得
    // plaintext を使用して API 呼び出しなどの安全な操作を行う
    _ = plaintext
}
```

::: danger セキュリティ警告
`Reveal()` が返すのは**平文の文字列**です。Go の文字列は不変であるため、手動でゼロクリアすることはできません。必要な場合にのみ使用し、返された値をログに記録したり保存したりしないでください。
:::

---

### Bytes

```go
func (sv *SecureValue) Bytes() []byte
```

値のバイトスライスのコピーを返します。呼び出し側は `ClearBytes` を使用してゼロクリアする責任があります。

**戻り値：**
- `[]byte` - 値のバイトコピー、クローズ済みの場合は nil を返す

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    data := secret.Bytes()
    defer env.ClearBytes(data)  // 使用後にゼロクリア
    // 使用 data
}
```

---

### Length

```go
func (sv *SecureValue) Length() int
```

値の長さを返します。内容は公開されません。

**戻り値：**
- `int` - 値の長さ、クローズ済みの場合は 0 を返す

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    fmt.Printf("API Key length: %d\n", secret.Length())
}
```

---

### Masked

```go
func (sv *SecureValue) Masked() string
```

マスクされた値を返します。ログ出力用。

**戻り値：**
- `string` - マスク表現

**出力フォーマット：**
- クローズ済み：`[CLOSED]`
- 空：`[SECURE:0 bytes]`
- 正常：`[SECURE:N bytes]` 或 `[SECURE:N bytes locked]` 或 `[SECURE:N bytes lock-failed]` 或 `[SECURE:N bytes unlocked]`

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    log.Printf("API Key: %s", secret.Masked())
    // 出力: API Key: [SECURE:32 bytes locked]
}
```

---

### Close

```go
func (sv *SecureValue) Close() error
```

メモリを安全にゼロクリアしてオブジェクトをクローズ。

**戻り値：**
- `error` - 常に nil を返す

**動作：**
- 安全内部データをゼロクリア
- クローズ済みとしてマーク
- オブジェクトプールに**返却されない**

```go
secret := env.GetSecure("TOKEN")
if secret != nil {
    defer secret.Close()
    // Close 後、メモリはゼロクリアされる
}
```

---

### Release

```go
func (sv *SecureValue) Release()
```

メモリをゼロクリアしてオブジェクトプールに返却。

**動作：**
- 安全内部データをゼロクリア
- GC ファイナライザをクリア
- オブジェクトプールに返却して再利用

```go
secret := env.GetSecure("KEY")
if secret != nil {
    defer secret.Release()
    // Release 後、メモリはゼロクリアされオブジェクトはプールに返却される
}
```

::: tip Close vs Release
- `Close()` - ゼロクリアのみ、プールに返却しない
- `Release()` - ゼロクリアしてプールに返却（高頻度ケースに推奨）
:::

---

### IsClosed

```go
func (sv *SecureValue) IsClosed() bool
```

オブジェクトがクローズ済みか確認。

**戻り値：**
- `bool` - 是否クローズ済み

```go
if secret.IsClosed() {
    // オブジェクトはクローズ済み、使用不可
}
```

---

### IsMemoryLocked

```go
func (sv *SecureValue) IsMemoryLocked() bool
```

メモリがロックされているか確認（ディスクへのスワップを防止）。

**戻り値：**
- `bool` - ロックされているかどうか

```go
if secret.IsMemoryLocked() {
    fmt.Println("Memory is locked, protected from swapping")
}
```

---

### MemoryLockError

```go
func (sv *SecureValue) MemoryLockError() error
```

メモリロック試行時のエラーを返します（存在する場合）。

**戻り値：**
- `error` - ロックエラー、成功または未試行の場合は nil を返す

```go
if err := secret.MemoryLockError(); err != nil {
    log.Printf("Memory lock failed: %v", err)
}
```

---

## メモリロック設定

### SetMemoryLockEnabled

```go
func SetMemoryLockEnabled(enabled bool)
```

メモリロックをグローバルに有効/無効にします。新しく作成されるすべての SecureValue に影響します。

**パラメータ：**
- `enabled` - 有効かどうか

```go
package main

import "github.com/cybergodev/env"

func main() {
    // アプリ起動時に有効化
    env.SetMemoryLockEnabled(true)

    // 以降のすべての SecureValue がロックを試行
}
```

---

### IsMemoryLockEnabled

```go
func IsMemoryLockEnabled() bool
```

メモリロックが有効かどうかを確認します。

**戻り値：**
- `bool` - 有効かどうか

```go
if env.IsMemoryLockEnabled() {
    // メモリロックが有効
}
```

---

### SetMemoryLockStrict

```go
func SetMemoryLockStrict(strict bool)
```

ストリクトモードを設定します。有効にすると、`NewSecureValueStrict` はロック失敗時にエラーを返します。

**パラメータ：**
- `strict` - 厳格モードが有効かどうか

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive-data")
if err != nil {
    // ロック失敗
}
```

---

### IsMemoryLockStrict

```go
func IsMemoryLockStrict() bool
```

厳格モードかどうかを確認します。

**戻り値：**
- `bool` - 有効かどうか

```go
strict := env.IsMemoryLockStrict()
```

---

### IsMemoryLockSupported

```go
func IsMemoryLockSupported() bool
```

現在のプラットフォームがメモリロックをサポートしているか確認します。

**戻り値：**
- `bool` - サポートしているかどうか

| プラットフォーム | サポート |
|------|------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| FreeBSD | ✅ |
| wasm | ❌ |

::: warning 注意
`true` が返されてもプラットフォームがサポートしていることを示すだけで、プロセスに十分な権限があることを保証するものではありません。Linux では `CAP_IPC_LOCK` または root 権限が必要です。
:::

```go
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

---

## セキュリティツール関数

### ClearBytes

```go
func ClearBytes(b []byte)
```

バイトスライスを安全にゼロクリアします。使用後すぐに機密データをゼロクリアしてください。

**パラメータ：**
- `b` - ゼロクリアするバイトスライス

```go
sensitive := []byte("secret-data")
// 使用...
env.ClearBytes(sensitive)
// sensitive 現在はすべて 0
```

---

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

キー名が機密パターンに一致するか確認します。

**パラメータ：**
- `key` - キー名

**戻り値：**
- `bool` - 機密かどうか

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // 機密キー、安全な方法で処理
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

**機密モード：** password, secret, token, key, api_key, credential など

---

### MaskValue

```go
func MaskValue(key, value string) string
```

キーの機密性に基づいてマスク値を返します。

**パラメータ：**
- `key` - キー名
- `value` - 元の値

**戻り値：**
- `string` - マスクされた値

```go
// 機密キー - [MASKED:N chars] フォーマットを返す
masked := env.MaskValue("API_KEY", "secret123")
// 戻り値: [MASKED:9 chars]

// 非機密キー - 元の値を返す（20文字を超える場合は切り詰め）
masked := env.MaskValue("APP_NAME", "myapp")
// 戻り値: myapp
```

---

### MaskKey

```go
func MaskKey(key string) string
```

ログ用にキー名をマスクします。

**パラメータ：**
- `key` - キー名

**戻り値：**
- `string` - マスクされたキー名

```go
masked := env.MaskKey("DB_PASSWORD")
// 戻り値: DB***
```

---

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

文字列内の機密キーと値のペア情報をクリーンアップします。`key=value` フォーマットの機密値を自動検出してマスクします。

**パラメータ：**
- `s` - 元の文字列

**戻り値：**
- `string` - クリーンアップされた文字列

```go
// 機密キーと値のペアを自動マスク
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// 戻り値: "Connected with password=[MASKED] api_key=[MASKED]"
```

---

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

文字列内の潜在的な機密内容をマスクします。50文字を超える文字列は切り詰められます。

**パラメータ：**
- `s` - 元の文字列

**戻り値：**
- `string` - マスクされた文字列

```go
// 長い文字列は切り詰められます
long := "This is a very long string that exceeds 50 characters"
clean := env.MaskSensitiveInString(long)
// 戻り値: "This is a very long string that exceeds 50..."
```

::: tip 使用例
機密データを含む可能性のある長い文字列の切り詰めに使用します。機密キーと値のペアを自動マスクする必要がある場合は、`SanitizeForLog` を使用してください。
:::

---

## 完全な例

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    // メモリロックを確認して有効化
    if env.IsMemoryLockSupported() {
        env.SetMemoryLockEnabled(true)
        fmt.Println("Memory locking enabled")
    }

    // 環境変数を読み込み
    if err := env.Load(".env"); err != nil {
        log.Printf("Warning: %v", err)
    }

    // 機密値を安全に取得
    apiKey := env.GetSecure("API_KEY")
    if apiKey == nil {
        log.Fatal("API_KEY not found")
    }
    defer apiKey.Release()

    // 安全な使用
    fmt.Printf("API Key length: %d\n", apiKey.Length())
    fmt.Printf("API Key (masked): %s\n", apiKey.Masked())

    // メモリロック状態を確認
    if apiKey.IsMemoryLocked() {
        fmt.Println("Memory is locked")
    }

    // ロックエラーを確認
    if err := apiKey.MemoryLockError(); err != nil {
        fmt.Printf("Memory lock warning: %v\n", err)
    }

    // 他の関数に渡す
    connectAPI(apiKey.Reveal())

    // セキュリティツール関数を使用
    logMessage := "Processing with API_KEY=secret"
    safeMessage := env.SanitizeForLog(logMessage)
    fmt.Println(safeMessage)  // Processing with API_KEY=[MASKED]
}

func connectAPI(key string) {
    // キーを使用して接続...
    fmt.Printf("Connecting with key of length %d\n", len(key))
}
```

---

## 内部実装

### オブジェクトプール

`SecureValue` は `sync.Pool` を使用してメモリ割り当てを削減：

```go
var secureValuePool = sync.Pool{
    New: func() interface{} {
        return &SecureValue{}
    },
}
```

### GC ファイナライザ

作成時に GC ファイナライザを設定し、ガベージコレクション時の自動ゼロクリアを保証：

```go
runtime.SetFinalizer(sv, (*SecureValue).finalize)
```

### 安全なゼロクリア

`unsafe.Pointer` を使用してコンパイラ最適化を防止：

```go
func (sv *SecureValue) clearData() {
    dataPtr := unsafe.Pointer(&sv.data[0])
    for i := range sv.data {
        *(*byte)(unsafe.Pointer(uintptr(dataPtr) + uintptr(i))) = 0
    }
    runtime.KeepAlive(sv.data)
    sv.data = nil
}
```

---

## 関連ドキュメント

- [定数とエラー](/ja/env/api-reference/constants) - 禁止キー、機密キーパターン、エラー型
- [セキュリティ概要](/ja/env/security/) - セキュリティアーキテクチャとコア機能
- [本番チェックリスト](/ja/env/security/production-checklist) - リリース前セキュリティチェック
- [Loader API](/ja/env/api-reference/loader) - GetSecure 方法

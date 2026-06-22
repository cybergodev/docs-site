---
title: "パフォーマンス最適化 - CyberGo env | 高並発読み書きチューニング"
description: "CyberGo env 性能最適化ガイド。RWMutex 並行性、オブジェクトプール再利用、mlock メモリロック、大容量ファイルストリーミング、ベンチマークに基づくチューニングを提案します。"
---

# パフォーマンス最適化

env ライブラリは高パフォーマンスシナリオ向けに最適化されています。このドキュメントではスレッドセーフ、オブジェクトプール、メモリ管理などのパフォーマンス関連機能について説明します。

## スレッドセーフ

### スレッドセーフの保証

`Loader` のすべてのメソッドはスレッドセーフ：

```go
loader, _ := env.New(env.DefaultConfig())
defer loader.Close()

var wg sync.WaitGroup

// 並発読み取り
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        loader.GetString("KEY")
    }()
}

// 並発書き込み
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func(n int) {
        defer wg.Done()
        loader.Set(fmt.Sprintf("KEY_%d", n), "value")
    }(i)
}

wg.Wait()
```

### パッケージレベル関数のスレッドセーフ性

パッケージレベル関数はグローバルローダーを使用し、同様にスレッドセーフです：

```go
var wg sync.WaitGroup

for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        env.GetString("KEY", "default")
    }()
}

wg.Wait()
```

### 内部実装

ライブラリはシャードストレージ（Sharded Storage）を使用してロック競合を削減しています：

```text
┌─────────────────────────────────────────┐
│          Loader（8 シャード）             │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐    ┌────────┐ │
│  │ Shard 0 │ │ Shard 1 │... │ Shard 7│ │
│  │  Lock   │ │  Lock   │    │  Lock  │ │
│  │  Data   │ │  Data   │    │  Data  │ │
│  └─────────┘ └─────────┘    └────────┘ │
└─────────────────────────────────────────┘
```

- キーはハッシュ値に基づいて異なるシャードに割り当てられる
- 各シャードには独立したロックがある
- ロック競合を削減し、並行パフォーマンスを向上

## オブジェクトプール

### オブジェクトプールを使用する理由

頻繁なオブジェクトの作成と破棄は GC 負荷を増大させます：

```text
オブジェクトプールなし：
オブジェクト作成 → 使用 → GC回収 → オブジェクト作成 → 使用 → GC回収 ...

オブジェクトプールあり：
オブジェクト作成 → 使用 → プールに返却 → 取得 → 使用 → プールに返却 ...
```

### SecureValue プール

`SecureValue` オブジェクトはプール化管理されています：

```go
// SecureValue を取得（プールから再利用される場合がある）
secret := env.GetSecure("API_KEY")

// 使用（Revealは平文を返し、String/Maskedはマスクを返す）
value := secret.Reveal()

// プールに返却
secret.Close()  // または secret.Release()
```

### オブジェクトプールの正しい使用方法

**速やかに解放する：**

```go
func processData() {
    secret := env.GetSecure("SECRET")
    defer secret.Close()  // 解放を保証

    // 使用 secret...
}
```

**参照を保持しない：**

```go
// 誤り：解放済みオブジェクトの参照を保持
var globalSecret *env.SecureValue

func init() {
    globalSecret = env.GetSecure("KEY")
    globalSecret.Close()  // 解放後、オブジェクトは再利用される
}

func later() {
    // 危険：globalSecret は他のコードで使用されている可能性がある
    globalSecret.String()
}

// 正しい：必要な時に毎回取得
func getSecret() string {
    secret := env.GetSecure("KEY")
    defer secret.Close()
    return secret.Reveal()
}
```

**クローズ状態の確認：**

```go
secret := env.GetSecure("KEY")

// 使用前に確認
if secret.IsClosed() {
    // オブジェクトはクローズ済み、使用不可
}

// 使用後にクローズ
secret.Close()

// クローズ後の確認
if secret.IsClosed() {
    // クローズ済み
}
```

## メモリ安全性

### メモリロック

メモリロックを有効にして機密データのディスクスワップを防止：

```go
// プラットフォームサポートを確認
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

**プラットフォームサポート：**

| プラットフォーム | サポート |
|------|------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| FreeBSD | ✅ |
| wasm | ❌ |

::: tip 詳細
[SecureValue API - メモリロック設定](/ja/env/api-reference/secure-value#メモリロック設定) で完全な設定説明を確認してください。
:::

### ストリクトモード

ストリクトモードでは、メモリロックの失敗はエラーとなります：

```go
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive_data")
if err != nil {
    // メモリロックに失敗
}
```

### 安全なゼロクリア

`SecureValue` はクローズ時に自動的にメモリをゼロクリアします：

```go
secret := env.GetSecure("PASSWORD")
// 内部状態: ['p', 'a', 's', 's', ...]

secret.Close()
// 内部状態: [0, 0, 0, 0, ...]
```

バイトスライスの手動ゼロクリア：

```go
sensitiveBytes := []byte("secret")
env.ClearBytes(sensitiveBytes)
// sensitiveBytes 現在はすべて 0
```

## パフォーマンスパターン

### 初期化後の読み取り専用

最も効率的なパターン：起動時に設定を読み込み，実行時は読み取り専用：

```go
var config *Config

func init() {
    env.Load(".env")

    config = &Config{}
    env.ParseInto(config)
}

// 任意の goroutine から安全に読み取り可能
func getValue() string {
    return config.Key
}
```

### 動的設定リフレッシュ

設定を動的に更新する必要がある場合のパターン：

```go
type ConfigManager struct {
    loader *env.Loader
    mu     sync.RWMutex
}

func (m *ConfigManager) Refresh() error {
    m.mu.Lock()
    defer m.mu.Unlock()

    return m.loader.LoadFiles(".env")
}

func (m *ConfigManager) Get(key string) string {
    m.mu.RLock()
    defer m.mu.RUnlock()

    return m.loader.GetString(key)
}
```

### ロック保持時間の削減

```go
// 非推奨：ロック内で時間のかかる操作を実行
func (l *Loader) ProcessValue(key string) {
    value := l.GetString(key)
    // 時間のかかる操作...
    processValue(value)
}

// 推奨：素早く読み取り、ロックの外で処理
func ProcessValue(key string) {
    value := loader.GetString(key)  // 素早く取得
    go processValue(value)          // 非同期処理
}
```

### バッチ操作

```go
// 必要な値をすべて一度に取得
func LoadAllConfig(loader *env.Loader) *Config {
    return &Config{
        Host:    loader.GetString("HOST"),
        Port:    loader.GetInt("PORT"),
        Debug:   loader.GetBool("DEBUG"),
        Timeout: loader.GetDuration("TIMEOUT"),
    }
}
```

### 頻繁な呼び出しを回避

```go
// 非推奨：リクエストのたびに読み取り
func Handler(w http.ResponseWriter, r *http.Request) {
    apiKey := env.GetString("API_KEY")  // リクエストのたびにロックを取得
    // ...
}

// 推奨：起動時にキャッシュ
var apiKey string

func init() {
    env.Load(".env")
    apiKey = env.GetString("API_KEY")
}

func Handler(w http.ResponseWriter, r *http.Request) {
    // キャッシュされた値を直接使用
    // ...
}
```

## パフォーマンスへの影響

### オブジェクトプールの効果

| 操作 | プールなし | プールあり |
|------|------|------|
| 割り当て回数 | N | ~定数 |
| GC 負荷 | 高 | 低 |
| レイテンシ | 不安定 | 安定 |

### メモリロックのオーバーヘッド

| 操作 | ロックなし | ロックあり |
|------|--------|--------|
| 作成 | ~100ns | ~1μs |
| 読み取り | ~10ns | ~10ns |

## ベンチマークテスト

### 読み取りパフォーマンス

```go
func BenchmarkConcurrentRead(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())
    loader.Set("KEY", "value")

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            loader.GetString("KEY")
        }
    })
}
```

### 書き込みパフォーマンス

```go
func BenchmarkConcurrentWrite(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())

    var i int64
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            n := atomic.AddInt64(&i, 1)
            loader.Set(fmt.Sprintf("KEY_%d", n), "value")
        }
    })
}
```

### 読み書きの混在

```go
func BenchmarkMixedReadWrite(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())
    loader.Set("KEY", "value")

    b.RunParallel(func(pb *testing.PB) {
        i := 0
        for pb.Next() {
            if i%10 == 0 {
                loader.Set("KEY", "new_value")
            } else {
                loader.GetString("KEY")
            }
            i++
        }
    })
}
```

## 注意事項

### ロック内でのブロックを回避

```go
// 危険：デッドロックの可能性あり
func (l *Loader) BadMethod() {
    // ロック内でブロックする可能性のある操作を呼び出し
    l.Set("KEY", computeValue())  // computeValue 遅くなる可能性がある
}

// 安全：先に計算、後に設定
func GoodMethod() {
    value := computeValue()  // ロックの外で計算
    loader.Set("KEY", value)  // 素早く設定
}
```

### クローズ後の並行アクセス

```go
loader, _ := env.New(cfg)

// goroutine を起動
go func() {
    time.Sleep(1 * time.Second)
    loader.GetString("KEY")  // 空文字列を返す（GetStringはerrorを返さない）
}()

loader.Close()  // メイン goroutine がクローズ
```

### グローバルローダーのリセット

```go
// 並行安全ではない：実行時に呼び出さないこと
env.ResetDefaultLoader()

// 安全：テストまたは起動時にのみ呼び出す
func init() {
    env.ResetDefaultLoader()
    env.Load(".env")
}
```

## 関連ドキュメント

- [SecureValue API](/ja/env/api-reference/secure-value) - セキュア値の処理とメモリロック
- [Loader API](/ja/env/api-reference/loader) - ローダーメソッド
- [テストシナリオ](/ja/env/guides/testing) - ベンチマーク例

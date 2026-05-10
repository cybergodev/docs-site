---
title: パッケージ関数 - HTTPC
description: HTTPC パッケージ関数とクライアントメソッド API リファレンス。7 種類の HTTP メソッド、New 作成関数、Download シリーズと ReleaseResult オブジェクトプール再利用メソッド。
---

# パッケージ関数

## パッケージレベルの HTTP メソッド

クライアントを作成せずにリクエストを送信。内部で遅延初期化されたデフォルトクライアントを使用。

### Get

```go
func Get(url string, options ...RequestOption) (*Result, error)
```

GET リクエストを送信。

```go
result, err := httpc.Get("https://api.example.com/data",
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

### Post

```go
func Post(url string, options ...RequestOption) (*Result, error)
```

POST リクエストを送信。

```go
result, err := httpc.Post("https://api.example.com/users",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

### Put / Patch / Delete / Head / Options

```go
func Put(url string, options ...RequestOption) (*Result, error)
func Patch(url string, options ...RequestOption) (*Result, error)
func Delete(url string, options ...RequestOption) (*Result, error)
func Head(url string, options ...RequestOption) (*Result, error)
func Options(url string, options ...RequestOption) (*Result, error)
```

### Request

```go
func Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
```

コンテキスト付きの汎用リクエストメソッド。タイムアウトとキャンセル制御をサポート。

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## クライアントメソッド

Client インターフェースはパッケージ関数と同じ HTTP メソッドに加え、コンテキスト付きの `Request` メソッドを提供します。

### New

```go
func New(config ...*Config) (Client, error)
```

新しい HTTP クライアントを作成。設定を渡さない場合や `nil` を渡すと `DefaultConfig()` が使用されます。

```go
client, err := httpc.New()
client, err := httpc.New(nil)
client, err := httpc.New(httpc.SecureConfig())

cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
client, err := httpc.New(cfg)
```

### クライアント HTTP メソッド

```go
result, err := client.Get(url, options...)
result, err := client.Post(url, options...)
result, err := client.Put(url, options...)
result, err := client.Patch(url, options...)
result, err := client.Delete(url, options...)
result, err := client.Head(url, options...)
result, err := client.Options(url, options...)
result, err := client.Request(ctx, "GET", url, options...)
```

### Close

Client インターフェースのメソッド。クライアントが保持するリソース（コネクションプール、Transport）を解放。呼び出し後は使用不可。

```go
// Client インターフェースメソッド
Close() error
```

```go
client, _ := httpc.New()
defer client.Close()
```

## デフォルトクライアント管理

### SetDefaultClient

```go
func SetDefaultClient(client Client) error
```

カスタムクライアントをデフォルトとして設定し、パッケージ関数で使用。古いデフォルトクライアントは自動的に閉じられます。

:::warning 制限事項
`httpc.New()` で作成されたクライアントのみ受け付けます。既に閉じられたクライアントは設定できません。
:::

```go
client, _ := httpc.New(httpc.PerformanceConfig())
httpc.SetDefaultClient(client)

// 以降のパッケージ関数は PerformanceConfig を使用
result, _ := httpc.Get(url)
```

### CloseDefaultClient

```go
func CloseDefaultClient() error
```

デフォルトクライアントを閉じてリセット。次回パッケージ関数を呼ぶと新しいクライアントが作成されます。

## Result 管理

### ReleaseResult

```go
func ReleaseResult(r *Result)
```

Result をオブジェクトプールに返却し GC 負荷を軽減。呼び出し後は Result にアクセス不可。

```go
result, _ := httpc.Get(url)
defer httpc.ReleaseResult(result)
```

:::warning
`ReleaseResult` 呼び出し後は Result にアクセスしないでください。内部データはゼロクリアされます。
:::

## ダウンロード関数

パッケージレベルのダウンロード関数はデフォルトクライアントを使用します。Client インターフェースも同名のメソッドを提供します。

### DownloadFile

```go
func DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

デフォルトクライアントでファイルを指定パスにダウンロード。

```go
// パッケージ関数
result, err := httpc.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")

// Client インターフェースメソッド
result, err := client.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")
```

### DownloadWithOptions

```go
func DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

設定付きファイルダウンロード。レジュームダウンロードとプログレスコールバックをサポート。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%%", float64(downloaded)/float64(total)*100)
}

// パッケージ関数
result, err := httpc.DownloadWithOptions(url, cfg)
// Client インターフェースメソッド
result, err = client.DownloadWithOptions(url, cfg)
```

### DownloadFileWithContext

```go
func DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

コンテキスト制御付きのファイルダウンロード。タイムアウトとキャンセルをサポート。

```go
// パッケージ関数
result, err := httpc.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
// Client インターフェースメソッド
result, err = client.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
```

### DownloadWithOptionsWithContext

```go
func DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

設定とコンテキスト制御付きのファイルダウンロード。

```go
// パッケージ関数
result, err := httpc.DownloadWithOptionsWithContext(ctx, url, downloadOpts)
// Client インターフェースメソッド
result, err = client.DownloadWithOptionsWithContext(ctx, url, downloadOpts)
```

## ヘルパー関数

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

バイト数を人間が読める文字列にフォーマット。

```go
httpc.FormatBytes(1536)      // "1.50 KB"
httpc.FormatBytes(1048576)   // "1.00 MB"
```

### FormatSpeed

```go
func FormatSpeed(bytesPerSecond float64) string
```

転送速度を人間が読める文字列にフォーマット。

```go
httpc.FormatSpeed(1536.0)    // "1.50 KB/s"
httpc.FormatSpeed(1048576.0) // "1.00 MB/s"
```

## ドメインクライアント

### NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

ドメインスコープクライアントを作成。Cookie とヘッダーを自動管理。

```go
dc, err := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, err := dc.Get("/users")
```

## 関連項目

- [Result](./result) - レスポンス結果タイプとメソッド
- [リクエストオプション](./options) - リクエスト設定オプション
- [ドメインクライアント](./domain-client) - ドメインスコープクライアント
- [ファイルダウンロード](./download) - ダウンロード関数とタイプ

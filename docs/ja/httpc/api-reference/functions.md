---
title: "パッケージ関数 - HTTPC"
description: "HTTPCパッケージ関数とクライアントメソッドAPIリファレンス：Get/Postなど7種類のHTTPパッケージ関数、Newクライアント作成、SetDefaultClientデフォルトクライアント管理、DownloadFileなど4つのダウンロード関数、ReleaseResultオブジェクトプール再利用、FormatBytesヘルパー関数とNewDomainドメインクライアント。"
---

# パッケージ関数

## パッケージレベルHTTPメソッド

クライアントを作成せずにリクエストを直接送信します。内部で遅延初期化されたデフォルトクライアントを使用します。

### Get

```go
func Get(url string, options ...RequestOption) (*Result, error)
```

GETリクエストを送信します。

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

POSTリクエストを送信します。

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

コンテキスト付きの汎用リクエストメソッド。タイムアウトとキャンセル制御をサポートします。

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## クライアントメソッド

Clientインターフェースはパッケージ関数と同じHTTPメソッドに加え、コンテキスト付きの`Request`メソッドを提供します。

### New

```go
func New(config ...*Config) (Client, error)
```

新しいHTTPクライアントを作成します。設定を省略または`nil`を渡すと`DefaultConfig()`を使用します。

```go
client, err := httpc.New()
client, err := httpc.New(nil)
client, err := httpc.New(httpc.SecureConfig())

cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
client, err := httpc.New(cfg)
```

### クライアントHTTPメソッド

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

Clientインターフェースのメソッド。クライアントが保持するリソース（接続プール、Transport）を解放します。呼び出し後は再使用できません。

```go
// Clientインターフェースのメソッド
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

カスタムクライアントをデフォルトクライアントとして設定します。パッケージ関数で使用されます。以前のデフォルトクライアントは自動的に閉じられます。

:::warning 警告 制限
`httpc.New()`で作成されたクライアントのみ受け付けます。閉じ済みのクライアントは設定できません。
:::

```go
client, _ := httpc.New(httpc.PerformanceConfig())
httpc.SetDefaultClient(client)

// 以降のパッケージ関数はPerformanceConfigを使用
result, _ := httpc.Get(url)
```

### CloseDefaultClient

```go
func CloseDefaultClient() error
```

デフォルトクライアントを閉じてリセットします。次回パッケージ関数の呼び出し時に新しいクライアントが作成されます。

## 結果管理

### ReleaseResult

```go
func ReleaseResult(r *Result)
```

Resultをオブジェクトプールに返却し、GC負荷を軽減します。呼び出し後はResultを使用できません。

```go
result, _ := httpc.Get(url)
defer httpc.ReleaseResult(result)
```

:::warning 警告
`ReleaseResult`呼び出し後はResultにアクセスしないでください。内部データはゼロクリアされます。
:::

## ダウンロード関数

パッケージレベルのダウンロード関数はデフォルトクライアントを使用します。Clientインターフェースも同名のメソッドを提供します。

### DownloadFile

```go
func DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

デフォルトクライアントを使用してファイルを指定パスにダウンロードします。

```go
// パッケージ関数
result, err := httpc.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")

// Clientインターフェースメソッド
result, err := client.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")
```

### DownloadWithOptions

```go
func DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

設定付きファイルダウンロード。レジュームとプログレスコールバックをサポートします。

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
// Clientインターフェースメソッド
result, err = client.DownloadWithOptions(url, cfg)
```

### DownloadFileWithContext

```go
func DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

コンテキスト制御付きファイルダウンロード。タイムアウトとキャンセルをサポートします。

```go
// パッケージ関数
result, err := httpc.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
// Clientインターフェースメソッド
result, err = client.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
```

### DownloadWithOptionsWithContext

```go
func DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

設定とコンテキスト制御付きファイルダウンロード。

```go
// パッケージ関数
result, err := httpc.DownloadWithOptionsWithContext(ctx, url, downloadOpts)
// Clientインターフェースメソッド
result, err = client.DownloadWithOptionsWithContext(ctx, url, downloadOpts)
```

## ヘルパー関数

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

バイト数を読みやすい文字列にフォーマットします。

```go
httpc.FormatBytes(1536)      // "1.50 KB"
httpc.FormatBytes(1048576)   // "1.00 MB"
```

### FormatSpeed

```go
func FormatSpeed(bytesPerSecond float64) string
```

転送速度を読みやすい文字列にフォーマットします。

```go
httpc.FormatSpeed(1536.0)    // "1.50 KB/s"
httpc.FormatSpeed(1048576.0) // "1.00 MB/s"
```

## ドメインクライアント

### NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

ドメインスコープのクライアントを作成します。Cookieとヘッダーを自動的に管理します。

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

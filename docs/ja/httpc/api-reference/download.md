---
title: ファイルダウンロード - HTTPC
description: HTTPC ファイルダウンロード API リファレンス。4 つのダウンロード関数シグネチャ、DownloadConfig 設定、プログレスコールバック、チェックサム列挙型、パストラバーサル防護メカニズムを解説。
---

# ファイルダウンロード

## パッケージレベルダウンロード関数

### DownloadFile

```go
func DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

デフォルトクライアントを使用してファイルを指定パスにダウンロードします。

```go
result, err := httpc.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")
```

### DownloadWithOptions

```go
func DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

設定付きダウンロード。レジュームダウンロードとプログレスコールバックをサポートします。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
```

### DownloadFileWithContext

```go
func DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

コンテキスト制御付きのファイルダウンロード。

### DownloadWithOptionsWithContext

```go
func DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

設定とコンテキスト制御付きのファイルダウンロード。

## DownloadConfig

```go
type DownloadConfig struct {
    FilePath          string
    ProgressCallback  DownloadProgressCallback
    Overwrite         bool
    ResumeDownload    bool
    Checksum          string
    ChecksumAlgorithm ChecksumAlgorithm
}

func DefaultDownloadConfig() *DownloadConfig
```

| フィールド | 型 | デフォルト | 説明 |
|------|------|------|------|
| `FilePath` | `string` | - | 保存パス（必須） |
| `ProgressCallback` | `DownloadProgressCallback` | `nil` | プログレスコールバック関数 |
| `Overwrite` | `bool` | `false` | 既存ファイルを上書き |
| `ResumeDownload` | `bool` | `false` | レジュームダウンロードを有効化 |
| `Checksum` | `string` | `""` | 期待するチェックサム値 |
| `ChecksumAlgorithm` | `ChecksumAlgorithm` | `"sha256"` | チェックサムアルゴリズム |

### DownloadProgressCallback

```go
type DownloadProgressCallback func(downloaded, total int64, speed float64)
```

| パラメータ | 型 | 説明 |
|------|------|------|
| `downloaded` | `int64` | ダウンロード済みバイト数 |
| `total` | `int64` | 総バイト数（-1 は不明） |
| `speed` | `float64` | 現在の速度（バイト/秒） |

```go
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r%.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}
```

## DownloadResult

```go
type DownloadResult struct {
    FilePath        string
    BytesWritten    int64
    Duration        time.Duration
    AverageSpeed    float64
    StatusCode      int
    ContentLength   int64
    Resumed         bool
    ResponseCookies []*http.Cookie
    ActualChecksum  string
    Proto           string
    ResponseHeaders http.Header
    RequestURL      string
    RequestMethod   string
    RequestHeaders  http.Header
}
```

| フィールド | 型 | 説明 |
|------|------|------|
| `FilePath` | `string` | ファイル保存パス |
| `BytesWritten` | `int64` | 書き込みバイト数 |
| `Duration` | `time.Duration` | ダウンロード所要時間 |
| `AverageSpeed` | `float64` | 平均速度（バイト/秒） |
| `StatusCode` | `int` | HTTP ステータスコード |
| `ContentLength` | `int64` | Content-Length ヘッダー値 |
| `Resumed` | `bool` | レジューム完了かどうか |
| `ResponseCookies` | `[]*http.Cookie` | レスポンス Cookie |
| `ActualChecksum` | `string` | 実際に計算されたチェックサム |
| `Proto` | `string` | HTTP プロトコルバージョン（例：`"HTTP/1.1"`、`"HTTP/2.0"`） |
| `ResponseHeaders` | `http.Header` | レスポンスヘッダー |
| `RequestURL` | `string` | 実際のリクエスト URL |
| `RequestMethod` | `string` | リクエスト HTTP メソッド |
| `RequestHeaders` | `http.Header` | リクエストヘッダー |

```go
fmt.Printf("ダウンロード完了: %s, 所要時間 %v, 平均速度 %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

## チェックサム検証

### ChecksumAlgorithm

```go
type ChecksumAlgorithm string
```

ダウンロードファイルの整合性検証アルゴリズム。

| 定数 | 値 | 説明 |
|------|-----|------|
| `ChecksumSHA256` | `"sha256"` | SHA-256 ハッシュアルゴリズム |

### 使用例

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/package.tar.gz"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256

result, err := httpc.DownloadWithOptions(url, cfg)
if err != nil {
    // チェックサムが一致しない場合、エラーを返しダウンロード済みファイルを自動削除
    log.Fatal(err)
}
fmt.Println("チェックサム:", result.ActualChecksum)
```

:::tip
`Checksum` を設定すると、ダウンロード完了時に自動的にファイルの整合性を検証します。検証失敗時はファイルを自動削除してエラーを返すため、手動での比較は不要です。
:::

## セキュリティ保護

ファイルダウンロードには多層的なセキュリティ保護が組み込まれています：

| 保護 | 説明 |
|------|------|
| UNC パスブロック | `\\server\share` 形式のパスを禁止 |
| 制御文字フィルタリング | パス内の制御文字を禁止 |
| システムパス保護 | システムディレクトリへの書き込みを禁止 |
| パストラバーサル検出 | `../` パストラバーサルを検出 |
| シンボリックリンク検出 | シンボリックリンク攻撃を防止 |
| 親ディレクトリ検出 | 親ディレクトリのシンボリックリンクを再帰的にチェック |

## レジュームダウンロード

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
if result.Resumed {
    fmt.Println("レジューム完了")
}
```

レジュームの仕組み：
1. ローカルファイルサイズを確認 → `Range` リクエストのオフセットとして使用
2. サーバーが 206 (Partial Content) を返す → 追記書き込み
3. サーバーが 416 (Range Not Satisfiable) を返す → エラーを返す
4. サーバーが 200 を返す（Range 非対応） → エラーを返す（ローカルの部分ファイルが上書きされるのを保護）

## 関連項目

- [ファイルアップロードとダウンロード](../guides/file-transfer) - 使用ガイド
- [パッケージ関数](./functions) - 補助関数リファレンス
- [ドメインクライアント](./domain-client) - ドメインクライアントのダウンロードメソッド

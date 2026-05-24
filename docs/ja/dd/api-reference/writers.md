---
title: "出力先 - CyberGo DD | FileWriter、BufferedWriter、MultiWriter"
description: "CyberGo DD 出力先完全 API ドキュメント。FileWriter ファイル自動ローテーション（サイズと時間によるローテーション対応）、BufferedWriter 高性能バッファ書き込み（バッファサイズとフラッシュ間隔を設定可能）、MultiWriter マルチ出力先並列出力を含み、開発デバッグから本番デプロイまでの各種ログ出力シナリオに対応。"
---

# 出力先

DD は 3 種類の出力ライターを提供し、ファイルローテーション、バッファ書き込み、マルチ出力に対応します。

## FileWriter

自動ローテーション付きファイルライター。

### 作成

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

```go
// デフォルト設定を使用
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// カスタム設定
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ := dd.NewFileWriter("logs/app.log", cfg)
```

### FileWriterConfig

ファイルライター設定。

```go
type FileWriterConfig struct {
    MaxSizeMB  int            // ファイルサイズ上限 MB（デフォルト 100）
    MaxAge     time.Duration  // 古いファイルの保持期間（デフォルト 30 日）
    MaxBackups int            // バックアップ保持数（デフォルト 10）
    Compress   bool           // gzip 圧縮するか（デフォルト false）
}
```

### デフォルト設定

```go
func DefaultFileWriterConfig() FileWriterConfig
```

デフォルト値：100MB サイズ制限、30 日保持、10 バックアップファイル。

### Validate

```go
func (c FileWriterConfig) Validate() error
```

ファイルライター設定の妥当性を検証します。

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | データを書き込み（io.Writer を実装） |
| `Close` | `() error` | ファイルライターを閉じる |

### ファイルローテーション

FileWriter は以下の条件で自動ローテーションをサポート：

- ファイルサイズが制限を超えた場合（デフォルト 100MB）
- ファイル経過時間が最大保持日数を超えた場合（デフォルト 30 日）
- バックアップファイル数が制限を超えた場合（デフォルト 10）

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 書き込み時に自動ローテーション
fw.Write([]byte("ログ内容\n"))

// ローテーション後に生成されるファイル：
// logs/app.log      (現在)
// logs/app.log.1    (直前のバックアップ)
// logs/app.log.2    (さらに古いバックアップ)
```

:::tip セキュリティ機能
FileWriter はパストラバーサル防止を組み込みで提供し、`..` やシンボリックリンクなどの安全でないパスを拒否します。
:::

## BufferedWriter

バッファ付きライター。システムコール回数を削減します。

### 作成

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

```go
// デフォルト設定を使用
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// カスタム設定
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

バッファライター設定。

```go
type BufferedWriterConfig struct {
    BufferSize int            // バッファサイズ（バイト、デフォルト 1024 つまり 1KB）
    FlushTime  time.Duration  // 定期フラッシュ間隔（デフォルト 100ms）
}
```

### デフォルト設定

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

バッファライター設定の妥当性を検証します。

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | バッファに書き込み |
| `Flush` | `() error` | バッファを基盤 Writer にフラッシュ |
| `Close` | `() error` | フラッシュして閉じる |

```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("ログ行\n"))
bw.Flush()  // ディスクへの書き込みを確実に
defer bw.Close()  // Close は自動 Flush
```

## MultiWriter

マルチライター管理。複数の出力先に同時書き込みします。

### 作成

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 全出力先に書き込み |
| `AddWriter` | `(w io.Writer) error` | 書き込み先を動的追加 |
| `RemoveWriter` | `(w io.Writer) error` | 書き込み先を動的削除 |
| `Close` | `() error` | 全ライターを閉じる |

```go
mw := dd.NewMultiWriter(console, file)

// 動的管理
mw.AddWriter(anotherFile)
mw.RemoveWriter(console)

// 全基盤ライターを閉じる
mw.Close()
```

:::warning エラー処理
MultiWriter は「ベストエフォート」戦略を採用：ある Writer の失敗が他の Writer に影響することはありません。エラーは `MultiWriterError` で返されます。
:::

## 組み合わせて使用

```go
// ファイル + バッファ + マルチ出力先
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bw, _ := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
mw := dd.NewMultiWriter(os.Stdout, bw)

logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
defer logger.Close()  // バッファを自動フラッシュしファイルを閉じる
```

## 次のステップ

- [設定](./config) -- Config 出力先設定（OutputTarget）
- [Logger](./logger) -- AddWriter / RemoveWriter
- [セキュリティフィルタ](./security) -- パスセキュリティ防護

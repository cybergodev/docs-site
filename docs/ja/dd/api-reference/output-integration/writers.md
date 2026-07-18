---
sidebar_label: "出力先"
title: "出力先 - CyberGo DD | FileWriter、BufferedWriter、MultiWriter"
description: "CyberGo DD 出力先 API：FileWriter はサイズと時間による自動ローテーション、BufferedWriter は高性能バッファ書き込み（バッファサイズとフラッシュ間隔を設定可能）、MultiWriter はマルチ出力先並行出力を提供し、開発から本番までの各種ログ出力シナリオに対応し、信頼性の高いログシステムの構築を支援します。"
sidebar_position: 1
---

# 出力先

DD は 3 種類の出力ライターを提供し、ファイルローテーション、バッファ書き込み、マルチ出力に対応します。

## FileWriter

自動ローテーション付きファイルライター。

### 作成

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

パスは `internal.ValidateAndSecurePath` でセキュリティ検証（パストラバーサル、null バイト、シンボリックリンク、overlong UTF-8）を経た後、`cfg.Validate()` が数量上限を検証し、最後に `applyFileWriterDefaults` がゼロ/負の値をデフォルトにフォールバックします。エラーを返すケース：

- パス系：`ErrEmptyFilePath` / `ErrNullByte` / `ErrPathTooLong`（>4096 バイト）/ `ErrPathTraversal` / `ErrInvalidPath` / `ErrSymlinkNotAllowed` / `ErrOverlongEncoding` / `ErrHardlinkNotAllowed`
- 設定系：`ErrMaxSizeExceeded`（`MaxSizeMB > 10240`）/ `ErrMaxBackupsExceeded`（`MaxBackups > 1000`）
- I/O 系：ディレクトリ作成またはファイルオープン失敗（基底エラーをラップ）

<!-- check-code: skip -->
```go
// デフォルト設定を使用
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// カスタム設定
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ = dd.NewFileWriter("logs/app.log", cfg)
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

ファイルライター設定の妥当性を検証します。エラーを返すケース：

- `MaxSizeMB` が 10240 を超える（`ErrMaxSizeExceeded` を返す）
- `MaxBackups` が 1000 を超える（`ErrMaxBackupsExceeded` を返す）

負の値は許可され、デフォルト値にフォールバックします。

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | データを書き込み（`io.Writer` を実装）；書き込み前にサイズをチェックしてローテーションをトリガー、クローズ済みなら `os.ErrClosed` を返す |
| `SetOnRotateCallback` | `(fn func(path string))` | ファイルローテーション成功後のコールバックを設定 |
| `Close` | `() error` | クリーンアップ goroutine を停止し基底ファイルをクローズ；複数回呼び出しも安全（CAS ガード） |

### ローテーションコールバック

```go
func (fw *FileWriter) SetOnRotateCallback(fn func(path string))
```

ファイルローテーション**成功後**に呼び出されるコールバック関数を設定します。コールバック引数 `path` は現在のログファイルのベースパス（[`NewFileWriter`](#作成) に渡した `path`）です。この時点で古いログはバックアップファイルとしてアーカイブされ、同じパスに新しいファイルが再オープンされています。設定時に進行中のローテーションとの競合を避けるため内部ミューテックスロックを取得します。

:::info 内部利用
このメソッドは主に `Logger` が内部で使用します——`FileWriter` が Logger の出力先である場合、Logger はこれを通じて `HookOnRotate` フックイベントをトリガーします（詳細は[フックシステム](../security-audit/hooks)を参照）。通常のユーザーが手動で呼び出す必要はありませんが、ローテーション後のカスタム動作が必要な場合は直接設定できます。
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// ローテーションコールバックを設定：ローテーション後に現在のファイルパスを出力
fw.SetOnRotateCallback(func(path string) {
    fmt.Println("ログがローテーションされました、現在のファイル:", path)
})

// MaxSizeMB を超えてローテーションがトリガーされるとコールバックが呼び出されます
fw.Write([]byte("ログ内容\n"))
```

### ファイルローテーションとクリーンアップ

FileWriter のローテーションとクリーンアップは 2 つの独立したパスで実行されます：

- **ローテーション（rotation）**：`Write` 呼び出し時に現在のファイルサイズをチェックし、`MaxSizeMB`（デフォルト 100MB）を超えるとトリガーされます——古いファイルはバックアップにリネーム、新しいファイルは `O_EXCL` で再オープン（シンボリックリンク TOCTOU を防止）され、その後 `internal.RotateBackups` が `MaxBackups` に従ってバックアップチェーンを切り詰め、`Compress=true` の場合は独立した goroutine がバックアップを gzip 圧縮します。
- **クリーンアップ（cleanup）**：`MaxAge > 0` かつ `MaxBackups > 0` の場合のみバックグラウンド goroutine を起動し、1 時間ごとにスキャンして `internal.CleanupOldFiles` を呼び出し、`MaxAge`（デフォルト 30 日）を超える古いバックアップを削除します。

:::tip デフォルト値適用ルール
ゼロ値または負の値の `MaxSizeMB` は一律 100MB にフォールバックします。`MaxAge`/`MaxBackups` の組み合わせルール：① 両方とも 0 → 完全デフォルト（30 日 + 10 個、クリーンアップ goroutine 起動）；② `MaxBackups` のみ設定 → 数量によるバックアップチェーン切り詰めのみ、`MaxAge=0` ではクリーンアップ goroutine 起動なし；③ `MaxAge` のみ設定 → `MaxBackups` はデフォルト 10 にフォールバック。
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 書き込み時に MaxSizeMB を超えると自動ローテーションがトリガーされます
fw.Write([]byte("ログ内容\n"))

// ローテーション後に生成されるファイル：
// logs/app.log      (現在のファイル)
// logs/app_log_1.log (最新のバックアップ)
// logs/app_log_2.log (さらに古いバックアップ)
// Compress 有効時に古いバックアップは logs/app_log_1.log.gz に非同期圧縮
```

:::tip セキュリティ機能
FileWriter はパストラバーサル、null バイト、シンボリックリンク、ハードリンク、overlong UTF-8 防護を内蔵し、TOCTOU 攻撃を防ぐため新しいファイルは `O_EXCL` でオープンします。
:::

## BufferedWriter

バッファ付きライター。システムコール回数を削減します。

### 作成

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

構築時にまず `nil` 基底 writer を拒否し（`ErrNilWriter`）、次に `cfg.Validate()` を呼び出し、最後に `BufferSize` がデフォルト（1KB）未満の値をデフォルト値にクランプし、`FlushTime <= 0` を 100ms にクランプします。エラーを返すケース：

- `ErrNilWriter`：`w == nil`
- `ErrBufferSizeTooLarge`：`BufferSize > 10MB`（`Validate` が返す）
- 不正な設定：`BufferSize < 0` または `FlushTime < 0`（`Validate` が返す）

<!-- check-code: skip -->
```go
// デフォルト設定を使用
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// カスタム設定
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ = dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

バッファライター設定。

```go
type BufferedWriterConfig struct {
    BufferSize int            // バッファサイズ（バイト、デフォルト 1024 つまり 1KB、上限 10MB）
    FlushTime  time.Duration  // 定期フラッシュ間隔（デフォルト 100ms）
}
```

### デフォルト設定

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

デフォルト値：1KB バッファ、100ms フラッシュ間隔。

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

バッファライター設定の妥当性を検証します。エラーを返すケース：

- `BufferSize` が負の値
- `BufferSize` が 10MB を超える（`ErrBufferSizeTooLarge` を返す）
- `FlushTime` が負の値

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | バッファに書き込み；バッファ済みバイトが `BufferSize/2` 以上の場合自動 flush |
| `Flush` | `() error` | バッファを基底 Writer に明示的にフラッシュ |
| `Close` | `() error` | まずバッファを flush しバックグラウンド goroutine を停止、その後基底 Writer をクローズ（`io.Closer` を実装している場合） |

バックグラウンド goroutine は `FlushTime` を周期にチェックします：バッファが空でなく前回の flush から `FlushTime` 以上経過している場合のみ自動 flush をトリガーします。`Close` の複数回呼び出しは安全（CAS ガード）；クローズ済みの場合 `Write` は `os.ErrClosed` を返します。

<!-- check-code: skip -->
```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("ログ行\n"))
_ = bw.Flush()      // 基底へ明示的にフラッシュ
defer bw.Close()    // Close はまず Flush し基底 Writer をクローズ
```

## MultiWriter

マルチライター管理。複数の出力先に同時書き込みします。

### 作成

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

`nil` writer は構築時に暗黙的に無視されます。戻り値は決して `nil` になりません（構築でエラーは発生しません）。

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 全出力先に書き込み（エラー戦略は下記参照） |
| `AddWriter` | `(w io.Writer) error` | 出力先を動的追加（重複 writer は暗黙的に受け付け） |
| `RemoveWriter` | `(w io.Writer) error` | 出力先を動的削除 |
| `Close` | `() error` | すべての基底 `io.Closer` をクローズ（標準ストリームを除く） |

`AddWriter` がエラーを返すケース：`ErrNilMultiWriter`（レシーバが `nil`）/ `ErrNilWriter`（引数が `nil`）/ `ErrMaxWritersExceeded`（≥ 100 個登録済み）。
`RemoveWriter` がエラーを返すケース：`ErrNilMultiWriter` / `ErrWriterNotFound`。

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(console, file)

// 動的管理
_ = mw.AddWriter(anotherFile)
_ = mw.RemoveWriter(console)

// すべての基底ライターをクローズ（os.Stdout などの標準ストリームはクローズされない）
_ = mw.Close()
```

### エラー型

`Write` 失敗時に返されるエラーは 2 つの公開型で保持されます（`errors.go` で定義）：

```go
// 単一 writer のエラー
type WriterError struct {
    Index  int       // MultiWriter 内におけるこの writer のインデックス
    Writer io.Writer // エラーが発生した writer
    Err    error     // 基底エラー
}

// 複数 writer のエラー集約（Write は *MultiWriterError を返す）
type MultiWriterError struct {
    Errors []WriterError
}
```

2 つの型のメソッド：

| 型 | メソッド | 説明 |
|------|------|------|
| `*WriterError` | `Error() string` | `writer[i]: <err>` 形式；`Err` が nil の場合は unknown error と表示 |
| `*WriterError` | `Unwrap() error` | `Err` を返し、`errors.Is` のチェーンマッチングに使用 |
| `*MultiWriterError` | `Error() string` | 単一エラーはそのまま返す；複数エラーは `multiple writer errors: [...]` に結合 |
| `*MultiWriterError` | `Unwrap() []error` | すべての `WriterError.Err` を返し、`errors.As` / `errors.Is` に使用 |
| `*MultiWriterError` | `HasErrors() bool` | エラーを収集したか |
| `*MultiWriterError` | `ErrorCount() int` | エラー数 |
| `*MultiWriterError` | `FirstError() error` | 最初のエラー（`*WriterError`）、無ければ `nil` |

### エラー戦略

`Write` は「ベストエフォート書き込み」を採用：単一 writer の失敗が他の writer に影響することはありません。基底 writer のエラーは `MultiWriterError` に集約され、`errors.As`/`errors.Is` で使用できるよう `Unwrap() []error` を実装します。全失敗時は `(0, *MultiWriterError)` を返し；一部失敗時は `(pLen, *MultiWriterError)` を返し；書き込みバイト数が不足する場合は short write エラーとして記録します。

:::warning 単一 writer 最適化
基底 writer が 1 つのみの場合、`Write` は高速パスで直接転送し、エラーはそのまま返され、`MultiWriterError` でラップされません。
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

- [設定](../core/config) -- Config 出力先設定（OutputTarget）
- [Logger](../core/logger) -- AddWriter / RemoveWriter
- [セキュリティフィルタ](../security-audit/security) -- パスセキュリティ防護

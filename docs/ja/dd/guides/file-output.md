---
title: "ファイル出力とローテーション - CyberGo DD | ファイルログ設定ガイド"
description: "CyberGo DD ファイル出力とログローテーション設定ガイド。FileWriter のサイズローテーションと時間クリーンアップポリシー、BufferedWriter バッファ書き込み最適化、MultiWriter マルチ出力先ディスパッチ、動的 Writer 管理、本番環境のベストプラクティスをカバーし、高信頼性のファイルログシステムを構築できます。"
---

# ファイル出力とローテーション

DD は柔軟なファイル出力機能を提供し、自動ローテーション、バッファ書き込み、マルチ出力先ディスパッチをサポートし、本番環境での使用に適しています。

## クイックスタート

### 基本的なファイル出力

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.log"),
    },
})
defer logger.Close()

logger.Info("ログがファイルに書き込まれます")
```

### コンソール + ファイル デュアル出力

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
defer logger.Close()
```

## FileWriter ローテーション設定

FileWriter はサイズによる自動ローテーションと、時間による古いファイルのクリーンアップをサポートします：

### デフォルト設定

```go
cfg := dd.DefaultFileWriterConfig()
// MaxSizeMB:   100   — 単一ファイルの最大 100MB
// MaxAge:      30 * 24 * time.Hour  — 30 日間保持
// MaxBackups:  10    — 最大 10 バックアップ保持
// Compress:    false — 圧縮なし
```

### カスタムローテーションポリシー

```go
// 高トラフィックサービス：小さいファイル、高速ローテーション
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 50                // 50MB でローテーション
fwCfg.MaxBackups = 20               // 20 バックアップ保持
fwCfg.MaxAge = 7 * 24 * time.Hour   // 7 日でクリーンアップ
fwCfg.Compress = true      // 古いファイルを圧縮

fw, _ := dd.NewFileWriter("logs/app.log", fwCfg)
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})
```

### JSON フォーマットのログファイル

```go
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
    },
})
```

ローテーション後のファイル命名規則：

```text
logs/app.log           ← 現在のログ
logs/app-001.log       ← 1 回目のローテーション
logs/app-002.log.gz    ← 圧縮された古いバックアップ（Compress 有効時）
```

## BufferedWriter バッファ書き込み

高スループット環境では、`BufferedWriter` を使用して I/O 回数を削減：

```go
// ファイル Writer を作成
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// バッファ Writer でラップ
bwCfg := dd.DefaultBufferedWriterConfig()
// BufferSize: 1024  — 1KB バッファ
// FlushTime:  100ms — 100ms 自動フラッシュ

bw, _ := dd.NewBufferedWriter(fw, bwCfg)

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
defer logger.Close() // Close 時に自動 Flush
```

### チューニングのヒント

| シナリオ | BufferSize | FlushTime | 説明 |
|------|-----------|-----------|------|
| 低遅延要件 | 512 | 50ms | 高速フラッシュ、遅延を削減 |
| 汎用シナリオ | 1024 | 100ms | デフォルト値、遅延とスループットのバランス |
| 高スループット | 4096 | 500ms | 大きなバッファ、スループットを最大化 |
| バッチ処理タスク | 8192 | 1000ms | 最大バッファ、オフライン処理に適している |

:::warning データ安全性
BufferedWriter はバッファが満杯またはタイマーが発動したときにフラッシュします。プログラムの異常終了時、バッファ内のデータが失われる可能性があります。データの完全性を確保するために `Close()` または `Flush()` を確実に呼び出してください。
:::

## MultiWriter マルチ出力先ディスパッチ

```go
// ファイルとリモートサービスに同時書き込み
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
remote := &RemoteLogWriter{endpoint: "http://log-service/ingest"}

mw := dd.NewMultiWriter(fw, remote)

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
```

MultiWriter は全ての Writer にログをディスパッチし、ある Writer の失敗が他の Writer に影響することはありません。

## 動的 Writer 管理

Logger は実行時の Writer の追加と削除をサポートします：

```go
// 実行時に Writer を追加
fw, _ := dd.NewFileWriter("logs/debug.log", dd.DefaultFileWriterConfig())
err := logger.AddWriter(fw)

// 実行時に Writer を削除
err = logger.RemoveWriter(fw)

// 現在の Writer 数を確認
count := logger.WriterCount()
```

:::tip 使用シナリオ
動的 Writer は、実行時にログ出力先を切り替える必要があるシナリオに適しています。例：デバッグモード時に詳細ログファイルを追加、ディスク容量不足時にリモートログサービスに切り替えなど。
:::

## カスタム Writer

`io.Writer` インターフェースを実装するだけで、カスタム出力先を作成できます：

```go
// ネットワークログ送信器
type LogstashWriter struct {
    endpoint string
    client   *http.Client
}

func (w *LogstashWriter) Write(p []byte) (n int, err error) {
    resp, err := w.client.Post(w.endpoint, "application/json", bytes.NewReader(p))
    if err != nil {
        return 0, err
    }
    defer resp.Body.Close()
    return len(p), nil
}

// カスタム Writer を使用
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
        dd.CustomOutput(&LogstashWriter{
            endpoint: "http://logstash:5044",
            client:   &http.Client{Timeout: 5 * time.Second},
        }),
    },
})
```

## 本番環境推奨設定

```go
func NewProductionLogger() (*dd.Logger, error) {
    // ファイル Writer：中規模ローテーション + 圧縮
    fwCfg := dd.DefaultFileWriterConfig()
    fwCfg.MaxSizeMB = 100
    fwCfg.MaxAge = 30 * 24 * time.Hour
    fwCfg.MaxBackups = 15
    fwCfg.Compress = true

    fw, err := dd.NewFileWriter("logs/app.json", fwCfg)
    if err != nil {
        return nil, err
    }

    // バッファラッパー
    bw, err := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
    if err != nil {
        return nil, err
    }

    return dd.New(dd.Config{
        Level:  dd.LevelInfo,
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.CustomOutput(bw),
        },
    })
}
```

## 次のステップ

- [構造化ログ](./structured-logging) -- フィールドとチェーン呼び出し
- [機密データフィルタリング](./sensitive-filtering) -- 自動マスキング
- [API リファレンス - Writers](../api-reference/writers) -- Writer 完全 API
- [パフォーマンス最適化](../advanced/performance) -- パフォーマンスチューニングのヒント

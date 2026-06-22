---
title: "エラー処理 - CyberGo HTML | 堅牢なエラーガイド"
description: "CyberGo HTML エラー処理ガイド：5 種のエラー分類、errors.Is センチネル判定、errors.As 構造化抽出、context キャンセルとバッチ部分失敗処理で堅牢なロジックを構築します。"
---

# エラー処理

## エラーの分類

HTML ライブラリのエラーは以下のカテゴリに分類されます：

| カテゴリ | センチネルエラー | 説明 |
|------|----------|------|
| 入力エラー | `ErrInputTooLarge`, `ErrInvalidHTML` | 入力コンテンツの問題 |
| 設定エラー | `ErrInvalidConfig`, `ErrMultipleConfigs` | 設定の問題 |
| ファイルエラー | `ErrFileNotFound`, `ErrInvalidFilePath` | ファイル操作の問題 |
| 処理エラー | `ErrProcessingTimeout`, `ErrMaxDepthExceeded` | 処理中の問題 |
| システムエラー | `ErrProcessorClosed`, `ErrInternalPanic` | 内部状態の問題 |

## errors.Is パターン

`errors.Is` でエラータイプを判定します：

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        slog.Warn("入力が大きすぎます。ドキュメントサイズを小さくしてください")
    case errors.Is(err, html.ErrInvalidHTML):
        slog.Warn("無効な HTML です。入力を確認してください")
    case errors.Is(err, html.ErrProcessingTimeout):
        slog.Warn("処理がタイムアウトしました。ドキュメントが複雑すぎる可能性があります")
    case errors.Is(err, html.ErrFileNotFound):
        slog.Warn("ファイルが存在しません")
    case errors.Is(err, html.ErrMaxDepthExceeded):
        slog.Warn("DOM 深度が深すぎます。悪意のある構成の可能性があります")
    case errors.Is(err, html.ErrInternalPanic):
        slog.Error("内部パニックからリカバリしました。この問題を報告してください")
    default:
        slog.Error("不明なエラー", "err", err)
    }
}
```

## errors.As パターン

構造化されたエラー情報を抽出します：

```go
var inputErr *html.InputError
var configErr *html.ConfigError
var fileErr *html.FileError

if errors.As(err, &inputErr) {
    fmt.Printf("サイズ %d が制限 %d を超過\n", inputErr.Size, inputErr.MaxSize)
}

if errors.As(err, &configErr) {
    fmt.Printf("フィールド %s の値 %v が無効: %s\n", configErr.Field, configErr.Value, configErr.Message)
}

if errors.As(err, &fileErr) {
    fmt.Printf("ファイル操作: %s\n", fileErr.SafePath())
}
```

## コンテキストのキャンセル

`WithContext` バージョンを使用してキャンセルに対応します：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
        // タイムアウト
    } else if ctx.Err() == context.Canceled {
        // 手動キャンセル
    }
}
```

## バッチエラー

バッチ処理の結果には部分的な成功と部分的な失敗が含まれます：

```go
batch := p.ExtractBatch(pages)

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("項目 %d が失敗: %v\n", i, err)
    }
}

fmt.Printf("成功: %d, 失敗: %d, キャンセル: %d\n",
    batch.Success, batch.Failed, batch.Cancelled)
```

---
title: "エラー処理 - CyberGo DD | ログエラー管理"
description: "CyberGo DD ログライブラリのエラー処理完全ガイド。構造化エラータイプと階層体系、エラーコード設計、センチネルエラー定義と判定方法、errors.Is/As エラーラッピングとアンラッピング、カスタムエラー処理戦略の実装、エラー復旧メカニズム、エラーフックコールバック設定を詳解し、開発者が各種ログ関連エラーを正確に識別して処理できるようにします。"
---

# エラー処理

DD は構造化されたエラー体系を定義し、各種エラーの正確な識別と処理を可能にします。

## エラータイプ

### LoggerError

構造化エラー。エラーコード、メッセージ、原因、コンテキストを含みます：

```go
type LoggerError struct { ... }

// 作成（LoggerError 構造体フィールドを直接使用）
err := &dd.LoggerError{
    Code:    "CUSTOM_CODE",
    Message: "エラー説明",
}

// ラッピング（LoggerError 構造体フィールドを使用）
err := &dd.LoggerError{
    Code:    "WRAP_CODE",
    Message: "ラッピング説明",
    Cause:   originalErr,
}
```

メソッド：

| メソッド | 説明 |
|------|------|
| `Error() string` | エラーメッセージ |
| `Unwrap() error` | 内部エラーを取得 |
| `Is(target error) bool` | エラー比較 |
| `WithContext(key, value)` | コンテキスト情報を追加 |
| `WithField(key, value)` | フィールド情報を追加 |

```go
err := &dd.LoggerError{
    Code:    "DB_ERROR",
    Message: "クエリ失敗",
    Cause:   dbErr,
}
err = err.WithContext("query", "SELECT * FROM users")
err = err.WithField("retry_count", 3)
```

### WriterError

ライターエラー。Writer インデックスと元のエラーを含みます。

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

### MultiWriterError

マルチライター集約エラー。

```go
type MultiWriterError struct { ... }
```

メソッド：`HasErrors()`、`ErrorCount()`、`FirstError()`

## エラー処理パターン

### errors.Is マッチング

```go
logger, err := dd.New(config)
if err != nil {
    if errors.Is(err, dd.ErrNilConfig) {
        // 設定が nil の場合の処理
    }
    if errors.Is(err, dd.ErrInvalidLevel) {
        // 無効なレベルの処理
    }
}
```

### 書き込みエラー処理

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // カスタム書き込みエラー処理
    if errors.Is(err, dd.ErrWriterNotFound) {
        // Writer が既に削除されている
        return
    }
    // エラーメトリクスを記録
    metrics.WriteErrors.Inc()
})
```

### 実行時エラー処理

```go
// Writer を追加
if err := logger.AddWriter(w); err != nil {
    if errors.Is(err, dd.ErrLoggerClosed) {
        // ロガーが閉じている
        return
    }
    if errors.Is(err, dd.ErrNilWriter) {
        // Writer が nil
        return
    }
}

// レベルを設定
if err := logger.SetLevel(dd.LevelDebug); err != nil {
    if errors.Is(err, dd.ErrInvalidLevel) {
        // 無効なレベル
    }
}
```

### セキュリティエラー

```go
fw, err := dd.NewFileWriter(userPath, dd.DefaultFileWriterConfig())
if err != nil {
    if errors.Is(err, dd.ErrPathTraversal) {
        // パストラバーサル攻撃
        log.Fatal("パストラバーサル攻撃を検出")
    }
    if errors.Is(err, dd.ErrNullByte) {
        // Null バイトインジェクション
        log.Fatal("null バイトインジェクションを検出")
    }
    if errors.Is(err, dd.ErrSymlinkNotAllowed) {
        // シンボリックリンクは許可されていない
    }
}
```

### パターンエラー

```go
filter, err := dd.NewCustomSensitiveDataFilter(pattern)
if err != nil {
    if errors.Is(err, dd.ErrReDoSPattern) {
        // ReDoS リスクパターン
        log.Fatal("正規表現パターンに ReDoS リスクあり")
    }
    if errors.Is(err, dd.ErrInvalidPattern) {
        // 無効な正規表現
    }
    if errors.Is(err, dd.ErrPatternTooLong) {
        // パターンが長すぎる
    }
}
```

## フックエラー

フック使用時はフック設定の `OnError` コールバックでフック実行中のエラーをキャプチャして処理できます：

```go
// HooksConfig でフックエラー処理を設定
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        // カスタムフックエラー処理
        handleHookError(event.String(), err)
    },
})
logger, _ := dd.New(dd.Config{
    Hooks: registry,
})
```

## グローバルロガーエラー

```go
// 初期化時にチェック
err := dd.InitDefault(cfg)
if err != nil {
    log.Fatal(err)
}

// 実行時にチェック
if err := dd.DefaultInitError(); err != nil {
    fmt.Println("グローバルロガーの初期化にエラー:", err)
}
```

## 次のステップ

- [定数とエラー](../api-reference/constants) -- 完全エラーコードリスト
- [フックシステム](../api-reference/hooks) -- HookRegistry
- [セキュリティフィルタ](../api-reference/security) -- セキュリティ関連エラー

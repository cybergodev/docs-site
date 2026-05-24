---
title: "エラータイプ - HTTPC"
description: "HTTPCエラータイプAPIリファレンス：ClientError構造体の8フィールドとCode、IsRetryable、Unwrapなどの5メソッド、ErrorTypeNetworkなど12種類のエラー分類列挙、ErrNilConfigなど13個のセンチネルエラー変数とerrors.Is/Asマッチング例。"
---

# エラータイプ

## ClientError

```go
type ClientError = engine.ClientError
```

分類されたHTTPクライアントエラー。`errors.As`で抽出します。

### 構造体フィールド

```go
type ClientError struct {
    Type       ErrorType  // エラー分類
    Message    string     // エラーの説明
    Cause      error      // 基底エラー
    URL        string     // リクエストURL（マスク済み）
    Method     string     // HTTPメソッド
    Attempts   int        // 試行済み回数
    StatusCode int        // HTTPステータスコード（該当する場合）
    Host       string     // ホスト名（サーキットブレーカー用）
}
```

| フィールド | タイプ | 説明 |
|------------|--------|------|
| `Type` | `ErrorType` | エラー分類。switch判定に使用 |
| `Message` | `string` | エラーの説明メッセージ |
| `Cause` | `error` | 基底エラー。`Unwrap()`で取得可能 |
| `URL` | `string` | リクエストURL（認証情報はマスク済み） |
| `Method` | `string` | HTTPメソッド（GET、POSTなど） |
| `Attempts` | `int` | リトライ済み回数 |
| `StatusCode` | `int` | HTTPステータスコード（HTTPエラー以外の場合は0） |
| `Host` | `string` | リクエストホスト名 |

### メソッド

| メソッド | 戻り値 | 説明 |
|----------|--------|------|
| `Error()` | `string` | `METHOD URL: Message: Cause (attempt N)`形式にフォーマット |
| `Code()` | `string` | 読みやすいエラーコード（例：`"NETWORK_ERROR"`、`"TIMEOUT"`） |
| `IsRetryable()` | `bool` | リトライ可能かどうか |
| `Unwrap()` | `error` | 基底エラーをアンラップ |
| `WithType(t ErrorType)` | `*ClientError` | エラータイプを設定したコピーを返す（元は変更しない） |

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    fmt.Println("エラータイプ:", clientErr.Code())
    fmt.Println("リクエストURL:", clientErr.URL)
    fmt.Println("リトライ回数:", clientErr.Attempts)
    fmt.Println("リトライ可能:", clientErr.IsRetryable())
    fmt.Println("基底エラー:", clientErr.Unwrap())
}
```

## ErrorType

```go
type ErrorType = engine.ErrorType
```

エラー分類列挙。

| 定数 | 説明 | リトライ可能 |
|------|------|--------------|
| `ErrorTypeUnknown` | 不明/未分類エラー | 不可 |
| `ErrorTypeNetwork` | ネットワークエラー（接続拒否、DNS失敗など） | 条件による |
| `ErrorTypeTimeout` | リクエストタイムアウト | 可能 |
| `ErrorTypeContextCanceled` | コンテキストキャンセル | 不可 |
| `ErrorTypeResponseRead` | レスポンスボディ読み取りエラー | 条件による |
| `ErrorTypeTransport` | トランスポート層エラー | 可能 |
| `ErrorTypeRetryExhausted` | リトライ枯渇 | 不可 |
| `ErrorTypeTLS` | TLSエラー | 不可 |
| `ErrorTypeCertificate` | 証明書検証エラー | 不可 |
| `ErrorTypeDNS` | DNS解決エラー | 条件による |
| `ErrorTypeValidation` | リクエスト検証エラー | 不可 |
| `ErrorTypeHTTP` | HTTP層エラー | 条件による |

### タイプ判定

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("リクエストタイムアウト")
        case httpc.ErrorTypeNetwork:
            log.Println("ネットワークエラー")
        case httpc.ErrorTypeTLS:
            log.Println("TLSエラー")
        case httpc.ErrorTypeCertificate:
            log.Println("証明書検証失敗")
        case httpc.ErrorTypeDNS:
            log.Println("DNS解決失敗")
        case httpc.ErrorTypeRetryExhausted:
            log.Println("リトライ枯渇")
        case httpc.ErrorTypeContextCanceled:
            log.Println("リクエストがキャンセルされました")
        case httpc.ErrorTypeValidation:
            log.Println("リクエスト検証失敗")
        }
    }
}
```

## エラー変数

### 設定エラー

| 変数 | 説明 |
|------|------|
| `ErrNilConfig` | 設定がnil |
| `ErrInvalidTimeout` | タイムアウト値が無効 |
| `ErrInvalidRetry` | リトライ設定が無効 |
| `ErrInvalidConnection` | 接続設定が無効 |
| `ErrInvalidSecurity` | セキュリティ設定が無効 |
| `ErrInvalidMiddleware` | ミドルウェア設定が無効 |

### リクエストエラー

| 変数 | 説明 |
|------|------|
| `ErrInvalidURL` | URL検証失敗 |
| `ErrInvalidHeader` | リクエストヘッダー検証失敗 |

### レスポンスエラー

| 変数 | 説明 |
|------|------|
| `ErrResponseBodyEmpty` | レスポンスボディが空 |
| `ErrResponseBodyTooLarge` | レスポンスボディがサイズ制限を超過 |

### ファイルエラー

| 変数 | 説明 |
|------|------|
| `ErrEmptyFilePath` | ファイルパスが空 |
| `ErrFileExists` | ファイルが既に存在 |

### クライアントエラー

| 変数 | 説明 |
|------|------|
| `ErrClientClosed` | クライアントが既に閉じられている |

### 変数マッチング

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // クライアントが閉じられている
}
if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // レスポンスボディが空
}
```

## 関連項目

- [エラー処理](../advanced/error-handling) - 完全なエラー処理ガイド
- [定数と列挙](./constants) - BodyKindなどの定数リファレンス
- [リトライとフォールトトレランス](../guides/retry-fault-tolerance) - リトライ戦略ガイド

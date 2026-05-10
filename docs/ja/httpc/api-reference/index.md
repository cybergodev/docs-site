---
title: API リファレンス - HTTPC
description: HTTPC API リファレンス索引。機能別に分類されたパッケージ関数、Client インターフェース、リクエストオプション、ミドルウェア、エラータイプ、設定と定数の詳細ドキュメントリンク。
---

# API リファレンス

HTTPC は 27 個のリクエストオプション関数、5 つの設定プリセット、8 つの組み込みミドルウェア、完全なダウンロードサポートを提供します。

## コアアーキテクチャ

```text
httpc パッケージ
├── Client インターフェース - メインクライアント、全 HTTP メソッド対応
├── DomainClienter インターフェース - ドメインスコープクライアント、セッション管理内蔵
├── Config - 設定システム（タイムアウト/接続/セキュリティ/リトライ/ミドルウェア）
├── RequestOption - 27 個のリクエストオプション関数
├── MiddlewareFunc - ミドルウェアチェーン
├── Result - レスポンス結果（リクエストメタデータ付き）
└── パッケージ関数 - クライアント作成なしで使用可能
```

## モジュールナビゲーション

### コア

| モジュール | 説明 |
|------------|------|
| [パッケージ関数](./functions) | Get/Post/Put/Patch/Delete などのパッケージ関数、クライアントメソッド、ヘルパー関数 |
| [設定](./config) | Config 構造体、5 種類のプリセット設定、検証関数、Cookie セキュリティ |
| [インターフェース](./interfaces) | Client、Doer、DomainClienter、RetryPolicy などのコアインターフェース |
| [Result](./result) | Result、RequestInfo、ResponseInfo、RequestMeta タイプと全メソッド |

### リクエストとレスポンス

| モジュール | 説明 |
|------------|------|
| [リクエストオプション](./options) | 27 個の WithXxx リクエストオプション関数（ヘッダー、ボディ、認証、Cookie、コールバックなど） |
| [ミドルウェア](./middleware) | Chain コンビネーション、8 つの組み込みミドルウェアファクトリ、監査イベントタイプ |
| [エラータイプ](./errors) | ClientError、12 種類の ErrorType 列挙、13 個のエラー変数 |

### 高度な機能

| モジュール | 説明 |
|------------|------|
| [ドメインクライアント](./domain-client) | DomainClient 作成、HTTP メソッド、ダウンロードメソッド、URL 構築ルール |
| [セッション管理](./session) | SessionManager の Cookie/ヘッダー管理とセキュリティ検証 |
| [ファイルダウンロード](./download) | ダウンロード関数、DownloadConfig、レジューム、セキュリティ保護 |
| [定数とタイプ](./constants) | BodyKind 列挙、FormData/FileData、監査コンテキストキー |

## クイックリファレンス

### クライアントの作成

```go
client, err := httpc.New()                    // デフォルト設定
client, err := httpc.New(httpc.SecureConfig()) // セキュアプリセット
client, err := httpc.New(customConfig)         // カスタム設定
```

### リクエストの送信

```go
// パッケージ関数
result, err := httpc.Get(url, options...)

// クライアントメソッド
result, err := client.Get(url, options...)

// コンテキスト付き
result, err := client.Request(ctx, "GET", url, options...)
```

### レスポンスの処理

```go
result.StatusCode()           // ステータスコード
result.Body()                 // レスポンスボディ（文字列）
result.RawBody()              // レスポンスボディ（バイト）
result.Unmarshal(&data)       // JSON パース
result.IsSuccess()            // 2xx かどうか
result.Meta.Duration          // リクエスト所要時間
result.Meta.Attempts          // リトライ回数
defer httpc.ReleaseResult(result) // オブジェクトプールに返却
```

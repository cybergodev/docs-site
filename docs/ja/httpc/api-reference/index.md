---
title: "APIリファレンス - HTTPC"
description: "HTTPC APIリファレンス索引：コア、リクエスト/レスポンス、高度な機能の3グループに分類し、パッケージ関数、27個のWithXxxリクエストオプション関数、Config設定システム、8つの組み込みミドルウェアファクトリ、ドメインクライアント、セッション管理、ファイルダウンロード、エラータイプの詳細ドキュメントリンクをナビゲーションします。"
---

# APIリファレンス

HTTPCは27個のリクエストオプション関数、5つの設定プリセット、8つの組み込みミドルウェア、完全なダウンロードサポートを提供しています。

## コアアーキテクチャ

```text
httpcパッケージ
├── Clientインターフェース - メインクライアント。全HTTPメソッド対応
├── DomainClienterインターフェース - ドメインスコープクライアント。セッション管理内蔵
├── Config - 設定システム（タイムアウト/接続/セキュリティ/リトライ/ミドルウェア）
├── RequestOption - 27個のリクエストオプション関数
├── MiddlewareFunc - ミドルウェアチェーン
├── Result - レスポンス結果（リクエストメタデータ付き）
└── パッケージ関数 - クライアント作成なしで使用可能
```

## モジュールナビゲーション

### コア

| モジュール | 説明 |
|------------|------|
| [パッケージ関数](./functions) | Get/Post/Put/Patch/Deleteなどのパッケージ関数、クライアントメソッド、ヘルパー関数 |
| [設定](./config) | Config構造体、5種のプリセット設定、検証関数、Cookieセキュリティ |
| [インターフェース](./interfaces) | Client、Doer、DomainClienter、RetryPolicyなどのコアインターフェース |
| [Result](./result) | Result、RequestInfo、ResponseInfo、RequestMetaタイプと全メソッド |

### リクエストとレスポンス

| モジュール | 説明 |
|------------|------|
| [リクエストオプション](./options) | 27個のWithXxxリクエストオプション関数（ヘッダー、ボディ、認証、Cookie、コールバックなど） |
| [ミドルウェア](./middleware) | Chain組み合わせ、8つの組み込みミドルウェアファクトリ、監査イベントタイプ |
| [エラータイプ](./errors) | ClientError、12種のErrorType列挙、13個のエラー変数 |

### 高度な機能

| モジュール | 説明 |
|------------|------|
| [ドメインクライアント](./domain-client) | DomainClientの作成、HTTPメソッド、ダウンロードメソッド、URL結合ルール |
| [セッション管理](./session) | SessionManagerのCookie/ヘッダー管理とセキュリティ検証 |
| [ファイルダウンロード](./download) | ダウンロード関数、DownloadConfig、レジュームダウンロード、セキュリティ保護 |
| [定数とタイプ](./constants) | BodyKind列挙、FormData/FileData、監査コンテキストキー |

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
result.Unmarshal(&data)       // JSON解析
result.IsSuccess()            // 2xxかどうか
result.Meta.Duration          // リクエスト所要時間
result.Meta.Attempts          // リトライ回数
defer httpc.ReleaseResult(result) // オブジェクトプールに返却
```

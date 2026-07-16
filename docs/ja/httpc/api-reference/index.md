---
sidebar_label: "概要"
title: "API リファレンス - CyberGo HTTPC | API総索引"
description: "HTTPC API リファレンス索引: コア、リクエスト/レスポンス、高度な機能で分類したナビゲーション。パッケージ関数、リクエストオプション、設定プリセット、ミドルウェア、ドメインクライアント、ダウンロード、エラータイプの完全な参照入口を提供します。"
sidebar_position: 1
---

# API リファレンス

HTTPC は 28 個のリクエストオプション関数、5 つの設定プリセット、8 つの内蔵ミドルウェア、完全なダウンロードサポートを提供します。

## コアアーキテクチャ

```text
httpc パッケージ
├── Client インターフェース - メインクライアント。全 HTTP メソッドに対応
├── DomainClienter インターフェース - ドメインスコープクライアント。セッション管理を内蔵
├── Config - 設定システム（タイムアウト/接続/セキュリティ/リトライ/ミドルウェア）
├── RequestOption - 28 個のリクエストオプション関数
├── MiddlewareFunc - ミドルウェアチェーン
├── Result - レスポンス結果（リクエストメタデータ含む）
└── パッケージ関数 - クライアントを作成せずに使用可能
```

## モジュールナビゲーション

### コア

| モジュール | 説明 |
|-----------|------|
| [パッケージ関数](./core/functions) | Get/Post/Put/Patch/Delete などのパッケージレベル関数、クライアントメソッド、ヘルパー関数 |
| [設定](./client-config/config) | Config 構造体、5 種類のプリセット設定、検証関数、Cookie セキュリティ |
| [インターフェース](./types/interfaces) | Client、Doer、DomainClienter、RetryPolicy などのコアインターフェース |
| [Result](./core/result) | Result、RequestInfo、ResponseInfo、RequestMeta タイプと全メソッド |

### リクエストとレスポンス

| モジュール | 説明 |
|-----------|------|
| [リクエストオプション](./core/options) | 28 個の WithXxx リクエストオプション関数（ヘッダー、ボディ、認証、Cookie、コールバックなど） |
| [ミドルウェア](./client-config/middleware) | Chain 組み合わせ、8 つの内蔵ミドルウェアファクトリ、監査イベントタイプ |
| [エラータイプ](./types/errors) | ClientError、12 種類の ErrorType 列挙、12 個のエラー変数 |

### 高度な機能

| モジュール | 説明 |
|-----------|------|
| [ドメインクライアント](./client-config/domain-client) | DomainClient 作成、HTTP メソッド、ダウンロードメソッド、URL 結合ルール |
| [セッション管理](./client-config/session) | SessionManager の Cookie/ヘッダー管理とセキュリティ検証 |
| [ファイルダウンロード](./client-config/download) | ダウンロード関数、DownloadConfig、レジューム、セキュリティ保護 |
| [定数とタイプ](./types/constants) | BodyKind 列挙、FormData/FileData、監査コンテキストキー |

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
result.Unmarshal(&data)       // JSON 解析
result.IsSuccess()            // 2xx かどうか
result.Meta.Duration          // リクエスト所要時間
result.Meta.Attempts          // リトライ回数
```

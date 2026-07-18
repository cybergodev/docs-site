---
sidebar_label: "リクエストとレスポンスミューテータ"
title: "リクエストとレスポンスミューテータ - CyberGo HTTPC | Mutator インターフェース"
description: "HTTPC ミドルウェアの読み書き契約の解説: RequestMutator と ResponseMutator はすべての読み書きメソッドを公開する合成インターフェースで、ヘッダー設定とステータスコード読み取りのコンパイル可能な例を提供します。"
sidebar_position: 2
---

# リクエストとレスポンスミューテータ

ミドルウェアは基礎となるリクエスト/レスポンスオブジェクトを直接操作せず、**ミューテータ**インターフェースを通じて読み書きします。ミドルウェアは常に完全な読み書きミューテータ（`RequestMutator` / `ResponseMutator`）を受け取ります。以下の読み取り/書き込みのグループ分けは読みやすさのためであり、個別にエクスポートされたインターフェースではありません。

```text
RequestMutator  = 読み取りメソッド  + 書き込みメソッド
ResponseMutator = 読み取りメソッド + 書き込みメソッド
        ↑                                    ↑
  ミドルウェアが RequestMutatorで       ミドルウェアが ResponseMutatorで
  リクエストを書き換える                 レスポンスを読み取り/書き換える
```

`Handler` シグネチャ `func(ctx, RequestMutator) (ResponseMutator, error)` がまさにこの 2 つのミューテータをミドルウェアの入口と出口として公開しています。

## リクエストミューテータ

### 読み取りメソッド

以下のメソッドはリクエストデータを読み取ります。ミドルウェアがリクエストプロパティを**検査**だけする場合に呼び出します。

| メソッド | 戻り値の型 | 説明 |
|----------|------------|------|
| `Method()` | `string` | HTTP メソッド |
| `URL()` | `string` | リクエスト URL |
| `Headers()` | `map[string]string` | 全リクエストヘッダー |
| `QueryParams()` | `map[string]any` | クエリパラメータ |
| `Body()` | `any` | リクエストボディ |
| `Timeout()` | `time.Duration` | リクエストタイムアウト |
| `MaxRetries()` | `int` | 最大リトライ回数 |
| `Context()` | `context.Context` | リクエストコンテキスト |
| `Cookies()` | `[]http.Cookie` | リクエスト Cookie |
| `FollowRedirects()` | `*bool` | リダイレクトを追うかどうか |
| `MaxRedirects()` | `*int` | 最大リダイレクト回数 |
| `StreamBody()` | `bool` | リクエストボディをストリーミングするかどうか |

### 書き込みメソッド

以下のメソッドはリクエストデータを変更します。ミドルウェアがリクエストプロパティを**変更**だけする場合に呼び出します。

| メソッド | 説明 |
|----------|------|
| `SetMethod(string)` | HTTP メソッドの設定 |
| `SetURL(string)` | URL の設定 |
| `SetHeaders(map[string]string)` | 全リクエストヘッダーの設定 |
| `SetHeader(key, value string)` | 単一リクエストヘッダーの設定 |
| `SetQueryParams(map[string]any)` | クエリパラメータの設定 |
| `SetBody(any)` | リクエストボディの設定 |
| `SetTimeout(time.Duration)` | タイムアウトの設定 |
| `SetMaxRetries(int)` | 最大リトライ回数の設定 |
| `SetContext(context.Context)` | コンテキストの設定 |
| `SetCookies([]http.Cookie)` | Cookie の設定 |
| `SetFollowRedirects(*bool)` | リダイレクトを追うかどうかの設定 |
| `SetMaxRedirects(*int)` | 最大リダイレクト回数の設定 |
| `SetStreamBody(bool)` | ストリーミングするかどうかの設定 |

### RequestMutator

httpc が公開する読み書き兼用のリクエストミューテータで、上の「読み取りメソッド」および「書き込みメソッド」両表の全メソッドを含みます。内部の読み取り/書き込み分割インターフェースは `internal/types` パッケージにあり、個別にはエクスポートされず、外部からは一様に `RequestMutator` として参照されます。ミドルウェアがリクエスト送信前にこれを通じてリクエストプロパティを検査・書き換えます。

## レスポンスミューテータ

### 読み取りメソッド

以下のメソッドはレスポンスデータを読み取ります。

| メソッド | 戻り値の型 | 説明 |
|----------|------------|------|
| `StatusCode()` | `int` | ステータスコード |
| `Status()` | `string` | ステータステキスト |
| `Proto()` | `string` | プロトコルバージョン |
| `Headers()` | `http.Header` | レスポンスヘッダー |
| `Body()` | `string` | レスポンスボディ（文字列） |
| `RawBody()` | `[]byte` | レスポンスボディ（バイト） |
| `ContentLength()` | `int64` | コンテンツ長 |
| `Duration()` | `time.Duration` | リクエスト所要時間 |
| `Attempts()` | `int` | 試行回数（リトライ含む） |
| `Cookies()` | `[]*http.Cookie` | レスポンス Cookie |
| `RedirectChain()` | `[]string` | リダイレクトチェーン |
| `RedirectCount()` | `int` | リダイレクト回数 |
| `RequestHeaders()` | `http.Header` | リクエストヘッダー |
| `RequestURL()` | `string` | リクエスト URL |
| `RequestMethod()` | `string` | リクエストメソッド |

### 書き込みメソッド

以下のメソッドはレスポンスデータを変更します。

| メソッド | 説明 |
|----------|------|
| `SetStatusCode(int)` | ステータスコードの設定 |
| `SetStatus(string)` | ステータステキストの設定 |
| `SetProto(string)` | プロトコルバージョンの設定 |
| `SetHeaders(http.Header)` | レスポンスヘッダーの設定 |
| `SetBody(string)` | レスポンスボディの設定 |
| `SetRawBody([]byte)` | レスポンスボディ（バイト）の設定 |
| `SetContentLength(int64)` | コンテンツ長の設定 |
| `SetDuration(time.Duration)` | 所要時間の設定 |
| `SetAttempts(int)` | 試行回数の設定 |
| `SetCookies([]*http.Cookie)` | Cookie の設定 |
| `SetRedirectChain([]string)` | リダイレクトチェーンの設定 |
| `SetRedirectCount(int)` | リダイレクト回数の設定 |
| `SetRequestHeaders(http.Header)` | リクエストヘッダーの設定 |
| `SetRequestURL(string)` | リクエスト URL の設定 |
| `SetRequestMethod(string)` | リクエストメソッドの設定 |
| `SetHeader(key string, values ...string)` | 単一レスポンスヘッダーの設定 |

### ResponseMutator

httpc が公開する読み書き兼用のレスポンスミューテータで、上の「読み取りメソッド」および「書き込みメソッド」両表の全メソッドを含みます。内部の読み取り/書き込み分割インターフェースは `internal/types` パッケージにあり、個別にはエクスポートされず、外部からは一様に `ResponseMutator` として参照されます。ミドルウェアがリクエスト完了後にこれを通じてレスポンスを読み取りまたは書き換えます。レスポンスキャッシュ、コンテンツ変換（例: JSON の整形）、エンコード/デコード、レスポンスフィルタリングに便利です。

## 例: ミューテータで読み書きする

`RequestMutator.SetHeader` で認証ヘッダーを注入し、`ResponseMutator.StatusCode` でレスポンスステータスコードを読み取る認証ミドルウェアです。

```go
package main

import (
	"context"
	"fmt"

	"github.com/cybergodev/httpc"
)

// authMiddleware は RequestMutator で認証ヘッダーを注入し、
// ResponseMutator でステータスコードを読み取ります
func authMiddleware(token string) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// 書き込み: RequestMutator でリクエストヘッダーを設定
			req.SetHeader("Authorization", "Bearer "+token)
			// 読み取り: RequestMutator でリクエストメソッドを検査
			fmt.Printf("%s リクエストを送信\n", req.Method())

			resp, err := next(ctx, req)
			if err != nil {
				return nil, err
			}
			// 読み取り: ResponseMutator でステータスコードを取得
			fmt.Printf("ステータスコード %d を受信\n", resp.StatusCode())
			return resp, nil
		}
	}
}

func main() {
	client, err := httpc.New(&httpc.Config{
		Middleware: &httpc.MiddlewareConfig{
			Middlewares: []httpc.MiddlewareFunc{
				authMiddleware("my-secret-token"),
			},
		},
	})
	if err != nil {
		panic(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}
	fmt.Println(result.IsSuccess())
	// 出力例:
	// GET リクエストを送信
	// ステータスコード 200 を受信
	// true
}
```

## 関連項目

- [Handlerとミドルウェアチェーン](./handler-chain) — 二重階層アーキテクチャとオニオンモデルの概要
- [内蔵ミドルウェア](../client-config/middleware) — HeaderMiddleware などはミューテータで動作する完成例です
- [インターフェース](../types/interfaces) — ミューテータの型エイリアス定義

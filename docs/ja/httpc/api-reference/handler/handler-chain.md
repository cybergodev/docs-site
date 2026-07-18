---
sidebar_label: "Handlerとミドルウェアチェーン"
title: "Handlerとミドルウェアチェーン - CyberGo HTTPC | リクエスト処理パイプライン"
description: "HTTPC Handler パイプラインアーキテクチャの解説: 二重階層設計において Layer 1 のパッケージ関数が MiddlewareFunc オニオンチェーンを組み立てて Handler を実行する仕組み、Chain 結合器の原理とカスタムミドルウェアの作成例。"
sidebar_position: 1
---

# Handlerとミドルウェアチェーン

## 二重階層アーキテクチャ

HTTPC のリクエスト処理は 2 つの階層の連携で成り立ちます。Layer 1 のメソッド API は**薄いラッパー**であり、実際にリクエストを処理するエンジンは Layer 2 の Handler パイプラインです。すべてのリクエスト実行は「Handler チェーンを組み立てて実行する」ことに帰着します。

```text
HTTPC 二重階層アーキテクチャ
├── Layer 1  メソッド API（薄いラッパー）
│     パッケージ関数 httpc.Get/Post/... + Client メソッド + リクエストオプション
│     → 内部的に client.Request → executeRequest で統一
│
└── Layer 2  Handler パイプライン（リクエスト処理エンジン）
      clientImpl.middlewareChain = Chain(middlewares...)(finalHandler)
      MiddlewareFunc(Handler) オニオンチェーン → 組み立て → 実行
```

クライアントにミドルウェアが設定されている場合、`executeRequest` はリクエストオプションを `RequestMutator` に適用してから `clientImpl.middlewareChain` に渡して実行します。ミドルウェアがない場合はエンジンへ直接リクエストを送ります。このチェーンこそが `buildMiddlewareChain` が `New()` 時に一度組み立てて `clientImpl.middlewareChain` フィールドにキャッシュした Handler です。

## Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

リクエスト処理のコア関数シグネチャです。コンテキストとリクエストミューテータを受け取り、レスポンスミューテータまたはエラーを返します。チェーンの末端にある Handler（`finalHandler`）は、ミドルウェアが書き換えたリクエストフィールドを下位エンジンへ転送し、実際にネットワークリクエストを送信する役割を担います。

## MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

ミドルウェア関数のシグネチャで、「次の Handler」を受け取りラップした Handler を返します。ミドルウェアは `next` 呼び出しの前後にロジック（リクエストの書き換え、レスポンスの記録、panic の回復など）を挿入し、オニオンモデルを形成します。最初のミドルウェアが最も外側の階層で、最初に進入し最後に退出します。

```text
リクエスト進入方向 →

[Middleware A] → [Middleware B] → [Middleware C] → finalHandler → エンジン
                                                                   ↓
レスポンス戻り方向 ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ↓
```

ミドルウェアは `MiddlewareConfig.Middlewares` スライスに順序付きで設定され、スライスで**前にある**ミドルウェアがチェーンの**外側の階層**に位置します。

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

複数のミドルウェアを単一のミドルウェアに結合します。返される結合器は最終 Handler を受け取り、ミドルウェアを渡された順序で外側から内側へネストします。スライスの最初のミドルウェアが最も外側の階層（最初に実行）を包み、最後のミドルウェアが最終 Handler のすぐ隣に接します。HTTPC は内部的にこれを使い `MiddlewareConfig.Middlewares` をチェーンに組み立てます。

```go
// 2 つの形式は等価です: Chain で組み立てて一度に注入するか、
// 手動で階層ごとにネストするかで結果は同じです
combined := httpc.Chain(mwA, mwB, mwC)
chain := combined(finalHandler)

// 手動ネストと同等
chain := mwA(mwB(mwC(finalHandler)))
```

## カスタムミドルウェアの例

リクエスト前後の所要時間を記録する完全なタイミングミドルウェアで、`MiddlewareConfig.Middlewares` を通じてクライアントに注入します。

```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/cybergodev/httpc"
)

// timingMiddleware は各リクエストの所要時間を記録します
func timingMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()
			// 次の Handler を呼び出し、リクエストがチェーン沿いに進むようにします
			resp, err := next(ctx, req)
			fmt.Printf("%s %s -> 所要 %v\n", req.Method(), req.URL(), time.Since(start))
			return resp, err
		}
	}
}

func main() {
	client, err := httpc.New(&httpc.Config{
		Middleware: &httpc.MiddlewareConfig{
			Middlewares: []httpc.MiddlewareFunc{
				timingMiddleware(),
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
	fmt.Println(result.StatusCode())
	// 出力例:
	// GET https://httpbin.org/get -> 所要 123.456ms
	// 200
}
```

:::tip
ミドルウェアが返す `resp` はそのまま（または以降の `next` 呼び出しを通じて）戻される必要があります。そうしないとエンジンのオブジェクトプールのレスポンスがリークします。未解放のレスポンスを保持したまま `(nil, error)` を返すとプールリークが発生します。
:::

## 関連項目

- [内蔵ミドルウェア](../client-config/middleware) — Recovery/Logging/Timeout など 8 つのすぐ使えるミドルウェアファクトリ
- [リクエストとレスポンスミューテータ](./mutators) — `RequestMutator`/`ResponseMutator` の完全なメソッド契約
- [インターフェース](../types/interfaces) — `Handler`/`MiddlewareFunc` の型エイリアス定義

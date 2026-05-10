---
title: リトライとフォールトトレランス - HTTPC
description: HTTPC リトライとフォールトトレランスガイド。デフォルトリトライ戦略とバックオフアルゴリズムの原理、RetryPolicy カスタムインターフェース、Retry-After 解析とベストプラクティス。
---

# リトライとフォールトトレランス

## デフォルトリトライ

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 3           // 最大 3 回
cfg.Retry.Delay = 1 * time.Second  // 初期遅延 1s
cfg.Retry.BackoffFactor = 2.0      // 指数バックオフ 2x
cfg.Retry.EnableJitter = true      // ジッター有効化

client, _ := httpc.New(cfg)
```

デフォルトのリトライ遅延シーケンス：`1s → 2s → 4s`（ランダムジッター含む）

### リトライ条件

デフォルトでは、以下のエラーがリトライをトリガーします：

| 条件 | リトライ |
|------|----------|
| ネットワークエラー（接続拒否、DNS 障害） | はい |
| タイムアウトエラー | はい |
| 5xx サーバーエラー（500/502/503/504） | はい |
| 408 Request Timeout / 429 Too Many Requests | はい |
| その他の 4xx クライアントエラー | いいえ |
| コンテキストのキャンセル | いいえ |
| 設定検証エラー | いいえ |

## カスタムリトライ戦略

`RetryPolicy` インターフェースを実装して、リトライ動作を完全に制御します：

:::warning 内部型
`RetryPolicy.ShouldRetry` の `resp` パラメータの型 `ResponseReader` は内部インターフェース（`internal/types` パッケージで定義）であり、外部パッケージからは直接参照できません。カスタム `RetryPolicy` は `httpc` と同じモジュール内のパッケージで実装する必要があります。ほとんどのシナリオでは `RetryConfig` フィールドによる設定で十分です。
:::

```go
// 注意：ResponseReader は内部型（internal/types パッケージ）です。
// このコードは github.com/cybergodev/httpc モジュール内でのみコンパイル可能です。
// ほとんどのユーザーは RetryConfig と WithMaxRetries でリトライを設定してください。

type MyRetryPolicy struct {
    maxAttempts int
}

// リトライすべきかどうかを判定
func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    // ネットワークエラーはリトライ
    if err != nil {
        return true
    }
    // 502、503、504 のみリトライ
    return resp.StatusCode() == 502 || resp.StatusCode() == 503 || resp.StatusCode() == 504
}

// リトライ遅延を返す
func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(attempt+1)
}

// 最大リトライ回数
func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxAttempts
}

// カスタム戦略の適用
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &MyRetryPolicy{maxAttempts: 5}
```

## リクエスト単位の制御

```go
// 単一リクエストを 5 回リトライ
result, err := client.Get(url, httpc.WithMaxRetries(5))

// リトライ無効化
result, err := client.Get(url, httpc.WithMaxRetries(0))

// コンテキストタイムアウトとの組み合わせ
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url, httpc.WithMaxRetries(3))
```

## Retry-After サポート

HTTPC はサーバーから返される `Retry-After` レスポンスヘッダーを自動的に解析します：

```go
// サーバーが返す: Retry-After: 120
// HTTPC は指数バックオフ遅延ではなく、120 秒待機してからリトライする

// サーバーが返す: Retry-After: Fri, 25 Apr 2026 12:00:00 GMT
// HTTPC は指定された時刻まで待機してからリトライする
```

:::tip ヒント
`Retry-After` はリトライ可能なすべてのレスポンス（408、429、500、502、503、504）で有効になり、指数バックオフ遅延より優先されます。
:::

## バックオフ戦略

### 指数バックオフ

```go
cfg.Retry.BackoffFactor = 2.0
// 遅延シーケンス: delay, delay*2, delay*4, delay*8...
```

### 固定遅延

```go
cfg.Retry.BackoffFactor = 1.0
// 遅延シーケンス: delay, delay, delay...
```

### 線形増加

```go
// カスタム RetryPolicy の実装が必要:
// delay * (attempt + 1)
// 詳細は高度なサンプルのカスタムリトライ戦略を参照
```

### ランダムジッター

ジッターを有効にして「サンダーハード効果」を回避します：

```go
cfg.Retry.EnableJitter = true
// 基本遅延にランダムなオフセットを追加し、すべてのクライアントが同時にリトライするのを防止
```

## エラー処理とリトライ

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("%d 回リトライ後も失敗", clientErr.Attempts)
        }
    }
    return err
}
```

## ベストプラクティス

| シナリオ | 推奨設定 |
|----------|----------|
| API 呼び出し | MaxRetries=3, Delay=1s, Backoff=2.0 |
| マイクロサービス通信 | MaxRetries=2, Delay=500ms |
| ファイルダウンロード | MaxRetries=5, Delay=2s, Backoff=2.0 |
| 冪等操作 | 安心してリトライ可能 |
| 非冪等操作（POST） | ネットワークエラー時のみリトライ |

:::warning 警告
非冪等な POST リクエストもデフォルトでリトライされます。厳密な制御が必要な場合は、カスタム `RetryPolicy` を実装してください。
:::

## 次のステップ

- [エラー処理](../advanced/error-handling) - 完全なエラー処理ガイド
- [設定 API](../api-reference/config) - リトライ設定リファレンス
- [インターフェース定義](../api-reference/interfaces) - RetryPolicy インターフェースリファレンス

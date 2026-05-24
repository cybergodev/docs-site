---
title: "リトライとフォールトトレランス - HTTPC"
description: "HTTPCリトライとフォールトトレランスガイド：デフォルト指数バックオフリトライ戦略とRetryConfig設定、408/429/5xx自動リトライ条件、RetryPolicyカスタムインターフェース（内部タイプ制限の説明付き）、Retry-Afterレスポンスヘッダー自動解析、バックオフ戦略の選択とリクエストごとのWithMaxRetries制御、ベストプラクティス。"
---

# リトライとフォールトトレランス

## デフォルトリトライ

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 3           // 最大3回
cfg.Retry.Delay = 1 * time.Second  // 初期遅延1s
cfg.Retry.BackoffFactor = 2.0      // 指数バックオフ2x
cfg.Retry.EnableJitter = true      // ジッター有効

client, _ := httpc.New(cfg)
```

デフォルトのリトライ遅延シーケンス：`1s → 2s → 4s`（ランダムジッター付き）

### リトライ条件

デフォルトでは、以下のエラーがリトライをトリガーします：

| 条件 | リトライ |
|------|----------|
| ネットワークエラー（接続拒否、DNS失敗） | あり |
| タイムアウトエラー | あり |
| 5xxサーバーエラー（500/502/503/504） | あり |
| 408 Request Timeout / 429 Too Many Requests | あり |
| その他の4xxクライアントエラー | なし |
| コンテキストキャンセル | なし |
| 設定検証エラー | なし |

## カスタムリトライポリシー

`RetryPolicy`インターフェースを実装してリトライ動作を完全に制御します：

:::warning 警告 内部タイプ
`RetryPolicy.ShouldRetry`の`resp`パラメータタイプ`ResponseReader`は内部インターフェース（`internal/types`パッケージで定義）であり、外部パッケージからは直接参照できません。カスタム`RetryPolicy`は`httpc`と同じモジュール内のパッケージでのみ実装可能です。ほとんどのシナリオでは`RetryConfig`フィールドの設定で要件を満たせます。
:::

```go
// 注意：ResponseReaderは内部タイプ（internal/typesパッケージ）です。
// このコードはgithub.com/cybergodev/httpcモジュール内でのみコンパイル可能です。
// ほとんどのユーザーはRetryConfigとWithMaxRetriesでリトライを設定してください。

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
    // 502、503、504のみリトライ
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

// カスタムポリシーを適用
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &MyRetryPolicy{maxAttempts: 5}
```

## リクエストごとの制御

```go
// 個別リクエストで5回リトライ
result, err := client.Get(url, httpc.WithMaxRetries(5))

// リトライを無効化
result, err := client.Get(url, httpc.WithMaxRetries(0))

// コンテキストタイムアウトと組み合わせ
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url, httpc.WithMaxRetries(3))
```

## Retry-Afterサポート

HTTPCはサーバーが返す`Retry-After`レスポンスヘッダーを自動的に解析します：

```go
// サーバーが返す: Retry-After: 120
// HTTPCは指数バックオフ遅延の代わりに120秒待機してからリトライ

// サーバーが返す: Retry-After: Fri, 25 Apr 2026 12:00:00 GMT
// HTTPCは指定時刻まで待機してからリトライ
```

:::tip ヒント
`Retry-After`はリトライ可能なすべてのレスポンス（408、429、500、502、503、504）で有効になり、指数バックオフ遅延より優先度が高くなります。
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
// カスタムRetryPolicyの実装が必要:
// delay * (attempt + 1)
// 詳細は高度な例のカスタムリトライポリシーを参照
```

### ランダムジッター

ジッターを有効にして「サンダースタンプ効果」を回避：

```go
cfg.Retry.EnableJitter = true
// 基本遅延にランダムなオフセットを追加し、全クライアントが同時にリトライするのを防止
```

## エラー処理とリトライ

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("%d回リトライ後も失敗", clientErr.Attempts)
        }
    }
    return err
}
```

## ベストプラクティス

| シナリオ | 推奨設定 |
|----------|----------|
| API呼び出し | MaxRetries=3, Delay=1s, Backoff=2.0 |
| マイクロサービス通信 | MaxRetries=2, Delay=500ms |
| ファイルダウンロード | MaxRetries=5, Delay=2s, Backoff=2.0 |
| べき等操作 | リトライを安心して使用可能 |
| 非べき等操作（POST） | ネットワークエラー時のみリトライ |

:::warning 警告
非べき等のPOSTリクエストもデフォルトでリトライされます。正確な制御が必要な場合は、カスタム`RetryPolicy`を実装してください。
:::

## 次のステップ

- [エラー処理](../advanced/error-handling) - 完全なエラー処理ガイド
- [設定API](../api-reference/config) - リトライ設定リファレンス
- [インターフェース定義](../api-reference/interfaces) - RetryPolicyインターフェースリファレンス

---
title: HTTP クライアント - HTTPC
description: CyberGo HTTPC は Go 言語向けの安全で高性能な HTTP クライアントライブラリです。TLS 暗号化、SSRF 防護、インテリジェントなリトライ、ミドルウェアチェーンを内蔵し、マイクロサービスシナリオに適しています。
---

# HTTPC

安全な HTTP クライアントライブラリ。デフォルトセーフ、スマートリトライ・ミドルウェアチェーン・オブジェクトプール再利用を内蔵。

## 特徴

- **TLS 1.2+** - 最低 TLS バージョンを強制、デフォルト TLS 1.2-1.3
- **SSRF 防護** - デフォルトでプライベート IP 接続をブロック、CIDR 豁免設定可能
- **スマートリトライ** - 指数バックオフ + ジッター、カスタムリトライ戦略対応
- **コネクションプール管理** - 高性能コネクション再利用、HTTP/2 対応
- **ミドルウェアチェーン** - ログ・監査・メトリクス・リカバリ・リクエスト ID などの組み込みミドルウェア
- **ファイルダウンロード** - レジュームダウンロード、プログレスコールバック、チェックサム検証対応
- **DNS-over-HTTPS** - 組み込み DoH リゾルバ、DNS ハイジャックリスクを低減
- **オブジェクトプール再利用** - 組み込み sync.Pool でメモリ割り当てを削減、GC 負荷を軽減

## インストール

```bash
go get github.com/cybergodev/httpc
```

## 30 秒で体験

```go
package main

import (
    "fmt"
    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://httpbin.org/get")
    if err != nil {
        panic(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
}
```

## ここから始める

目的に応じて読むページを選んでください：

| 目的 | おすすめ |
|------|----------|
| 5 分で始める | [クイックスタート](./getting-started) |
| 30 分の実践 | [チュートリアル](./guides/tutorial) |
| 使い方を探す | [チートシート](./cheatsheet) |
| セキュリティ機能 | [セキュリティ概要](./security/) |
| API 署名を確認 | [API リファレンス](./api-reference/) |

## コアコンセプト

HTTPC はシンプルから柔軟まで、3 つの使い方を提供します：

```text
パッケージ関数          クライアントインスタンス             ドメインクライアント
httpc.Get()  →  client, _ := httpc.New()  →  dc, _ := httpc.NewDomain(url)
一回限りのリクエスト   カスタム設定/ミドルウェア        セッション管理/Cookie 自動維持
```

### 設定プリセット

| プリセット | 適用シナリオ |
|------------|-------------|
| `DefaultConfig()` | 汎用、セキュアなデフォルト値 |
| `SecureConfig()` | セキュリティ重要シナリオ、厳格なタイムアウト |
| `PerformanceConfig()` | 高スループット、大規模コネクションプール |
| `TestingConfig()` | テスト環境、セキュリティチェック無効 |
| `MinimalConfig()` | 軽量スクリプト、リトライ・リダイレクトなし |

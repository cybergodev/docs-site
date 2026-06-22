---
title: "HTTP クライアント - CyberGo HTTPC | 安全なGoクライアント"
description: "CyberGo HTTPC は Go 向けの安全で高性能な HTTP クライアントライブラリ。TLS 1.2+ 強制暗号化、SSRF 防護、指数バックオフリトライ、オニオンモデルミドルウェア、接続プール管理を内蔵し、マイクロサービス通信に適しています。"
---

# HTTPC

安全な HTTP クライアントライブラリ。デフォルトで安全、インテリジェントなリトライ、ミドルウェアチェーン、オブジェクトプール再利用を内蔵。

## 特徴

- **TLS 1.2+** - 最低 TLS バージョンを強制、デフォルト TLS 1.2-1.3
- **SSRF 防護** - デフォルトでプライベート IP 接続をブロック、CIDR 免除設定可能
- **インテリジェントリトライ** - 指数バックオフ + ジッター、カスタムリトライ戦略に対応
- **コネクションプール管理** - 高性能な接続再利用、HTTP/2 対応
- **ミドルウェアチェーン** - ログ、監査、メトリクス、リカバリ、リクエスト ID などの内蔵ミドルウェア
- **ファイルダウンロード** - レジューム、プログレスコールバック、チェックサム検証に対応
- **DNS-over-HTTPS** - 内蔵 DoH リゾルバ、DNS ハイジャックリスクを低減
- **オブジェクトプール再利用** - 内部のレスポンスオブジェクトと文字列ビルダーを sync.Pool で再利用、GC 負荷を軽減

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

    fmt.Println(result.StatusCode()) // 200
}
```

## ここから始める

目的に応じて読むページを選んでください：

| 目的 | おすすめ |
|------|----------|
| 5 分で始める | [クイックスタート](./getting-started) |
| 30 分の実践チュートリアル | [チュートリアル](./guides/tutorial) |
| 使い方を調べる | [チートシート](./cheatsheet) |
| セキュリティ機能を理解する | [セキュリティ概要](./security/) |
| API シグネチャを調べる | [API リファレンス](./api-reference/) |

## コアコンセプト

HTTPC は 3 つの使用方法を提供します。シンプルから柔軟まで：

```text
パッケージ関数         クライアントインスタンス            ドメインクライアント
httpc.Get()  →  client, _ := httpc.New()  →  dc, _ := httpc.NewDomain(url)
一度きりのリクエスト   カスタム設定/ミドルウェア   セッション管理/Cookie 自動維持
```

### 設定プリセット

| プリセット | 適用シナリオ |
|------------|--------------|
| `DefaultConfig()` | 汎用シナリオ、安全なデフォルト値 |
| `SecureConfig()` | セキュリティ重視シナリオ、厳格なタイムアウト |
| `PerformanceConfig()` | 高スループット、大規模コネクションプール |
| `TestingConfig()` | テスト環境、セキュリティチェック無効 |
| `MinimalConfig()` | 軽量スクリプト、リトライ・リダイレクトなし |

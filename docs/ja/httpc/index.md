---
title: "HTTPクライアント - HTTPC"
description: "CyberGo HTTPCはGo言語向けの安全で高性能なHTTPクライアントライブラリです。TLS 1.2+暗号化、SSRF防御、スマートな指数バックオフリトライ、オニオンモデルミドルウェアチェーン、Resultオブジェクトプール再利用を内蔵し、マイクロサービスや高並行処理シナリオに最適です。"
---

# HTTPC

安全なHTTPクライアントライブラリ。デフォルトで安全。スマートリトライ、ミドルウェアチェーン、オブジェクトプール再利用を内蔵。

## 特徴

- **TLS 1.2+** - 最低TLSバージョンを強制。デフォルトTLS 1.2-1.3
- **SSRF防御** - デフォルトでプライベートIP接続をブロック。免除CIDR設定可能
- **スマートリトライ** - 指数バックオフ + ジッター。カスタムリトライ戦略設定可能
- **接続プール管理** - 高性能接続再利用。HTTP/2対応
- **ミドルウェアチェーン** - ログ、監査、メトリクス、リカバリ、リクエストIDなどの内蔵ミドルウェア
- **ファイルダウンロード** - レジュームダウンロード、プログレスコールバック、チェックサム検証対応
- **DNS-over-HTTPS** - 内蔵DoH解決。DNSハイジャックリスクを軽減
- **オブジェクトプール再利用** - 内蔵sync.Poolでメモリ割り当てを削減し、GC負荷を軽減

## インストール

```bash
go get github.com/cybergodev/httpc
```

## 30秒体験

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

目的に合わせて読む順を選んでください：

| 目的 | おすすめ |
|------|----------|
| 5分で始める | [クイックスタート](./getting-started) |
| 30分の実践 | [チュートリアル](./guides/tutorial) |
| 特定の使い方を探す | [チートシート](./cheatsheet) |
| セキュリティ機能を理解する | [セキュリティ概要](./security/) |
| APIシグネチャを確認する | [APIリファレンス](./api-reference/) |

## コア概念

HTTPCは3つの使用方法を提供しています。シンプルから柔軟まで：

```text
パッケージ関数          クライアントインスタンス            ドメインクライアント
httpc.Get()  →  client, _ := httpc.New()  →  dc, _ := httpc.NewDomain(url)
一回限りのリクエスト   カスタム設定/ミドルウェア    セッション管理/Cookie自動維持
```

### 設定プリセット

| プリセット | 適用シナリオ |
|------------|--------------|
| `DefaultConfig()` | 汎用シナリオ。安全なデフォルト値 |
| `SecureConfig()` | セキュリティ重視。厳格なタイムアウト |
| `PerformanceConfig()` | 高スループット。大規模接続プール |
| `TestingConfig()` | テスト環境。セキュリティチェック無効 |
| `MinimalConfig()` | 軽量スクリプト。リトライ・リダイレクトなし |

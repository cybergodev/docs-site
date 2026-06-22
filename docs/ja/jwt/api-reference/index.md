---
title: "API リファレンス - CyberGo JWT | 完全なインターフェース文書"
description: "CyberGo JWT API リファレンス総覧：パッケージ関数・Processor 核心メソッド・Config と BlacklistConfig・Claims と RegisteredClaims・拡張インターフェース・補助型・19 個のセンチネルエラーへナビゲート。"
---

# API リファレンス

CyberGo JWT ライブラリは完全な JWT トークンライフサイクル管理 API を提供します。

## モジュール構成

| モジュール | 説明 | 詳細 |
|-----------|------|------|
| [パッケージ関数](./functions) | `New`、`DefaultConfig`、`NewRateLimiter` などのファクトリ関数 | 構築と初期化 |
| [Processor](./processor) | トークン作成、検証、リフレッシュ、失効などのコアメソッド | コア操作 |
| [Config](./config) | `Config`、`BlacklistConfig` 設定構造体 | 設定管理 |
| [Claims](./claims) | `Claims`、`RegisteredClaims` クレーム型 | トークンクレーム |
| [インターフェース定義](./interfaces) | `TokenManager`、`CustomClaims`、`BlacklistStore` など | 拡張インターフェース |
| [型と定数](./types) | 署名アルゴリズム定数、`NumericDate`、`StringOrSlice` など | 補助型 |
| [エラー](./errors) | 19 個のセンチネルエラー、`ValidationError` | エラー処理 |

## クイック検索

### 使用シーン別

| シーン | 関連 API |
|--------|----------|
| Processor の作成 | [`jwt.New()`](./functions#new)、[`jwt.DefaultConfig()`](./functions#defaultconfig) |
| トークンの発行 | [`Processor.Create()`](./processor#create)、[`Processor.CreateRefresh()`](./processor#createrefresh) |
| トークンの検証 | [`Processor.Validate()`](./processor#validate)、[`Processor.ValidateInto()`](./processor#validateinto) |
| トークンのリフレッシュ | [`Processor.Refresh()`](./processor#refresh)、[`Processor.RefreshInto()`](./processor#refreshinto) |
| トークンの失効 | [`Processor.Revoke()`](./processor#revoke)、[`Processor.IsRevoked()`](./processor#isrevoked) |
| 署名アルゴリズムの設定 | [`Config.SigningMethod`](./config#config) |
| カスタム Claims | [`CustomClaims`](./interfaces#customclaims) インターフェース |
| ブラックリスト管理 | [`BlacklistStore`](./interfaces#blackliststore) インターフェース |
| レート制限 | [`RateLimitProvider`](./interfaces#ratelimitprovider) インターフェース |
| エラー処理 | [`センチネルエラー`](./errors#センチネルエラー) |

---
title: "JWT - プロダクションレディ JWT 認証ライブラリ"
description: "CyberGo JWT プロダクションレディ認証ライブラリ。HMAC/RSA/ECDSA マルチアルゴリズム署名、トークンブラックリスト、レート制限、カスタム Claims、クロック注入をサポート。すべてのメソッドが並行安全。"
---

# JWT - プロダクションレディ JWT 認証ライブラリ

CyberGo JWT は Go 言語向けの高性能 JWT 認証ライブラリで、トークンの生成、検証、リフレッシュ、失効の完全なソリューションを提供します。

## 特徴

- **マルチアルゴリズムサポート** — HMAC (HS256/384/512)、RSA (RS256/384/512)、RSA-PSS (PS256/384/512)、ECDSA (ES256/384/512)
- **トークンライフサイクル** — 作成、検証、リフレッシュ、失効のワンストップ管理
- **カスタム Claims** — `CustomClaims` インターフェースで任意のビジネスフィールドをサポート
- **ブラックリスト管理** — 内蔵メモリストア、Redis などのカスタムバックエンドをサポート
- **レート制限** — トークンバケットアルゴリズムでブルートフォース攻撃を防止
- **入力検証** — フィールド長制限、注入パターン検出、制御文字フィルタリング
- **クロック注入** — `ClockProvider` インターフェースでテストシナリオをサポート
- **並行安全** — すべてのエクスポート済みメソッドが並行安全に呼び出し可能
- **機密データの漏洩ゼロ** — `Close()` で秘密鍵を安全にクリア

## インストール

```bash
go get github.com/cybergodev/jwt
```

## クイックスタート

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    // 1. 設定を作成
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    // 2. Processor を作成
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // 3. トークンを発行
    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
        Role:     "admin",
    }
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token:", token)

    // 4. トークンを検証
    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)
    fmt.Println("UserID:", parsed.UserID)
}
```

## アーキテクチャ概要

```text
┌────────────────────────────────────────────────┐
│                  Processor                      │
│  (implements TokenManager interface)            │
├────────────────────────────────────────────────┤
│  Create / Validate / Refresh / Revoke          │
│  CreateRefresh / ValidateInto / RefreshInto    │
│  ParseUnverified / IsRevoked / IsClosed / Close│
├──────────────────┬─────────────────────────────┤
│  BlacklistManager│     RateLimiter              │
│  (optional)      │     (optional)               │
├──────────────────┴─────────────────────────────┤
│                Config                           │
│  SigningMethod / TTL / Blacklist / Limit       │
└────────────────────────────────────────────────┘
```

## 次のステップ

- [クイックスタート](./getting-started) — 詳細なインストールと設定ガイド
- [署名アルゴリズム](./guides/signing-algorithms) — HMAC、RSA、ECDSA 選択ガイド
- [カスタム Claims](./guides/custom-claims) — ビジネスフィールドの定義
- [API リファレンス](./api-reference/) — 完全な API リファレンス
- [基本サンプル](./examples/basic) — HMAC、トークンペア、検証の例

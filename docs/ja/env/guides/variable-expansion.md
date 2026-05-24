---
title: "変数展開 - CyberGo env 変数構文"
description: "CyberGo env ライブラリ変数展開構文ガイド。${VAR} と ${VAR:-default} 参照構文、ネストされたデフォルト値、:= 代入と :? エラー出力などの条件付き展開モード、循環参照検出、MaxExpansionDepth 深度制限と ExpandVariables スイッチ制御を詳しく解説し、.env ファイルでの変数再利用と動的値置換を実現します。"
---

# 変数展開

env ライブラリは設定ファイル内での変数参照をサポートし、設定の再利用と動的値置換を実現します。

## 変数展開の有効化

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // デフォルトで有効

loader, _ := env.New(cfg)
loader.LoadFiles(".env")
```

## 基本構文

### シンプルな参照

```bash
# 他の変数を参照
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1
# API_URL は展開後: https://api.example.com/v1

# 簡略構文
HOST=localhost
URL=$HOST:8080
# URL は展開後: localhost:8080
```

### デフォルト値構文

| 構文 | 説明 |
|------|------|
| `${VAR:-default}` | VAR が存在しない場合、default を使用 |
| `${VAR:=default}` | VAR が存在しない場合、default を使用（`:-` と同じ） |
| `${VAR:?error}` | VAR が存在しないまたは空の場合、エラーを返す |

---

## 構文の詳細

### `${VAR:-default}` - デフォルト値の使用

最も一般的なデフォルト値構文です。変数が存在しない場合にデフォルト値を使用し、変数が存在する場合（値が空でも）は元の値を使用します：

```bash
# LOG_LEVEL が存在しない場合、"info" を使用
LOG_LEVEL=${LOG_LEVEL:-info}

# TIMEOUT が存在しない場合、"30s" を使用
TIMEOUT=${TIMEOUT:-30s}

# ネストされたデフォルト値
DB_HOST=${DB_HOST:-localhost}
DB_URL=${DB_HOST}:${DB_PORT:-5432}
# DB_HOST=localhost で DB_PORT が存在しない場合
# DB_URL は展開後: localhost:5432
```

**使用シーン：**
- オプション設定項目のデフォルト値
- 開発/本番環境の統一設定

---

### `${VAR:=default}` - デフォルト値の使用

`${VAR:-default}` と同じ動作で、変数が存在しない場合にデフォルト値を使用します：

```bash
# DEBUG が存在しない場合、"false" を使用
DEBUG=${DEBUG:=false}

# 存在しない場合はデフォルト値を使用
CACHE_TTL=${CACHE_TTL:=3600}
```

:::info と :- の関係
`${VAR:=default}` はこのライブラリでは `${VAR:-default}` と全く同じ動作です。変数が存在しない場合、デフォルト値を展開結果として使用します。`:=` はデフォルト値を変数ストアに書き戻しません。
:::

---

### `${VAR:?error}` - エラープロンプト

変数が存在しないまたは空の場合、エラーを返します：

```bash
# DATABASE_URL が存在しない場合、読み込み失敗しエラーを表示
DATABASE_URL=${DATABASE_URL:?Database URL is required}

# API_KEY が存在しない場合、エラー
API_KEY=${API_KEY:?API_KEY must be set}
```

**使用シーン：**
- 必須設定項目の検証
- 早期フェイル、ランタイムエラーの回避

---

## エスケープ

### ドル記号のエスケープ

`$$` を使用してリテラル `$` を表します：

```bash
# 価格設定
PRICE=$$99.99
# 展開後: $99.99

# $ を含む文字列
MESSAGE=Price is $$100
# 展開後: Price is $100
```

### シングルクォート

シングルクォート内の変数は展開されません：

```bash
# 展開されない
LITERAL='${NO_EXPANSION}'
# 値: ${NO_EXPANSION}

# ダブルクォートとの比較
EXPANDED="${WILL_EXPAND}"
# ${WILL_EXPAND} が展開される
```

---

## ネストされた展開

変数はネストして参照できます：

```bash
# 基本設定
APP_NAME=myapp
ENV=production

# ネストされた参照
DB_HOST=db.${ENV}.example.com
# 展開後: db.production.example.com

API_URL=https://${APP_NAME}.${ENV}.api.example.com
# 展開後: https://myapp.production.api.example.com
```

---

## 循環検出

ライブラリは循環参照を自動的に検出し、エラーを返します：

```bash
# 循環参照（エラー）
A=${B}
B=${A}

# 読み込み時に ErrExpansionDepth エラーが返される
```

---

## 展開深度制限

デフォルトの最大展開深度は 5、ハードリミットは 20 です：

```go
cfg := env.DefaultConfig()
cfg.MaxExpansionDepth = 10  // カスタム深度
```

| 定数 | 値 | 説明 |
|------|---|------|
| `DefaultMaxExpansionDepth` | 5 | デフォルト値（公開 API） |

:::info ヒント
ハードリミットは 20（内部制限）です。設定の `MaxExpansionDepth` はこの制限を超えることはできません。
:::

---

## 完全な例

```bash
# .env ファイル

# 基本設定
APP_NAME=myapp
ENV=development
DEBUG=true

# データベース設定
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-${APP_NAME}}
DB_URL=postgres://${DB_HOST}:${DB_PORT}/${DB_NAME}

# API 設定
API_BASE=https://api.${ENV}.example.com
API_URL=${API_BASE}/v1
API_KEY=${API_KEY:?API_KEY is required}

# ログ設定
LOG_LEVEL=${LOG_LEVEL:-info}

# 価格（エスケープ）
PRICE=$$99.99
```

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    cfg := env.DefaultConfig()
    cfg.ExpandVariables = true

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("DB_URL:", loader.GetString("DB_URL"))
    fmt.Println("API_URL:", loader.GetString("API_URL"))
    fmt.Println("PRICE:", loader.GetString("PRICE"))
}
```

---

## 関連ドキュメント

- [クイックスタート](/ja/env/getting-started) - 基本的な使用方法
- [Config API](/ja/env/api-reference/config) - ExpandVariables 設定
- [定数とエラー](/ja/env/api-reference/constants) - 展開深度制限

---
sidebar_label: "パースと検証"
title: "Processor 解析 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor 解析メソッド：Valid 検証、Parse、ParseAny、PreParse 最適化、GetFromParsed で設定ベースの解析をサポートします。"
sidebar_position: 6
---

# 解析と検証メソッド

Processor は JSON 解析と有効性検証の機能を提供します。ファイル読み書きとストリーミング読み込みは[ファイル I/O](./file-io)を参照してください。

## 検証メソッド

### Valid

シグネチャ：`func (p *Processor) Valid(jsonStr string, cfg ...Config) (bool, error)`

JSON 文字列が有効かどうかを検証します。

```go
valid, err := p.Valid(data)
if valid && err == nil {
    // 有効な JSON
}
```

### ValidBytes

シグネチャ：`func (p *Processor) ValidBytes(data []byte) bool`

バイトスライスが有効な JSON かどうかを検証します。

```go
if p.ValidBytes([]byte(data)) {
    // 有効な JSON
}
```

## 解析メソッド

### Parse

シグネチャ：`func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

JSON 文字列をターゲット変数に解析します。標準モードと数値保持モードをサポートします。

```go
// map に解析
var obj map[string]any
err := p.Parse(`{"name":"Alice"}`, &obj)

// 構造体に解析
type User struct { Name string }
var user User
err = p.Parse(`{"name":"Alice"}`, &user)

// 数値保持モードを使用
cfg := json.DefaultConfig()
cfg.PreserveNumbers = true
var data any
err = p.Parse(`{"price":19.99}`, &data, cfg)
```

### ParseAny

シグネチャ：`func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

JSON 文字列を `any` 型に解析します。

```go
data, err := p.ParseAny(`{"name": "test"}`)
if err != nil {
    panic(err)
}
```

### PreParse

シグネチャ：`func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)`

JSON データを事前解析し、同じデータに対する複数回のクエリで再解析を回避します。

```go
parsed, err := p.PreParse(jsonStr)
if err != nil {
    panic(err)
}

// 解析済みデータに対して複数回クエリ
name, _ := p.GetFromParsed(parsed, "user.name")
age, _ := p.GetFromParsed(parsed, "user.age")
```

### GetFromParsed

シグネチャ：`func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

事前解析済みデータから値を取得します。`PreParse` と組み合わせて複数回クエリのパフォーマンスを向上させます。

### SetFromParsed

シグネチャ：`func (p *Processor) SetFromParsed(parsed *ParsedJSON, path string, value any, cfg ...Config) (*ParsedJSON, error)`

事前解析済みデータに値を設定し、新しい `ParsedJSON` を返します。

```go
parsed, _ := p.PreParse(jsonStr)
newParsed, err := p.SetFromParsed(parsed, "user.name", "Bob")
```

## メソッドの選択

| シナリオ | 推奨メソッド |
|----------|-------------|
| 有効性の検証のみ | `Valid` / `ValidBytes` |
| ターゲット変数への解析 | `Parse` |
| 同じデータを複数回クエリ | `PreParse` + `GetFromParsed` |

## 関連

- [ファイル I/O](./file-io) - LoadFromFile/SaveToFile ファイルメソッド
- [出力メソッド](./output) - Encode/EncodePretty エンコードメソッド
- [パスクエリ](./query) - Get シリーズメソッド

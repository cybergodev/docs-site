---
title: "パス式構文 - CyberGo JSON | JSONPath クエリガイド"
description: "CyberGo JSON パス式構文ガイド：プロパティアクセス user.name、配列インデックス items[0]、スライス、ワイルドカード、複数フィールド抽出で JSON の任意ノードを指定します。"
---

# パス式構文

json ライブラリは、JSON データ内の任意のノードを特定・操作するための豊富なパス式構文をサポートしています。

## 基本構文

### プロパティアクセス

ドット `.` を使用してオブジェクトのプロパティにアクセスします：

```go
data := `{"user": {"name": "Alice", "age": 30}}`

name := json.GetString(data, "user.name")    // "Alice"
age := json.GetInt(data, "user.age")         // 30
```

### ネストされたパス

ドットを連続して使用し、深くネストされたプロパティにアクセスします：

```go
data := `{
    "company": {
        "department": {
            "team": {
                "lead": "Bob"
            }
        }
    }
}`

lead := json.GetString(data, "company.department.team.lead")  // "Bob"
```

### 配列インデックス

2 種類の構文で配列要素にアクセスできます：

```go
data := `{"items": ["a", "b", "c", "d", "e"]}`

// 構文 1：ドット + インデックス
first := json.GetString(data, "items.0")   // "a"

// 構文 2：角括弧 + インデックス
first2 := json.GetString(data, "items[0]")   // "a"
```

#### 負のインデックス

負のインデックスは配列の末尾から数えます。`-1` は最後の要素を表します：

```go
data := `{"items": ["a", "b", "c", "d", "e"]}`

val := json.GetString(data, "items[-1]")  // "e"  (最後の要素)
val = json.GetString(data, "items[-2]")   // "d"  (末尾から2番目)
val = json.GetString(data, "items[-5]")   // "a"  ([0] と同等)
```

| インデックス | 意味 | 等価な正のインデックス |
|------|------|-----------|
| `[0]` | 最初の要素 | — |
| `[1]` | 2 番目の要素 | — |
| `[-1]` | 最後の要素 | `[len-1]` |
| `[-2]` | 末尾から 2 番目 | `[len-2]` |
| `[-N]` | 末尾から N 番目 | `[len-N]` |

#### 多次元配列

インデックスを連続して使用し、ネストされた配列にアクセスします：

```go
data := `{"matrix": [[1, 2, 3], [4, 5, 6], [7, 8, 9]]}`

val := json.GetInt(data, "matrix[0][0]")   // 1
val = json.GetInt(data, "matrix[1][2]")    // 6
val = json.GetInt(data, "matrix[-1][-1]")  // 9
```

#### 境界動作

範囲外のインデックスは panic を起こしません。型安全な取得関数（GetString、GetInt など）はゼロ値を返し、Get 関数はエラーを返します：

```go
data := `{"items": ["a", "b", "c"]}`

// 正のインデックスの範囲外 → ゼロ値を返し、エラーなし
json.GetString(data, "items[10]")   // ""   (空文字列)
json.GetInt(data, "items[10]")      // 0
json.Get(data, "items[10]")         // nil, ErrPathNotFound

// 負のインデックスの範囲外 → 同様にゼロ値を返す
json.GetString(data, "items[-10]")  // ""   (空文字列)
json.GetInt(data, "items[-10]")     // 0
```

| 関数 | 範囲外の戻り値 |
|------|-----------|
| `Get` | `(nil, ErrPathNotFound)` |
| `GetString` | `""` |
| `GetInt` | `0` |
| `GetFloat` | `0.0` |
| `GetBool` | `false` |
| `GetArray` | `nil` |

::: tip インデックスの境界
- 正のインデックスは `[0, len)` の範囲内である必要があります。負のインデックスも変換後（`len + index`）同様です
- 範囲外アクセスは対応する型のゼロ値を返し、panic もエラーも発生しません
- パスが存在するかどうかを確認するには、`Get` を使用してエラーが `json.ErrPathNotFound` かどうかを確認してください
:::

---

## 高度な構文

### 配列スライス `[start:end:step]`

配列から部分配列を抽出します。Python スタイルのスライス構文 `[start:end:step]` を採用しており、3 つのパラメータはすべて省略可能です：

| パラメータ | 説明 | 省略時のデフォルト値 |
|------|------|-------------|
| `start` | 開始インデックス（含む） | `0`（正のステップ）または `len-1`（負のステップ） |
| `end` | 終了インデックス（含まない） | `len`（正のステップ）または `-1`（負のステップ） |
| `step` | ステップ幅 | `1` |

#### スライス構文クイックリファレンス

| 構文 | 意味 | 例（`[0,1,2,3,4]`） | 結果 |
|------|------|----------------------|------|
| `[:]` | 完全なコピー | `[0,1,2,3,4][:]` | `[0,1,2,3,4]` |
| `[N:]` | N から末尾まで | `[0,1,2,3,4][2:]` | `[2,3,4]` |
| `[:N]` | 先頭から N まで | `[0,1,2,3,4][:3]` | `[0,1,2]` |
| `[N:M]` | N から M-1 まで | `[0,1,2,3,4][1:4]` | `[1,2,3]` |
| `[::S]` | S 個おきに取得 | `[0,1,2,3,4][::2]` | `[0,2,4]` |
| `[N::S]` | N からステップ S で | `[0,1,2,3,4][1::2]` | `[1,3]` |
| `[:M:S]` | 先頭から M までステップ S で | `[0,1,2,3,4][:4:2]` | `[0,2]` |
| `[N:M:S]` | 完全な 3 パラメータ | `[0,1,2,3,4][0:5:2]` | `[0,2,4]` |
| `[::-1]` | 配列を反転 | `[0,1,2,3,4][::-1]` | `[4,3,2,1,0]` |
| `[::-S]` | 逆順ステップ | `[0,1,2,3,4][::-2]` | `[4,2,0]` |

#### 正方向スライス

```go
data := `{"numbers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}`

// 基本スライス
slice := json.GetArray(data, "numbers[2:5]")    // [2, 3, 4]

// start を省略（先頭から）
slice2 := json.GetArray(data, "numbers[:3]")      // [0, 1, 2]

// end を省略（末尾まで）
slice3 := json.GetArray(data, "numbers[7:]")      // [7, 8, 9]

// ステップ 2（偶数位置の要素）
slice4 := json.GetArray(data, "numbers[::2]")     // [0, 2, 4, 6, 8]

// 完全なパラメータ指定
slice5 := json.GetArray(data, "numbers[1:8:3]")   // [1, 4, 7]

// 完全なコピー
slice6 := json.GetArray(data, "numbers[:]")       // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```

#### 負のインデックスを使ったスライス

スライスの `start` と `end` はどちらも負のインデックスをサポートします：

```go
data := `{"numbers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}`

// 最後の 3 要素を取得
json.GetArray(data, "numbers[-3:]")    // [7, 8, 9]

// 最後の 2 要素を除外
json.GetArray(data, "numbers[:-2]")    // [0, 1, 2, 3, 4, 5, 6, 7]

// 末尾から 5 番目から末尾から 2 番目まで
json.GetArray(data, "numbers[-5:-2]")  // [5, 6, 7]

// インデックス 2 から末尾から 1 番目まで（最後の要素は含まない）
json.GetArray(data, "numbers[2:-1]")   // [2, 3, 4, 5, 6, 7, 8]
```

#### 逆方向スライス

負のステップで逆方向の走査を実現します：

```go
data := `{"letters": ["a", "b", "c", "d", "e"]}`

// 配列を反転
json.GetArray(data, "letters[::-1]")    // ["e", "d", "c", "b", "a"]

// 逆方向ステップ 2
json.GetArray(data, "letters[::-2]")    // ["e", "c", "a"]

// インデックス 3 から 1 へ（逆方向）
json.GetArray(data, "letters[3:1:-1]")  // ["d", "c"]

// 末尾から逆方向に最初の 3 要素を取得
json.GetArray(data, "letters[2::-1]")   // ["c", "b", "a"]
```

#### 境界動作

スライスは範囲外のインデックスを自動的にクリップ（clamp）し、エラーを返しません：

```go
data := `{"items": [0, 1, 2]}`

// 範囲外の start/end は有効な範囲に自動クリップされる
json.GetArray(data, "items[0:100]")   // [0, 1, 2]  (end は len=3 にクリップ)
json.GetArray(data, "items[10:20]")   // []         (start >= end、空の結果)

// start >= end の場合、空の配列を返す
json.GetArray(data, "items[2:2]")     // []
json.GetArray(data, "items[3:1]")     // []
```

::: warning スライスとインデックスの境界処理の違い
- **インデックスの範囲外**（例：`items[10]`）は対応する型のゼロ値を返し、エラーになりません
- **スライスの範囲外**（例：`items[10:20]`）は自動クリップされ、空の配列を返し、エラーになりません
:::

### フィールド抽出 `{field1,field2}`

オブジェクトから特定のフィールドのみを抽出します：

```go
data := `{
    "user": {
        "id": 1001,
        "name": "Alice",
        "email": "alice@example.com",
        "password": "secret",
        "age": 25
    }
}`

// id と name のみ抽出
extracted, _ := json.Get(data, "user{id,name}")
// 結果: {"id": 1001, "name": "Alice"}
```

### フラット化抽出 `{flat:field}`

配列オブジェクトのフィールドから値を抽出する際、フィールド自体も配列である場合、通常の抽出ではネストされた配列が生成されます。`{flat:}` プレフィックスを使用すると、すべてのネストされた配列を再帰的に展開し、フラットな結果配列を得ることができます。

#### 通常の抽出 vs フラット化抽出

```go
data := `{
    "groups": [
        {"tags": ["go", "json"]},
        {"tags": ["python", "yaml"]}
    ]
}`

// 通常の抽出 → ネストされた配列
json.GetArray(data, "groups{tags}")
// [["go", "json"], ["python", "yaml"]]

// フラット化抽出 → 1 次元配列に展開
json.GetArray(data, "groups{flat:tags}")
// ["go", "json", "python", "yaml"]
```

#### チェーン式フラット化抽出

複数レベルのネストされた配列に対して、連続して `{flat:}` を使用し、段階的に展開できます：

```go
data := `{
    "departments": [
        {
            "teams": [
                {"members": [{"name": "Alice"}, {"name": "Bob"}]}
            ]
        },
        {
            "teams": [
                {"members": [{"name": "Carol"}]}
            ]
        }
    ]
}`

// 3 段階のフラット化：departments → teams → members → name
json.GetArray(data, "departments{flat:teams}{flat:members}{name}")
// ["Alice", "Bob", "Carol"]
```

#### フラット化抽出後の他の操作への接続

フラット化抽出の結果には、引き続きスライスやインデックスなどの操作を適用できます：

```go
data := `{
    "orders": [
        {"items": ["book", "pen"]},
        {"items": ["laptop", "mouse", "keyboard"]},
        {"items": ["cup"]}
    ]
}`

// フラット化後にスライス
json.GetArray(data, "orders{flat:items}[0:3]")
// ["book", "pen", "laptop"]
```

::: info 制限事項
- `{flat:field1,field2}` のように複数フィールド抽出の場合、`flat` フラグは機能しません。複数フィールド抽出はオブジェクトを生成するためです
- フラット化はすべてのレベルのネストされた配列を再帰的に展開します。第 1 レベルのみではありません
:::

### 追加操作 `[+]`

配列の末尾に要素を追加します：

```go
data := `{"items": [1, 2, 3]}`

updated, _ := json.Set(data, "items[+]", 4)
// 結果: {"items": [1, 2, 3, 4]}

updated, _ = json.Set(updated, "items[+]", 5)
// 結果: {"items": [1, 2, 3, 4, 5]}
```

### ワイルドカード `[*]`

```go
data := `{"items": [1, 2, 3]}`

updated, _ := json.Set(data, "items[*]", 0)
// 結果: {"items": [0, 0, 0]}
```

---

## パスの検証

### Processor を通じたパスの検証

`Processor.CompilePath` を使用してパス形式が正しいかを検証します：

```go
p, err := json.New()
if err != nil {
    panic(err)
}

// パスのコンパイル（形式の自動検証）
cp, err := p.CompilePath("user.profile.name")
if err != nil {
    fmt.Println("Invalid path:", err)
}

cp, err = p.CompilePath("items[0:10:2]")
if err != nil {
    fmt.Println("Invalid path:", err)
}
```

---

## 特殊なパス

### ルートパス

空文字列 `""` または `"."` はルートを表します：

```go
data := `{"name": "test"}`

// オブジェクト全体を取得
root, _ := json.Get(data, "")     // {"name": "test"}
root, _ = json.Get(data, ".")     // 同上
```

### パスのエスケープ

キー名に特殊文字が含まれる場合は、エスケープを使用します：

```go
data := `{"user.name": "Alice"}`

// ドットを含むキー名
name := json.GetString(data, "user\\.name")  // "Alice"
```

---

## パスセグメントの型

ライブラリは内部でパスを異なる型のセグメントに解析します（以下は内部実装の詳細であり、公開 API としてエクスポートされません）：

| 型 | 構文例 | 説明 |
|------|----------|------|
| プロパティアクセス | `user.name` | オブジェクトのプロパティにアクセス |
| 配列インデックス | `items[0]` | 配列要素にアクセス |
| 配列スライス | `items[1:5]` | スライス範囲アクセス |
| ワイルドカード | `items[*]` | すべての要素にマッチ |
| フィールド抽出 | `{name,email}` | 複数フィールドの抽出 |
| フラット化抽出 | `{flat:tags}` | 抽出してネストされた配列を再帰的に展開 |
| 追加操作 | `items[+]` | 配列に要素を追加 |

---

## 完全な例

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "store": {
            "books": [
                {"title": "Go 101", "price": 25, "category": "programming"},
                {"title": "JSON Guide", "price": 35, "category": "programming"},
                {"title": "Clean Code", "price": 45, "category": "programming"}
            ],
            "prices": [10, 20, 30, 40, 50]
        }
    }`

    // 1. 基本的なアクセス
    title := json.GetString(data, "store.books.0.title")
    fmt.Println("First book:", title)

    // 2. 配列スライス
    books := json.GetArray(data, "store.books[0:2]")
    fmt.Printf("First 2 books: %d items\n", len(books))

    // 3. ステップ付きスライス
    prices := json.GetArray(data, "store.prices[::2]")
    fmt.Println("\nEvery other price:", prices)

    // 4. フィールド抽出
    extracted, _ := json.Get(data, "store.books[0]{title,price}")
    fmt.Println("\nExtracted fields:", extracted)

    // 5. 要素の追加
    updated, _ := json.Set(data, "store.books[+]", map[string]any{
        "title":    "New Book",
        "price":    55,
        "category": "programming",
    })
    fmt.Println("\nAfter append:", json.Valid([]byte(updated)))
}
```

## 次のステップ

- [API ドキュメント](./api-reference/) — 完全な API リファレンス
- [使用例](./examples) — より多くの実践的な例

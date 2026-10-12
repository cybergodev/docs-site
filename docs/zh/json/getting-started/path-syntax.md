---
sidebar_label: "路径表达式语法"
title: "路径表达式语法 - CyberGo JSON | JSONPath 查询指南"
description: "CyberGo JSON 路径表达式语法完整指南：属性访问、数组索引与负索引、切片步长、通配符收集、多字段与扁平化提取、追加与 JSON Pointer（RFC 6901），每个语法配输入输出对照，并汇总负索引越界、提取静默未命中等语法陷阱。"
sidebar_position: 20
---

# 路径表达式语法

json 库支持丰富的路径表达式语法，用于定位和操作 JSON 数据中的任意节点。

## 基本语法

### 属性访问

使用点号 `.` 访问对象属性：

```go
data := `{"user": {"name": "Alice", "age": 30}}`

name := json.GetString(data, "user.name")    // "Alice"
age := json.GetInt(data, "user.age")         // 30
```

### 嵌套路径

连续使用点号访问深层嵌套属性：

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

### 数组索引

两种语法访问数组元素：

```go
data := `{"items": ["a", "b", "c", "d", "e"]}`

// 语法 1：点号 + 索引
first := json.GetString(data, "items.0")   // "a"

// 语法 2：方括号 + 索引
first2 := json.GetString(data, "items[0]")   // "a"
```

#### 负索引

负索引从数组末尾开始计数，`-1` 表示最后一个元素：

```go
data := `{"items": ["a", "b", "c", "d", "e"]}`

val := json.GetString(data, "items[-1]")  // "e"  (最后一个)
val = json.GetString(data, "items[-2]")   // "d"  (倒数第二个)
val = json.GetString(data, "items[-5]")   // "a"  (等同于 [0])
```

| 索引 | 含义 | 等价正索引 |
|------|------|-----------|
| `[0]` | 第一个元素 | — |
| `[1]` | 第二个元素 | — |
| `[-1]` | 最后一个元素 | `[len-1]` |
| `[-2]` | 倒数第二个 | `[len-2]` |
| `[-N]` | 倒数第 N 个 | `[len-N]` |

#### 多维数组

连续使用索引访问嵌套数组：

```go
data := `{"matrix": [[1, 2, 3], [4, 5, 6], [7, 8, 9]]}`

val := json.GetInt(data, "matrix[0][0]")   // 1
val = json.GetInt(data, "matrix[1][2]")    // 6
val = json.GetInt(data, "matrix[-1][-1]")  // 9
```

#### 边界行为

越界索引不会 panic，也不会报错——类型安全的获取函数返回零值，`Get` 返回 nil 结果：

```go
data := `{"items": ["a", "b", "c"]}`

// 正索引越界 → 零值 / nil，均不报错
json.GetString(data, "items[10]")   // ""   (空字符串)
json.GetInt(data, "items[10]")      // 0
json.Get(data, "items[10]")         // nil, nil（注意：err 也是 nil）

// 负索引越界 → 同样返回零值
json.GetString(data, "items[-10]")  // ""   (空字符串)
json.GetInt(data, "items[-10]")     // 0
```

| 函数 | 越界返回值 |
|------|-----------|
| `Get` | `(nil, nil)` — 不报错 |
| `GetString` | `""` |
| `GetInt` | `0` |
| `GetFloat` | `0.0` |
| `GetBool` | `false` |
| `GetArray` | `nil` |

::: tip 索引边界
- 正索引必须在 `[0, len)` 范围内，负索引经过转换后（`len + index`）同理
- 越界访问返回零值 / nil，不会 panic，不会报错
- 「对象键不存在」才返回 `ErrPathNotFound`（如 `json.Get(data, "nosuchkey")`）；判断数组元素是否存在要结合返回值，不能只看 err
:::

---

## 高级语法

### 数组切片 `[start:end:step]`

从数组中提取子数组，采用 Python 风格的切片语法 `[start:end:step]`，三个参数均可省略：

| 参数 | 说明 | 省略时默认值 |
|------|------|-------------|
| `start` | 起始索引（包含） | `0`（正步长）或 `len-1`（负步长） |
| `end` | 结束索引（不包含） | `len`（正步长）或 `-1`（负步长） |
| `step` | 步长 | `1` |

#### 切片语法速查表

| 语法 | 含义 | 示例（`[0,1,2,3,4]`） | 结果 |
|------|------|----------------------|------|
| `[:]` | 完整复制 | `[0,1,2,3,4][:]` | `[0,1,2,3,4]` |
| `[N:]` | 从 N 到末尾 | `[0,1,2,3,4][2:]` | `[2,3,4]` |
| `[:N]` | 从开头到 N | `[0,1,2,3,4][:3]` | `[0,1,2]` |
| `[N:M]` | 从 N 到 M-1 | `[0,1,2,3,4][1:4]` | `[1,2,3]` |
| `[::S]` | 每隔 S 取一个 | `[0,1,2,3,4][::2]` | `[0,2,4]` |
| `[N::S]` | 从 N 起，步长 S | `[0,1,2,3,4][1::2]` | `[1,3]` |
| `[:M:S]` | 从头到 M，步长 S | `[0,1,2,3,4][:4:2]` | `[0,2]` |
| `[N:M:S]` | 完整三参数 | `[0,1,2,3,4][0:5:2]` | `[0,2,4]` |
| `[::-1]` | 反转数组 | `[0,1,2,3,4][::-1]` | `[4,3,2,1,0]` |
| `[::-S]` | 反向步长 | `[0,1,2,3,4][::-2]` | `[4,2,0]` |

#### 正向切片

```go
data := `{"numbers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}`

// 基本切片
slice := json.GetArray(data, "numbers[2:5]")    // [2, 3, 4]

// 省略 start（从开头）
slice2 := json.GetArray(data, "numbers[:3]")      // [0, 1, 2]

// 省略 end（到末尾）
slice3 := json.GetArray(data, "numbers[7:]")      // [7, 8, 9]

// 步长为 2（偶数位元素）
slice4 := json.GetArray(data, "numbers[::2]")     // [0, 2, 4, 6, 8]

// 完整参数
slice5 := json.GetArray(data, "numbers[1:8:3]")   // [1, 4, 7]

// 完整复制
slice6 := json.GetArray(data, "numbers[:]")       // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```

#### 负索引切片

切片的 `start` 和 `end` 均支持负索引：

```go
data := `{"numbers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}`

// 取最后 3 个元素
json.GetArray(data, "numbers[-3:]")    // [7, 8, 9]

// 去掉最后 2 个元素
json.GetArray(data, "numbers[:-2]")    // [0, 1, 2, 3, 4, 5, 6, 7]

// 从倒数第 5 个到倒数第 2 个
json.GetArray(data, "numbers[-5:-2]")  // [5, 6, 7]

// 从索引 2 到倒数第 1 个（不含最后一个）
json.GetArray(data, "numbers[2:-1]")   // [2, 3, 4, 5, 6, 7, 8]
```

#### 反向切片

负步长实现反向遍历：

```go
data := `{"letters": ["a", "b", "c", "d", "e"]}`

// 反转数组
json.GetArray(data, "letters[::-1]")    // ["e", "d", "c", "b", "a"]

// 反向步长 2
json.GetArray(data, "letters[::-2]")    // ["e", "c", "a"]

// 从索引 3 到 1（反向）
json.GetArray(data, "letters[3:1:-1]")  // ["d", "c"]

// 从末尾反向取前 3 个
json.GetArray(data, "letters[2::-1]")   // ["c", "b", "a"]
```

#### 边界行为

切片对越界索引进行自动裁剪（clamp），不会返回错误：

```go
data := `{"items": [0, 1, 2]}`

// 越界 start/end 会被自动裁剪到有效范围
json.GetArray(data, "items[0:100]")   // [0, 1, 2]  (end 裁剪到 len=3)
json.GetArray(data, "items[10:20]")   // []         (start >= end，空结果)

// start >= end 时返回空数组
json.GetArray(data, "items[2:2]")     // []
json.GetArray(data, "items[3:1]")     // []
```

::: warning 切片 vs 索引的边界处理差异
- **索引越界**（如 `items[10]`）返回对应类型的零值，不报错
- **切片越界**（如 `items[10:20]`）自动裁剪，返回空数组，不报错
:::

### 字段提取 `{field1,field2}`

只提取对象中的特定字段：

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

// 只提取 id 和 name
extracted, err := json.Get(data, "user{id,name}")
if err != nil {
    panic(err)
}
// 结果：{"id": 1001, "name": "Alice"}
```

### 扁平化提取 `{flat:field}`

从数组对象的字段中提取值时，如果字段本身也是数组，普通提取会产生嵌套数组。使用 `{flat:}` 前缀可以递归展开所有嵌套数组，得到一个扁平的结果数组。

#### 普通提取 vs 扁平化提取

```go
data := `{
    "groups": [
        {"tags": ["go", "json"]},
        {"tags": ["python", "yaml"]}
    ]
}`

// 普通提取 → 嵌套数组
json.GetArray(data, "groups{tags}")
// [["go", "json"], ["python", "yaml"]]

// 扁平化提取 → 展开为一维数组
json.GetArray(data, "groups{flat:tags}")
// ["go", "json", "python", "yaml"]
```

#### 链式扁平化提取

多层嵌套数组可以连续使用 `{flat:}` 逐层展开：

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

// 三层扁平化：departments → teams → members → name
json.GetArray(data, "departments{flat:teams}{flat:members}{name}")
// ["Alice", "Bob", "Carol"]
```

#### 扁平化提取后接其他操作

扁平化提取的结果可以继续使用切片、索引等操作：

```go
data := `{
    "orders": [
        {"items": ["book", "pen"]},
        {"items": ["laptop", "mouse", "keyboard"]},
        {"items": ["cup"]}
    ]
}`

// 扁平化后切片
json.GetArray(data, "orders{flat:items}[0:3]")
// ["book", "pen", "laptop"]
```

::: info 限制
- `{flat:field1,field2}` 多字段提取时 `flat` 标志不生效，因为多字段提取产生的是对象而非数组
- 扁平化会递归展开所有层级的嵌套数组，不仅是第一层
:::

### 追加操作 `[+]`

向数组末尾追加元素：

```go
data := `{"items": [1, 2, 3]}`

updated, err := json.Set(data, "items[+]", 4)
if err != nil {
    panic(err)
}
// 结果：{"items": [1, 2, 3, 4]}

updated, err = json.Set(updated, "items[+]", 5)
if err != nil {
    panic(err)
}
// 结果：{"items": [1, 2, 3, 4, 5]}

// 追加切片值会展开为多个元素，而不是变成嵌套数组
updated, err = json.Set(updated, "items[+]", []any{6, 7})
if err != nil {
    panic(err)
}
// 结果：{"items": [1, 2, 3, 4, 5, 6, 7]}
```

::: warning [+] 的前置路径必须是已存在的数组
`items[+]` 只会追加，不会创建数组。目标路径不存在或不是数组时报错（"cannot append to non-array type"）；先 `SetCreate(data, "items", []any{})` 建好数组再追加。
:::

### 通配符 `[*]`

通配符匹配数组（或对象）中的**所有元素**，在查询与修改两种场景下都有用：

```go
data := `{"items": [1, 2, 3]}`

updated, err := json.Set(data, "items[*]", 0)
if err != nil {
    panic(err)
}
// 结果：{"items": [0, 0, 0]}
```

#### 查询场景：收集字段

通配符后接属性路径时，把每个元素上该字段的值**收集成一个数组**：

```go
users := `{"users": [{"name": "John"}, {"name": "Jane"}]}`

// [*].field → 收集所有元素的字段值
names, err := json.Get(users, "users[*].name")
if err != nil {
    panic(err)
}
fmt.Println(names) // [John Jane]

// 单独作为最后一段时，[*] 等价于数组本身
arr, _ := json.GetArray(data, "items[*]") // [1, 2, 3]
```

#### 点号简写 `*`

`*` 可以替代 `[*]`，两种写法等价：

```go
symbols := `[
    {"symbol": "AAPL", "price": 180},
    {"symbol": "GOOG", "price": 140}
]`

// 开头即通配符：作用于根数组
a, _ := json.GetArray(symbols, "[*].symbol") // [AAPL GOOG]
b, _ := json.GetArray(symbols, "*.symbol")   // [AAPL GOOG]，与上等价
```

::: tip 与 Foreach 的分工
`[*].field` 适合「只要一个字段」的收集；需要逐元素访问多个字段时，用 [`ForeachWithPath`](../api-reference/functions/iterate) 更直接。
:::

---

## 路径验证

### 通过 Processor 验证路径

使用 `Processor.CompilePath` 验证路径格式是否正确：

```go
p, err := json.New()
if err != nil {
    panic(err)
}

// 编译路径（自动验证格式）
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

## 特殊路径

### 根路径

空字符串 `""` 或 `"."` 表示根：

```go
data := `{"name": "test"}`

// 获取整个对象
root, err := json.Get(data, "") // {"name": "test"}
if err != nil {
    panic(err)
}
root, err = json.Get(data, ".") // 同上
```

### JSON Pointer（RFC 6901）

以 `/` 开头的路径按 JSON Pointer 语法解析（斜杠分隔），与点号语法是两套独立表示，不能混用：

```go
data := `{"user": {"name": "Alice"}, "items": ["a", "b"]}`

name := json.GetString(data, "/user/name") // "Alice"
item := json.GetString(data, "/items/0")   // "a"
```

- 键名包含 `/` 或 `~` 时用 `~1`、`~0` 转义（`a~1b` 表示键 `a/b`）
- 数组下标必须是**非负**整数：Pointer 模式不支持负索引，`/items/-1` 找不到目标；`/items/-` 指向末尾尚未存在的位置，同样找不到
- `Set` 经 JSON Pointer 不能扩容数组（越界直接报错）；需要越界写入时改用点号路径
- 单独的 `/` 表示根，与 `""`、`.` 等价

### 路径转义

如果键名包含特殊字符，用反斜杠转义。可转义的字符共 6 个：

| 转义写法 | 匹配的键名字符 |
|----------|----------------|
| `\\.` | 字面量点号 `.` |
| `\\\\` | 字面量反斜杠 `\` |
| `\\[` / `\\]` | 字面量方括号 `[` `]` |
| `\\{` / `\\}` | 字面量花括号 `{` `}` |

```go
data := `{
    "user.name": "Alice",
    "a[b]": "bracket",
    "config\\local": "backslash"
}`

// 包含点的键名
name := json.GetString(data, "user\\.name")    // "Alice"

// 包含方括号的键名
bracket := json.GetString(data, "a\\[b\\]")    // "bracket"

// 包含反斜杠的键名
bs := json.GetString(data, "config\\\\local")  // "backslash"
```

::: warning Go 字符串与路径转义是两层
上例写在 Go 源码里是**双反斜杠**（`"user\\.name"`）——Go 字符串字面量先消费一层，路径解析器收到 `user\.name` 再消费一层。若路径来自运行时变量（非字面量），只需单层转义：`"user\\.name"` 字面量 == 运行时的 `user\.name`。
:::

---

## 路径段类型

库内部将路径解析为不同类型的段（以下为内部实现细节，不作为公开 API 导出）：

| 类型 | 语法示例 | 说明 |
|------|----------|------|
| 属性访问 | `user.name` | 访问对象属性 |
| 数组索引 | `items[0]` | 访问数组元素 |
| 数组切片 | `items[1:5]` | 切片范围访问 |
| 通配符 | `items[*]` | 匹配所有元素 |
| 字段提取 | `{name,email}` | 提取多个字段 |
| 扁平化提取 | `{flat:tags}` | 提取并递归展开嵌套数组 |
| 追加操作 | `items[+]` | 向数组追加元素 |
| JSON Pointer | `/user/name` | 以 `/` 开头的 RFC 6901 语法 |

---

## 有哪些语法陷阱？

以下行为均来自库的实际实现，提前了解可以省去不少调试时间。

### 提取未命中不报错

字段提取的「未命中」是静默的——`Get` 返回 `(nil, nil)`，既无值也无错误：

```go
data := `{"user": {"id": 1}}`

json.Get(data, "user{nonexistent}") // (nil, nil) — 不报错
json.Get(data, "user{a,b}")         // (nil, nil) — 所有字段都不存在时
```

因此不能用 `err != nil` 判断提取是否命中，要检查返回值本身。多字段提取只要有一个字段存在，就返回只含命中字段的对象。

### 单字段与多字段提取的返回形状不同

| 路径 | 作用目标 | 返回 |
|------|----------|------|
| `user{name}` | 对象 | 字段值本身（裸值，不是对象） |
| `user{id,name}` | 对象 | 只含命中字段的新对象 |
| `users{name}` | 数组 | 各元素字段值组成的数组 |
| `users{id,name}` | 数组 | 各元素提取结果对象组成的数组 |

```go
data := `{"user": {"id": 1, "name": "Alice", "email": "a@ex.com"}}`

json.Get(data, "user{name}")    // "Alice"（裸值）
json.Get(data, "user{id,name}") // {"id":1,"name":"Alice"}
```

### 属性链「穿过」标量返回 nil，不报错

路径中间遇到字符串、数字等标量时，继续取属性得到 `(nil, nil)`；而**键不存在**才返回 `ErrPathNotFound`——两种「找不到」的错误形态不同：

```go
data := `{"name": "Alice"}`

json.Get(data, "name.foo")   // (nil, nil) — name 是字符串，无法继续取属性
json.Get(data, "nosuch.foo") // (nil, ErrPathNotFound) — 键 nosuch 不存在
```

但对标量使用**数组索引**（如 `name[0]` 作用于字符串）是硬错误，返回 "cannot access array index..." 描述性错误。

### 提取跳过「字段整体缺失」的元素，但保留 null 值

数组上的单字段提取中，没有该字段的元素不产生结果项；字段存在且值为 null 的元素会产生一个 null 项：

```go
data := `{"users": [{"name": "A"}, {"age": 20}, {"name": null}]}`

json.GetArray(data, "users{name}")
// ["A", null] — 无 name 字段的元素被跳过，值为 null 的保留
```

### 索引、切片、修改的越界语义各不相同

| 操作 | 越界行为 |
|------|----------|
| 索引查询 `items[10]` | 返回零值 / `(nil, nil)`，不报错 |
| 切片查询 `items[10:20]` | 自动裁剪到有效范围，返回空数组 `[]` |
| 修改 `Set(data, "items[5]", v)`（len=3） | 默认配置下数组以 `null` 填充扩展到下标 5 |

### JSON Pointer 与点号语法不能混用

路径一旦以 `/` 开头就整体进入 Pointer 模式——`"/user.name"` 会把 `user.name` 当作**一个键名**查找。反过来，这恰是访问含点号/方括号键名最省事的方式（无需反斜杠转义）：

```go
data := `{"a.b": 1, "c[0]": 2}`

json.GetInt(data, "/a.b")  // 1 — Pointer 模式下点号是键名的一部分
json.GetInt(data, "/c[0]") // 2
```

---

## 完整示例

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

	// 1. 基本访问
	title := json.GetString(data, "store.books.0.title")
	fmt.Println("First book:", title)

	// 2. 数组切片
	books := json.GetArray(data, "store.books[0:2]")
	fmt.Printf("First 2 books: %d items\n", len(books))

	// 3. 切片带步长
	prices := json.GetArray(data, "store.prices[::2]")
	fmt.Println("\nEvery other price:", prices)

	// 4. 字段提取
	extracted, err := json.Get(data, "store.books[0]{title,price}")
	if err != nil {
		panic(err)
	}
	fmt.Println("\nExtracted fields:", extracted)

	// 5. 追加元素
	updated, err := json.Set(data, "store.books[+]", map[string]any{
		"title":    "New Book",
		"price":    55,
		"category": "programming",
	})
	if err != nil {
		panic(err)
	}
	fmt.Println("\nAfter append:", json.Valid([]byte(updated)))
}
```

## 下一步

- [API 文档](../api-reference/) — 查看完整 API 参考
- [使用示例](../examples/) — 更多实战示例

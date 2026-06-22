---
title: "路径表达式语法 - CyberGo JSON | JSONPath 查询指南"
description: "CyberGo JSON 路径表达式语法指南：属性访问 user.name、数组索引 items[0]、切片、通配符、多字段提取，精确定位 Go JSON 数据中的任意节点。"
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

越界索引不会 panic。类型安全的获取函数（GetString、GetInt 等）返回零值，而 Get 函数会返回错误：

```go
data := `{"items": ["a", "b", "c"]}`

// 正索引越界 → 返回零值，不报错
json.GetString(data, "items[10]")   // ""   (空字符串)
json.GetInt(data, "items[10]")      // 0
json.Get(data, "items[10]")         // nil, ErrPathNotFound

// 负索引越界 → 同样返回零值
json.GetString(data, "items[-10]")  // ""   (空字符串)
json.GetInt(data, "items[-10]")     // 0
```

| 函数 | 越界返回值 |
|------|-----------|
| `Get` | `(nil, ErrPathNotFound)` |
| `GetString` | `""` |
| `GetInt` | `0` |
| `GetFloat` | `0.0` |
| `GetBool` | `false` |
| `GetArray` | `nil` |

::: tip 索引边界
- 正索引必须在 `[0, len)` 范围内，负索引经过转换后（`len + index`）同理
- 越界访问返回对应类型的零值，不会 panic，不会报错
- 如需判断路径是否存在，请使用 `Get` 并检查 error 是否为 `json.ErrPathNotFound`
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
extracted, _ := json.Get(data, "user{id,name}")
// 结果: {"id": 1001, "name": "Alice"}
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

updated, _ := json.Set(data, "items[+]", 4)
// 结果: {"items": [1, 2, 3, 4]}

updated, _ = json.Set(updated, "items[+]", 5)
// 结果: {"items": [1, 2, 3, 4, 5]}
```

### 通配符 `[*]`

```go
data := `{"items": [1, 2, 3]}`

updated, _ := json.Set(data, "items[*]", 0)
// 结果: {"items": [0, 0, 0]}
```

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
root, _ := json.Get(data, "")     // {"name": "test"}
root, _ = json.Get(data, ".")     // 同上
```

### 路径转义

如果键名包含特殊字符，使用转义：

```go
data := `{"user.name": "Alice"}`

// 包含点的键名
name := json.GetString(data, "user\\.name")  // "Alice"
```

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
    extracted, _ := json.Get(data, "store.books[0]{title,price}")
    fmt.Println("\nExtracted fields:", extracted)

    // 5. 追加元素
    updated, _ := json.Set(data, "store.books[+]", map[string]any{
        "title":    "New Book",
        "price":    55,
        "category": "programming",
    })
    fmt.Println("\nAfter append:", json.Valid([]byte(updated)))
}
```

## 下一步

- [API 文档](./api-reference/) — 查看完整 API 参考
- [使用示例](./examples) — 更多实战示例

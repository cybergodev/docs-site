---
title: "高级功能示例 - CyberGo JSON | 进阶用法"
description: "CyberGo JSON 高级示例：EncodeBatch 批量编码、EncodeFields 字段选择、PreParse 预解析、SafeGet 安全获取、WarmupCache 缓存预热与内存池优化，展示生产级性能技巧。"
---

# 高级功能示例

本文提供批量编码、预解析、钩子、高级配置等高级功能的完整示例。

## 批量编码

### EncodeBatch

将多个键值对快速编码为 JSON 对象：

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 从分散数据构建 JSON
    pairs := map[string]any{
        "id":      1001,
        "name":    "Alice",
        "email":   "alice@example.com",
        "active":  true,
        "tags":    []string{"admin", "user"},
        "balance": 1250.50,
    }

    // 使用 EncodeBatch 批量编码为 JSON 对象
    result, err := json.EncodeBatch(pairs)
    if err != nil {
        panic(err)
    }
    fmt.Println(result)

    // 使用 EncodeBatch 搭配 PrettyConfig 格式化输出
    pretty, err := json.EncodeBatch(pairs, json.PrettyConfig())
    if err != nil {
        panic(err)
    }
    fmt.Println(pretty)
}
```

## 选择字段编码

### EncodeFields

只编码结构体的指定字段，适合 API 响应过滤敏感信息：

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    ID       int    `json:"id"`
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
    Salt     string `json:"salt"`
}

func main() {
    user := User{
        ID:       1,
        Name:     "Alice",
        Email:    "alice@example.com",
        Password: "secret123",
        Salt:     "randomsalt",
    }

    // 只编码公开字段（排除敏感信息）
    publicFields := []string{"id", "name", "email"}
    result, err := json.EncodeFields(user, publicFields)
    if err != nil {
        panic(err)
    }
    fmt.Println(result)
    // {"id":1,"name":"Alice","email":"alice@example.com"}
}
```

## 预解析优化
### PreParse
预解析 JSON，避免重复解析，提升多次查询性能：
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 大型 JSON 数据
    largeJSON := `{
        "users": [
            {"id": 1, "name": "Alice", "email": "alice@example.com"},
            {"id": 2, "name": "Bob", "email": "bob@example.com"},
            {"id": 3, "name": "Charlie", "email": "charlie@example.com"}
        ],
        "metadata": {
            "total": 3,
            "page": 1,
            "perPage": 10
        }
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 预解析（只解析一次）
    parsed, err := p.PreParse(largeJSON)
    if err != nil {
        panic(err)
    }

    // 多次查询复用预解析结果
    total, _ := p.GetFromParsed(parsed, "metadata.total")
    page, _ := p.GetFromParsed(parsed, "metadata.page")

    // 遍历用户
    for i := 0; i < 3; i++ {
        path := fmt.Sprintf("users.%d.name", i)
        name, _ := p.GetFromParsed(parsed, path)
        fmt.Printf("User %d: %v\n", i, name)
    }

    fmt.Printf("Total: %v, Page: %v\n", total, page)
}
```

## 安全获取
### SafeGet
返回结构化结果，支持链式调用和类型转换:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "user": {
            "id": 1001,
            "name": "Alice",
            "age": 28,
            "active": true,
            "balance": 1250.50
        }
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 安全获取单个字段
    nameResult := p.SafeGet(data, "user.name")
    if nameResult.Ok() {
        name, _ := nameResult.AsString()
        fmt.Println("Name:", name)
    }

    // 安全获取并转换类型
    ageResult := p.SafeGet(data, "user.age")
    if ageResult.Ok() {
        age, _ := ageResult.AsInt()
        fmt.Println("Age:", age)
    }

    // 安全获取布尔值
    activeResult := p.SafeGet(data, "user.active")
    if activeResult.Ok() {
        active, _ := activeResult.AsBool()
        fmt.Println("Active:", active)
    }

    // 不存在的路径不会 panic
    emailResult := p.SafeGet(data, "user.email")
    fmt.Println("Email exists:", emailResult.Ok()) // false

    // 使用默认值
    email := emailResult.UnwrapOr("N/A")
    fmt.Println("Email:", email)
}
```

## 缓存预热
### WarmupCache
预热常用路径缓存，提升后续查询性能:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 大型 JSON 数据（模拟）
    largeJSON := `{
        "products": [
            {"id": 1, "name": "Product A", "price": 100},
            {"id": 2, "name": "Product B", "price": 200},
            {"id": 3, "name": "Product C", "price": 300}
        ],
        "categories": ["electronics", "books", "clothing"],
        "settings": {"currency": "USD", "taxRate": 0.1}
    }`

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 定义常用路径
    commonPaths := []string{
        "products",
        "products.0.id",
        "products.0.name",
        "products.1.id",
        "products.1.name",
        "categories",
        "settings.currency",
    }

    // 预热缓存
    result, err := p.WarmupCache(largeJSON, commonPaths)
    if err != nil {
        panic(err)
    }

    fmt.Printf("预热完成: %d/%d 成功\n", result.Successful, result.TotalPaths)
    if len(result.FailedPaths) > 0 {
        fmt.Println("失败路径:", result.FailedPaths)
    }

    // 后续查询将使用缓存
    for i := 0; i < 3; i++ {
        path := fmt.Sprintf("products.%d.name", i)
        name := p.GetString(largeJSON, path)
        fmt.Printf("Product %d: %s\n", i, name)
    }
}
```

## 批量操作
### ProcessBatch
批量执行多个操作,提升效率:
```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}`

    // 定义批量操作（ID 用于在结果中标识每条操作）
    operations := []json.BatchOperation{
        {ID: "get-name", Type: "get", Path: "users.0.name", JSONStr: data},
        {ID: "get-users", Type: "get", Path: "users", JSONStr: data},
        {ID: "set-name", Type: "set", Path: "users.0.name", Value: "Updated", JSONStr: data},
        {ID: "del-id", Type: "delete", Path: "users.0.id", JSONStr: data},
    }

    // 执行批量操作
    results, err := json.ProcessBatch(operations)
    if err != nil {
        panic(err)
    }

    // 查看结果
    for _, r := range results {
        fmt.Printf("ID: %s\n", r.ID)
        if r.Error != nil {
            fmt.Printf("  错误: %v\n", r.Error)
        } else if r.Result != nil {
            fmt.Printf("  值: %v\n", r.Result)
        }
    }
}
```

## 键值内存优化

库内部使用字符串内存池（string interning）自动优化重复键值的内存占用。无需手动管理。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 库在内部自动对重复键值使用内存池
    // 处理大量数据时，重复的字符串键值会自动复用内存
    records := make([]map[string]any, 10000)
    for i := range records {
        records[i] = map[string]any{
            "status": "active",
            "type":   "user",
            "role":   "member",
        }
    }

    // 批量编码时库内部自动优化内存
    result, _ := json.Marshal(map[string]any{
        "status": "active",
        "type":   "user",
    })

    fmt.Println("Sample:", string(result))
}
```

## 下一步
- [路径表达式语法](./path-syntax) — 完整路径语法参考
- [大文件处理](./large-files) — 流式处理指南
- [API 文档](./api-reference/) — 完整 API 参考

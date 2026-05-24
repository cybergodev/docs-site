---
title: "快速开始 - CyberGo JSON | 5分钟上手指南"
description: "CyberGo JSON 快速入门指南：安装配置、路径查询 GetString/GetInt、编解码 Marshal/Unmarshal、文件读写操作，5 分钟掌握 Go JSON 处理最佳实践，支持 JSONPath 查询和类型安全获取，100% 兼容 encoding/json 标准库。"
---

# 快速开始

本指南帮助你快速上手 `github.com/cybergodev/json` 库。

## 安装

```bash
go get github.com/cybergodev/json
```

## 基本用法

### 包级函数

库提供了一组便捷的包级函数，无需创建处理器即可使用：

#### 获取值

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "name": "CyberGo",
        "version": 1,
        "active": true,
        "price": 99.99,
        "tags": ["json", "go", "fast"],
        "meta": {"author": "dev"}
    }`

    // 通用获取
    val, err := json.Get(data, "name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // CyberGo

    // 类型安全获取
    name := json.GetString(data, "name")
    version := json.GetInt(data, "version")
    active := json.GetBool(data, "active")
    price := json.GetFloat(data, "price")
    tags := json.GetArray(data, "tags")
    meta := json.GetObject(data, "meta")

    fmt.Println(name, version, active, price)
    fmt.Println(tags)  // [json go fast]
    fmt.Println(meta)  // map[author:dev]

    // 带默认值获取
    desc := json.GetString(data, "description", "N/A")
    count := json.GetInt(data, "count", 0)
    fmt.Println(desc, count) // N/A 0
}
```

#### 嵌套路径

支持点号分隔的嵌套路径：

```go
data := `{"user": {"profile": {"name": "Alice"}}}`

name := json.GetString(data, "user.profile.name")
fmt.Println(name) // Alice
```

#### 数组索引

支持数组索引访问：

```go
data := `{"items": ["a", "b", "c"]}`

// 两种语法都支持
item0 := json.GetString(data, "items.0")   // "a"
item1 := json.GetString(data, "items.1")   // "b"
last := json.GetString(data, "items.-1")   // "c"

// 方括号语法
first := json.GetString(data, "items[0]")  // "a"
last2 := json.GetString(data, "items[-1]") // "c"

// 范围取值（返回数组）
arr := json.GetArray(data, "items[0:2]")   // ["a", "b"]
```

::: tip 更多路径语法
除了基本的属性和数组索引，还支持 **数组切片** `[1:5]`、**通配符** `[*]`、**字段提取** `{name,email}` 等高级语法。详见 [路径表达式语法](./path-syntax)。
:::

#### 设置值

```go
data := `{"name": "old"}`

// 设置新值
updated, _ := json.Set(data, "name", "new")
fmt.Println(updated) // {"name":"new"}

// 添加新字段
updated, _ = json.Set(data, "version", 1)
fmt.Println(updated) // {"name":"old","version":1}

// 逐个设置多个字段
updated, _ = json.Set(data, "name", "updated")
updated, _ = json.Set(updated, "version", 2)
updated, _ = json.Set(updated, "active", true)
```

#### 删除值

```go
data := `{"name": "test", "temp": "remove"}`

// 删除字段
updated, _ := json.Delete(data, "temp")
fmt.Println(updated) // {"name":"test"}
```

### 编码与解码

与标准库完全兼容：

```go
type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

// 编码
user := User{Name: "Alice", Age: 30}
bytes, _ := json.Marshal(user)
fmt.Println(string(bytes)) // {"name":"Alice","age":30}

// 格式化编码
pretty, _ := json.MarshalIndent(user, "", "  ")
fmt.Println(string(pretty))
// {
//   "name": "Alice",
//   "age": 30
// }

// 解码
var u User
json.Unmarshal(bytes, &u)
fmt.Println(u.Name, u.Age) // Alice 30
```

### 验证

```go
valid := `{"key": "value"}`
invalid := `{key: value}`

fmt.Println(json.Valid([]byte(valid)))   // true
fmt.Println(json.Valid([]byte(invalid))) // false
```

### 格式化

```go
compact := `{"name":"test","nested":{"key":"value"}}`

// 格式化输出
pretty, _ := json.Prettify(compact)
fmt.Println(pretty)
// {
//   "name": "test",
//   "nested": {
//     "key": "value"
//   }
// }

// 压缩输出
jsonStr := `{
  "name": "test"
}`
var buf bytes.Buffer
err := json.Compact(&buf, []byte(jsonStr))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

## 使用 Processor

对于频繁操作，建议使用 `Processor` 以获得更好的性能和缓存效果：

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 使用默认配置创建处理器
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close() // 记得关闭以释放资源

    data := `{"name": "test", "value": 42}`

    // 使用处理器操作
    name := p.GetString(data, "name")
    value := p.GetInt(data, "value")

    fmt.Println(name, value)
}
```

## 配置选项

```go
// 默认配置
cfg := json.DefaultConfig()

// 安全增强配置（处理不可信输入）
cfg = json.SecurityConfig()

// 格式化输出配置
cfg = json.PrettyConfig()

// 自定义配置
cfg := json.DefaultConfig()
cfg.MaxJSONSize = 50 * 1024 * 1024 // 50MB
cfg.EnableCache = true
cfg.CacheTTL = 5 * time.Minute

// 使用自定义配置创建处理器
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## 迭代遍历

```go
data := `{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}`

err := json.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("User %v: %s (age %d)\n", key, name, age)
})
// User 0: Alice (age 30)
// User 1: Bob (age 25)
```

## 下一步

- [路径表达式语法](./path-syntax) — 学习完整的路径查询语法
- [大文件处理](./large-files) — 处理大型 JSON 文件
- [API 文档](./api-reference/) — 查看完整 API 参考
- [使用示例](./examples) — 浏览更多实战示例

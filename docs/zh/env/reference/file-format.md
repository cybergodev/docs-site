---
title: "文件格式 - CyberGo env | .env/JSON/YAML 语法"
description: "CyberGo env 配置文件格式参考，详解 .env、JSON、YAML 的语法规则、注释方式、数据类型、UTF-8 编码与 DetectFormat 自动检测。"
---

# 文件格式

env 库支持多种配置文件格式：`.env`、JSON 和 YAML。

## .env 格式

### 基本语法

```bash
# 注释
KEY=value

# 等号在值中
URL=https://example.com?foo=bar

# 空行被忽略

# 无效：键不能有空格
# MY KEY=value
```

### 引号

```bash
# 双引号：保留空格，支持转义
MESSAGE="Hello World"
PATH="/usr/local/bin"

# 单引号：原样保留，不转义
LITERAL='no ${expansion} here'

# 无引号
SIMPLE=value

# 空值
EMPTY=
EMPTY=""
EMPTY=''
```

### 转义字符

在双引号中支持转义：

```bash
# 换行
MULTILINE="line1\nline2"

# 制表符
TABBED="col1\tcol2"

# 引号
QUOTED="He said \"Hello\""

# 反斜杠
PATH="C:\\Users\\name"

# 美元符号
PRICE="Price: \$100"
```

### 变量展开

启用 `ExpandVariables` 后支持：

```bash
# 引用其他变量
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# 简单语法
URL=$BASE_URL/path

# 默认值
HOST=${HOST:-localhost}
PORT=${PORT:-8080}

# 嵌套展开
SERVICE=${CLUSTER:-default}-${REGION:-us-east}
```

### export 语法

启用 `AllowExportPrefix` 后支持：

```bash
# Bash 风格导出
export KEY=value
export ANOTHER="quoted value"
```

### YAML 风格

启用 `AllowYamlSyntax` 后支持：

```bash
# YAML 风格键值对
KEY: value
ANOTHER: "quoted value"
```

### 多行值

```bash
# 双引号内换行
PRIVATE_KEY="-----BEGIN KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END KEY-----"

# 使用 \n 转义
LINES="line1\nline2\nline3"
```

## JSON 格式

### 基本结构

```json
{
    "APP_NAME": "my-app",
    "APP_VERSION": "1.0.0",
    "DEBUG": true,
    "PORT": 8080
}
```

### 嵌套对象

嵌套对象会被扁平化：

```json
{
    "database": {
        "host": "localhost",
        "port": 5432
    }
}
```

结果：

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

### 数组

数组被扁平化为索引键：

```json
{
    "ALLOWED_HOSTS": ["localhost", "example.com"],
    "PORTS": [80, 443, 8080]
}
```

结果：

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
PORTS_0=80
PORTS_1=443
PORTS_2=8080
```

::: tip 访问数组元素
使用 `GetSlice[T]` 函数或点号路径访问索引键：
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
详见 [GetSlice 文档](/zh/env/api-reference/functions#getslice-t)。
:::

### 类型转换选项

```go
cfg := env.DefaultConfig()

// null 转为空字符串
cfg.JSONNullAsEmpty = true

// 数字转为字符串
cfg.JSONNumberAsString = true

// 布尔值转为字符串
cfg.JSONBoolAsString = true
```

### 深度限制

```go
cfg.JSONMaxDepth = 10  // 最大嵌套深度
```

## YAML 格式

### 基本结构

```yaml
APP_NAME: my-app
APP_VERSION: "1.0.0"
DEBUG: true
PORT: 8080
```

### 嵌套结构

```yaml
database:
  host: localhost
  port: 5432
  credentials:
    user: admin
    password: secret
```

扁平化结果：

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_CREDENTIALS_USER=admin
DATABASE_CREDENTIALS_PASSWORD=secret
```

### 列表

列表被扁平化为索引键：

```yaml
allowed_hosts:
  - localhost
  - example.com
  - api.example.com
```

结果：

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
ALLOWED_HOSTS_2=api.example.com
```

### 多行字符串

```yaml
# 字面量块（保留换行）
description: |
  Line 1
  Line 2
  Line 3

# 折叠块（换行变空格）
summary: >
  This is a long
  summary that will
  be on one line.
```

### 类型转换选项

```go
cfg := env.DefaultConfig()

cfg.YAMLNullAsEmpty = true
cfg.YAMLNumberAsString = true
cfg.YAMLBoolAsString = true
cfg.YAMLMaxDepth = 10
```

## 格式检测

### 自动检测

```go
// 根据扩展名检测
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv

// 无匹配扩展名时返回 FormatAuto（默认使用 .env 解析器）
format = env.DetectFormat("config")  // FormatAuto
```

### 格式常量

```go
const (
    FormatAuto  FileFormat = iota  // 自动检测
    FormatEnv                      // .env 格式
    FormatJSON                     // JSON 格式
    FormatYAML                     // YAML 格式
)
```

### 格式字符串

```go
format := env.FormatJSON
fmt.Println(format.String())  // 输出: json
```

## 最佳实践

### 选择格式

| 场景 | 推荐格式 |
|------|----------|
| 简单配置 | `.env` |
| 复杂嵌套配置 | JSON 或 YAML |
| 与其他工具共享 | JSON |
| 人类可读优先 | YAML |
| Docker/K8s 环境 | `.env` |

### 文件命名

```bash
.env              # 默认配置
.env.local        # 本地覆盖（不提交）
.env.development  # 开发环境
.env.staging      # 预发布环境
.env.production   # 生产环境
.env.test         # 测试环境
```

### 混合使用

```go
// 可以混合使用不同格式
loader.LoadFiles(
    "base.env",           // 基础配置
    "database.json",      // 数据库配置
    "secrets.yaml",       // 敏感配置
    ".env.local",         // 本地覆盖
)
```

### Git 忽略

```bash
# 忽略敏感配置
.env.local
.env.*.local
.env.production
secrets.yaml

# 保留模板
!.env.example
```

## 相关文档

- [多格式配置](/zh/env/guides/multi-format) - 多格式加载指南
- [ComponentFactory API](/zh/env/api-reference/factory) - DetectFormat 函数参考
- [Config API](/zh/env/api-reference/config) - JSON/YAML 解析选项

---
sidebar_label: "文件格式"
title: "文件格式 - CyberGo env | .env/JSON/YAML 语法"
description: "CyberGo env 配置文件格式参考，详解 .env、JSON、YAML 三种格式的语法规则、引号与 export 前缀、变量展开 ${VAR}、多行字符串、嵌套对象与数组扁平化、DetectFormat 自动检测机制。"
sidebar_position: 1
---

# 文件格式

env 库支持三种配置文件格式：`.env`、JSON 和 YAML。三种格式最终都解析成扁平的 `KEY=value` 键值对，差别在语法与嵌套结构的处理方式。

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

# 单引号：不处理转义（原样保留反斜杠序列），值内变量也不展开
LITERAL='no escaping here: \n stays literal'
# 上例的 LITERAL 就是字面文本；写 '${HOME}' 也不会被展开

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

`ExpandVariables` 默认开启（`DefaultConfig` 为 `true`，可用 `cfg.ExpandVariables = false` 关闭），支持：

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

`AllowExportPrefix` 默认开启（`true`），支持：

```bash
# Bash 风格导出
export KEY=value
export ANOTHER="quoted value"
```

### YAML 风格

`.env` 行解析器默认只把 `=` 当作分隔符。`AllowYamlSyntax` 为 `false`（`DefaultConfig` 的默认值）时，`KEY: value` 这类行找不到分隔符，整行被跳过；启用审计时，每条被跳过的行记一条审计事件，行内容先经掩码处理。

```bash
# 默认（AllowYamlSyntax = false）：这行没有 '='，整行被跳过
KEY: value
```

把 `AllowYamlSyntax` 设为 `true` 后，`:` 才作分隔符，同时值的解析切换到 YAML 标量语义：`null`/`~` 视为空字符串，YAML 布尔与数字字面量按其规则识别。`DevelopmentConfig()` 已将该开关设为 `true`，`DefaultConfig()` 与 `ProductionConfig()` 保持 `false`。

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true
```

```bash
# AllowYamlSyntax = true 时：冒号分隔生效
KEY: value
ANOTHER: "quoted value"
```

### 多行值

`.env` 解析器按行扫描，每行独立解析，**不支持跨多行的引号字符串**：双引号值必须在一行内闭合，否则报 `ErrInvalidValue`。需要换行时用 `\n` 转义（仅在双引号中有效，单引号不处理转义）：

```bash
# 双引号内的 \n 会被解析为换行符
LINES="line1\nline2\nline3"
# 实际值为三行文本：line1 / line2 / line3

# PRIVATE_KEY 等多行证书用 \n 拼接
PRIVATE_KEY="-----BEGIN KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END KEY-----"
```

需要真正的跨行字符串时，改用 [JSON 或 YAML 格式](#格式检测)，或通过自定义解析器扩展多行支持。

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
用 `GetSlice[T]` 或点号路径读取索引键：
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
完整规则见 [GetSlice 文档](../api-reference/functions#getslice-t)。
:::

### 类型转换选项

`JSONNullAsEmpty` / `JSONNumberAsString` / `JSONBoolAsString` 在 `DefaultConfig` 中**默认均为 `true`**，无需逐项手动赋值；只有需要关闭对应转换时才显式设为 `false`：

```go
cfg := env.DefaultConfig()

// 例：关闭「数字转字符串」，让 JSON 数字保留原始类型语义
cfg.JSONNumberAsString = false
```

### 深度限制

```go
cfg.JSONMaxDepth = 10  // 最大嵌套深度（默认 16）
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

::: warning 注意
YAML 块标量（字面量块 `|` 与折叠块 `>`）**当前不支持**。解析器把 `|`/`>` 当作普通标量字符存储，后续缩进行会破坏键值解析。
:::

需要保留换行的值，改用双引号加 `\n` 转义：

```yaml
description: "Line1\nLine2\nLine3"
```

或通过自定义解析器扩展块标量支持。

### 类型转换选项

`YAMLNullAsEmpty` / `YAMLNumberAsString` / `YAMLBoolAsString` 同样**默认均为 `true`**，需要关闭时显式设为 `false`；`YAMLMaxDepth` 默认 16，仅在嵌套更深时调整：

```go
cfg := env.DefaultConfig()

// 例：关闭「布尔值转字符串」
cfg.YAMLBoolAsString = false

// 例：放宽嵌套深度
cfg.YAMLMaxDepth = 20
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
fmt.Println(format.String())  // 输出：json
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

- [多格式配置](../guides/multi-format) - 多格式加载指南
- [ComponentFactory API](../api-reference/factory) - DetectFormat 函数参考
- [Config API](../api-reference/config) - JSON/YAML 解析选项

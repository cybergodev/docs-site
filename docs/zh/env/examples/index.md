---
sidebar_label: "示例概览"
title: "示例 - CyberGo env | Go 配置库可运行示例合集"
description: "CyberGo env 官方示例导览：覆盖快速上手、Loader 配置预设、全类型读取、结构体映射、SecureValue 敏感值保护、审计日志、多格式互转、并发访问与可扩展性等 13 个可运行 Go 示例，附 go run 运行说明。"
sidebar_position: 1
---

# 示例

env 库在源码仓库的 `examples/` 目录下提供 13 个可运行示例。每个示例都是独立完整的 `main` 程序，覆盖从全局模式快速上手到安全特性与高级特性的完整路径。所有示例都参与常规构建（`go build ./...`）。

## 运行方式

克隆源码仓库 [github.com/cybergodev/env](https://github.com/cybergodev/env) 后，在**项目根目录**执行 `go run`：

```bash
git clone https://github.com/cybergodev/env.git
cd env
go run ./examples/01_quickstart/
```

示例以 `examples/data/` 下的相对路径读取共享配置文件，因此必须在项目根目录执行 `go run`，在子目录运行会因路径无法解析而失败。

### 共享数据文件

| 文件 | 格式 | 用途 |
|------|------|------|
| `config.env` | dotenv | 扁平 KEY=value 键值对，含变量展开演示 |
| `config.json` | JSON | 嵌套结构（app/db/cache/features） |
| `config.yaml` | YAML | 与 JSON 同构，供结构体映射示例使用 |

## 示例索引

| 编号 | 目录 | 演示内容 | 相关文档 |
|------|------|----------|----------|
| 01 | `01_quickstart/` | 全局模式基础：`Load` 初始化、`GetString`/`GetInt`/`GetBool`/`GetDuration` 类型化读取、`Lookup` 存在性检查、`Set` 运行时写入 | [快速开始](../getting-started/) |
| 02 | `02_loader_config/` | 实例模式与四套配置预设（Default/Development/Production/Testing）、自定义配置、显式生命周期控制 | [Config](../api-reference/config)、[Loader](../api-reference/loader) |
| 03 | `03_type_access/` | 全部类型化读取方法：string、int、bool、duration、float、uint、slice 与 `Lookup`，含点号路径访问 | [快速开始](../getting-started/) |
| 04 | `04_struct_mapping/` | `env` 标签结构体映射：嵌套结构体、`envDefault` 默认值与序列化 | [结构体映射](../guides/struct-mapping) |
| 05 | `05_secure_values/` | `SecureValue` 生命周期：`Close` 与 `Release` 的区别、内存清零与 mlock 内存锁定 | [内存锁定](../security/memory-locking)、[SecureValue](../api-reference/secure-value) |
| 06 | `06_audit_logging/` | JSON、Channel、Log 三种审计处理器，自动记录读取、写入与删除事件 | [审计日志](../guides/audit-logging) |
| 07 | `07_marshal_unmarshal/` | 格式转换：map 与字符串互转、结构体与 map 互转、多格式输出与往返转换 | [序列化](../guides/serialization) |
| 08 | `08_utilities/` | 工具函数：内省（`Len`/`Keys`/`All`）、键删除、脱敏与格式检测 | [多格式配置](../guides/multi-format) |
| 09 | `09_error_handling/` | 哨兵错误（`errors.Is`）与类型化错误（`errors.As`），覆盖文件缺失与加载器已关闭场景 | [错误处理](../guides/error-handling) |
| 10 | `10_concurrency/` | 并发读、并发写与读写混合访问，演示分片锁保证的并发安全 | [并发访问](../guides/concurrency) |
| 11 | `11_advanced/` | 变量展开（`$VAR` 与 `${VAR}`）、多文件加载覆盖、前缀过滤 | [变量展开](../guides/variable-expansion) |
| 12 | `12_extensibility/` | 自定义解析器注册 `RegisterParser`、接口式消费 `EnvGetter`（依赖注入与测试替身）、自定义组件（`CustomAuditor` 审计计数） | [自定义解析器](../guides/custom-parser)、[接口定义](../api-reference/interfaces) |
| 13 | `13_customization/` | 自定义 Validator/Expander/FileSystem、fail-closed 审计（`ErrAuditFailed`）、自定义 Marshaler/Unmarshaler、花括号运算符 | [接口定义](../api-reference/interfaces)、[审计日志](../guides/audit-logging)、[序列化](../guides/serialization) |

## 阅读顺序

推荐按编号顺序阅读。01–03 覆盖全局与实例两种使用模式和类型化读取；04–07 进入结构体映射、敏感值保护、审计等生产特性；08–13 进阶到工具函数、错误处理、高级特性与可扩展性。每个示例都能直接 `go run` 验证，与上方对应文档页面配合阅读。
